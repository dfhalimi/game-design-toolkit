/**
 * Level data model
 * Container for all level elements and metadata
 */

import {
    AnyLevelElement,
    LevelElement,
    DEFAULT_WALL_HEIGHT
} from './LevelElement.js';

/**
 * Callback type for level change notifications
 */
export type LevelChangeCallback = (level: Level) => void;

/**
 * Level metadata
 */
export interface LevelMetadata {
    name: string;
    author: string;
    createdAt: string;
    modifiedAt: string;
    description: string;
}

/**
 * Level class - main container for level data
 */
export class Level {
    private metadata: LevelMetadata;
    private gridWidth: number;
    private gridHeight: number;
    private elements: Map<string, AnyLevelElement>;
    private defaultWallHeight: number;
    private changeCallbacks: LevelChangeCallback[];

    constructor(
        gridWidth: number = 20,
        gridHeight: number = 20,
        name: string = 'Untitled Level'
    ) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.elements = new Map();
        this.defaultWallHeight = DEFAULT_WALL_HEIGHT;
        this.changeCallbacks = [];

        const now = new Date().toISOString();
        this.metadata = {
            name,
            author: '',
            createdAt: now,
            modifiedAt: now,
            description: ''
        };
    }

    /**
     * Gets level metadata
     */
    getMetadata(): LevelMetadata {
        return { ...this.metadata };
    }

    /**
     * Updates level metadata
     */
    setMetadata(metadata: Partial<LevelMetadata>): void {
        this.metadata = {
            ...this.metadata,
            ...metadata,
            modifiedAt: new Date().toISOString()
        };
        this.notifyChange();
    }

    /**
     * Gets the level name
     */
    getName(): string {
        return this.metadata.name;
    }

    /**
     * Sets the level name
     */
    setName(name: string): void {
        this.metadata.name = name;
        this.metadata.modifiedAt = new Date().toISOString();
        this.notifyChange();
    }

    /**
     * Gets grid dimensions
     */
    getGridSize(): { width: number; height: number } {
        return { width: this.gridWidth, height: this.gridHeight };
    }

    /**
     * Sets grid dimensions
     */
    setGridSize(width: number, height: number): void {
        this.gridWidth = Math.max(1, width);
        this.gridHeight = Math.max(1, height);
        this.metadata.modifiedAt = new Date().toISOString();
        this.notifyChange();
    }

    /**
     * Gets the default wall height
     */
    getDefaultWallHeight(): number {
        return this.defaultWallHeight;
    }

    /**
     * Sets the default wall height
     */
    setDefaultWallHeight(height: number): void {
        this.defaultWallHeight = Math.max(0.1, height);
        this.notifyChange();
    }

    /**
     * Adds an element to the level
     */
    addElement(element: AnyLevelElement): void {
        this.elements.set(element.id, element);
        this.metadata.modifiedAt = new Date().toISOString();
        this.notifyChange();
    }

    /**
     * Removes an element from the level
     */
    removeElement(elementId: string): boolean {
        const removed = this.elements.delete(elementId);
        if (removed) {
            this.metadata.modifiedAt = new Date().toISOString();
            this.notifyChange();
        }
        return removed;
    }

    /**
     * Gets an element by ID
     */
    getElement(elementId: string): AnyLevelElement | undefined {
        return this.elements.get(elementId);
    }

    /**
     * Gets all elements
     */
    getAllElements(): AnyLevelElement[] {
        return Array.from(this.elements.values());
    }

    /**
     * Gets elements at a specific grid position
     */
    getElementsAt(gridX: number, gridY: number): AnyLevelElement[] {
        return this.getAllElements().filter(element => {
            return (
                gridX >= element.gridX &&
                gridX < element.gridX + element.width &&
                gridY >= element.gridY &&
                gridY < element.gridY + element.depth
            );
        });
    }

    /**
     * Gets elements of a specific type
     */
    getElementsByType<T extends AnyLevelElement>(type: T['type']): T[] {
        return this.getAllElements().filter(
            element => element.type === type
        ) as T[];
    }

    /**
     * Updates an existing element
     */
    updateElement(elementId: string, updates: Partial<LevelElement>): boolean {
        const element = this.elements.get(elementId);
        if (element) {
            // Don't allow changing ID or type
            const { id, type, ...allowedUpdates } = updates as any;
            Object.assign(element, allowedUpdates);
            this.metadata.modifiedAt = new Date().toISOString();
            this.notifyChange();
            return true;
        }
        return false;
    }

    /**
     * Clears all elements from the level
     */
    clear(): void {
        this.elements.clear();
        this.metadata.modifiedAt = new Date().toISOString();
        this.notifyChange();
    }

    /**
     * Gets the total element count
     */
    getElementCount(): number {
        return this.elements.size;
    }

    /**
     * Registers a callback for level changes
     */
    onChange(callback: LevelChangeCallback): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * Removes a change callback
     */
    offChange(callback: LevelChangeCallback): void {
        const index = this.changeCallbacks.indexOf(callback);
        if (index !== -1) {
            this.changeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notifies all registered callbacks of a change
     */
    private notifyChange(): void {
        this.changeCallbacks.forEach(callback => callback(this));
    }

    /**
     * Exports level data to a plain object (for serialization)
     */
    toJSON(): object {
        return {
            metadata: this.metadata,
            gridWidth: this.gridWidth,
            gridHeight: this.gridHeight,
            defaultWallHeight: this.defaultWallHeight,
            elements: this.getAllElements()
        };
    }

    /**
     * Imports level data from a plain object
     */
    static fromJSON(data: any): Level {
        const level = new Level(
            data.gridWidth || 20,
            data.gridHeight || 20,
            data.metadata?.name || 'Imported Level'
        );

        if (data.metadata) {
            level.metadata = { ...level.metadata, ...data.metadata };
        }

        if (data.defaultWallHeight) {
            level.defaultWallHeight = data.defaultWallHeight;
        }

        if (Array.isArray(data.elements)) {
            data.elements.forEach((element: AnyLevelElement) => {
                level.elements.set(element.id, element);
            });
        }

        return level;
    }
}
