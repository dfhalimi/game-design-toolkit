# Color Palette Generator & Level Design Editor

A web-based toolset for game developers and designers, featuring a color palette generator with 3D texture preview and a level design editor with GLTF export for Godot.

## Features

### Color Palette Generator
- Interactive HSL color wheel for color selection
- Complementary color generation
- Texture upload and HSL-based color adjustment
- 3D texture preview on various primitives (cube, sphere, plane)
- Full 3D scene preview with assignable material slots
- Animated background gradients with multiple effects

### Level Design Editor
- 2D grid-based level layout editor
- Real-time 3D whitebox preview with lighting and shadows
- Multiple element types: walls, floors, spawn points
- Export to GLTF/GLB format (compatible with Godot, Blender, Unity, etc.)
- Save/load levels as JSON
- Auto-save to browser localStorage

## Project Structure

```
├── public/                    # HTML entry points
│   ├── index.html            # Color Palette Generator
│   └── level-editor.html     # Level Design Editor
├── src/
│   ├── main.ts               # Color Palette entry point
│   ├── PaletteGenerator/     # Color palette module
│   │   ├── Domain/           # Business logic (color conversion, image processing)
│   │   ├── Presentation/     # UI components (color wheel, 3D preview)
│   │   └── docs/             # Module documentation
│   └── LevelDesignEditor/    # Level editor module
│       ├── Domain/           # Level data models, grid system
│       ├── Presentation/     # 2D editor, 3D preview, toolbar
│       ├── Export/           # GLTF exporter, JSON serializer
│       └── docs/             # Module documentation
├── build/                    # Compiled JavaScript output
└── tsconfig.json            # TypeScript configuration
```

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- TypeScript compiler (`tsc`) for development
- A local web server for running the application

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd color-palette-generator
```

### 2. Install TypeScript (if not already installed)

```bash
# Global installation
npm install -g typescript

# Or use npx (no installation needed)
npx tsc --version
```

### 3. Compile TypeScript

```bash
tsc
```

This compiles all TypeScript files from `src/` to `build/`.

### 4. Start a Local Web Server

The application uses ES modules, which require a web server (file:// protocol won't work).

**Option A: Using Python**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Option B: Using Node.js**
```bash
npx serve .
```

**Option C: Using VS Code Live Server**
Install the "Live Server" extension and click "Go Live".

### 5. Open in Browser

- Color Palette Generator: `http://localhost:8000/public/index.html`
- Level Design Editor: `http://localhost:8000/public/level-editor.html`

## Development

### File Watching

For continuous compilation during development:

```bash
tsc --watch
```

### Adding New Features

1. Add TypeScript files to the appropriate module in `src/`
2. Follow the existing Domain/Presentation separation pattern
3. Run `tsc` to compile
4. Refresh the browser to see changes

### Code Architecture

The project follows a clean architecture pattern:

- **Domain**: Pure business logic, no UI dependencies
- **Presentation**: UI components that use domain classes
- **Export**: Serialization and file export functionality

## External Dependencies

The project loads Three.js from CDN via import maps (no npm install required):

- [Three.js](https://threejs.org/) v0.160.0 - 3D rendering
- OrbitControls - Camera controls
- GLTFExporter - GLTF/GLB export

## Browser Support

- Chrome 89+
- Firefox 108+
- Safari 16.4+
- Edge 89+

(Requires ES modules and import maps support)

## License

MIT License - See LICENSE file for details.
