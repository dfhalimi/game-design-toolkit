# Palette Generator Module

This module provides a color palette generation and texture adjustment workflow for game developers and designers.

## Overview

The Palette Generator allows users to:
1. Select colors using an interactive color wheel
2. Generate complementary colors
3. Upload textures and adjust their colors to match a palette
4. Preview adjusted textures on 3D models
5. Test colors in a full 3D scene with multiple material slots

## Architecture

```
PaletteGenerator/
├── Domain/           # Business logic (no UI dependencies)
│   ├── ColorConverter.ts
│   ├── ColorSchemeGenerator.ts
│   ├── ImageProcessor.ts
│   └── SceneMaterialManager.ts
└── Presentation/     # UI components
    ├── ColorWheel.ts
    ├── TextureAdjuster.ts
    ├── Texture3DPreview.ts
    └── ScenePreview.ts
```

### Domain Layer

#### ColorConverter.ts
Utility class for converting between color formats:
- `hslToRgb(h, s, l)` - HSL to RGB conversion
- `rgbToHex(r, g, b)` - RGB to hex string
- `hexToRgb(hex)` - Hex string to RGB

#### ColorSchemeGenerator.ts
Generates related colors based on color theory:
- `getComplementaryColor(hex)` - Returns the complementary (opposite) color

#### ImageProcessor.ts
Handles image analysis and HSL transformations:
- `getDominantColor(imageData)` - Extracts average color from image
- `rgbToHsl(r, g, b)` / `hslToRgb(h, s, l)` - Color space conversion
- `applyHslAdjustment(imageData, targetRgb)` - Shifts all pixels to match target color

#### SceneMaterialManager.ts
Manages material slots for the 3D scene preview:
- Maintains a map of material slots (ground, wall, primary, secondary, accent, sky)
- Supports both color and texture assignments
- Notifies listeners when slots change

### Presentation Layer

#### ColorWheel.ts
Interactive HSL color wheel canvas component:
- Click to select colors
- Manual hex input with validation
- Complementary color generation
- Animated background gradients (rotate, breathing, wave, pulse)

#### TextureAdjuster.ts
Texture upload and color adjustment component:
- File input for texture upload
- Target color picker (synced with color wheel)
- HSL-based color adjustment algorithm
- Download adjusted texture as PNG

#### Texture3DPreview.ts
Simple 3D preview for adjusted textures:
- Displays texture on cube, sphere, or plane
- Orbit controls for rotation/zoom
- Real-time texture updates

#### ScenePreview.ts
Full 3D scene with multiple material slots:
- Ground plane, back wall, and 3D objects
- Each object linked to a material slot
- Supports both color and texture per slot
- Shadows and professional lighting setup

## Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ ColorWheel  │────>│ TextureAdjuster  │────>│ Texture3DPreview│
│ (select)    │     │ (adjust texture) │     │ (preview)       │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                    │
       │                    v
       │            ┌──────────────────┐
       └───────────>│ ScenePreview     │
                    │ (material slots) │
                    └──────────────────┘
```

1. User selects a color on the ColorWheel
2. Selected color updates the TextureAdjuster's target color
3. User uploads a texture and applies adjustment
4. Adjusted texture updates in Texture3DPreview
5. User can assign the adjusted texture to ScenePreview material slots

## Key Concepts

### HSL Color Adjustment Algorithm
The texture adjustment works by:
1. Finding the dominant (average) color of the original texture
2. Converting both dominant and target colors to HSL
3. Calculating the difference in hue, saturation ratio, and lightness
4. Applying these shifts to every pixel while preserving relative differences

### Material Slot System
The scene preview uses named slots that map to 3D objects:
- `ground` - Floor plane
- `wall` - Back wall
- `primary` - Main object (cube)
- `secondary` - Secondary object (sphere)
- `accent` - Accent object (cylinder)
- `sky` - Scene background color

## Usage Example

```typescript
import { ColorWheel } from './Presentation/ColorWheel.js';
import { TextureAdjuster } from './Presentation/TextureAdjuster.js';
import { ScenePreview } from './Presentation/ScenePreview.js';
import { SceneMaterialManager } from './Domain/SceneMaterialManager.js';

// Initialize components
const colorWheel = new ColorWheel('colorWheelCanvas', 300);
colorWheel.draw();

const textureAdjuster = new TextureAdjuster(
    'originalCanvas',
    'adjustedCanvas',
    'fileInput',
    'colorInput',
    'applyButton',
    'downloadButton'
);

const materialManager = new SceneMaterialManager();
const scenePreview = new ScenePreview('sceneContainer', materialManager);

// Wire up: color selection updates texture adjuster
// ... see main.ts for full wiring
```

## Future Improvements

- Additional color schemes (analogous, triadic, tetradic)
- Color history/favorites
- Texture tiling controls
- More 3D primitives for preview
- Color accessibility checker (contrast ratios)
