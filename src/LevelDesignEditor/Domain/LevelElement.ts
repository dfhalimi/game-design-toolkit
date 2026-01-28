/**
 * Level element types and interfaces
 * Defines the building blocks of a level: walls, floors, and spawn points
 */

/**
 * Supported element types
 */
export type ElementType = 'wall' | 'floor' | 'spawn';

/**
 * Spawn point types
 */
export type SpawnType = 'player' | 'enemy' | 'item';

/**
 * Base interface for all level elements
 */
export interface LevelElement {
    /** Unique identifier */
    id: string;
    /** Element type */
    type: ElementType;
    /** Grid X position (left edge) */
    gridX: number;
    /** Grid Y position (top edge in 2D view, Z in 3D) */
    gridY: number;
    /** Width in grid units */
    width: number;
    /** Depth in grid units (height in 2D view) */
    depth: number;
}

/**
 * Wall element - vertical barrier
 */
export interface WallElement extends LevelElement {
    type: 'wall';
    /** Vertical height in meters */
    wallHeight: number;
    /** Base elevation in meters */
    elevation: number;
}

/**
 * Floor element - horizontal walkable surface
 */
export interface FloorElement extends LevelElement {
    type: 'floor';
    /** Floor elevation in meters */
    elevation: number;
    /** Floor thickness in meters */
    thickness: number;
}

/**
 * Spawn point element - entity spawn location
 */
export interface SpawnElement extends LevelElement {
    type: 'spawn';
    /** Type of entity to spawn */
    spawnType: SpawnType;
    /** Spawn elevation in meters */
    elevation: number;
}

/**
 * Union type for all element types
 */
export type AnyLevelElement = WallElement | FloorElement | SpawnElement;

/**
 * Default values for element creation
 */
export const DEFAULT_WALL_HEIGHT = 3.0;
export const DEFAULT_FLOOR_THICKNESS = 0.1;
export const DEFAULT_ELEVATION = 0;

/**
 * Generates a unique element ID
 */
export function generateElementId(): string {
    return `elem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a new wall element
 */
export function createWallElement(
    gridX: number,
    gridY: number,
    width: number,
    depth: number,
    wallHeight: number = DEFAULT_WALL_HEIGHT,
    elevation: number = DEFAULT_ELEVATION
): WallElement {
    return {
        id: generateElementId(),
        type: 'wall',
        gridX,
        gridY,
        width,
        depth,
        wallHeight,
        elevation
    };
}

/**
 * Creates a new floor element
 */
export function createFloorElement(
    gridX: number,
    gridY: number,
    width: number,
    depth: number,
    elevation: number = DEFAULT_ELEVATION,
    thickness: number = DEFAULT_FLOOR_THICKNESS
): FloorElement {
    return {
        id: generateElementId(),
        type: 'floor',
        gridX,
        gridY,
        width,
        depth,
        elevation,
        thickness
    };
}

/**
 * Creates a new spawn element
 */
export function createSpawnElement(
    gridX: number,
    gridY: number,
    spawnType: SpawnType = 'player',
    elevation: number = DEFAULT_ELEVATION
): SpawnElement {
    return {
        id: generateElementId(),
        type: 'spawn',
        gridX,
        gridY,
        width: 1,
        depth: 1,
        spawnType,
        elevation
    };
}

/**
 * Type guard for WallElement
 */
export function isWallElement(element: LevelElement): element is WallElement {
    return element.type === 'wall';
}

/**
 * Type guard for FloorElement
 */
export function isFloorElement(element: LevelElement): element is FloorElement {
    return element.type === 'floor';
}

/**
 * Type guard for SpawnElement
 */
export function isSpawnElement(element: LevelElement): element is SpawnElement {
    return element.type === 'spawn';
}
