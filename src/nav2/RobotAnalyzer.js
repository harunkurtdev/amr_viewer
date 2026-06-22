/**
 * RobotAnalyzer - derives Nav2-relevant facts from a loaded robot so the user
 * doesn't have to enter them by hand:
 *   - footprint  : 2D convex hull of the robot geometry, in the base frame
 *   - wheelbase / track : from drive/steer joint origins
 *   - drive type + drive/steering joints : from joint structure & names
 *
 * Pure geometry helpers (convex hull, joint heuristics) are exported separately
 * so they can be unit-tested without a DOM/WebGL context.
 */
import * as THREE from 'three';

/**
 * Project the robot's mesh geometry into the base frame and return the 2D
 * convex hull (footprint) as [[x,y], ...] in metres. Returns null if nothing
 * could be measured.
 */
export function computeFootprint(model, baseFrameName, { useCollision = false, maxPoints = 12 } = {}) {
    if (!model || !model.threeObject) return null;
    const baseLink = model.links.get(baseFrameName) || model.links.get(model.rootLink);
    const baseObj = baseLink && baseLink.threeObject;
    if (!baseObj) return null;

    model.threeObject.updateWorldMatrix(true, true);
    baseObj.updateWorldMatrix(true, false);
    const invBase = new THREE.Matrix4().copy(baseObj.matrixWorld).invert();

    const pts = [];
    const v = new THREE.Vector3();
    model.threeObject.traverse((o) => {
        if (!o.isMesh) return;
        const inCollider = isCollider(o);
        if (useCollision ? !inCollider : inCollider) return; // pick the right layer
        const g = o.geometry;
        if (!g || !g.attributes || !g.attributes.position) return;
        const pos = g.attributes.position;
        // Sample large meshes to keep the hull computation cheap.
        const stride = Math.max(1, Math.floor(pos.count / 2000));
        o.updateWorldMatrix(true, false);
        const m = new THREE.Matrix4().multiplyMatrices(invBase, o.matrixWorld);
        for (let i = 0; i < pos.count; i += stride) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m);
            pts.push([v.x, v.y]);
        }
    });

    if (pts.length < 3) return null;
    let hull = convexHull(pts);
    if (hull.length < 3) return null;
    hull = simplifyHull(hull, maxPoints).map(([x, y]) => [round(x), round(y)]);
    return hull;
}

/**
 * Accurate top-down outline (concave-capable) of the robot, in the base frame.
 * Rasterizes the projected triangles into a grid, then traces the outer cell
 * boundary and simplifies it. Far more faithful than the convex hull for shapes
 * with concavities (e.g. forks), at the cost of more computation.
 *
 * @returns {Array<[number,number]>|null}
 */
export function computeOutline(model, baseFrameName, { useCollision = false, resolution = 0.03, maxPoints = 40 } = {}) {
    if (!model || !model.threeObject) return null;
    const baseLink = model.links.get(baseFrameName) || model.links.get(model.rootLink);
    const baseObj = baseLink && baseLink.threeObject;
    if (!baseObj) return null;

    model.threeObject.updateWorldMatrix(true, true);
    baseObj.updateWorldMatrix(true, false);
    const invBase = new THREE.Matrix4().copy(baseObj.matrixWorld).invert();

    // Collect projected triangles (base-frame XY).
    const tris = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    model.threeObject.traverse((o) => {
        if (!o.isMesh) return;
        const inCollider = isCollider(o);
        if (useCollision ? !inCollider : inCollider) return;
        const g = o.geometry;
        if (!g || !g.attributes || !g.attributes.position) return;
        const pos = g.attributes.position;
        const idx = g.index;
        o.updateWorldMatrix(true, false);
        const m = new THREE.Matrix4().multiplyMatrices(invBase, o.matrixWorld);
        const triCount = idx ? idx.count / 3 : pos.count / 3;
        const stride = triCount > 20000 ? Math.ceil(triCount / 20000) : 1;
        for (let t = 0; t < triCount; t += stride) {
            const i0 = idx ? idx.getX(t * 3) : t * 3;
            const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
            const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(m);
            b.fromBufferAttribute(pos, i1).applyMatrix4(m);
            c.fromBufferAttribute(pos, i2).applyMatrix4(m);
            tris.push([a.x, a.y, b.x, b.y, c.x, c.y]);
            minX = Math.min(minX, a.x, b.x, c.x); maxX = Math.max(maxX, a.x, b.x, c.x);
            minY = Math.min(minY, a.y, b.y, c.y); maxY = Math.max(maxY, a.y, b.y, c.y);
        }
    });
    if (!tris.length || !isFinite(minX)) return null;

    // Rasterize into an occupancy grid.
    const res = resolution > 0 ? resolution : 0.03;
    const pad = 1;
    const W = Math.min(2000, Math.ceil((maxX - minX) / res) + 2 * pad);
    const H = Math.min(2000, Math.ceil((maxY - minY) / res) + 2 * pad);
    const ox = minX - pad * res, oy = minY - pad * res;
    const filled = new Uint8Array(W * H);
    for (const [ax, ay, bx, by, cx, cy] of tris) {
        rasterTriangle(filled, W, H, ox, oy, res,
            (ax - ox) / res, (ay - oy) / res,
            (bx - ox) / res, (by - oy) / res,
            (cx - ox) / res, (cy - oy) / res);
    }

    const loop = traceOuterLoop(filled, W, H);
    if (!loop || loop.length < 3) return null;

    // Cell-corner coords -> world (base frame).
    let pts = loop.map(([gx, gy]) => [ox + gx * res, oy + gy * res]);
    // Drop the duplicated closing vertex so cyclic simplification keeps every corner.
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
        pts.pop();
    }
    pts = dropCollinear(pts);
    pts = douglasPeucker(pts, res * 0.75);
    if (pts.length > maxPoints) pts = douglasPeucker(pts, res * 2);
    if (pts.length > maxPoints) pts = simplifyHull(pts, maxPoints); // last resort
    return pts.map(([x, y]) => [round(x), round(y)]);
}

/**
 * Expand/shrink a (convex, roughly centred) footprint: scale about its centroid
 * and then offset every vertex outward by `margin` metres along its radial
 * direction. Used to grow the projected footprint with a safety margin.
 */
export function expandFootprint(points, scale = 1, margin = 0) {
    if (!points || points.length === 0) return points;
    let cx = 0, cy = 0;
    for (const [x, y] of points) { cx += x; cy += y; }
    cx /= points.length; cy /= points.length;
    return points.map(([x, y]) => {
        let dx = x - cx, dy = y - cy;
        dx *= scale; dy *= scale;
        const len = Math.hypot(dx, dy);
        if (len > 1e-6 && margin) {
            dx += (dx / len) * margin;
            dy += (dy / len) * margin;
        }
        return [round(cx + dx), round(cy + dy)];
    });
}

/** Largest distance of the footprint from the base origin (suggested radius). */
export function footprintRadius(points) {
    let r = 0;
    for (const [x, y] of points) r = Math.max(r, Math.hypot(x, y));
    return round(r);
}

/**
 * Infer drive model + actuated joints from the joint set.
 * Returns { driveType, wheelbase, track, driveJoints, steeringJoints, confident }.
 */
export function detectDrive(model) {
    const out = { driveType: null, wheelbase: 0, track: 0, driveJoints: [], steeringJoints: [], confident: false };
    if (!model || !model.joints) return out;

    const movable = Array.from(model.joints.values()).filter(j => j.type && j.type !== 'fixed');
    const isSteer = (n) => /steer|steering/i.test(n);
    const isWheel = (n) => /wheel|drive|caster/i.test(n);

    const steer = movable.filter(j => isSteer(j.name));
    let wheels = movable.filter(j => isWheel(j.name) && !isSteer(j.name));
    if (wheels.length === 0) {
        // Fall back to continuous joints (typical for free-spinning wheels).
        wheels = movable.filter(j => j.type === 'continuous');
    }

    out.driveJoints = wheels.map(j => j.name);
    out.steeringJoints = steer.map(j => j.name);

    // Wheelbase/track from joint origins (use steer joints if present, else wheels).
    const ref = (steer.length ? steer : wheels).map(j => j.origin && j.origin.xyz).filter(Boolean);
    if (ref.length >= 2) {
        const xs = ref.map(p => p[0]); const ys = ref.map(p => p[1]);
        out.wheelbase = round(Math.max(...xs) - Math.min(...xs));
        out.track = round(Math.max(...ys) - Math.min(...ys));
    }
    // Wheelbase: prefer front-to-rear axle span from wheels if steer-only span is ~0.
    if ((!out.wheelbase || out.wheelbase < 1e-3) && wheels.length >= 2) {
        const xs = wheels.map(j => j.origin && j.origin.xyz ? j.origin.xyz[0] : 0);
        out.wheelbase = round(Math.max(...xs) - Math.min(...xs));
    }

    // Drive-type heuristic.
    if (steer.length >= 4 || (steer.length >= 2 && wheels.length >= 4)) {
        out.driveType = 'four_wheel_steering';
    } else if (steer.length === 1) {
        out.driveType = 'tricycle';
    } else if (steer.length >= 2) {
        out.driveType = 'ackermann';
    } else if (wheels.length >= 4) {
        out.driveType = 'skid_steer';
    } else if (wheels.length >= 2) {
        out.driveType = 'differential';
    }
    out.confident = !!out.driveType && (out.driveJoints.length > 0);
    return out;
}

// ==================== pure geometry ====================

/** Andrew's monotone chain convex hull. points: [[x,y],...] -> hull CCW. */
export function convexHull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
}

/** Reduce a hull to at most maxPoints, keeping the most significant vertices. */
export function simplifyHull(hull, maxPoints) {
    if (hull.length <= maxPoints) return hull;
    // Drop the vertices that contribute the least area (smallest triangle) until
    // we reach maxPoints — preserves overall shape better than uniform sampling.
    const pts = hull.slice();
    const triArea = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    while (pts.length > maxPoints) {
        let minA = Infinity, minI = 1;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[(i - 1 + pts.length) % pts.length];
            const b = pts[i];
            const c = pts[(i + 1) % pts.length];
            const area = triArea(a, b, c);
            if (area < minA) { minA = area; minI = i; }
        }
        pts.splice(minI, 1);
    }
    return pts;
}

// ==================== rasterization / contour ====================

/** Fill grid cells whose centre lies inside the triangle (grid-unit coords). */
function rasterTriangle(filled, W, H, ox, oy, res, ax, ay, bx, by, cx, cy) {
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxy = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(d) < 1e-12) return;
    for (let gy = miny; gy <= maxy; gy++) {
        const py = gy + 0.5;
        for (let gx = minx; gx <= maxx; gx++) {
            const px = gx + 0.5;
            // barycentric sign test
            const s = ((by - ay) * (px - ax) - (bx - ax) * (py - ay));
            const t = ((cy - by) * (px - bx) - (cx - bx) * (py - by));
            const u = ((ay - cy) * (px - cx) - (ax - cx) * (py - cy));
            if ((s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0)) {
                filled[gy * W + gx] = 1;
            }
        }
    }
}

/** Extract the largest boundary loop (cell-corner coords) of a filled grid. */
function traceOuterLoop(filled, W, H) {
    const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? filled[y * W + x] : 0;
    // Directed boundary edges with the filled cell on the left (CCW for outer).
    const edges = new Map(); // "x,y" -> array of [ex,ey]
    const addEdge = (sx, sy, ex, ey) => {
        const k = sx + ',' + sy;
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push([ex, ey]);
    };
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!filled[y * W + x]) continue;
            if (!get(x, y - 1)) addEdge(x, y, x + 1, y);         // bottom
            if (!get(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1); // right
            if (!get(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1); // top
            if (!get(x - 1, y)) addEdge(x, y + 1, x, y);         // left
        }
    }

    const loops = [];
    for (const [startKey, list] of edges) {
        while (list.length) {
            const start = startKey.split(',').map(Number);
            let cur = list.pop();
            const loop = [start, cur];
            let guard = 0;
            while (guard++ < W * H * 4) {
                const k = cur[0] + ',' + cur[1];
                const nexts = edges.get(k);
                if (!nexts || !nexts.length) break;
                const next = nexts.pop();
                if (next[0] === start[0] && next[1] === start[1]) { loop.push(next); break; }
                loop.push(next);
                cur = next;
            }
            if (loop.length >= 4) loops.push(loop);
        }
    }
    if (!loops.length) return null;
    // Largest by absolute area.
    let best = null, bestA = -1;
    for (const lp of loops) {
        const A = Math.abs(polyArea(lp));
        if (A > bestA) { bestA = A; best = lp; }
    }
    return best;
}

function polyArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        a += (pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]);
    }
    return a / 2;
}

/** Remove the middle of any three (near-)collinear consecutive points. */
function dropCollinear(pts) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
        const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(cross) > 1e-9) out.push(b);
    }
    return out.length >= 3 ? out : pts;
}

/** Ramer–Douglas–Peucker simplification of a (closed) point sequence. */
function douglasPeucker(pts, epsilon) {
    if (pts.length < 3) return pts;
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    const dist = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy;
        if (l2 < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
        let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    };
    while (stack.length) {
        const [s, e] = stack.pop();
        let maxD = 0, idx = -1;
        for (let i = s + 1; i < e; i++) {
            const d = dist(pts[i], pts[s], pts[e]);
            if (d > maxD) { maxD = d; idx = i; }
        }
        if (maxD > epsilon && idx > 0) {
            keep[idx] = true;
            stack.push([s, idx], [idx, e]);
        }
    }
    return pts.filter((_, i) => keep[i]);
}

// ==================== helpers ====================

function isCollider(obj) {
    let n = obj;
    while (n) {
        if (n.isURDFCollider) return true;
        n = n.parent;
    }
    return false;
}

function round(v) {
    return Math.round(v * 1000) / 1000;
}
