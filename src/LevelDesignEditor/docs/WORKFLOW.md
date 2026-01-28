# Level Design Editor Module

This module provides a 2D-to-3D level design workflow, allowing users to draw level layouts in 2D and instantly preview them as 3D whitebox geometry.

## Overview

The Level Design Editor enables:
1. Drawing level layouts on a 2D grid canvas
2. Real-time 3D preview with lighting and shadows
3. Multiple element types (walls, floors, spawn points)
4. Export to GLTF/GLB for use in Godot, Blender, Unity, etc.
5. Save/load levels as JSON with auto-save support

## Architecture

```
LevelDesignEditor/
├── Domain/           # Data models and business logic
│   ├── Level.ts
│   ├── LevelElement.ts
│   ├── GridSystem.ts
│   └── PlayerMetrics.ts
├── Presentation/     # UI components
│   ├── LevelEditor2D.ts
│   ├── LevelPreview3D.ts
│   └── EditorToolbar.ts
├── Export/           # Serialization and export
│   ├── LevelSerializer.ts
│   └── GLTFLevelExporter.ts
└── index.ts          # Entry point and wiring
```

### Domain Layer

#### Level.ts
Main level container class:
- Stores level metadata (name, author, timestamps)
- Manages a collection of `LevelElement` objects
- Grid size configuration
- Change notification system for reactive updates

```typescript
const level = new Level(20, 20, 'My Level');
level.addElement(wallElement);
level.onChange((level) => console.log('Level changed!'));
```

#### LevelElement.ts
Defines element types and factory functions:

| Type | Properties | Description |
|------|------------|-------------|
| `WallElement` | gridX, gridY, width, depth, wallHeight, elevation | Vertical barriers |
| `FloorElement` | gridX, gridY, width, depth, elevation, thickness | Horizontal surfaces |
| `SpawnElement` | gridX, gridY, spawnType, elevation | Entity spawn points |

Factory functions for creating elements:
- `createWallElement(gridX, gridY, width, depth, wallHeight?, elevation?)`
- `createFloorElement(gridX, gridY, width, depth, elevation?, thickness?)`
- `createSpawnElement(gridX, gridY, spawnType?, elevation?)`

#### GridSystem.ts
Grid coordinate utilities:
- `snapToGrid(x, y)` - Snap to nearest grid point
- `gridToWorld(gridX, gridY)` - Convert grid to world coordinates
- `worldToGrid(worldX, worldY)` - Convert world to grid coordinates
- `pixelToGrid(...)` / `gridToPixel(...)` - Canvas coordinate conversion

#### PlayerMetrics.ts
Player dimension constants for future validation:
- `PLAYER_HEIGHT` - 1.8m standing height
- `CROUCH_HEIGHT` - 0.9m crouched
- `PLAYER_WIDTH` - 0.6m capsule diameter
- `JUMP_HEIGHT` - 1.0m maximum jump
- `STEP_HEIGHT` - 0.3m step-up threshold

### Presentation Layer

#### LevelEditor2D.ts
Canvas-based 2D grid editor:

**Tools:**
- `wall` - Click and drag to draw rectangular walls
- `floor` - Click and drag to draw floor areas
- `spawn` - Click to place spawn points
- `select` - Click to select elements
- `erase` - Click to delete elements

**Controls:**
- Left click + drag: Draw/select/erase
- Scroll wheel: Zoom in/out
- Hover: Shows grid cursor highlight

**Rendering:**
- Grid lines with major lines every 5 units
- Walls: Dark filled rectangles
- Floors: Lighter rectangles with diagonal pattern
- Spawns: Colored circles with type indicator (P/E/I)
- Selection: Blue dashed outline
- Ghost preview while drawing

#### LevelPreview3D.ts
Three.js 3D preview:

**Scene Setup:**
- PerspectiveCamera with OrbitControls
- Ground plane with grid helper
- Ambient light (0.4 intensity)
- Hemisphere light (sky/ground tint)
- Directional light with shadows (0.8 intensity)
- Fill light from opposite side

**Geometry Generation:**
- Walls → BoxGeometry (width, wallHeight, depth)
- Floors → BoxGeometry (width, thickness, depth)
- Spawns → CylinderGeometry marker + vertical pole

**Materials:**
- Walls: Gray MeshStandardMaterial (#718096)
- Floors: Lighter gray (#a0aec0)
- Spawns: Colored by type (green/red/yellow)

#### EditorToolbar.ts
Tool and action buttons:
- Tool selection buttons (Wall, Floor, Spawn, Select, Erase)
- Spawn type dropdown (Player, Enemy, Item)
- Wall height input
- Action buttons (Clear, Save, Load, Export GLB)

### Export Layer

#### LevelSerializer.ts
JSON serialization:
- `serialize(level)` - Convert to JSON string
- `deserialize(json)` - Parse JSON to Level object
- `downloadLevel(level)` - Trigger file download
- `loadLevelFromFile()` - Open file picker and load
- `saveToLocalStorage()` / `loadFromLocalStorage()` - Browser storage

**File Format:**
```json
{
  "version": "1.0",
  "level": {
    "metadata": { "name": "...", "author": "...", ... },
    "gridWidth": 20,
    "gridHeight": 20,
    "defaultWallHeight": 3,
    "elements": [ ... ]
  }
}
```

#### GLTFLevelExporter.ts
GLTF/GLB export using Three.js GLTFExporter:
- `export(options)` - Returns Blob with GLTF data
- `exportAndDownload(options)` - Export and trigger download
- Options: `binary` (GLB vs GLTF), `levelOnly` (exclude ground/grid)

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│ User Input  │────>│ Level       │────>│ LevelPreview3D  │
│ (2D Editor) │     │ (Model)     │     │ (3D Render)     │
└─────────────┘     └─────────────┘     └─────────────────┘
                          │
                          v
                    ┌─────────────────┐
                    │ GLTFExporter    │──> .glb file
                    │ LevelSerializer │──> .json file
                    └─────────────────┘
```

1. User draws on 2D canvas → creates LevelElements
2. Level model stores elements and notifies listeners
3. LevelPreview3D rebuilds 3D geometry on change
4. Export generates GLTF from 3D scene or JSON from Level

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1 | Wall tool |
| 2 | Floor tool |
| 3 | Spawn tool |
| 4 | Select tool |
| 5 | Erase tool |
| Delete/Backspace | Delete selected |
| Escape | Clear selection |
| Ctrl+S | Save level |
| Ctrl+O | Load level |
| Ctrl+E | Export GLB |

## Godot Integration

The exported `.glb` file can be imported into Godot:

1. Export level as GLB from the editor
2. Drag the `.glb` file into Godot's FileSystem dock
3. Godot auto-imports as a scene
4. Instance the scene or open to edit

The geometry imports as MeshInstance3D nodes with basic materials. You can:
- Add collision shapes (use "Create Trimesh Collision Sibling")
- Replace materials with your own
- Add gameplay scripts

## Future Improvements

- Undo/redo system (command pattern)
- Ramp/stair elements for elevation changes
- Trigger zone elements
- Multi-floor/layer support with elevation
- Player metrics visualization (ghost player, jump arcs)
- AI-assisted level generation and validation
- Copy/paste elements
- Rotation for elements
- Custom textures per element
- Collision shape generation in export
