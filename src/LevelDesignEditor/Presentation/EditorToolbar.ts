/**
 * Editor Toolbar
 * Tool selection and action buttons for the level editor
 */

import { EditorTool, LevelEditor2D } from './LevelEditor2D.js';
import { SpawnType } from '../Domain/LevelElement.js';

/**
 * Toolbar button definition
 */
interface ToolbarButton {
    id: string;
    label: string;
    icon: string;
    tool?: EditorTool;
    action?: () => void;
}

/**
 * Toolbar action callbacks
 */
export interface ToolbarCallbacks {
    onClear: () => void;
    onExport: () => void;
    onSave: () => void;
    onLoad: () => void;
}

/**
 * Editor Toolbar class
 */
export class EditorToolbar {
    private container: HTMLElement;
    private editor: LevelEditor2D;
    private callbacks: ToolbarCallbacks;

    // Tool buttons
    private readonly toolButtons: ToolbarButton[] = [
        { id: 'tool-wall', label: 'Wall', icon: '▬', tool: 'wall' },
        { id: 'tool-floor', label: 'Floor', icon: '▢', tool: 'floor' },
        { id: 'tool-spawn', label: 'Spawn', icon: '◉', tool: 'spawn' },
        { id: 'tool-select', label: 'Select', icon: '⬚', tool: 'select' },
        { id: 'tool-erase', label: 'Erase', icon: '✕', tool: 'erase' }
    ];

    constructor(
        containerId: string,
        editor: LevelEditor2D,
        callbacks: ToolbarCallbacks
    ) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.container = container;
        this.editor = editor;
        this.callbacks = callbacks;

        this.render();
        this.setupEventListeners();
        this.updateActiveState();

        // Listen for editor state changes
        this.editor.onStateChange(() => this.updateActiveState());
    }

    /**
     * Renders the toolbar HTML
     */
    private render(): void {
        this.container.innerHTML = `
            <div class="toolbar-section toolbar-tools">
                ${this.toolButtons.map(btn => `
                    <button class="toolbar-btn" id="${btn.id}" title="${btn.label}">
                        <span class="toolbar-btn-icon">${btn.icon}</span>
                        <span class="toolbar-btn-label">${btn.label}</span>
                    </button>
                `).join('')}
            </div>

            <div class="toolbar-separator"></div>

            <div class="toolbar-section toolbar-spawn-types" id="spawnTypeSection" style="display: none;">
                <label class="toolbar-label">Spawn Type:</label>
                <select id="spawnTypeSelect" class="toolbar-select">
                    <option value="player">Player</option>
                    <option value="enemy">Enemy</option>
                    <option value="item">Item</option>
                </select>
            </div>

            <div class="toolbar-section toolbar-properties" id="propertiesSection">
                <label class="toolbar-label">Wall Height:</label>
                <input type="number" id="wallHeightInput" class="toolbar-input" value="3" min="0.1" step="0.5">
                <span class="toolbar-unit">m</span>
            </div>

            <div class="toolbar-separator"></div>

            <div class="toolbar-section toolbar-actions">
                <button class="toolbar-btn toolbar-btn-action" id="btn-clear" title="Clear All">
                    <span class="toolbar-btn-icon">🗑</span>
                    <span class="toolbar-btn-label">Clear</span>
                </button>
                <button class="toolbar-btn toolbar-btn-action" id="btn-save" title="Save Level">
                    <span class="toolbar-btn-icon">💾</span>
                    <span class="toolbar-btn-label">Save</span>
                </button>
                <button class="toolbar-btn toolbar-btn-action" id="btn-load" title="Load Level">
                    <span class="toolbar-btn-icon">📂</span>
                    <span class="toolbar-btn-label">Load</span>
                </button>
                <button class="toolbar-btn toolbar-btn-primary" id="btn-export" title="Export to GLTF">
                    <span class="toolbar-btn-icon">📦</span>
                    <span class="toolbar-btn-label">Export GLB</span>
                </button>
            </div>
        `;
    }

    /**
     * Sets up event listeners for toolbar buttons
     */
    private setupEventListeners(): void {
        // Tool buttons
        this.toolButtons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element && btn.tool) {
                element.addEventListener('click', () => {
                    this.editor.setTool(btn.tool!);
                });
            }
        });

        // Spawn type select
        const spawnTypeSelect = document.getElementById('spawnTypeSelect') as HTMLSelectElement;
        if (spawnTypeSelect) {
            spawnTypeSelect.addEventListener('change', () => {
                this.editor.setSpawnType(spawnTypeSelect.value as SpawnType);
            });
        }

        // Wall height input
        const wallHeightInput = document.getElementById('wallHeightInput') as HTMLInputElement;
        if (wallHeightInput) {
            wallHeightInput.addEventListener('change', () => {
                const height = parseFloat(wallHeightInput.value);
                if (!isNaN(height)) {
                    this.editor.setWallHeight(height);
                }
            });
        }

        // Action buttons
        const clearBtn = document.getElementById('btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all elements?')) {
                    this.callbacks.onClear();
                }
            });
        }

        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.callbacks.onSave());
        }

        const loadBtn = document.getElementById('btn-load');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.callbacks.onLoad());
        }

        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.callbacks.onExport());
        }
    }

    /**
     * Updates the active state of tool buttons
     */
    private updateActiveState(): void {
        const currentTool = this.editor.getTool();

        // Update tool button active states
        this.toolButtons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                if (btn.tool === currentTool) {
                    element.classList.add('active');
                } else {
                    element.classList.remove('active');
                }
            }
        });

        // Show/hide spawn type section based on current tool
        const spawnTypeSection = document.getElementById('spawnTypeSection');
        const propertiesSection = document.getElementById('propertiesSection');

        if (spawnTypeSection && propertiesSection) {
            if (currentTool === 'spawn') {
                spawnTypeSection.style.display = 'flex';
                propertiesSection.style.display = 'none';
            } else if (currentTool === 'wall') {
                spawnTypeSection.style.display = 'none';
                propertiesSection.style.display = 'flex';
            } else {
                spawnTypeSection.style.display = 'none';
                propertiesSection.style.display = 'none';
            }
        }
    }

    /**
     * Enables or disables the export button
     */
    setExportEnabled(enabled: boolean): void {
        const exportBtn = document.getElementById('btn-export') as HTMLButtonElement;
        if (exportBtn) {
            exportBtn.disabled = !enabled;
        }
    }
}
