/**
 * Level Design Editor
 * Main entry point - initializes and wires together all components
 */

import { Level } from './Domain/Level.js';
import { LevelEditor2D } from './Presentation/LevelEditor2D.js';
import { LevelPreview3D } from './Presentation/LevelPreview3D.js';
import { EditorToolbar, ToolbarCallbacks } from './Presentation/EditorToolbar.js';
import { LevelSerializer } from './Export/LevelSerializer.js';
import { GLTFLevelExporter } from './Export/GLTFLevelExporter.js';

/**
 * Level Design Editor Application
 */
class LevelDesignEditorApp {
    private level: Level;
    private editor2D: LevelEditor2D;
    private preview3D: LevelPreview3D;
    private toolbar: EditorToolbar;
    private exporter: GLTFLevelExporter | null = null;

    constructor() {
        // Initialize level
        this.level = new Level(20, 20, 'New Level');

        // Try to restore from localStorage
        this.tryRestoreLevel();

        // Initialize components
        this.initializeCanvas();
        this.editor2D = new LevelEditor2D('editor2dCanvas', this.level);
        this.preview3D = new LevelPreview3D('preview3dContainer', this.level);

        // Initialize toolbar with callbacks
        const callbacks: ToolbarCallbacks = {
            onClear: () => this.clearLevel(),
            onExport: () => this.exportLevel(),
            onSave: () => this.saveLevel(),
            onLoad: () => this.loadLevel()
        };
        this.toolbar = new EditorToolbar('toolbar', this.editor2D, callbacks);

        // Initialize exporter after preview3D is ready
        setTimeout(() => {
            this.exporter = new GLTFLevelExporter(this.preview3D, this.level);
        }, 1000);

        // Set up status bar updates
        this.setupStatusBar();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Auto-save on changes
        this.level.onChange(() => this.autoSave());
    }

    /**
     * Initializes the canvas with proper sizing
     */
    private initializeCanvas(): void {
        const canvas = document.getElementById('editor2dCanvas') as HTMLCanvasElement;
        if (canvas) {
            const container = canvas.parentElement;
            if (container) {
                // Set canvas size to match container
                const resize = () => {
                    canvas.width = container.clientWidth;
                    canvas.height = container.clientHeight;
                };

                resize();
                window.addEventListener('resize', resize);
            }
        }
    }

    /**
     * Tries to restore level from localStorage
     */
    private tryRestoreLevel(): void {
        try {
            const savedLevel = LevelSerializer.loadFromLocalStorage();
            if (savedLevel) {
                // Copy data from saved level to current level
                const savedData = savedLevel.toJSON() as any;
                const elements = savedData.elements || [];
                
                this.level.setGridSize(savedData.gridWidth || 20, savedData.gridHeight || 20);
                this.level.setDefaultWallHeight(savedData.defaultWallHeight || 3);
                
                if (savedData.metadata) {
                    this.level.setMetadata(savedData.metadata);
                }

                elements.forEach((element: any) => {
                    this.level.addElement(element);
                });

                console.log('Level restored from localStorage');
            }
        } catch (error) {
            console.warn('Failed to restore level:', error);
        }
    }

    /**
     * Sets up status bar updates
     */
    private setupStatusBar(): void {
        const updateStatus = () => {
            const gridSize = this.level.getGridSize();
            const elementCount = this.level.getElementCount();

            const gridElement = document.getElementById('statusGrid');
            const elementsElement = document.getElementById('statusElements');

            if (gridElement) {
                gridElement.textContent = `${gridSize.width} x ${gridSize.height}`;
            }

            if (elementsElement) {
                elementsElement.textContent = String(elementCount);
            }
        };

        // Initial update
        updateStatus();

        // Update on level changes
        this.level.onChange(updateStatus);

        // Update cursor position on mouse move
        const canvas = document.getElementById('editor2dCanvas');
        if (canvas) {
            canvas.addEventListener('mousemove', (e) => {
                const cursorElement = document.getElementById('statusCursor');
                if (cursorElement) {
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.floor((e.clientX - rect.left) / 30);
                    const y = Math.floor((e.clientY - rect.top) / 30);
                    cursorElement.textContent = `${x}, ${y}`;
                }
            });

            canvas.addEventListener('mouseleave', () => {
                const cursorElement = document.getElementById('statusCursor');
                if (cursorElement) {
                    cursorElement.textContent = '-';
                }
            });
        }
    }

    /**
     * Sets up keyboard shortcuts
     */
    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
                return;
            }

            switch (e.key) {
                case '1':
                    this.editor2D.setTool('wall');
                    break;
                case '2':
                    this.editor2D.setTool('floor');
                    break;
                case '3':
                    this.editor2D.setTool('spawn');
                    break;
                case '4':
                    this.editor2D.setTool('select');
                    break;
                case '5':
                    this.editor2D.setTool('erase');
                    break;
                case 'Delete':
                case 'Backspace':
                    if (this.editor2D.getSelectedElement()) {
                        e.preventDefault();
                        this.editor2D.deleteSelected();
                    }
                    break;
                case 'Escape':
                    this.editor2D.clearSelection();
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveLevel();
                    }
                    break;
                case 'o':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.loadLevel();
                    }
                    break;
                case 'e':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.exportLevel();
                    }
                    break;
            }
        });
    }

    /**
     * Clears the level
     */
    private clearLevel(): void {
        this.level.clear();
        LevelSerializer.clearLocalStorage();
    }

    /**
     * Saves the level to a file
     */
    private saveLevel(): void {
        LevelSerializer.downloadLevel(this.level);
    }

    /**
     * Loads a level from a file
     */
    private async loadLevel(): Promise<void> {
        try {
            const loadedLevel = await LevelSerializer.loadLevelFromFile();
            
            // Clear current level
            this.level.clear();

            // Copy data from loaded level
            const loadedData = loadedLevel.toJSON() as any;
            
            this.level.setGridSize(loadedData.gridWidth || 20, loadedData.gridHeight || 20);
            this.level.setDefaultWallHeight(loadedData.defaultWallHeight || 3);
            
            if (loadedData.metadata) {
                this.level.setMetadata(loadedData.metadata);
            }

            const elements = loadedData.elements || [];
            elements.forEach((element: any) => {
                this.level.addElement(element);
            });

            // Reset 3D preview camera
            this.preview3D.resetCamera();

            console.log('Level loaded successfully');
        } catch (error) {
            console.error('Failed to load level:', error);
            alert('Failed to load level file');
        }
    }

    /**
     * Exports the level to GLTF/GLB
     */
    private async exportLevel(): Promise<void> {
        if (!this.exporter) {
            alert('Please wait for the 3D preview to initialize');
            return;
        }

        if (!this.exporter.canExport()) {
            alert('Please add some elements to the level before exporting');
            return;
        }

        try {
            await this.exporter.exportAndDownload({
                binary: true,
                levelOnly: true
            });
            console.log('Level exported successfully');
        } catch (error) {
            console.error('Failed to export level:', error);
            alert('Failed to export level');
        }
    }

    /**
     * Auto-saves the level to localStorage
     */
    private autoSave(): void {
        try {
            LevelSerializer.saveToLocalStorage(this.level);
        } catch (error) {
            console.warn('Auto-save failed:', error);
        }
    }
}

/**
 * Initialize the application when DOM is ready
 */
function init(): void {
    try {
        new LevelDesignEditorApp();
        console.log('Level Design Editor initialized');
    } catch (error) {
        console.error('Failed to initialize Level Design Editor:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
