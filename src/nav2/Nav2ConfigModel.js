/**
 * Nav2ConfigModel - single source of truth for all Nav2 editing state.
 *
 * Holds the base frame selection, robot footprint, Collision Monitor polygons,
 * costmap parameters and observation sources. Everything the editor draws and
 * exports is derived from this object. Serializable to/from JSON so a project
 * can be saved and reloaded.
 *
 * Coordinate convention: all 2D points are [x, y] in metres in the selected
 * base frame (x forward, y left), matching Nav2 / ROS conventions.
 */

export const ACTION_TYPES = ['none', 'stop', 'slowdown', 'limit', 'approach'];

// Robot base / drive models the editor can target.
// `kind` groups them for motion-model / controller defaults:
//   diff      → differential-like (rotate in place, no lateral motion)
//   holonomic → can translate sideways (vy != 0)
//   car       → car-like (steered, has a minimum turning radius)
export const DRIVE_TYPES = [
    { id: 'differential', label: 'Differential', kind: 'diff' },
    { id: 'skid_steer', label: 'Skid steer', kind: 'diff' },
    { id: 'tricycle', label: 'Tricycle', kind: 'car' },
    { id: 'ackermann', label: 'Ackermann (car-like)', kind: 'car' },
    { id: 'four_wheel_steering', label: '4WS (four-wheel steering)', kind: 'car' },
    { id: 'omni', label: 'Omnidirectional', kind: 'holonomic' },
    { id: 'mecanum', label: 'Mecanum', kind: 'holonomic' },
    { id: 'legged', label: 'Legged / holonomic', kind: 'holonomic' }
];

/** Classify a drive type id into 'diff' | 'holonomic' | 'car'. */
export function driveKind(id) {
    const d = DRIVE_TYPES.find(x => x.id === id);
    return d ? d.kind : 'diff';
}

// Nav2 controller (FollowPath) plugins the editor can export.
export const CONTROLLER_PLUGINS = [
    { id: 'rpp', label: 'Regulated Pure Pursuit', plugin: 'nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController' },
    { id: 'dwb', label: 'DWB', plugin: 'dwb_core::DWBLocalPlanner' },
    { id: 'mppi', label: 'MPPI', plugin: 'nav2_mppi_controller::MPPIController' },
    { id: 'graceful', label: 'Graceful', plugin: 'nav2_graceful_controller::GracefulController' },
    { id: 'rotation_shim', label: 'Rotation Shim + RPP', plugin: 'nav2_rotation_shim_controller::RotationShimController' }
];

// Display colours per Collision Monitor action type (hex).
export const ACTION_COLORS = {
    none: 0x8e8e93,
    stop: 0xff3b30,
    slowdown: 0xff9f0a,
    limit: 0xffd60a,
    approach: 0x0a84ff
};

let _idCounter = 0;
function nextId() {
    _idCounter += 1;
    return `poly_${_idCounter}`;
}

export class Nav2ConfigModel {
    constructor() {
        this.reset();
    }

    reset() {
        this.baseFrame = 'base_link';
        this.odomFrame = 'odom';
        this.baseOffset = { x: 0, y: 0, yaw: 0 };
        this.transformTolerance = 0.1;
        this.sourceTimeout = 2.0;

        this.footprint = {
            mode: 'radius', // 'radius' | 'polygon'
            radius: 0.3,
            points: [[0.25, 0.25], [0.25, -0.25], [-0.25, -0.25], [-0.25, 0.25]],

            // Where the polygon came from + expansion controls.
            source: 'manual',          // 'manual' | 'projection'
            sourcePoints: [],          // raw vertical-projection points (pre scale/margin)
            scale: 1.0,                // multiply about centroid
            margin: 0.0,               // outward offset (m)
            projectionLayer: 'visual', // 'visual' | 'collision'
            projectMode: 'outline'     // 'outline' (detailed, concave) | 'hull' (convex)
        };

        /** @type {Array} Collision Monitor polygons */
        this.polygons = [];

        /** @type {Array} Costmap-filter zones (keepout / speed-limit) */
        this.zones = [];

        this.observationSources = [
            { name: 'scan', type: 'scan', topic: '/scan' }
        ];

        this.costmap = {
            useFootprint: false,
            robotRadius: 0.3,
            inflationRadius: 0.55,
            costScalingFactor: 3.0,
            resolution: 0.05
        };

        // Robot drive model + Nav2 controller (FollowPath) selection.
        this.controller = {
            driveType: 'differential', // see DRIVE_TYPES
            plugin: 'rpp',             // see CONTROLLER_PLUGINS
            maxVelX: 0.5,              // m/s (forward)
            minVelX: -0.5,             // m/s (reverse; 0 to forbid reversing)
            maxVelTheta: 1.0,          // rad/s
            maxAccelX: 1.0,            // m/s^2
            desiredLinearVel: 0.5,     // RPP cruise speed
            lookaheadDist: 0.6,        // RPP lookahead (m)
            minTurningRadius: 0.0,     // car-like / 4WS (m); 0 = not constrained
            allowReversing: false,

            // Which robot joints the drive/controller actuates (names from the model).
            driveJoints: [],           // wheel drive joints
            steeringJoints: [],        // steering joints (car-like / 4WS)
            wheelbase: 0.5,            // m, front-rear axle distance (for path arc)

            // Trajectory ("where it will go") preview that sweeps the footprint.
            previewEnabled: false,
            previewDistance: 2.0,      // m, how far ahead to draw the path
            previewSteerAngle: 0.0,    // rad, steering angle used for the arc

            // Global planner (planner_server GridBased). 'auto' picks by drive type.
            planner: 'auto'            // 'auto' | 'navfn' | 'smac2d' | 'smac_hybrid'
        };
    }

    /** Create a new polygon with sane Nav2 defaults and append it. */
    addPolygon(shape = 'polygon') {
        const index = this.polygons.length + 1;
        const poly = {
            id: nextId(),
            name: shape === 'circle' ? `circle_${index}` : `polygon_${index}`,
            shape, // 'polygon' | 'circle'
            points: shape === 'polygon'
                ? [[0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [-0.5, 0.5]]
                : [],
            radius: 0.5,
            action_type: 'stop',
            min_points: 4,
            slowdown_ratio: 0.3,
            linear_limit: 0.5,
            angular_limit: 0.5,
            time_before_collision: 1.2,
            simulation_time_step: 0.1,
            visualize: true,
            enabled: true
        };
        this.polygons.push(poly);
        return poly;
    }

    removePolygon(id) {
        this.polygons = this.polygons.filter(p => p.id !== id);
    }

    getPolygon(id) {
        return this.polygons.find(p => p.id === id) || null;
    }

    /** Costmap-filter zones (keepout / speed-limit), drawn in the map frame. */
    addZone(type = 'keepout') {
        const index = this.zones.length + 1;
        const zone = {
            id: nextId(),
            name: type === 'speed' ? `speed_${index}` : `keepout_${index}`,
            type,                       // 'keepout' | 'speed'
            points: [[1, 1], [1, -1], [-1, -1], [-1, 1]],
            speedLimit: 50,             // % of max speed (speed zones)
            enabled: true
        };
        this.zones.push(zone);
        return zone;
    }

    removeZone(id) {
        this.zones = this.zones.filter(z => z.id !== id);
    }

    getZone(id) {
        return this.zones.find(z => z.id === id) || null;
    }

    /** Serialize to a plain JSON-safe object. */
    toJSON() {
        return {
            version: 1,
            baseFrame: this.baseFrame,
            odomFrame: this.odomFrame,
            baseOffset: { ...this.baseOffset },
            transformTolerance: this.transformTolerance,
            sourceTimeout: this.sourceTimeout,
            footprint: {
                mode: this.footprint.mode,
                radius: this.footprint.radius,
                points: this.footprint.points.map(p => [...p]),
                source: this.footprint.source,
                sourcePoints: this.footprint.sourcePoints.map(p => [...p]),
                scale: this.footprint.scale,
                margin: this.footprint.margin,
                projectionLayer: this.footprint.projectionLayer,
                projectMode: this.footprint.projectMode
            },
            polygons: this.polygons.map(p => ({
                ...p,
                points: p.points.map(pt => [...pt])
            })),
            observationSources: this.observationSources.map(s => ({ ...s })),
            costmap: { ...this.costmap },
            controller: { ...this.controller },
            zones: this.zones.map(z => ({ ...z, points: z.points.map(pt => [...pt]) }))
        };
    }

    /** Replace state from a previously serialized object. */
    fromJSON(data) {
        if (!data || typeof data !== 'object') return;
        this.reset();
        if (data.baseFrame) this.baseFrame = data.baseFrame;
        if (data.odomFrame) this.odomFrame = data.odomFrame;
        if (data.baseOffset) this.baseOffset = { x: 0, y: 0, yaw: 0, ...data.baseOffset };
        if (typeof data.transformTolerance === 'number') this.transformTolerance = data.transformTolerance;
        if (typeof data.sourceTimeout === 'number') this.sourceTimeout = data.sourceTimeout;
        if (data.footprint) {
            const f = data.footprint;
            this.footprint = {
                mode: f.mode === 'polygon' ? 'polygon' : 'radius',
                radius: Number(f.radius) || 0.3,
                points: Array.isArray(f.points)
                    ? f.points.map(p => [Number(p[0]) || 0, Number(p[1]) || 0])
                    : this.footprint.points,
                source: f.source === 'projection' ? 'projection' : 'manual',
                sourcePoints: Array.isArray(f.sourcePoints)
                    ? f.sourcePoints.map(p => [Number(p[0]) || 0, Number(p[1]) || 0])
                    : [],
                scale: Number(f.scale) || 1.0,
                margin: Number(f.margin) || 0.0,
                projectionLayer: f.projectionLayer === 'collision' ? 'collision' : 'visual',
                projectMode: f.projectMode === 'hull' ? 'hull' : 'outline'
            };
        }
        if (Array.isArray(data.polygons)) {
            this.polygons = data.polygons.map(p => ({
                id: p.id || nextId(),
                name: p.name || 'polygon',
                shape: p.shape === 'circle' ? 'circle' : 'polygon',
                points: Array.isArray(p.points) ? p.points.map(pt => [Number(pt[0]) || 0, Number(pt[1]) || 0]) : [],
                radius: Number(p.radius) || 0.5,
                action_type: ACTION_TYPES.includes(p.action_type) ? p.action_type : 'stop',
                min_points: Number(p.min_points) || 4,
                slowdown_ratio: Number(p.slowdown_ratio) || 0.3,
                linear_limit: Number(p.linear_limit) || 0.5,
                angular_limit: Number(p.angular_limit) || 0.5,
                time_before_collision: Number(p.time_before_collision) || 1.2,
                simulation_time_step: Number(p.simulation_time_step) || 0.1,
                visualize: p.visualize !== false,
                enabled: p.enabled !== false
            }));
        }
        if (Array.isArray(data.observationSources)) {
            this.observationSources = data.observationSources.map(s => ({
                name: s.name || 'scan',
                type: s.type || 'scan',
                topic: s.topic || '/scan'
            }));
        }
        if (data.costmap) this.costmap = { ...this.costmap, ...data.costmap };
        if (data.controller) this.controller = { ...this.controller, ...data.controller };
        if (Array.isArray(data.zones)) {
            this.zones = data.zones.map(z => ({
                id: z.id || nextId(),
                name: z.name || 'zone',
                type: z.type === 'speed' ? 'speed' : 'keepout',
                points: Array.isArray(z.points) ? z.points.map(pt => [Number(pt[0]) || 0, Number(pt[1]) || 0]) : [],
                speedLimit: Number(z.speedLimit) || 50,
                enabled: z.enabled !== false
            }));
        }
    }
}
