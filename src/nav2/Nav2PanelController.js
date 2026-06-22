/**
 * Nav2PanelController - builds and drives the Nav2 editor panel.
 *
 * Sections: Base Frame, Footprint, Collision Polygons, Costmap, Export.
 * Edits flow into the shared Nav2ConfigModel and are reflected by the
 * Nav2OverlayManager in the 3D scene. Vertex geometry is edited visually on the
 * canvas (Edit / Draw modes) rather than via numeric inputs, so re-renders never
 * steal input focus.
 */
import { ACTION_TYPES, DRIVE_TYPES, CONTROLLER_PLUGINS, driveKind } from './Nav2ConfigModel.js';
import { Nav2Exporter } from './Nav2Exporter.js';
import { computeFootprint, computeOutline, footprintRadius, expandFootprint } from './RobotAnalyzer.js';

const t = (key, fallback) => (window.i18n?.t(key)) || fallback || key;

export class Nav2PanelController {
    constructor(config, overlay) {
        this.config = config;
        this.overlay = overlay;
        this.container = document.getElementById('nav2-panel-content');
        this.model = null;
        this.selectedId = null;

        this._injectStyles();

        // When the user drags/adds/removes a vertex on the canvas, keep the
        // points-count label in sync without a full re-render.
        this.overlay.onChange = () => this._syncPointsInfo();
    }

    setModel(model) {
        this.model = model;
        // Default-select first polygon if any.
        if (!this.selectedId && this.config.polygons.length) {
            this.selectedId = this.config.polygons[0].id;
        }
        this.render();
    }

    /** Re-translate labels (called on language change). */
    relocalize() {
        this.render();
    }

    // ==================== rendering ====================

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.container.appendChild(this._baseFrameSection());
        this.container.appendChild(this._controllerSection());
        this.container.appendChild(this._footprintSection());
        this.container.appendChild(this._polygonsSection());
        this.container.appendChild(this._zonesSection());
        this.container.appendChild(this._costmapSection());
        this.container.appendChild(this._exportSection());
    }

    _section(titleKey, titleFallback) {
        const sec = el('div', 'nav2-section');
        const h = el('div', 'nav2-section-title');
        h.textContent = t(titleKey, titleFallback);
        sec.appendChild(h);
        return sec;
    }

    _row(labelText, control) {
        const row = el('label', 'nav2-row');
        const span = el('span', 'nav2-label');
        span.textContent = labelText;
        row.appendChild(span);
        row.appendChild(control);
        return row;
    }

    // ---------- Base frame ----------
    _baseFrameSection() {
        const sec = this._section('nav2BaseFrame', 'Base Frame');

        const select = el('select', 'nav2-input');
        const names = this.model && this.model.links ? Array.from(this.model.links.keys()) : [];
        if (names.length === 0) names.push(this.config.baseFrame);
        names.forEach(n => {
            const opt = el('option');
            opt.value = n; opt.textContent = n;
            if (n === this.config.baseFrame) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => this.overlay.setBaseFrame(select.value));
        sec.appendChild(this._row(t('nav2BaseLink', 'Base link'), select));

        const odom = textInput(this.config.odomFrame, (v) => { this.config.odomFrame = v; });
        sec.appendChild(this._row(t('nav2OdomFrame', 'Odom frame'), odom));

        // Base offset (authoring origin tweak relative to the link).
        const offsetWrap = el('div', 'nav2-inline');
        ['x', 'y', 'yaw'].forEach(axis => {
            const inp = numInput(this.config.baseOffset[axis], 0.01, (v) => {
                this.config.baseOffset[axis] = v;
                this.overlay.updateBaseOffset();
            });
            inp.title = axis;
            const cell = el('div', 'nav2-inline-cell');
            const lab = el('span', 'nav2-mini-label'); lab.textContent = axis;
            cell.appendChild(lab); cell.appendChild(inp);
            offsetWrap.appendChild(cell);
        });
        sec.appendChild(this._row(t('nav2BaseOffset', 'Offset (x,y,yaw)'), offsetWrap));

        const tol = numInput(this.config.transformTolerance, 0.01, (v) => { this.config.transformTolerance = v; });
        sec.appendChild(this._row(t('nav2TransformTolerance', 'Transform tolerance'), tol));
        const st = numInput(this.config.sourceTimeout, 0.1, (v) => { this.config.sourceTimeout = v; });
        sec.appendChild(this._row(t('nav2SourceTimeout', 'Source timeout'), st));

        return sec;
    }

    // ---------- Footprint ----------
    _footprintSection() {
        const sec = this._section('nav2Footprint', 'Footprint');
        const fp = this.config.footprint;

        // Mode: radius vs polygon.
        const modeSel = el('select', 'nav2-input');
        [['radius', t('nav2Radius', 'Radius')], ['polygon', t('nav2Polygon', 'Polygon')]].forEach(([val, label]) => {
            const opt = el('option'); opt.value = val; opt.textContent = label;
            if (fp.mode === val) opt.selected = true;
            modeSel.appendChild(opt);
        });
        modeSel.addEventListener('change', () => {
            fp.mode = modeSel.value;
            this.overlay.refresh();
            this.render();
        });
        sec.appendChild(this._row(t('nav2FootprintMode', 'Mode'), modeSel));

        if (fp.mode === 'radius') {
            const r = numInput(fp.radius, 0.01, (v) => { fp.radius = v; this.overlay.refresh(); });
            sec.appendChild(this._row(t('nav2Radius', 'Radius') + ' (m)', r));
            return sec;
        }

        // --- Vertical projection footprint ---
        const layerSel = el('select', 'nav2-input');
        [['visual', t('nav2LayerVisual', 'Visual')], ['collision', t('nav2LayerCollision', 'Collision')]].forEach(([val, label]) => {
            const opt = el('option'); opt.value = val; opt.textContent = label;
            if (fp.projectionLayer === val) opt.selected = true;
            layerSel.appendChild(opt);
        });
        layerSel.addEventListener('change', () => { fp.projectionLayer = layerSel.value; });
        sec.appendChild(this._row(t('nav2ProjectLayer', 'Projection layer'), layerSel));

        const detailSel = el('select', 'nav2-input');
        [['outline', t('nav2DetailOutline', 'Detailed outline')], ['hull', t('nav2DetailHull', 'Convex hull')]].forEach(([val, label]) => {
            const opt = el('option'); opt.value = val; opt.textContent = label;
            if (fp.projectMode === val) opt.selected = true;
            detailSel.appendChild(opt);
        });
        detailSel.addEventListener('change', () => { fp.projectMode = detailSel.value; });
        sec.appendChild(this._row(t('nav2ProjectDetail', 'Detail'), detailSel));

        const projBtn = button(t('nav2Project', '⤓ Ground projection footprint'), () => {
            if (!this.model) return;
            const useCollision = fp.projectionLayer === 'collision';
            const pts = fp.projectMode === 'hull'
                ? computeFootprint(this.model, this.config.baseFrame, { useCollision })
                : computeOutline(this.model, this.config.baseFrame, { useCollision });
            if (pts && pts.length >= 3) {
                fp.source = 'projection';
                fp.sourcePoints = pts;
                this._applyFootprintExpansion();
                this.overlay.refresh();
                this.render();
            } else {
                this._flash(projBtn, t('nav2AutoFail', 'Could not measure geometry'));
            }
        }, 'nav2-primary');
        projBtn.style.width = '100%';
        sec.appendChild(projBtn);

        // Export the top-down footprint as SVG.
        sec.appendChild(button(t('nav2ExportSvg', '⬇ Top view (.svg)'), () => {
            Nav2Exporter.download(Nav2Exporter.footprintSvg(this.config), 'footprint_top.svg', 'image/svg+xml');
        }));

        // Scale + margin (expand the projected footprint).
        if (fp.source === 'projection' && fp.sourcePoints.length >= 3) {
            sec.appendChild(this._row(t('nav2FpScale', 'Scale (×)'),
                numInput(fp.scale, 0.05, (v) => { fp.scale = v > 0 ? v : 1; this._applyFootprintExpansion(); this.overlay.refresh(); })));
            sec.appendChild(this._row(t('nav2FpMargin', 'Margin (m)'),
                numInput(fp.margin, 0.02, (v) => { fp.margin = v; this._applyFootprintExpansion(); this.overlay.refresh(); })));
            const note = el('div', 'nav2-hint');
            note.textContent = t('nav2ProjectNote', 'Footprint = downward projection of the robot, expanded by scale/margin.');
            sec.appendChild(note);
        }

        sec.appendChild(this._pointsEditor(
            { type: 'footprint' },
            fp.points,
            () => { fp.source = 'manual'; fp.points = [[0.25, 0.25], [0.25, -0.25], [-0.25, -0.25], [-0.25, 0.25]]; }
        ));
        return sec;
    }

    /** Recompute footprint.points from the projected hull + scale/margin. */
    _applyFootprintExpansion() {
        const fp = this.config.footprint;
        if (fp.source !== 'projection' || fp.sourcePoints.length < 3) return;
        fp.mode = 'polygon';
        fp.points = expandFootprint(fp.sourcePoints, fp.scale || 1, fp.margin || 0);
        fp.radius = footprintRadius(fp.points);
    }

    // ---------- Collision polygons ----------
    _polygonsSection() {
        const sec = this._section('nav2Polygons', 'Collision Polygons');

        // Add buttons
        const addRow = el('div', 'nav2-inline');
        const addPoly = button(t('nav2AddPolygon', '+ Polygon'), () => {
            const p = this.config.addPolygon('polygon');
            this.selectedId = p.id;
            this.overlay.setActiveTarget({ type: 'polygon', id: p.id });
            this.overlay.refresh();
            this.render();
        });
        const addCircle = button(t('nav2AddCircle', '+ Circle'), () => {
            const p = this.config.addPolygon('circle');
            this.selectedId = p.id;
            this.overlay.setActiveTarget({ type: 'polygon', id: p.id });
            this.overlay.refresh();
            this.render();
        });
        addRow.appendChild(addPoly);
        addRow.appendChild(addCircle);
        sec.appendChild(addRow);

        if (this.config.polygons.length === 0) {
            const empty = el('div', 'nav2-empty');
            empty.textContent = t('nav2NoPolygons', 'No polygons yet.');
            sec.appendChild(empty);
            return sec;
        }

        // Selector
        const sel = el('select', 'nav2-input');
        this.config.polygons.forEach(p => {
            const opt = el('option'); opt.value = p.id;
            opt.textContent = `${p.name} (${p.action_type})`;
            if (p.id === this.selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            this.selectedId = sel.value;
            this.overlay.setActiveTarget({ type: 'polygon', id: this.selectedId });
            this.render();
        });
        sec.appendChild(this._row(t('nav2Selected', 'Selected'), sel));

        const poly = this.config.getPolygon(this.selectedId) || this.config.polygons[0];
        if (poly) {
            this.selectedId = poly.id;
            sec.appendChild(this._polygonEditor(poly));
        }
        return sec;
    }

    _polygonEditor(poly) {
        const box = el('div', 'nav2-subpanel');

        box.appendChild(this._row(t('nav2Name', 'Name'),
            textInput(poly.name, (v) => { poly.name = v; })));

        // Action type
        const act = el('select', 'nav2-input');
        ACTION_TYPES.forEach(a => {
            const opt = el('option'); opt.value = a; opt.textContent = a;
            if (a === poly.action_type) opt.selected = true;
            act.appendChild(opt);
        });
        act.addEventListener('change', () => {
            poly.action_type = act.value;
            this.overlay.refresh();
            this.render();
        });
        box.appendChild(this._row(t('nav2ActionType', 'Action type'), act));

        // Shape-specific
        if (poly.shape === 'circle') {
            box.appendChild(this._row(t('nav2Radius', 'Radius') + ' (m)',
                numInput(poly.radius, 0.01, (v) => { poly.radius = v; this.overlay.refresh(); })));
        } else {
            box.appendChild(this._pointsEditor(
                { type: 'polygon', id: poly.id },
                poly.points,
                () => { poly.points = [[0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [-0.5, 0.5]]; }
            ));
        }

        // Action-specific params
        if (poly.action_type === 'slowdown') {
            box.appendChild(this._row(t('nav2SlowdownRatio', 'Slowdown ratio'),
                numInput(poly.slowdown_ratio, 0.05, (v) => { poly.slowdown_ratio = v; })));
        }
        if (poly.action_type === 'limit') {
            box.appendChild(this._row(t('nav2LinearLimit', 'Linear limit'),
                numInput(poly.linear_limit, 0.05, (v) => { poly.linear_limit = v; })));
            box.appendChild(this._row(t('nav2AngularLimit', 'Angular limit'),
                numInput(poly.angular_limit, 0.05, (v) => { poly.angular_limit = v; })));
        }
        if (poly.action_type === 'approach') {
            box.appendChild(this._row(t('nav2TimeBeforeCollision', 'Time before collision'),
                numInput(poly.time_before_collision, 0.1, (v) => { poly.time_before_collision = v; })));
            box.appendChild(this._row(t('nav2SimTimeStep', 'Simulation time step'),
                numInput(poly.simulation_time_step, 0.01, (v) => { poly.simulation_time_step = v; })));
        }

        box.appendChild(this._row(t('nav2MinPoints', 'Min points'),
            numInput(poly.min_points, 1, (v) => { poly.min_points = Math.max(1, Math.round(v)); })));

        // Toggles
        box.appendChild(this._row(t('nav2Visualize', 'Visualize'),
            checkbox(poly.visualize, (v) => { poly.visualize = v; })));
        box.appendChild(this._row(t('nav2Enabled', 'Enabled'),
            checkbox(poly.enabled, (v) => { poly.enabled = v; this.overlay.refresh(); })));

        // Delete
        const del = button(t('nav2Delete', 'Delete polygon'), () => {
            this.config.removePolygon(poly.id);
            this.selectedId = this.config.polygons[0]?.id || null;
            this.overlay.setActiveTarget(this.selectedId ? { type: 'polygon', id: this.selectedId } : null);
            this.overlay.refresh();
            this.render();
        }, 'nav2-danger');
        box.appendChild(del);

        return box;
    }

    /**
     * Edit controls for a polygon's vertices. Geometry is edited on the canvas;
     * here we only expose count + Edit / Draw / Reset toggles.
     */
    _pointsEditor(target, points, resetFn) {
        const wrap = el('div', 'nav2-subpanel');

        const info = el('div', 'nav2-points-info');
        info.dataset.nav2Points = '1';
        info.textContent = t('nav2Points', 'Points') + `: ${points.length}`;
        wrap.appendChild(info);

        const isActive = this.overlay.activeTarget &&
            this.overlay.activeTarget.type === target.type &&
            this.overlay.activeTarget.id === target.id;

        const row = el('div', 'nav2-inline');
        const editBtn = button(
            this.overlay.editMode && isActive ? t('nav2EditOn', 'Editing ✓') : t('nav2Edit', 'Edit on canvas'),
            () => {
                const turnOn = !(this.overlay.editMode && isActive);
                this.overlay.setActiveTarget(turnOn ? target : null);
                this.overlay.setEditMode(turnOn);
                this.render();
            },
            (this.overlay.editMode && isActive) ? 'nav2-active' : ''
        );
        const drawBtn = button(
            this.overlay.drawMode && isActive ? t('nav2DrawOn', 'Drawing ✓') : t('nav2Draw', 'Draw points'),
            () => {
                const turnOn = !(this.overlay.drawMode && isActive);
                this.overlay.setActiveTarget(target);
                this.overlay.setDrawMode(turnOn);
                this.render();
            },
            (this.overlay.drawMode && isActive) ? 'nav2-active' : ''
        );
        const resetBtn = button(t('nav2Reset', 'Reset'), () => {
            resetFn();
            this.overlay.refresh();
            this.render();
        });
        row.appendChild(editBtn);
        row.appendChild(drawBtn);
        row.appendChild(resetBtn);
        wrap.appendChild(row);

        const hint = el('div', 'nav2-hint');
        hint.textContent = t('nav2EditHint', 'Drag white handles to move points · right-click a handle to delete · Draw mode: click ground to add.');
        wrap.appendChild(hint);

        return wrap;
    }

    /** Briefly show a message on a button, then restore its label. */
    _flash(btn, msg) {
        const original = btn.textContent;
        btn.textContent = msg;
        btn.disabled = true;
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1600);
    }

    _syncPointsInfo() {
        const info = this.container?.querySelector('[data-nav2-points]');
        if (!info) return;
        let count = 0;
        const tgt = this.overlay.activeTarget;
        if (tgt?.type === 'footprint') count = this.config.footprint.points.length;
        else if (tgt?.type === 'polygon') count = this.config.getPolygon(tgt.id)?.points.length || 0;
        else if (tgt?.type === 'zone') count = this.config.getZone(tgt.id)?.points.length || 0;
        info.textContent = t('nav2Points', 'Points') + `: ${count}`;
    }

    // ---------- Controller / Drive ----------
    _controllerSection() {
        const sec = this._section('nav2Controller', 'Controller / Drive');
        const c = this.config.controller;

        // Drive / base model
        const drive = el('select', 'nav2-input');
        DRIVE_TYPES.forEach(d => {
            const opt = el('option'); opt.value = d.id; opt.textContent = d.label;
            if (d.id === c.driveType) opt.selected = true;
            drive.appendChild(opt);
        });
        drive.addEventListener('change', () => { c.driveType = drive.value; this.render(); });
        sec.appendChild(this._row(t('nav2DriveType', 'Drive model'), drive));

        // Controller plugin
        const plugin = el('select', 'nav2-input');
        CONTROLLER_PLUGINS.forEach(p => {
            const opt = el('option'); opt.value = p.id; opt.textContent = p.label;
            if (p.id === c.plugin) opt.selected = true;
            plugin.appendChild(opt);
        });
        plugin.addEventListener('change', () => { c.plugin = plugin.value; this.render(); });
        sec.appendChild(this._row(t('nav2ControllerPlugin', 'Controller'), plugin));

        // Global planner selection.
        const planner = el('select', 'nav2-input');
        [['auto', t('nav2PlannerAuto', 'Auto (by drive)')],
         ['navfn', 'NavFn'],
         ['smac2d', 'Smac 2D'],
         ['smac_hybrid', 'Smac Hybrid-A*']].forEach(([val, label]) => {
            const opt = el('option'); opt.value = val; opt.textContent = label;
            if (c.planner === val) opt.selected = true;
            planner.appendChild(opt);
        });
        planner.addEventListener('change', () => { c.planner = planner.value; });
        sec.appendChild(this._row(t('nav2Planner', 'Planner'), planner));

        const carLike = driveKind(c.driveType) === 'car';
        if (carLike && c.plugin === 'dwb') {
            const warn = el('div', 'nav2-hint');
            warn.style.color = '#ff9f0a';
            warn.textContent = t('nav2DwbCarWarn', 'DWB is not ideal for car-like robots — prefer RPP or MPPI.');
            sec.appendChild(warn);
        }

        // Common velocity limits
        sec.appendChild(this._row(t('nav2MaxVelX', 'Max linear vel (m/s)'),
            numInput(c.maxVelX, 0.05, (v) => { c.maxVelX = v; })));
        sec.appendChild(this._row(t('nav2MaxVelTheta', 'Max angular vel (rad/s)'),
            numInput(c.maxVelTheta, 0.05, (v) => { c.maxVelTheta = v; })));
        sec.appendChild(this._row(t('nav2MaxAccel', 'Max accel (m/s²)'),
            numInput(c.maxAccelX, 0.1, (v) => { c.maxAccelX = v; })));

        // Plugin-specific
        if (c.plugin === 'rpp' || c.plugin === 'graceful' || c.plugin === 'rotation_shim') {
            sec.appendChild(this._row(t('nav2DesiredVel', 'Desired linear vel'),
                numInput(c.desiredLinearVel, 0.05, (v) => { c.desiredLinearVel = v; })));
        }
        if (c.plugin === 'rpp' || c.plugin === 'rotation_shim') {
            sec.appendChild(this._row(t('nav2Lookahead', 'Lookahead dist (m)'),
                numInput(c.lookaheadDist, 0.05, (v) => { c.lookaheadDist = v; })));
            sec.appendChild(this._row(t('nav2AllowReversing', 'Allow reversing'),
                checkbox(c.allowReversing, (v) => { c.allowReversing = v; })));
        }
        // Car-like turning radius + wheelbase
        if (carLike) {
            sec.appendChild(this._row(t('nav2MinTurnRadius', 'Min turning radius (m)'),
                numInput(c.minTurningRadius, 0.05, (v) => { c.minTurningRadius = v; })));
            sec.appendChild(this._row(t('nav2Wheelbase', 'Wheelbase (m)'),
                numInput(c.wheelbase, 0.05, (v) => { c.wheelbase = v; this.overlay.refresh(); })));
        }

        // --- Actuated joints ---
        const jointNames = this.model && this.model.joints
            ? Array.from(this.model.joints.values()).filter(j => j.type !== 'fixed').map(j => j.name)
            : [];

        const driveLabel = el('div', 'nav2-mini-title');
        driveLabel.textContent = t('nav2DriveJoints', 'Drive joints');
        sec.appendChild(driveLabel);
        sec.appendChild(this._jointChecklist(jointNames, c.driveJoints, () => this.overlay.refresh()));

        if (carLike) {
            const steerLabel = el('div', 'nav2-mini-title');
            steerLabel.textContent = t('nav2SteeringJoints', 'Steering joints');
            sec.appendChild(steerLabel);
            sec.appendChild(this._jointChecklist(jointNames, c.steeringJoints, () => this.overlay.refresh()));
        }

        // --- Path ("where it will go") preview ---
        const prevLabel = el('div', 'nav2-mini-title');
        prevLabel.textContent = t('nav2PathPreview', 'Path preview');
        sec.appendChild(prevLabel);

        sec.appendChild(this._row(t('nav2ShowPath', 'Show predicted path'),
            checkbox(c.previewEnabled, (v) => { c.previewEnabled = v; this.overlay.refresh(); this.render(); })));

        if (c.previewEnabled) {
            sec.appendChild(this._row(t('nav2PreviewDistance', 'Preview distance (m)'),
                numInput(c.previewDistance, 0.25, (v) => { c.previewDistance = v; this.overlay.refresh(); })));

            if (carLike) {
                // Steering angle slider drives the predicted arc.
                const slider = el('input', 'nav2-input');
                slider.type = 'range';
                slider.min = '-0.785'; slider.max = '0.785'; slider.step = '0.01';
                slider.value = String(c.previewSteerAngle);
                const valSpan = el('span', 'nav2-mini-label');
                valSpan.textContent = `${(c.previewSteerAngle * 180 / Math.PI).toFixed(0)}°`;
                slider.addEventListener('input', () => {
                    c.previewSteerAngle = parseFloat(slider.value);
                    valSpan.textContent = `${(c.previewSteerAngle * 180 / Math.PI).toFixed(0)}°`;
                    this.overlay.applySteering(c.previewSteerAngle); // turn the wheels
                    this.overlay.refresh();
                });
                const wrap = el('div', 'nav2-inline');
                wrap.appendChild(slider); wrap.appendChild(valSpan);
                sec.appendChild(this._row(t('nav2SteerAngle', 'Steering angle'), wrap));

                // Read the angle from the first selected steering joint's current value.
                if (c.steeringJoints.length && this.model?.joints) {
                    sec.appendChild(button(t('nav2ReadJointAngle', 'Read from joint'), () => {
                        const j = this.model.joints.get(c.steeringJoints[0]);
                        if (j && typeof j.currentValue === 'number') {
                            c.previewSteerAngle = j.currentValue;
                            this.overlay.refresh();
                            this.render();
                        }
                    }));
                }
            } else {
                const hint = el('div', 'nav2-hint');
                hint.textContent = t('nav2PathStraightHint', 'Differential / holonomic: path shown straight ahead.');
                sec.appendChild(hint);
            }

            // --- Simulation (play the robot along the path) ---
            const simLabel = el('div', 'nav2-mini-title');
            simLabel.textContent = t('nav2Sim', 'Simulation');
            sec.appendChild(simLabel);

            const speed = c.desiredLinearVel || c.maxVelX || 0.5;
            const eta = (c.previewDistance || 2) / Math.max(0.01, speed);
            const etaNote = el('div', 'nav2-hint');
            etaNote.textContent = `${t('nav2SimEta', 'Duration')}: ${eta.toFixed(1)} s  (${(c.previewDistance || 2).toFixed(2)} m @ ${speed.toFixed(2)} m/s)`;
            sec.appendChild(etaNote);

            const simRow = el('div', 'nav2-inline');
            const playBtn = button('▶ ' + t('nav2SimPlay', 'Simulate'), () => this._startSim(), 'nav2-primary');
            const stopBtn = button('■ ' + t('nav2SimStop', 'Stop'), () => { this.overlay.stopSim(); this._hideSimBar(); });
            simRow.appendChild(playBtn);
            simRow.appendChild(stopBtn);
            sec.appendChild(simRow);
        }

        return sec;
    }

    // ---------- simulation progress bar ----------
    _startSim() {
        this._ensureSimBar();
        this._showSimBar();
        const ok = this.overlay.startSim(
            (elapsed, total, frac) => this._updateSimBar(elapsed, total, frac),
            () => { this._updateSimBar(0, 0, 1); setTimeout(() => this._hideSimBar(), 1500); }
        );
        if (!ok) this._hideSimBar();
    }

    _ensureSimBar() {
        if (this._simBar) return;
        const bar = el('div'); bar.id = 'nav2-sim-bar';
        bar.style.cssText = `position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
            width: min(520px, 80vw); z-index: 200; background: var(--glass-bg);
            border: 0.5px solid var(--glass-border); border-radius: 12px; padding: 8px 12px;
            backdrop-filter: blur(20px); box-shadow: var(--glass-shadow); display: none;`;
        const label = el('div'); label.id = 'nav2-sim-label';
        label.style.cssText = 'font-size: 12px; color: var(--text-primary); margin-bottom: 6px; display:flex; justify-content:space-between;';
        const track = el('div');
        track.style.cssText = 'height: 8px; border-radius: 4px; background: rgba(128,128,128,0.25); overflow: hidden;';
        const fill = el('div'); fill.id = 'nav2-sim-fill';
        fill.style.cssText = 'height: 100%; width: 0%; background: var(--accent); transition: width 0.06s linear;';
        track.appendChild(fill);
        bar.appendChild(label); bar.appendChild(track);
        document.body.appendChild(bar);
        this._simBar = bar;
    }

    _showSimBar() { if (this._simBar) this._simBar.style.display = 'block'; }
    _hideSimBar() { if (this._simBar) this._simBar.style.display = 'none'; }

    _updateSimBar(elapsed, total, frac) {
        if (!this._simBar) return;
        const pct = Math.round(frac * 100);
        this._simBar.querySelector('#nav2-sim-fill').style.width = pct + '%';
        const label = this._simBar.querySelector('#nav2-sim-label');
        const left = el('span'); left.textContent = `${t('nav2Sim', 'Simulation')}`;
        const right = el('span');
        right.textContent = total > 0 ? `${elapsed.toFixed(1)} / ${total.toFixed(1)} s  ·  ${pct}%` : `100%`;
        label.innerHTML = '';
        label.appendChild(left); label.appendChild(right);
    }

    /** A compact scrollable checkbox list of joint names. */
    _jointChecklist(jointNames, selected, onChange) {
        const box = el('div', 'nav2-checklist');
        if (jointNames.length === 0) {
            const empty = el('div', 'nav2-hint');
            empty.textContent = t('nav2NoJoints', 'No movable joints (load a model first).');
            box.appendChild(empty);
            return box;
        }
        jointNames.forEach(name => {
            const row = el('label', 'nav2-check-row');
            const cb = el('input');
            cb.type = 'checkbox';
            cb.checked = selected.includes(name);
            cb.addEventListener('change', () => {
                const i = selected.indexOf(name);
                if (cb.checked && i < 0) selected.push(name);
                else if (!cb.checked && i >= 0) selected.splice(i, 1);
                onChange?.();
            });
            const span = el('span'); span.textContent = name;
            row.appendChild(cb); row.appendChild(span);
            box.appendChild(row);
        });
        return box;
    }

    // ---------- Costmap-filter zones ----------
    _zonesSection() {
        const sec = this._section('nav2Zones', 'Zones (Costmap Filters)');

        const addRow = el('div', 'nav2-inline');
        addRow.appendChild(button(t('nav2AddKeepout', '+ Keepout'), () => {
            const z = this.config.addZone('keepout');
            this.selectedZoneId = z.id;
            this.overlay.setActiveTarget({ type: 'zone', id: z.id });
            this.overlay.refresh();
            this.render();
        }));
        addRow.appendChild(button(t('nav2AddSpeed', '+ Speed limit'), () => {
            const z = this.config.addZone('speed');
            this.selectedZoneId = z.id;
            this.overlay.setActiveTarget({ type: 'zone', id: z.id });
            this.overlay.refresh();
            this.render();
        }));
        sec.appendChild(addRow);

        if (this.config.zones.length === 0) {
            const empty = el('div', 'nav2-empty');
            empty.textContent = t('nav2NoZones', 'No zones. Keepout/speed zones are in the map frame.');
            sec.appendChild(empty);
            return sec;
        }

        const sel = el('select', 'nav2-input');
        this.config.zones.forEach(z => {
            const opt = el('option'); opt.value = z.id;
            opt.textContent = `${z.name} (${z.type})`;
            if (z.id === this.selectedZoneId) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            this.selectedZoneId = sel.value;
            this.overlay.setActiveTarget({ type: 'zone', id: this.selectedZoneId });
            this.render();
        });
        sec.appendChild(this._row(t('nav2Selected', 'Selected'), sel));

        const zone = this.config.getZone(this.selectedZoneId) || this.config.zones[0];
        if (zone) {
            this.selectedZoneId = zone.id;
            const box = el('div', 'nav2-subpanel');
            box.appendChild(this._row(t('nav2Name', 'Name'), textInput(zone.name, (v) => { zone.name = v; })));
            if (zone.type === 'speed') {
                box.appendChild(this._row(t('nav2SpeedLimit', 'Speed limit (%)'),
                    numInput(zone.speedLimit, 5, (v) => { zone.speedLimit = Math.max(0, Math.min(100, v)); })));
            }
            box.appendChild(this._row(t('nav2Enabled', 'Enabled'),
                checkbox(zone.enabled, (v) => { zone.enabled = v; this.overlay.refresh(); })));
            box.appendChild(this._pointsEditor(
                { type: 'zone', id: zone.id },
                zone.points,
                () => { zone.points = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; }
            ));
            box.appendChild(button(t('nav2Delete', 'Delete'), () => {
                this.config.removeZone(zone.id);
                this.selectedZoneId = this.config.zones[0]?.id || null;
                this.overlay.setActiveTarget(null);
                this.overlay.refresh();
                this.render();
            }, 'nav2-danger'));
            sec.appendChild(box);
        }
        return sec;
    }

    // ---------- Costmap ----------
    _costmapSection() {
        const sec = this._section('nav2Costmap', 'Costmap');
        const c = this.config.costmap;
        const fp = this.config.footprint;

        // Use footprint polygon vs. robot_radius. Enabling it switches the
        // footprint to polygon mode and exposes an editable footprint here.
        sec.appendChild(this._row(t('nav2UseFootprint', 'Use footprint polygon'),
            checkbox(c.useFootprint, (v) => {
                c.useFootprint = v;
                if (v && fp.mode !== 'polygon') fp.mode = 'polygon';
                this.overlay.refresh();
                this.render();
            })));

        if (c.useFootprint) {
            // Editable footprint polygon (shared with the Footprint section).
            const note = el('div', 'nav2-hint');
            note.textContent = t('nav2FootprintShared', 'Costmap uses the footprint polygon below (same as the Footprint section).');
            sec.appendChild(note);
            sec.appendChild(this._pointsEditor(
                { type: 'footprint' },
                fp.points,
                () => { fp.points = [[0.25, 0.25], [0.25, -0.25], [-0.25, -0.25], [-0.25, 0.25]]; }
            ));
        } else {
            sec.appendChild(this._row(t('nav2RobotRadius', 'Robot radius'),
                numInput(c.robotRadius, 0.01, (v) => { c.robotRadius = v; })));
        }

        sec.appendChild(this._row(t('nav2InflationRadius', 'Inflation radius'),
            numInput(c.inflationRadius, 0.01, (v) => { c.inflationRadius = v; })));
        sec.appendChild(this._row(t('nav2CostScaling', 'Cost scaling factor'),
            numInput(c.costScalingFactor, 0.1, (v) => { c.costScalingFactor = v; })));
        sec.appendChild(this._row(t('nav2Resolution', 'Resolution'),
            numInput(c.resolution, 0.01, (v) => { c.resolution = v; })));
        return sec;
    }

    // ---------- Export ----------
    _exportSection() {
        const sec = this._section('nav2Export', 'Export');

        const row1 = el('div', 'nav2-inline');
        row1.appendChild(button(t('nav2ExportCollision', 'collision_monitor.yaml'), () => {
            Nav2Exporter.download(Nav2Exporter.collisionMonitorYaml(this.config), 'collision_monitor.yaml');
        }));
        row1.appendChild(button(t('nav2ExportCostmap', 'costmap.yaml'), () => {
            Nav2Exporter.download(Nav2Exporter.costmapYaml(this.config), 'costmap_params.yaml');
        }));
        row1.appendChild(button(t('nav2ExportController', 'controller_server.yaml'), () => {
            Nav2Exporter.download(Nav2Exporter.controllerServerYaml(this.config), 'controller_server.yaml');
        }));
        sec.appendChild(row1);

        // Full bringup bundle
        const bundleRow = el('div', 'nav2-inline');
        const bundleBtn = button(t('nav2ExportBundle', '⬇ Full Nav2 bundle (.zip)'), () => {
            Nav2Exporter.downloadBundle(this.config);
        }, 'nav2-primary');
        bundleBtn.style.width = '100%';
        bundleRow.appendChild(bundleBtn);
        sec.appendChild(bundleRow);

        const rowFull = el('div', 'nav2-inline');
        rowFull.appendChild(button(t('nav2ExportParams', 'nav2_params.yaml'), () => {
            Nav2Exporter.download(Nav2Exporter.fullNav2ParamsYaml(this.config), 'nav2_params.yaml');
        }));
        rowFull.appendChild(button(t('nav2ExportRos2Control', 'ros2_controllers.yaml'), () => {
            Nav2Exporter.download(Nav2Exporter.ros2ControllersYaml(this.config), 'ros2_controllers.yaml');
        }));
        sec.appendChild(rowFull);

        const row2 = el('div', 'nav2-inline');
        row2.appendChild(button(t('nav2SaveProject', 'Save project (.json)'), () => {
            Nav2Exporter.download(Nav2Exporter.projectJson(this.config), 'nav2_project.json', 'application/json');
        }));

        const loadBtn = button(t('nav2LoadProject', 'Load project'), () => fileInput.click());
        const fileInput = el('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async () => {
            const f = fileInput.files?.[0];
            if (!f) return;
            try {
                const data = JSON.parse(await f.text());
                this.config.fromJSON(data);
                this.selectedId = this.config.polygons[0]?.id || null;
                this.overlay.setActiveTarget(null);
                this.overlay.setBaseFrame(this.config.baseFrame);
                this.render();
            } catch (e) {
                console.error('Failed to load Nav2 project JSON:', e);
            }
            fileInput.value = '';
        });
        row2.appendChild(loadBtn);
        row2.appendChild(fileInput);
        sec.appendChild(row2);

        const preview = button(t('nav2Preview', 'Preview YAML'), () => {
            const pre = sec.querySelector('.nav2-preview');
            pre.textContent = Nav2Exporter.collisionMonitorYaml(this.config) + '\n' +
                Nav2Exporter.controllerServerYaml(this.config) + '\n' +
                Nav2Exporter.costmapYaml(this.config);
            pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
        });
        sec.appendChild(preview);

        const pre = el('pre', 'nav2-preview');
        pre.style.display = 'none';
        sec.appendChild(pre);

        return sec;
    }

    // ==================== styles ====================
    _injectStyles() {
        if (document.getElementById('nav2-panel-styles')) return;
        const style = document.createElement('style');
        style.id = 'nav2-panel-styles';
        style.textContent = `
        #floating-nav2-panel { top: 80px; right: 20px; left: auto; width: 340px;
            height: calc(100vh - 100px); display: flex; flex-direction: column; }
        #floating-nav2-panel.maximized { top: 80px !important; height: calc(100vh - 100px) !important; }
        #nav2-panel-content { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px; }
        .nav2-section { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--glass-border); }
        .nav2-section-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--text-primary); }
        .nav2-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 6px 0; }
        .nav2-label { font-size: 12px; color: var(--text-secondary); flex: 1; }
        .nav2-input { flex: 1.2; min-width: 0; background: var(--glass-bg); color: var(--text-primary);
            border: 1px solid var(--glass-border); border-radius: 6px; padding: 4px 6px; font-size: 12px; }
        .nav2-input[type="number"] { width: 70px; flex: 0 0 auto; }
        .nav2-inline { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
        .nav2-inline-cell { display: flex; flex-direction: column; align-items: center; }
        .nav2-mini-label { font-size: 10px; color: var(--text-tertiary); }
        .nav2-inline-cell .nav2-input { width: 60px; }
        .nav2-subpanel { background: var(--accent-secondary); border-radius: 8px; padding: 8px; margin-top: 6px; }
        .nav2-btn { background: var(--glass-bg); color: var(--text-primary); border: 1px solid var(--glass-border);
            border-radius: 6px; padding: 5px 9px; font-size: 12px; cursor: pointer; }
        .nav2-btn:hover { border-color: var(--accent); }
        .nav2-btn.nav2-active { background: var(--accent); color: #fff; border-color: var(--accent); }
        .nav2-btn.nav2-danger { color: #ff5b50; width: 100%; margin-top: 8px; }
        .nav2-btn.nav2-primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; margin-top: 6px; }
        .nav2-btn.nav2-primary:hover { background: var(--accent-hover); }
        .nav2-empty, .nav2-hint { font-size: 11px; color: var(--text-tertiary); margin: 6px 0; }
        .nav2-mini-title { font-size: 11px; font-weight: 600; color: var(--text-secondary); margin: 8px 0 4px; }
        .nav2-checklist { max-height: 110px; overflow-y: auto; border: 1px solid var(--glass-border);
            border-radius: 6px; padding: 4px 6px; background: rgba(0,0,0,0.15); }
        .nav2-check-row { display: flex; align-items: center; gap: 6px; font-size: 12px;
            color: var(--text-primary); padding: 2px 0; cursor: pointer; }
        .nav2-check-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #nav2-panel-content input[type="range"] { flex: 1; }
        .nav2-points-info { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
        .nav2-preview { display: none; white-space: pre; overflow: auto; max-height: 220px; font-size: 10px;
            background: rgba(0,0,0,0.35); color: #c8e1ff; padding: 8px; border-radius: 6px; margin-top: 8px; }
        `;
        document.head.appendChild(style);
    }
}

// ==================== tiny DOM helpers ====================
function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
}
function textInput(value, onChange) {
    const i = el('input', 'nav2-input');
    i.type = 'text'; i.value = value ?? '';
    i.addEventListener('input', () => onChange(i.value));
    return i;
}
function numInput(value, step, onChange) {
    const i = el('input', 'nav2-input');
    i.type = 'number'; i.step = String(step ?? 0.01); i.value = value ?? 0;
    i.addEventListener('input', () => {
        const v = parseFloat(i.value);
        if (!Number.isNaN(v)) onChange(v);
    });
    return i;
}
function checkbox(checked, onChange) {
    const i = el('input');
    i.type = 'checkbox'; i.checked = !!checked;
    i.addEventListener('change', () => onChange(i.checked));
    return i;
}
function button(label, onClick, extraCls) {
    const b = el('button', 'nav2-btn' + (extraCls ? ' ' + extraCls : ''));
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}
