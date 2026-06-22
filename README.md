# Nav2 Editor

[![License](https://img.shields.io/badge/license-Apache--2.0-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web-orange.svg)](#)
[![Three.js](https://img.shields.io/badge/Three.js-0.163.0-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.5.0-646cff.svg)](https://vitejs.dev/)

**Nav2 Editor** is a web-based editor for designing [Nav2](https://docs.nav2.org/) navigation
parameters on top of your own robot. Import a robot as a **URDF / Xacro / SDF** package,
visualize it in 3D, and then design Nav2-specific configuration directly on the model:
**Collision Monitor polygons**, **robot footprint**, **costmap parameters** and **base-frame**
selection — then export ready-to-use Nav2 YAML.

It is built on top of the excellent [Robot Viewer](https://github.com/fan-ziqi/robot_viewer)
([Three.js](https://threejs.org/)) project, so the full model viewer (joints, collision/visual
toggles, measurement, code editor) is included. All processing happens in your browser — your
models never leave your device.

## Features

- **Robot import**: URDF, Xacro, **SDF / world** (basic, extensible parser), MJCF, USD (partial).
- **Base frame**: pick which link is the Nav2 `base_frame_id` (e.g. `base_link` / `base_footprint`)
  with an optional authoring offset (x, y, yaw).
- **Footprint**: define the robot footprint as a radius or an editable polygon.
- **Collision Monitor polygons**: add polygon / circle shapes, choose the `action_type`
  (`stop`, `slowdown`, `limit`, `approach`), and set per-shape parameters
  (`slowdown_ratio`, `linear_limit` / `angular_limit`, `time_before_collision`, `min_points`, …).
  Drag vertices directly on the ground plane; colors follow the action type.
- **Costmap parameters**: `robot_radius` / footprint, `inflation_radius`, `cost_scaling_factor`,
  `resolution`.
- **Export**: `collision_monitor.yaml`, costmap parameter snippet, and a re-loadable project JSON.
- **Languages**: English, Türkçe, 中文.

## Quick start

```bash
pnpm install
pnpm run dev      # http://localhost:3000
pnpm run build    # production build into dist/
```

A sample robot is included at `public/examples/diffbot.sdf` — drag it onto the page to try the editor.

## Using the editor

1. Drag a robot file/folder (URDF/Xacro/SDF) onto the page, or use the file panel.
2. Open the **Nav2** panel from the top toolbar.
3. Pick the **Base Frame**, set the **Footprint**, and add **Collision Polygons**.
4. Use **Edit on canvas** to drag vertices, or **Draw points** to click new vertices on the ground.
   Right-click a vertex handle to delete it.
5. **Export** the YAML and merge it into your Nav2 parameter files.

> The polygon `points` string form matches Nav2 on ROS 2 Humble/Iron/Jazzy. Older distros used a
> flat float list — adjust if you target an older release.

## Deployment (GitHub Pages)

The Vite config uses relative asset paths (`base: './'`), so the build works on GitHub Pages.
A workflow at `.github/workflows/deploy.yml` builds and publishes `dist/` on every push to
`main`. Enable **Settings → Pages → Source: GitHub Actions** in your repository.

## Acknowledgements

- [Robot Viewer](https://github.com/fan-ziqi/robot_viewer) by Ziqi Fan — the 3D viewer this project
  is built on.
- [urdf-loader](https://github.com/gkjohnson/urdf-loaders), [xacro-parser](https://github.com/gkjohnson/xacro-parser),
  [three.js](https://threejs.org/), and the Nav2 community.

## License

Licensed under the [Apache License 2.0](LICENSE).
