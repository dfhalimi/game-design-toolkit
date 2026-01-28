/**
 * Grid system utilities
 * Handles coordinate snapping and conversion between grid and world coordinates
 */

/** Default grid cell size in world units (1 unit = 1 meter) */
export const DEFAULT_CELL_SIZE = 1.0;

/**
 * Grid system configuration and utilities
 */
export class GridSystem {
    private cellSize: number;

    constructor(cellSize: number = DEFAULT_CELL_SIZE) {
        this.cellSize = cellSize;
    }

    /**
     * Gets the current cell size
     */
    getCellSize(): number {
        return this.cellSize;
    }

    /**
     * Sets the cell size
     */
    setCellSize(size: number): void {
        if (size > 0) {
            this.cellSize = size;
        }
    }

    /**
     * Snaps a value to the nearest grid point
     * @param value The value to snap
     * @returns The snapped value
     */
    snap(value: number): number {
        return Math.round(value / this.cellSize) * this.cellSize;
    }

    /**
     * Snaps coordinates to the nearest grid point
     * @param x X coordinate
     * @param y Y coordinate
     * @returns Snapped coordinates as [x, y]
     */
    snapToGrid(x: number, y: number): [number, number] {
        return [this.snap(x), this.snap(y)];
    }

    /**
     * Converts grid coordinates to world coordinates
     * @param gridX Grid X position
     * @param gridY Grid Y position
     * @returns World coordinates as [x, y]
     */
    gridToWorld(gridX: number, gridY: number): [number, number] {
        return [gridX * this.cellSize, gridY * this.cellSize];
    }

    /**
     * Converts world coordinates to grid coordinates
     * @param worldX World X position
     * @param worldY World Y position
     * @returns Grid coordinates as [x, y]
     */
    worldToGrid(worldX: number, worldY: number): [number, number] {
        return [
            Math.floor(worldX / this.cellSize),
            Math.floor(worldY / this.cellSize)
        ];
    }

    /**
     * Converts a pixel position on canvas to grid coordinates
     * @param pixelX Pixel X position
     * @param pixelY Pixel Y position
     * @param pixelsPerUnit Pixels per grid unit (zoom level)
     * @param offsetX Canvas offset X
     * @param offsetY Canvas offset Y
     * @returns Grid coordinates as [x, y]
     */
    pixelToGrid(
        pixelX: number,
        pixelY: number,
        pixelsPerUnit: number,
        offsetX: number = 0,
        offsetY: number = 0
    ): [number, number] {
        const worldX = (pixelX - offsetX) / pixelsPerUnit;
        const worldY = (pixelY - offsetY) / pixelsPerUnit;
        return [Math.floor(worldX), Math.floor(worldY)];
    }

    /**
     * Converts grid coordinates to pixel position on canvas
     * @param gridX Grid X position
     * @param gridY Grid Y position
     * @param pixelsPerUnit Pixels per grid unit (zoom level)
     * @param offsetX Canvas offset X
     * @param offsetY Canvas offset Y
     * @returns Pixel coordinates as [x, y]
     */
    gridToPixel(
        gridX: number,
        gridY: number,
        pixelsPerUnit: number,
        offsetX: number = 0,
        offsetY: number = 0
    ): [number, number] {
        return [
            gridX * pixelsPerUnit + offsetX,
            gridY * pixelsPerUnit + offsetY
        ];
    }
}
