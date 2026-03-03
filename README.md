# Coriolis Game JS

`Coriolis Game JS` is a small browser-based simulation of projectile motion inside a rotating cylinder habitat. You launch projectiles from the inner surface and observe how Coriolis and centrifugal effects reshape the path in the rotating reference frame.

## Highlights

- Drag-to-launch interaction with a capped maximum shot speed
- Adjustable angular velocity from `-0.50` to `0.50` RPM
- Real-time display of launch speed relative to local tangential speed
- Lightweight static deployment: no build step, no backend, no package install

## Running Locally

Because the project is a static web app, any basic HTTP server is enough.

### Option 1: Python

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

### Option 2: Node.js

```bash
npx serve .
```

## Controls

- Click and drag inside the cylinder to aim and set launch speed.
- Release the pointer to fire.
- Use the RPM slider to change habitat rotation speed and direction.

## Production Notes

- Phaser is pinned to an exact CDN version in `index.html` for reproducible deployments.
- The simulation loop is frame-rate compensated so trajectories are more consistent across machines.
- Only the five most recent projectiles remain visible to keep the scene readable.

## Project Structure

- `index.html`: app shell, styles, controls, and script loading
- `main.js`: Phaser scene, drag handling, projectile updates, and rotating-frame forces

## License

Copyright (C) 2026 Daniel Häggström.

This project is licensed under the GNU General Public License v3.0 or later. See `LICENSE`.
