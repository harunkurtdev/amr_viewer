/**
 * Nav2OverlayManager - draws and edits the Nav2 footprint and Collision Monitor
 * polygons directly in the 3D scene, anchored to the robot's base frame.
 *
 * The overlay group is parented to the selected base link's Three.js object, so
 * all 2D points are expressed in that link's frame (x forward, y left, z up) -
 * exactly the frame Nav2 uses for footprints and collision polygons. Vertices
 * can be dragged on the ground plane; new vertices added in "draw" mode.
 */
import * as THREE from 'three';
import { ACTION_COLORS, driveKind } from './Nav2ConfigModel.js';
import { URDFAdapter } from '../adapters/URDFAdapter.js';

const PREVIEW_COLOR = 0x32ade6;

const Z = 0.02;            // small lift above the base frame plane to avoid z-fighting
const HANDLE_RADIUS = 0.035;
const FOOTPRINT_COLOR = 0x30d158;

export class Nav2OverlayManager {
    constructor(sceneManager, config) {
        this.sceneManager = sceneManager;
        this.config = config;
        this.model = null;

        this.group = new THREE.Group();
        this.group.name = 'nav2-overlay';
        this.group.renderOrder = 999;

        // Interaction state
        this.editMode = false;      // show & allow dragging vertices of the active target
        this.drawMode = false;      // clicking the ground appends a vertex to the active target
        this.activeTarget = null;   // { type:'footprint' } | { type:'polygon', id }
        this._dragging = null;      // { pointIndex }
        this._handles = [];

        this.onChange = null;       // called after the user edits geometry (panel can refresh)

        this._raycaster = new THREE.Raycaster();
        this._ndc = new THREE.Vector2();

        // Math plane (base-frame z=0) used to convert pointer rays into x/y.
        // A real mesh is deliberately avoided: it must never be part of the
        // model hierarchy (it would inflate the bounding box and be picked up
        // as a visual mesh, producing a giant white plane / "white world").
        this._plane = new THREE.Plane();
        this._planeNormal = new THREE.Vector3();
        this._planePoint = new THREE.Vector3();

        this._bound = false;
        this._scale = 1; // updated from model size to keep handles a sensible size
    }

    /** Attach overlay to a freshly loaded model and pick a sensible base frame. */
    attachToModel(model) {
        this.model = model;
        // Choose a default base frame if the current one is not present.
        if (model && model.links) {
            const names = Array.from(model.links.keys());
            if (!names.includes(this.config.baseFrame)) {
                const preferred = names.find(n => n === 'base_link')
                    || names.find(n => n === 'base_footprint')
                    || model.rootLink
                    || names[0];
                if (preferred) this.config.baseFrame = preferred;
            }
            // Scale handles relative to model size.
            this._scale = this._estimateScale(model);
        }
        this._reparent();
        this.bindPointer();
        this.refresh();
    }

    detach() {
        if (this.group.parent) this.group.parent.remove(this.group);
        this.model = null;
    }

    _estimateScale(model) {
        try {
            const box = new THREE.Box3().setFromObject(model.threeObject);
            const size = box.getSize(new THREE.Vector3());
            const s = Math.max(size.x, size.y, size.z);
            return s > 0 ? Math.min(Math.max(s / 3, 0.5), 5) : 1;
        } catch (e) {
            return 1;
        }
    }

    /**
     * Place the overlay at the selected base link's pose.
     *
     * The overlay is parented to the coordinate-system wrapper (world) or the
     * scene - NEVER to the model's own object tree - so it can't affect the
     * model bounding box or be mistaken for a robot mesh. We then position the
     * group at the base link's pose, computed from world matrices so it works
     * regardless of any Z-up wrapper or single-mesh layout.
     */
    _reparent() {
        const parent = this.sceneManager.world || this.sceneManager.scene;
        if (this.group.parent !== parent) {
            if (this.group.parent) this.group.parent.remove(this.group);
            if (parent) parent.add(this.group);
        }

        const o = this.config.baseOffset || { x: 0, y: 0, yaw: 0 };
        const offset = new THREE.Matrix4()
            .makeRotationZ(o.yaw || 0)
            .setPosition(o.x || 0, o.y || 0, 0);

        const link = this.model && this.model.links
            ? this.model.links.get(this.config.baseFrame) : null;

        if (parent && link && link.threeObject) {
            parent.updateWorldMatrix(true, false);
            link.threeObject.updateWorldMatrix(true, false);
            // group = parent^-1 * linkWorld * offset  (base link pose in parent frame)
            const rel = new THREE.Matrix4()
                .copy(parent.matrixWorld).invert()
                .multiply(link.threeObject.matrixWorld)
                .multiply(offset);
            rel.decompose(this.group.position, this.group.quaternion, this.group.scale);
        } else {
            offset.decompose(this.group.position, this.group.quaternion, this.group.scale);
        }
    }

    /**
     * Rotate the robot's selected steering joints to the given angle (rad) so the
     * wheels visibly turn with the steering-angle control. Uses the URDF joint
     * setter (works for URDF/Xacro); silently ignores joints without a setter.
     */
    applySteering(angle) {
        if (!this.model || !this.model.joints) return;
        const names = this.config.controller.steeringJoints || [];
        let changed = false;
        for (const n of names) {
            const j = this.model.joints.get(n);
            if (j) { URDFAdapter.setJointAngle(j, angle, true); changed = true; }
        }
        if (changed) this.sceneManager.redraw();
    }

    setBaseFrame(name) {
        this.config.baseFrame = name;
        this._reparent();
        this.refresh();
    }

    updateBaseOffset() {
        this._reparent();
        this.refresh();
    }

    setActiveTarget(target) {
        this.activeTarget = target;
        this.refresh();
    }

    setEditMode(on) {
        this.editMode = on;
        if (!on) this.drawMode = false;
        this.refresh();
    }

    setDrawMode(on) {
        this.drawMode = on;
        if (on) this.editMode = true;
        this.refresh();
    }

    // ==================== rendering ====================

    refresh() {
        // Clear previous content (dispose geometries/materials).
        this._disposeChildren();
        this._handles = [];

        // Footprint
        this._drawFootprint();

        // Collision polygons
        for (const poly of this.config.polygons) {
            if (!poly.enabled) continue;
            const isActive = this.activeTarget && this.activeTarget.type === 'polygon' && this.activeTarget.id === poly.id;
            this._drawPolygon(poly, isActive);
        }

        // Costmap-filter zones (keepout / speed)
        for (const zone of this.config.zones) {
            if (!zone.enabled) continue;
            const isActive = this.activeTarget && this.activeTarget.type === 'zone' && this.activeTarget.id === zone.id;
            const color = zone.type === 'speed' ? 0xff9f0a : 0xff453a;
            this._addPolyline(zone.points, color, 0.16, true);
            if (isActive && this.editMode) this._addHandles(zone.points, color);
        }

        // Trajectory ("where it will go") preview
        this._drawPathPreview();

        this.sceneManager.redraw();
    }

    /**
     * Draw the predicted path the robot base would follow for the current drive
     * model + steering angle, and sweep the footprint along it (ghost outlines)
     * so the user sees the corridor the body will occupy.
     */
    _drawPathPreview() {
        const c = this.config.controller;
        if (!c || !c.previewEnabled) return;

        const poses = this._previewPoses(c);
        if (poses.length < 2) return;

        // Center-line path.
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(poses.map(p => new THREE.Vector3(p.x, p.y, Z))),
            new THREE.LineBasicMaterial({ color: PREVIEW_COLOR })
        );
        line.renderOrder = 1000;
        line.raycast = () => {};
        this.group.add(line);

        // Ghost footprints swept along the path.
        const outline = this._footprintOutline();
        if (outline.length >= 2) {
            const N = poses.length;
            const step = Math.max(1, Math.floor(N / 8)); // ~8 ghosts
            for (let i = 0; i < N; i += step) {
                const pose = poses[i];
                const cos = Math.cos(pose.h), sin = Math.sin(pose.h);
                const pts = outline.map(([px, py]) => new THREE.Vector3(
                    pose.x + px * cos - py * sin,
                    pose.y + px * sin + py * cos,
                    Z
                ));
                pts.push(pts[0].clone());
                const ghost = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(pts),
                    new THREE.LineBasicMaterial({ color: PREVIEW_COLOR, transparent: true, opacity: 0.28 })
                );
                ghost.renderOrder = 999;
                ghost.raycast = () => {};
                this.group.add(ghost);
            }
        }
    }

    /** Footprint outline as [x,y] points (polygon points, or a sampled circle). */
    _footprintOutline() {
        const fp = this.config.footprint;
        if (fp.mode === 'polygon') return fp.points.map(p => [p[0], p[1]]);
        const r = fp.radius || 0.3;
        const pts = [];
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return pts;
    }

    // ==================== trajectory simulation ====================

    /**
     * Animate the robot (and its footprint) along the predicted path. Total time
     * is path length / cruise speed. Calls onProgress(elapsed, total, frac) each
     * frame and onDone() at the end.
     */
    startSim(onProgress, onDone) {
        if (!this.model || !this.model.threeObject) return false;
        this.stopSim();
        const c = this.config.controller;
        const poses = this._previewPoses(c);
        if (poses.length < 2) return false;
        const speed = Math.max(0.01, c.desiredLinearVel || c.maxVelX || 0.5);
        const total = Math.max(0.1, (c.previewDistance || 2) / speed);

        this.group.updateMatrix();
        const G = this.group.matrix.clone();
        const Ginv = G.clone().invert();
        const root = this.model.threeObject;
        root.updateMatrix();
        const R0 = root.matrix.clone();

        root.matrixAutoUpdate = false;

        const startT = (typeof performance !== 'undefined' ? performance.now() : 0);
        const P = new THREE.Matrix4();
        const sim = { raf: null, root, G, Ginv, R0 };
        this._sim = sim;

        const tick = () => {
            if (this._sim !== sim) return;
            const now = (typeof performance !== 'undefined' ? performance.now() : startT);
            const elapsed = (now - startT) / 1000;
            const frac = Math.min(1, elapsed / total);
            const idx = Math.min(poses.length - 1, Math.floor(frac * (poses.length - 1)));
            const pose = poses[idx];

            P.makeRotationZ(pose.h).setPosition(pose.x, pose.y, 0);
            // robot root = G * P * G^-1 * R0  (drive the base along the path).
            // The footprint/path overlay stays fixed so the robot drives through
            // its planned corridor.
            root.matrix.copy(G).multiply(P).multiply(Ginv).multiply(R0);
            root.matrixWorldNeedsUpdate = true;

            this.sceneManager.redraw();
            onProgress && onProgress(Math.min(elapsed, total), total, frac);

            if (frac >= 1) { this.stopSim(); onDone && onDone(); return; }
            sim.raf = requestAnimationFrame(tick);
        };
        sim.raf = requestAnimationFrame(tick);
        return true;
    }

    isSimulating() { return !!this._sim; }

    /** Stop playback and restore the robot/footprint to their start pose. */
    stopSim() {
        const sim = this._sim;
        if (!sim) return;
        if (sim.raf) cancelAnimationFrame(sim.raf);
        this._sim = null;
        sim.root.matrix.copy(sim.R0);
        sim.root.matrixAutoUpdate = true;
        sim.root.matrixWorldNeedsUpdate = true;
        this.sceneManager.redraw();
    }

    /** Sample base-frame poses {x,y,h} along the predicted trajectory. */
    _previewPoses(c) {
        const D = Math.max(0.1, c.previewDistance || 2);
        const steer = c.previewSteerAngle || 0;
        const kind = driveKind(c.driveType);
        const N = 40;
        const poses = [];

        if (kind === 'car' && Math.abs(steer) > 1e-3) {
            const L = Math.max(0.05, c.wheelbase || 0.5);
            let R = L / Math.tan(steer); // signed turning radius
            if (c.minTurningRadius > 0 && Math.abs(R) < c.minTurningRadius) {
                R = Math.sign(R) * c.minTurningRadius;
            }
            for (let i = 0; i <= N; i++) {
                const s = (i / N) * D;
                const a = s / R;
                poses.push({ x: R * Math.sin(a), y: R * (1 - Math.cos(a)), h: a });
            }
        } else {
            // Differential / holonomic / zero-steer: straight ahead.
            for (let i = 0; i <= N; i++) {
                const s = (i / N) * D;
                poses.push({ x: s, y: 0, h: 0 });
            }
        }
        return poses;
    }

    _drawFootprint() {
        const fp = this.config.footprint;
        const isActive = this.activeTarget && this.activeTarget.type === 'footprint';
        if (fp.mode === 'radius') {
            this._addCircle(fp.radius, FOOTPRINT_COLOR, 0.12);
        } else {
            this._addPolyline(fp.points, FOOTPRINT_COLOR, 0.12, true);
            if (isActive && this.editMode) this._addHandles(fp.points, FOOTPRINT_COLOR);
        }
    }

    _drawPolygon(poly, isActive) {
        const color = ACTION_COLORS[poly.action_type] ?? 0xffffff;
        if (poly.shape === 'circle') {
            this._addCircle(poly.radius, color, 0.18);
        } else {
            this._addPolyline(poly.points, color, 0.18, true);
            if (isActive && this.editMode) this._addHandles(poly.points, color);
        }
    }

    _addPolyline(points, color, fillOpacity, closed) {
        if (!points || points.length < 2) return;
        const verts = points.map(p => new THREE.Vector3(p[0], p[1], Z));
        if (closed) verts.push(verts[0].clone());

        const lineGeo = new THREE.BufferGeometry().setFromPoints(verts);
        const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 1000;
        this.group.add(line);

        // Translucent fill
        if (closed && points.length >= 3) {
            const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])));
            const fillGeo = new THREE.ShapeGeometry(shape);
            fillGeo.translate(0, 0, Z * 0.5);
            const fillMat = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: fillOpacity, side: THREE.DoubleSide, depthWrite: false
            });
            const fill = new THREE.Mesh(fillGeo, fillMat);
            fill.renderOrder = 999;
            fill.raycast = () => {};
            this.group.add(fill);
        }
    }

    _addCircle(radius, color, fillOpacity) {
        if (!(radius > 0)) return;
        const segments = 64;
        const verts = [];
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            verts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, Z));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(verts);
        const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color }));
        line.renderOrder = 1000;
        this.group.add(line);

        const fillGeo = new THREE.CircleGeometry(radius, segments);
        fillGeo.translate(0, 0, Z * 0.5);
        const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: fillOpacity, side: THREE.DoubleSide, depthWrite: false
        }));
        fill.renderOrder = 999;
        fill.raycast = () => {};
        this.group.add(fill);
    }

    _addHandles(points, color) {
        const r = HANDLE_RADIUS * this._scale;
        // Vertex handles (white) — drag to move, right-click to delete.
        points.forEach((p, idx) => {
            const geo = new THREE.SphereGeometry(r, 16, 12);
            const handle = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            handle.position.set(p[0], p[1], Z);
            handle.userData.nav2Handle = true;
            handle.userData.pointIndex = idx;
            handle.renderOrder = 1001;
            this.group.add(handle);
            this._handles.push(handle);
        });
        // Midpoint handles (blue) — click to insert a new vertex between two points.
        if (points.length >= 2) {
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                const geo = new THREE.SphereGeometry(r * 0.6, 12, 8);
                const handle = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a84ff }));
                handle.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Z);
                handle.userData.nav2Handle = true;
                handle.userData.insertAt = i + 1;
                handle.renderOrder = 1001;
                this.group.add(handle);
                this._handles.push(handle);
            }
        }
    }

    _disposeChildren() {
        const toRemove = this.group.children.slice();
        toRemove.forEach(child => {
            this.group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    }

    // ==================== pointer interaction ====================

    bindPointer() {
        if (this._bound) return;
        const canvas = this.sceneManager.canvas;
        if (!canvas) return;
        this._onDown = (e) => this._handleDown(e);
        this._onMove = (e) => this._handleMove(e);
        this._onUp = (e) => this._handleUp(e);
        this._onContext = (e) => this._handleContext(e);
        canvas.addEventListener('pointerdown', this._onDown, true);
        window.addEventListener('pointermove', this._onMove, true);
        window.addEventListener('pointerup', this._onUp, true);
        canvas.addEventListener('contextmenu', this._onContext, true);
        this._bound = true;
    }

    _setNdc(event) {
        const canvas = this.sceneManager.canvas;
        const rect = canvas.getBoundingClientRect();
        this._ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._ndc, this.sceneManager.camera);
    }

    _activePoints() {
        if (!this.activeTarget) return null;
        if (this.activeTarget.type === 'footprint') {
            return this.config.footprint.mode === 'polygon' ? this.config.footprint.points : null;
        }
        if (this.activeTarget.type === 'zone') {
            const zone = this.config.getZone(this.activeTarget.id);
            return zone ? zone.points : null;
        }
        const poly = this.config.getPolygon(this.activeTarget.id);
        return poly && poly.shape === 'polygon' ? poly.points : null;
    }

    _handleDown(event) {
        if (!this.editMode || event.button !== 0) return;
        this._setNdc(event);

        // 1) Try to grab a handle.
        const hits = this._raycaster.intersectObjects(this._handles, false);
        if (hits.length > 0) {
            const ud = hits[0].object.userData;
            if (ud.insertAt !== undefined) {
                // Midpoint handle: insert a new vertex between the two points.
                const points = this._activePoints();
                if (points) {
                    const a = points[ud.insertAt - 1];
                    const b = points[ud.insertAt % points.length];
                    points.splice(ud.insertAt, 0, [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)]);
                    this.refresh();
                    this.onChange?.();
                }
            } else {
                this._dragging = { pointIndex: ud.pointIndex };
                this.sceneManager.controls.enabled = false;
            }
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        // 2) In draw mode, append a vertex where the ray meets the base plane.
        if (this.drawMode) {
            const local = this._pickLocal();
            const points = this._activePoints();
            if (local && points) {
                points.push([round(local.x), round(local.y)]);
                this.refresh();
                this.onChange?.();
                event.stopPropagation();
                event.preventDefault();
            }
        }
    }

    _handleMove(event) {
        if (!this._dragging) return;
        this._setNdc(event);
        const local = this._pickLocal();
        if (!local) return;
        const points = this._activePoints();
        if (points && points[this._dragging.pointIndex]) {
            points[this._dragging.pointIndex] = [round(local.x), round(local.y)];
            this.refresh();
            this.onChange?.();
        }
    }

    _handleUp() {
        if (this._dragging) {
            this._dragging = null;
            this.sceneManager.controls.enabled = true;
        }
    }

    _handleContext(event) {
        if (!this.editMode) return;
        this._setNdc(event);
        const hits = this._raycaster.intersectObjects(this._handles, false);
        if (hits.length > 0) {
            const idx = hits[0].object.userData.pointIndex;
            if (idx !== undefined) { // only vertex handles are deletable
                const points = this._activePoints();
                if (points && points.length > 3) {
                    points.splice(idx, 1);
                    this.refresh();
                    this.onChange?.();
                }
            }
            event.stopPropagation();
            event.preventDefault();
        }
    }

    /** Intersect the base-frame z=0 plane and return the point in group-local coords. */
    _pickLocal() {
        this.group.updateWorldMatrix(true, false);
        // Build the plane in world space from the group's z=0 plane.
        this._planeNormal.set(0, 0, 1).transformDirection(this.group.matrixWorld).normalize();
        this._planePoint.setFromMatrixPosition(this.group.matrixWorld);
        this._plane.setFromNormalAndCoplanarPoint(this._planeNormal, this._planePoint);

        const hit = new THREE.Vector3();
        if (!this._raycaster.ray.intersectPlane(this._plane, hit)) return null;
        return this.group.worldToLocal(hit);
    }
}

function round(v) {
    return Math.round(v * 1000) / 1000;
}
