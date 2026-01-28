/**
 * 2D Level Editor
 * Canvas-based grid editor for drawing level layouts
 */

import { Level } from '../Domain/Level.js';
import { GridSystem } from '../Domain/GridSystem.js';
import {
    AnyLevelElement,
    ElementType,
    SpawnType,
    createWallElement,
    createFloorElement,
    createSpawnElement,
    isWallElement,
    isFloorElement,
    isSpawnElement
} from '../Domain/LevelElement.js';

/**
 * Editor tool types
 */
export type EditorTool = 'wall' | 'floor' | 'spawn' | 'select' | 'erase';

/**
 * Editor state change callback
 */
export type EditorStateCallback = (state: EditorState) => void;

/**
 * Editor state
 */
export interface EditorState {
    tool: EditorTool;
    selectedElement: AnyLevelElement | null;
    spawnType: SpawnType;
    wallHeight: number;
    floorElevation: number;
}

/**
 * 2D Level Editor class
 */
export class LevelEditor2D {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private level: Level;
    private gridSystem: GridSystem;

    // View settings
    private pixelsPerUnit: number = 30;
    private offsetX: number = 0;
    private offsetY: number = 0;

    // Tool state
    private currentTool: EditorTool = 'wall';
    private selectedElement: AnyLevelElement | null = null;
    private spawnType: SpawnType = 'player';
    private wallHeight: number = 3.0;
    private floorElevation: number = 0;

    // Drawing state
    private isDrawing: boolean = false;
    private drawStartX: number = 0;
    private drawStartY: number = 0;
    private currentGridX: number = 0;
    private currentGridY: number = 0;

    // Callbacks
    private stateCallbacks: EditorStateCallback[] = [];

    // Colors
    private readonly GRID_COLOR = '#e0e0e0';
    private readonly GRID_MAJOR_COLOR = '#c0c0c0';
    private readonly WALL_COLOR = '#4a5568';
    private readonly WALL_STROKE = '#2d3748';
    private readonly FLOOR_COLOR = '#a0aec0';
    private readonly FLOOR_STROKE = '#718096';
    private readonly SPAWN_PLAYER_COLOR = '#48bb78';
    private readonly SPAWN_ENEMY_COLOR = '#f56565';
    private readonly SPAWN_ITEM_COLOR = '#ecc94b';
    private readonly SELECTION_COLOR = '#4299e1';
    private readonly GHOST_ALPHA = 0.4;

    constructor(canvasId: string, level: Level) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2d context from canvas');
        }

        this.canvas = canvas;
        this.ctx = ctx;
        this.level = level;
        this.gridSystem = new GridSystem();

        this.setupEventListeners();
        this.centerView();
        this.render();

        // Re-render when level changes
        this.level.onChange(() => this.render());
    }

    /**
     * Sets up mouse and keyboard event listeners
     */
    private setupEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));

        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Centers the view on the grid
     */
    private centerView(): void {
        const gridSize = this.level.getGridSize();
        const gridPixelWidth = gridSize.width * this.pixelsPerUnit;
        const gridPixelHeight = gridSize.height * this.pixelsPerUnit;

        this.offsetX = (this.canvas.width - gridPixelWidth) / 2;
        this.offsetY = (this.canvas.height - gridPixelHeight) / 2;
    }

    /**
     * Handles mouse down events
     */
    private handleMouseDown(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;

        const [gridX, gridY] = this.pixelToGrid(pixelX, pixelY);

        if (e.button === 0) { // Left click
            if (this.currentTool === 'select') {
                this.selectElementAt(gridX, gridY);
            } else if (this.currentTool === 'erase') {
                this.eraseElementAt(gridX, gridY);
            } else if (this.currentTool === 'spawn') {
                // Spawns are placed immediately on click
                this.placeSpawn(gridX, gridY);
            } else {
                // Start drawing for wall/floor
                this.isDrawing = true;
                this.drawStartX = gridX;
                this.drawStartY = gridY;
            }
        }

        this.render();
    }

    /**
     * Handles mouse move events
     */
    private handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;

        const [gridX, gridY] = this.pixelToGrid(pixelX, pixelY);
        this.currentGridX = gridX;
        this.currentGridY = gridY;

        this.render();
    }

    /**
     * Handles mouse up events
     */
    private handleMouseUp(e: MouseEvent): void {
        if (this.isDrawing && e.button === 0) {
            this.finishDrawing();
        }
        this.isDrawing = false;
        this.render();
    }

    /**
     * Handles mouse leave events
     */
    private handleMouseLeave(): void {
        this.isDrawing = false;
        this.render();
    }

    /**
     * Handles scroll wheel for zooming
     */
    private handleWheel(e: WheelEvent): void {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Get grid position before zoom
        const [gridX, gridY] = this.pixelToGrid(mouseX, mouseY);

        // Adjust zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newPixelsPerUnit = Math.max(10, Math.min(100, this.pixelsPerUnit * zoomFactor));

        // Calculate new offset to keep mouse position stable
        const [newPixelX, newPixelY] = this.gridToPixel(gridX, gridY, newPixelsPerUnit);
        this.offsetX += mouseX - newPixelX - this.offsetX;
        this.offsetY += mouseY - newPixelY - this.offsetY;

        this.pixelsPerUnit = newPixelsPerUnit;
        this.render();
    }

    /**
     * Converts pixel coordinates to grid coordinates
     */
    private pixelToGrid(pixelX: number, pixelY: number): [number, number] {
        const gridX = Math.floor((pixelX - this.offsetX) / this.pixelsPerUnit);
        const gridY = Math.floor((pixelY - this.offsetY) / this.pixelsPerUnit);
        return [gridX, gridY];
    }

    /**
     * Converts grid coordinates to pixel coordinates
     */
    private gridToPixel(
        gridX: number,
        gridY: number,
        ppu: number = this.pixelsPerUnit
    ): [number, number] {
        return [
            gridX * ppu + this.offsetX,
            gridY * ppu + this.offsetY
        ];
    }

    /**
     * Finishes a drawing operation and creates an element
     */
    private finishDrawing(): void {
        const startX = Math.min(this.drawStartX, this.currentGridX);
        const startY = Math.min(this.drawStartY, this.currentGridY);
        const endX = Math.max(this.drawStartX, this.currentGridX);
        const endY = Math.max(this.drawStartY, this.currentGridY);

        const width = endX - startX + 1;
        const depth = endY - startY + 1;

        if (width > 0 && depth > 0) {
            if (this.currentTool === 'wall') {
                const wall = createWallElement(
                    startX,
                    startY,
                    width,
                    depth,
                    this.wallHeight
                );
                this.level.addElement(wall);
            } else if (this.currentTool === 'floor') {
                const floor = createFloorElement(
                    startX,
                    startY,
                    width,
                    depth,
                    this.floorElevation
                );
                this.level.addElement(floor);
            }
        }
    }

    /**
     * Places a spawn point at the given grid position
     */
    private placeSpawn(gridX: number, gridY: number): void {
        const spawn = createSpawnElement(gridX, gridY, this.spawnType);
        this.level.addElement(spawn);
    }

    /**
     * Selects an element at the given grid position
     */
    private selectElementAt(gridX: number, gridY: number): void {
        const elements = this.level.getElementsAt(gridX, gridY);
        if (elements.length > 0) {
            this.selectedElement = elements[elements.length - 1]; // Top element
        } else {
            this.selectedElement = null;
        }
        this.notifyStateChange();
    }

    /**
     * Erases elements at the given grid position
     */
    private eraseElementAt(gridX: number, gridY: number): void {
        const elements = this.level.getElementsAt(gridX, gridY);
        if (elements.length > 0) {
            // Remove the top element
            this.level.removeElement(elements[elements.length - 1].id);
        }
    }

    /**
     * Main render function
     */
    render(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Fill background
        this.ctx.fillStyle = '#f7fafc';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawElements();
        this.drawGhostPreview();
        this.drawCursor();
    }

    /**
     * Draws the grid
     */
    private drawGrid(): void {
        const gridSize = this.level.getGridSize();

        // Draw grid background
        const [startX, startY] = this.gridToPixel(0, 0);
        const gridPixelWidth = gridSize.width * this.pixelsPerUnit;
        const gridPixelHeight = gridSize.height * this.pixelsPerUnit;

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(startX, startY, gridPixelWidth, gridPixelHeight);

        // Draw grid lines
        this.ctx.strokeStyle = this.GRID_COLOR;
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= gridSize.width; x++) {
            const [px] = this.gridToPixel(x, 0);
            this.ctx.beginPath();
            this.ctx.moveTo(px, startY);
            this.ctx.lineTo(px, startY + gridPixelHeight);
            
            // Major lines every 5 units
            if (x % 5 === 0) {
                this.ctx.strokeStyle = this.GRID_MAJOR_COLOR;
                this.ctx.lineWidth = 2;
            } else {
                this.ctx.strokeStyle = this.GRID_COLOR;
                this.ctx.lineWidth = 1;
            }
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= gridSize.height; y++) {
            const [, py] = this.gridToPixel(0, y);
            this.ctx.beginPath();
            this.ctx.moveTo(startX, py);
            this.ctx.lineTo(startX + gridPixelWidth, py);
            
            if (y % 5 === 0) {
                this.ctx.strokeStyle = this.GRID_MAJOR_COLOR;
                this.ctx.lineWidth = 2;
            } else {
                this.ctx.strokeStyle = this.GRID_COLOR;
                this.ctx.lineWidth = 1;
            }
            this.ctx.stroke();
        }

        // Draw border
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, startY, gridPixelWidth, gridPixelHeight);
    }

    /**
     * Draws all level elements
     */
    private drawElements(): void {
        const elements = this.level.getAllElements();

        // Draw floors first (below walls)
        elements.filter(isFloorElement).forEach(element => {
            this.drawFloorElement(element);
        });

        // Draw walls
        elements.filter(isWallElement).forEach(element => {
            this.drawWallElement(element);
        });

        // Draw spawns on top
        elements.filter(isSpawnElement).forEach(element => {
            this.drawSpawnElement(element);
        });
    }

    /**
     * Draws a wall element
     */
    private drawWallElement(element: AnyLevelElement): void {
        const [px, py] = this.gridToPixel(element.gridX, element.gridY);
        const width = element.width * this.pixelsPerUnit;
        const height = element.depth * this.pixelsPerUnit;

        this.ctx.fillStyle = this.WALL_COLOR;
        this.ctx.fillRect(px, py, width, height);

        this.ctx.strokeStyle = this.WALL_STROKE;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px, py, width, height);

        // Draw selection highlight
        if (this.selectedElement?.id === element.id) {
            this.drawSelectionHighlight(px, py, width, height);
        }
    }

    /**
     * Draws a floor element
     */
    private drawFloorElement(element: AnyLevelElement): void {
        const [px, py] = this.gridToPixel(element.gridX, element.gridY);
        const width = element.width * this.pixelsPerUnit;
        const height = element.depth * this.pixelsPerUnit;

        this.ctx.fillStyle = this.FLOOR_COLOR;
        this.ctx.fillRect(px, py, width, height);

        this.ctx.strokeStyle = this.FLOOR_STROKE;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px, py, width, height);

        // Diagonal lines pattern to distinguish from walls
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(px, py, width, height);
        this.ctx.clip();

        this.ctx.strokeStyle = this.FLOOR_STROKE;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;

        const spacing = 10;
        for (let i = -height; i < width + height; i += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(px + i, py);
            this.ctx.lineTo(px + i + height, py + height);
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Draw selection highlight
        if (this.selectedElement?.id === element.id) {
            this.drawSelectionHighlight(px, py, width, height);
        }
    }

    /**
     * Draws a spawn element
     */
    private drawSpawnElement(element: AnyLevelElement): void {
        if (!isSpawnElement(element)) return;

        const [px, py] = this.gridToPixel(element.gridX, element.gridY);
        const size = this.pixelsPerUnit;
        const centerX = px + size / 2;
        const centerY = py + size / 2;
        const radius = size * 0.35;

        // Choose color based on spawn type
        let color: string;
        switch (element.spawnType) {
            case 'player':
                color = this.SPAWN_PLAYER_COLOR;
                break;
            case 'enemy':
                color = this.SPAWN_ENEMY_COLOR;
                break;
            case 'item':
                color = this.SPAWN_ITEM_COLOR;
                break;
        }

        // Draw spawn marker
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw spawn type indicator
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${radius}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const label = element.spawnType[0].toUpperCase();
        this.ctx.fillText(label, centerX, centerY);

        // Draw selection highlight
        if (this.selectedElement?.id === element.id) {
            this.drawSelectionHighlight(px, py, size, size);
        }
    }

    /**
     * Draws selection highlight around an element
     */
    private drawSelectionHighlight(x: number, y: number, width: number, height: number): void {
        this.ctx.strokeStyle = this.SELECTION_COLOR;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        this.ctx.setLineDash([]);
    }

    /**
     * Draws ghost preview while drawing
     */
    private drawGhostPreview(): void {
        if (!this.isDrawing) return;

        const startX = Math.min(this.drawStartX, this.currentGridX);
        const startY = Math.min(this.drawStartY, this.currentGridY);
        const endX = Math.max(this.drawStartX, this.currentGridX);
        const endY = Math.max(this.drawStartY, this.currentGridY);

        const [px, py] = this.gridToPixel(startX, startY);
        const width = (endX - startX + 1) * this.pixelsPerUnit;
        const height = (endY - startY + 1) * this.pixelsPerUnit;

        this.ctx.globalAlpha = this.GHOST_ALPHA;

        if (this.currentTool === 'wall') {
            this.ctx.fillStyle = this.WALL_COLOR;
            this.ctx.fillRect(px, py, width, height);
            this.ctx.strokeStyle = this.WALL_STROKE;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(px, py, width, height);
        } else if (this.currentTool === 'floor') {
            this.ctx.fillStyle = this.FLOOR_COLOR;
            this.ctx.fillRect(px, py, width, height);
            this.ctx.strokeStyle = this.FLOOR_STROKE;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(px, py, width, height);
        }

        this.ctx.globalAlpha = 1;
    }

    /**
     * Draws the cursor indicator
     */
    private drawCursor(): void {
        const gridSize = this.level.getGridSize();

        // Only draw cursor if within grid bounds
        if (
            this.currentGridX < 0 ||
            this.currentGridX >= gridSize.width ||
            this.currentGridY < 0 ||
            this.currentGridY >= gridSize.height
        ) {
            return;
        }

        const [px, py] = this.gridToPixel(this.currentGridX, this.currentGridY);
        const size = this.pixelsPerUnit;

        // Draw hover highlight
        this.ctx.fillStyle = 'rgba(66, 153, 225, 0.2)';
        this.ctx.fillRect(px, py, size, size);

        this.ctx.strokeStyle = this.SELECTION_COLOR;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px, py, size, size);
    }

    // ========== Public API ==========

    /**
     * Sets the current tool
     */
    setTool(tool: EditorTool): void {
        this.currentTool = tool;
        this.notifyStateChange();
        this.render();
    }

    /**
     * Gets the current tool
     */
    getTool(): EditorTool {
        return this.currentTool;
    }

    /**
     * Sets the spawn type for spawn tool
     */
    setSpawnType(type: SpawnType): void {
        this.spawnType = type;
        this.notifyStateChange();
    }

    /**
     * Sets the wall height for wall tool
     */
    setWallHeight(height: number): void {
        this.wallHeight = Math.max(0.1, height);
        this.notifyStateChange();
    }

    /**
     * Sets the floor elevation for floor tool
     */
    setFloorElevation(elevation: number): void {
        this.floorElevation = elevation;
        this.notifyStateChange();
    }

    /**
     * Gets the selected element
     */
    getSelectedElement(): AnyLevelElement | null {
        return this.selectedElement;
    }

    /**
     * Clears the selection
     */
    clearSelection(): void {
        this.selectedElement = null;
        this.notifyStateChange();
        this.render();
    }

    /**
     * Deletes the selected element
     */
    deleteSelected(): void {
        if (this.selectedElement) {
            this.level.removeElement(this.selectedElement.id);
            this.selectedElement = null;
            this.notifyStateChange();
        }
    }

    /**
     * Gets the current editor state
     */
    getState(): EditorState {
        return {
            tool: this.currentTool,
            selectedElement: this.selectedElement,
            spawnType: this.spawnType,
            wallHeight: this.wallHeight,
            floorElevation: this.floorElevation
        };
    }

    /**
     * Registers a callback for editor state changes
     */
    onStateChange(callback: EditorStateCallback): void {
        this.stateCallbacks.push(callback);
    }

    /**
     * Notifies all state change callbacks
     */
    private notifyStateChange(): void {
        const state = this.getState();
        this.stateCallbacks.forEach(callback => callback(state));
    }

    /**
     * Gets the current zoom level (pixels per unit)
     */
    getZoom(): number {
        return this.pixelsPerUnit;
    }

    /**
     * Sets the zoom level
     */
    setZoom(pixelsPerUnit: number): void {
        this.pixelsPerUnit = Math.max(10, Math.min(100, pixelsPerUnit));
        this.render();
    }

    /**
     * Resets the view to center
     */
    resetView(): void {
        this.pixelsPerUnit = 30;
        this.centerView();
        this.render();
    }
}
