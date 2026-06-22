/**
 * SDF Adapter
 * Parses SDFormat (.sdf / .world) into the UnifiedRobotModel used by the viewer.
 *
 * Scope (v1, intentionally extensible):
 *   - <sdf> -> <model> (and <world> containing one or more <model>s)
 *   - nested <model> (pose composed relative to the parent model frame)
 *   - <link> with <pose>, <visual>/<collision> -> <geometry>:
 *       box / cylinder / sphere / plane / mesh (model://, package://, file://, relative uri)
 *   - <joint> (type, parent, child, axis) recorded as data (kinematics not articulated yet)
 *   - <material> diffuse/ambient color
 *
 * Not yet handled (logged and skipped, easy to extend):
 *   - <include> of external model:// resources
 *   - sensors, plugins, physics, <pose relative_to="...">, frames
 *
 * SDF uses a Z-up, metric, right-handed frame just like URDF, so the SceneManager
 * world wrapper (rotated -90deg about X) maps it correctly to the Three.js Y-up scene.
 */
import * as THREE from 'three';
import {
    UnifiedRobotModel, Link, Joint, JointLimits,
    VisualGeometry, CollisionGeometry, GeometryType, Material
} from '../models/UnifiedRobotModel.js';
import { loadMeshFile } from '../utils/MeshLoader.js';

export class SDFAdapter {
    /**
     * @param {string} content - SDF/world XML text
     * @param {string} fileName - key in fileMap (may include path)
     * @param {Map} fileMap - path -> File map for resolving mesh uris
     * @param {File} file - original file (unused, kept for signature parity)
     * @returns {Promise<UnifiedRobotModel>}
     */
    static async parse(content, fileName = '', fileMap = null, file = null) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'application/xml');

        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('SDF XML parse error: ' + parseError.textContent.trim());
        }

        const sdfEl = doc.querySelector('sdf') || doc.documentElement;
        if (!sdfEl) {
            throw new Error('No <sdf> root element found');
        }

        const model = new UnifiedRobotModel();
        const root = new THREE.Group();
        root.name = 'sdf_root';
        root.userData.type = 'sdf';
        model.threeObject = root;

        // Collect top-level <model> elements (directly under <sdf> or under <world>)
        const worldEl = directChild(sdfEl, 'world');
        const modelHost = worldEl || sdfEl;
        const topModels = directChildren(modelHost, 'model');

        if (worldEl) {
            const includes = directChildren(worldEl, 'include');
            if (includes.length > 0) {
                console.warn(`SDFAdapter: ${includes.length} <include> element(s) skipped (external model:// resolution not supported yet)`);
            }
        }

        if (topModels.length === 0) {
            console.warn('SDFAdapter: no <model> elements found in SDF');
            model.name = sdfEl.getAttribute('version') ? 'empty_sdf' : 'sdf';
            return model;
        }

        model.name = topModels.length === 1
            ? (topModels[0].getAttribute('name') || 'model')
            : (worldEl?.getAttribute('name') || 'world');

        // Pending async mesh loads; resolved after the tree is built so the
        // SceneManager's deferred re-extraction picks the geometry up.
        const meshJobs = [];

        for (const modelEl of topModels) {
            const group = this.parseModel(modelEl, '', model, fileMap, meshJobs);
            root.add(group);
        }

        // Determine root link (a link that is not the child of any joint)
        const childLinks = new Set(
            Array.from(model.joints.values()).map(j => j.child).filter(Boolean)
        );
        const rootCandidates = Array.from(model.links.keys()).filter(n => !childLinks.has(n));
        model.rootLink = rootCandidates[0] || Array.from(model.links.keys())[0] || null;

        // If there are no joints the model is a single rigid body; SceneManager
        // adds it straight to the scene (no Z-up world wrapper), so apply the
        // Z-up -> Y-up rotation here to keep it upright.
        if (model.joints.size === 0) {
            root.rotation.x = -Math.PI / 2;
        }

        // Kick off mesh loading; don't block the model from being returned.
        meshJobs.forEach(job => job());

        return model;
    }

    /**
     * Parse a <model> element into a THREE.Group, registering its links/joints
     * on the unified model. Names are namespaced with the model path to keep
     * nested models unambiguous.
     */
    static parseModel(modelEl, parentPath, model, fileMap, meshJobs) {
        const localName = modelEl.getAttribute('name') || 'model';
        const path = parentPath ? `${parentPath}::${localName}` : localName;

        const group = new THREE.Group();
        group.name = path;
        applyPose(group, readPose(modelEl));

        // Links
        for (const linkEl of directChildren(modelEl, 'link')) {
            const linkLocal = linkEl.getAttribute('name') || 'link';
            const linkName = parentPath ? `${path}::${linkLocal}` : `${path}::${linkLocal}`;
            // For a single top-level model keep link names clean (no prefix) so
            // nav2 base_frame selection shows familiar names like "base_link".
            const cleanName = (parentPath === '' ) ? linkLocal : linkName;

            const link = new Link(cleanName);
            const linkGroup = new THREE.Group();
            linkGroup.name = cleanName;
            applyPose(linkGroup, readPose(linkEl));
            link.threeObject = linkGroup;

            // Visuals
            for (const visEl of directChildren(linkEl, 'visual')) {
                const vg = this.parseVisual(visEl, fileMap, meshJobs);
                if (vg) {
                    link.visuals.push(vg);
                    if (vg.threeObject) linkGroup.add(vg.threeObject);
                }
            }

            // Collisions
            for (const colEl of directChildren(linkEl, 'collision')) {
                const cg = this.parseCollision(colEl, fileMap, meshJobs);
                if (cg) {
                    link.collisions.push(cg);
                    if (cg.threeObject) linkGroup.add(cg.threeObject);
                }
            }

            model.addLink(link);
            group.add(linkGroup);
        }

        // Joints (data only in v1)
        for (const jointEl of directChildren(modelEl, 'joint')) {
            const joint = this.parseJoint(jointEl, path, parentPath === '');
            if (joint) model.addJoint(joint);
        }

        // Nested models
        for (const childModelEl of directChildren(modelEl, 'model')) {
            const childGroup = this.parseModel(childModelEl, path, model, fileMap, meshJobs);
            group.add(childGroup);
        }

        return group;
    }

    static parseVisual(visEl, fileMap, meshJobs) {
        const vg = new VisualGeometry();
        vg.name = visEl.getAttribute('name') || 'visual';
        const pose = readPose(visEl);
        vg.origin = { xyz: [pose.x, pose.y, pose.z], rpy: [pose.roll, pose.pitch, pose.yaw] };

        const material = this.parseMaterial(directChild(visEl, 'material'));
        vg.material = material;

        const geomEl = directChild(visEl, 'geometry');
        const built = this.buildGeometry(geomEl, material, fileMap, meshJobs, false);
        if (!built) return null;
        vg.geometry = built.geometryType;
        vg.threeObject = built.object;
        applyPose(vg.threeObject, pose);
        return vg;
    }

    static parseCollision(colEl, fileMap, meshJobs) {
        const cg = new CollisionGeometry();
        cg.name = colEl.getAttribute('name') || 'collision';
        const pose = readPose(colEl);
        cg.origin = { xyz: [pose.x, pose.y, pose.z], rpy: [pose.roll, pose.pitch, pose.yaw] };

        const geomEl = directChild(colEl, 'geometry');
        const built = this.buildGeometry(geomEl, null, fileMap, meshJobs, true);
        if (!built) return null;
        cg.geometry = built.geometryType;

        // Wrap so VisualizationManager can toggle/recolor collision geometry.
        const wrapper = new THREE.Group();
        wrapper.name = cg.name;
        wrapper.isURDFCollider = true;
        wrapper.visible = false;
        wrapper.add(built.object);
        applyPose(wrapper, pose);
        cg.threeObject = wrapper;
        return cg;
    }

    /**
     * Build a THREE object + GeometryType descriptor from a <geometry> element.
     * Mesh geometry loads asynchronously: a placeholder group is returned and a
     * job is queued that injects the loaded mesh once ready.
     */
    static buildGeometry(geomEl, material, fileMap, meshJobs, isCollision) {
        if (!geomEl) return null;

        const color = material?.color || { r: 0.7, g: 0.7, b: 0.72 };
        const makeMaterial = () => new THREE.MeshPhongMaterial({
            color: new THREE.Color(color.r, color.g, color.b),
            shininess: 40
        });

        // box
        const boxEl = directChild(geomEl, 'box');
        if (boxEl) {
            const s = parseVec(text(directChild(boxEl, 'size')), [1, 1, 1]);
            const gt = new GeometryType('box');
            gt.size = { x: s[0], y: s[1], z: s[2] };
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), makeMaterial());
            return { object: mesh, geometryType: gt };
        }

        // cylinder
        const cylEl = directChild(geomEl, 'cylinder');
        if (cylEl) {
            const radius = parseFloat(text(directChild(cylEl, 'radius'))) || 0.5;
            const length = parseFloat(text(directChild(cylEl, 'length'))) || 1;
            const gt = new GeometryType('cylinder');
            gt.size = { radius, length };
            // SDF cylinder axis is +Z; THREE cylinder axis is +Y -> rotate +90deg about X.
            const geo = new THREE.CylinderGeometry(radius, radius, length, 32);
            geo.rotateX(Math.PI / 2);
            return { object: new THREE.Mesh(geo, makeMaterial()), geometryType: gt };
        }

        // sphere
        const sphEl = directChild(geomEl, 'sphere');
        if (sphEl) {
            const radius = parseFloat(text(directChild(sphEl, 'radius'))) || 0.5;
            const gt = new GeometryType('sphere');
            gt.size = { radius };
            return { object: new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), makeMaterial()), geometryType: gt };
        }

        // plane
        const planeEl = directChild(geomEl, 'plane');
        if (planeEl) {
            const size = parseVec(text(directChild(planeEl, 'size')), [10, 10]);
            const gt = new GeometryType('plane');
            gt.size = { x: size[0], y: size[1] };
            const geo = new THREE.PlaneGeometry(size[0], size[1]);
            const mat = makeMaterial();
            mat.side = THREE.DoubleSide;
            return { object: new THREE.Mesh(geo, mat), geometryType: gt };
        }

        // mesh
        const meshEl = directChild(geomEl, 'mesh');
        if (meshEl) {
            const uri = text(directChild(meshEl, 'uri'));
            const scaleVec = parseVec(text(directChild(meshEl, 'scale')), [1, 1, 1]);
            const gt = new GeometryType('mesh');
            gt.filename = uri;
            gt.size = { scale: scaleVec };

            const container = new THREE.Group();
            container.scale.set(scaleVec[0], scaleVec[1], scaleVec[2]);

            if (uri && fileMap) {
                const resolved = stripUriScheme(uri);
                meshJobs.push(async () => {
                    try {
                        const loaded = await loadMeshFile(resolved, fileMap);
                        if (loaded) {
                            const obj = loaded.isBufferGeometry
                                ? new THREE.Mesh(loaded, makeMaterial())
                                : loaded;
                            container.add(obj);
                        } else {
                            console.warn(`SDFAdapter: mesh not found in package: ${uri}`);
                        }
                    } catch (err) {
                        console.warn(`SDFAdapter: failed to load mesh ${uri}`, err);
                    }
                });
            }
            return { object: container, geometryType: gt };
        }

        return null;
    }

    static parseMaterial(matEl) {
        const material = new Material('sdf_material');
        if (!matEl) return material;
        const diffuse = text(directChild(matEl, 'diffuse')) || text(directChild(matEl, 'ambient'));
        if (diffuse) {
            const c = parseVec(diffuse, [0.7, 0.7, 0.72, 1]);
            material.color = { r: c[0], g: c[1], b: c[2] };
        }
        return material;
    }

    static parseJoint(jointEl, modelPath, isTopLevel) {
        const localName = jointEl.getAttribute('name') || 'joint';
        const type = (jointEl.getAttribute('type') || 'fixed').toLowerCase();
        const joint = new Joint(localName, mapJointType(type));

        const parentName = text(directChild(jointEl, 'parent'));
        const childName = text(directChild(jointEl, 'child'));
        // Keep link references consistent with how links were named.
        joint.parent = isTopLevel ? bareLink(parentName) : `${modelPath}::${bareLink(parentName)}`;
        joint.child = isTopLevel ? bareLink(childName) : `${modelPath}::${bareLink(childName)}`;

        const pose = readPose(jointEl);
        joint.origin = { xyz: [pose.x, pose.y, pose.z], rpy: [pose.roll, pose.pitch, pose.yaw] };

        const axisEl = directChild(jointEl, 'axis');
        if (axisEl) {
            const xyz = parseVec(text(directChild(axisEl, 'xyz')), [0, 0, 1]);
            joint.axis = { xyz };
            const limitEl = directChild(axisEl, 'limit');
            if (limitEl) {
                const limits = new JointLimits();
                const lower = text(directChild(limitEl, 'lower'));
                const upper = text(directChild(limitEl, 'upper'));
                const effort = text(directChild(limitEl, 'effort'));
                const velocity = text(directChild(limitEl, 'velocity'));
                if (lower !== '') limits.lower = parseFloat(lower);
                if (upper !== '') limits.upper = parseFloat(upper);
                if (effort !== '') limits.effort = parseFloat(effort);
                if (velocity !== '') limits.velocity = parseFloat(velocity);
                joint.limits = limits;
            }
        }
        return joint;
    }
}

// ==================== helpers ====================

/** Direct child elements with a given tag name (avoids deep descendant matches). */
function directChildren(el, tag) {
    if (!el) return [];
    return Array.from(el.children).filter(c => c.tagName === tag);
}

function directChild(el, tag) {
    return directChildren(el, tag)[0] || null;
}

function text(el) {
    return el ? (el.textContent || '').trim() : '';
}

/** SDF link references can be "model::link"; nav2 base frames want the bare link. */
function bareLink(name) {
    if (!name) return name;
    const parts = name.split('::');
    return parts[parts.length - 1];
}

function parseVec(str, fallback) {
    if (!str) return fallback.slice();
    const parts = str.trim().split(/\s+/).map(Number).filter(n => !Number.isNaN(n));
    return parts.length ? parts : fallback.slice();
}

/** Parse a <pose>x y z roll pitch yaw</pose> element value. */
function readPose(el) {
    const poseEl = directChild(el, 'pose');
    if (poseEl && poseEl.getAttribute('relative_to')) {
        console.warn(`SDFAdapter: <pose relative_to="${poseEl.getAttribute('relative_to')}"> treated as model-relative (frames not resolved yet)`);
    }
    const v = parseVec(text(poseEl), [0, 0, 0, 0, 0, 0]);
    return {
        x: v[0] || 0, y: v[1] || 0, z: v[2] || 0,
        roll: v[3] || 0, pitch: v[4] || 0, yaw: v[5] || 0
    };
}

/** Apply an SDF pose (Z-up, RPY = Rz*Ry*Rx) to a THREE object. */
function applyPose(obj, pose) {
    obj.position.set(pose.x, pose.y, pose.z);
    obj.quaternion.setFromEuler(new THREE.Euler(pose.roll, pose.pitch, pose.yaw, 'ZYX'));
}

function mapJointType(type) {
    switch (type) {
        case 'revolute': return 'revolute';
        case 'continuous': return 'continuous';
        case 'prismatic': return 'prismatic';
        case 'revolute2':
        case 'universal':
        case 'ball':
        case 'gearbox':
        case 'screw': return 'revolute';
        case 'fixed':
        default: return 'fixed';
    }
}

/** Strip model://, package://, file:// schemes so MeshLoader can fuzzy-match by name. */
function stripUriScheme(uri) {
    let p = uri.trim();
    p = p.replace(/^model:\/\//, '').replace(/^package:\/\//, '').replace(/^file:\/\//, '');
    // model://pkg/meshes/x.dae -> meshes/x.dae (drop the package/model name segment)
    if (p.includes('/')) {
        const parts = p.split('/');
        // Keep everything; MeshLoader matches on filename, but drop a leading
        // package segment if the path clearly starts with one.
        return parts.join('/');
    }
    return p;
}
