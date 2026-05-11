# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

A top-down 2.5D "couch potato" browser game built with Three.js + Rapier 2D + Vite. The player moves around a living room with WASD/arrow keys, eats scattered food (which triggers humorous events affecting weight/happiness stats), and performs workout exercises to lose weight. A **desire system** drives semi-automatic food-seeking behavior — when appetite is high, the character auto-walks toward food, and the player must suppress cravings with Space or burn calories via 10 workout moves.

Player model is loaded from GLB (soldier.glb) with Mixamo bone-based procedural animations for all workouts. Furniture and food use placeholder geometry with `// TODO:` comments for future GLB swaps.

## Commands

```bash
npm install          # Install dependencies (three, vite, @dimforge/rapier2d-compat)
npm run dev          # Start Vite dev server (default port 5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

There are no tests, linting, or formatting tools configured.

## Architecture

```
src/
├── main.js      # Entry point: async init, renderer, PerspectiveCamera, game loop
├── scene.js     # Living room environment (floor, walls, 15 furniture items, lights)
├── player.js    # Player movement, state (weight, happiness), GLB model + 10 procedural bone animations
├── desire.js    # Desire/appetite system: natural growth, auto-pathfinding to food, Space suppression
├── workout.js   # Workout system: 10 exercise definitions, progress tracking, stat effects
├── food.js      # Food spawning/management, proximity-based eat detection
├── ui.js        # HTML overlay: weight/happiness/desire bars, workout panel, progress bar, dialog, desire bubble
├── events.js    # Event table (11 entries), trigger logic on food eaten
├── input.js     # Keyboard/mouse handling: WASD, Space, Tab, 1-9/0 workout keys, camera orbit
├── physics.js   # Rapier 2D physics: zero-gravity world, collision bodies, step simulation
├── assets.js    # GLB resource loading with progress, caching
└── utils.js     # Coordinate mapping (physTo3D), random helpers, weighted selection
```

### Module Dependencies

```
main.js (async init: physics → assets → scene → player → food → input → ui → workout)
  ├── physics.js   (init collision world, step simulation)
  ├── assets.js    (preload GLB models)
  ├── scene.js     (creates environment, registers furniture colliders via physics.js)
  ├── player.js    (reads/writes physics position, uses assets.js for model)
  ├── desire.js    (appetite growth, auto-pathfinding logic)
  ├── workout.js   (exercise definitions, progress, stat effects)
  ├── food.js      (spawns/respawns food, proximity eat detection)
  ├── ui.js        (refreshes HUD each frame)
  ├── events.js    (triggers when food eaten)
  └── input.js     (feeds keyboard/mouse input)

scene.js → physics.js   (createFurnitureCollider)
player.js → physics.js  (setPlayerPosition, getPlayerPosition, stepPhysics)
player.js → assets.js   (getAssetRaw for GLB model + animations)
food.js → utils.js      (physTo3D, randomRange)
workout.js → player.js  (modifyWeight, modifyHappiness)
workout.js → desire.js  (satisfyDesireOnWorkout)
ui.js → workout.js      (WORKOUTS constant for panel rendering)
events.js → player.js   (modify stats)
events.js → ui.js       (show dialog)
```

### Circular Dependency Note

`ui.js ↔ workout.js` form a potential cycle. It is resolved by having `workout.js` use an injected dialog function (`setDialogFn`) instead of directly importing from `ui.js`. The injection happens in `main.js` during initialization.

### Key Design Decisions

- **Physics**: `@dimforge/rapier2d-compat` handles all collision in a zero-gravity 2D world. Player is a `kinematicPositionBased` rigid body with a `ball(0.35)` collider; furniture/walls are `fixed` bodies with cuboid colliders. Rapier auto-resolves penetration (wall sliding).
- **Coordinate system**: Game logic uses 2D coordinates (x, y) in Rapier's plane. `utils.js` `physTo3D(x2d, y2d)` maps directly: `x_3d = x2d`, `z_3d = y2d`, `y_3d = 0`. This is a top-down mapping, **not** isometric.
- **Camera**: `PerspectiveCamera` (FOV 60). Third-person orbit following the player. Left-click drag rotates yaw/pitch; scroll wheel zooms. No panning.
- **Asset loading**: `assets.js` preloads all GLB models before game starts. Loading screen shows progress. Models cached and accessed via `getAsset()` (cloned scene) / `getAssetRaw()` (raw GLTF with animations).
- **Placeholder models**: Furniture meshes use simple geometry with `// TODO: 替换为 xxx GLB 模型` comments. Do not remove these comments. Food items also use BoxGeometry placeholders with similar TODO comments.
- **UI overlay**: HTML/CSS elements positioned absolutely over the canvas. Includes stat bars (weight/happiness/desire), toggleable workout panel (Tab), workout progress bar, auto-dismissing dialog, and floating desire bubble emoji.
- **Desire system**: Appetite grows naturally (0.5/sec). At >= 70, character auto-walks toward nearest food at 60% speed. Space suppresses desire (2/sec). Eating reduces desire by 30; completing a workout reduces it by 10.
- **Workout system**: 10 exercises across 3 categories (基础/器械/搞笑), each with duration, weight delta, and happiness delta. Triggered by keys 1-9 and 0. Uses procedural Mixamo bone animations in `player.js`. Progress tracked in `workout.js`; ESC cancels with partial effect.
- **Event system**: 11 humorous events triggered on food eaten (70% chance). Weighted random selection. New events can be added to `events.js` EVENTS array or at runtime via `addEvent()`.

## Important Conventions

- Player state (weight, happiness) is managed in `player.js` and modified through its exports (`modifyWeight`/`modifyHappiness`). Callers include `events.js` and `workout.js`.
- Player position is the source of truth in Rapier. Use `getX2d()`/`getY2d()` (which read from physics) instead of caching local state.
- Desire state is managed in `desire.js` with no external dependencies. Modified via `updateDesire()`, `satisfyDesireOnEat()`, `satisfyDesireOnWorkout()`.
- Food items store 3D coordinates (`x`, `z`) and a reference to their Three.js mesh. Removing a food item must dispose its geometry/material and remove from scene.
- When adding new events, add entries to the `EVENTS` array in `events.js` following the existing `{ text, weightDelta, happinessDelta, probability }` shape.
- When adding new workouts, add entries to the `WORKOUTS` array in `workout.js`, add a bone animation function in `player.js` and register it in `ACTION_ANIMATIONS`, and optionally add a key binding in `input.js` `WORKOUT_KEY_MAP`.
- When adding new furniture, pass `collider: { hw, hh }` to `addFurniture()` — it auto-registers with Rapier. Omit `collider` for walkable/overhead items.
- The renderer and camera are created in `main.js` and not exported. Other modules receive `scene` as a parameter.
- Rapier uses the `-compat` package (WASM embedded as base64) so no special Vite WASM config is needed.

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow keys | Camera-relative movement |
| Space (hold) | Suppress appetite / resist cravings |
| Tab | Toggle workout panel |
| 1–9, 0 | Trigger workout exercises |
| Escape | Cancel current workout/action |
| Left-click drag | Orbit camera (yaw/pitch) |
| Scroll wheel | Zoom camera (distance 2–15) |

## Detailed Technical Reference

For comprehensive module documentation including all exports, constants, parameters, and internal state, see `TECHNICAL_REFERENCE.md`.
