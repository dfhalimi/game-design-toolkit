/**
 * Environment Palette - Semantic color slots for game environments
 * Organizes colors by their role in outdoor (and future indoor) scenes
 */

/**
 * Slot identifiers for environment palette
 */
export type SlotId = 'sky' | 'water' | 'grass' | 'foliage' | 'rock' | 'dirt' | 'bark' | 'accent';

/**
 * Slot group identifiers
 */
export type SlotGroup = 'atmosphere' | 'vegetation' | 'terrain' | 'accent';

/**
 * Individual color slot with lock state
 */
export interface ColorSlot {
    color: string;  // Hex color string (e.g., "#4A90E2")
    locked: boolean; // If true, won't be modified by generation/suggestions
}

/**
 * Slot metadata for UI display
 */
export interface SlotInfo {
    id: SlotId;
    name: string;
    group: SlotGroup;
    description: string;
}

/**
 * All slot definitions with metadata
 */
export const SLOT_DEFINITIONS: SlotInfo[] = [
    { id: 'sky', name: 'Sky', group: 'atmosphere', description: 'Sky color, typically the brightest value' },
    { id: 'water', name: 'Water', group: 'atmosphere', description: 'Water surfaces, reflects sky' },
    { id: 'grass', name: 'Grass', group: 'vegetation', description: 'Ground vegetation, grass, moss' },
    { id: 'foliage', name: 'Foliage', group: 'vegetation', description: 'Tree leaves, bushes, shrubs' },
    { id: 'rock', name: 'Rock', group: 'terrain', description: 'Stone, boulders, cliffs' },
    { id: 'dirt', name: 'Dirt', group: 'terrain', description: 'Earth, soil, paths' },
    { id: 'bark', name: 'Bark', group: 'terrain', description: 'Tree trunks, wooden structures' },
    { id: 'accent', name: 'Accent', group: 'accent', description: 'Highlight color for important elements' }
];

/**
 * Default colors for a neutral outdoor palette
 */
const DEFAULT_COLORS: Record<SlotId, string> = {
    sky: '#87CEEB',     // Light sky blue
    water: '#4A90D9',   // Deeper blue
    grass: '#7CB342',   // Green
    foliage: '#558B2F', // Darker green
    rock: '#9E9E9E',    // Gray
    dirt: '#8D6E63',    // Brown
    bark: '#5D4037',    // Dark brown
    accent: '#FF7043'   // Orange accent
};

/**
 * Callback type for palette change notifications
 */
export type PaletteChangeCallback = (palette: EnvironmentPalette) => void;

/**
 * Environment Palette class
 * Container for all semantic color slots with change notification
 */
export class EnvironmentPalette {
    private slots: Map<SlotId, ColorSlot>;
    private changeCallbacks: PaletteChangeCallback[];

    constructor() {
        this.slots = new Map();
        this.changeCallbacks = [];
        
        // Initialize with default colors
        for (const slotId of Object.keys(DEFAULT_COLORS) as SlotId[]) {
            this.slots.set(slotId, {
                color: DEFAULT_COLORS[slotId],
                locked: false
            });
        }
    }

    /**
     * Gets a color slot by ID
     */
    getSlot(slotId: SlotId): ColorSlot {
        const slot = this.slots.get(slotId);
        if (!slot) {
            throw new Error(`Unknown slot: ${slotId}`);
        }
        return { ...slot }; // Return copy to prevent external mutation
    }

    /**
     * Gets the color for a slot
     */
    getColor(slotId: SlotId): string {
        return this.getSlot(slotId).color;
    }

    /**
     * Checks if a slot is locked
     */
    isLocked(slotId: SlotId): boolean {
        return this.getSlot(slotId).locked;
    }

    /**
     * Sets the color for a slot
     */
    setColor(slotId: SlotId, color: string): void {
        const slot = this.slots.get(slotId);
        if (!slot) {
            throw new Error(`Unknown slot: ${slotId}`);
        }
        slot.color = color;
        this.notifyChange();
    }

    /**
     * Sets the locked state for a slot
     */
    setLocked(slotId: SlotId, locked: boolean): void {
        const slot = this.slots.get(slotId);
        if (!slot) {
            throw new Error(`Unknown slot: ${slotId}`);
        }
        slot.locked = locked;
        this.notifyChange();
    }

    /**
     * Sets both color and locked state for a slot
     */
    setSlot(slotId: SlotId, color: string, locked?: boolean): void {
        const slot = this.slots.get(slotId);
        if (!slot) {
            throw new Error(`Unknown slot: ${slotId}`);
        }
        slot.color = color;
        if (locked !== undefined) {
            slot.locked = locked;
        }
        this.notifyChange();
    }

    /**
     * Gets all slots as a record
     */
    getAllSlots(): Record<SlotId, ColorSlot> {
        const result: Partial<Record<SlotId, ColorSlot>> = {};
        for (const [id, slot] of this.slots) {
            result[id] = { ...slot };
        }
        return result as Record<SlotId, ColorSlot>;
    }

    /**
     * Gets slots by group
     */
    getSlotsByGroup(group: SlotGroup): { id: SlotId; slot: ColorSlot }[] {
        const groupSlots = SLOT_DEFINITIONS.filter(def => def.group === group);
        return groupSlots.map(def => ({
            id: def.id,
            slot: this.getSlot(def.id)
        }));
    }

    /**
     * Gets all unlocked slot IDs
     */
    getUnlockedSlots(): SlotId[] {
        return Array.from(this.slots.entries())
            .filter(([_, slot]) => !slot.locked)
            .map(([id, _]) => id);
    }

    /**
     * Resets all slots to defaults
     */
    reset(): void {
        for (const slotId of Object.keys(DEFAULT_COLORS) as SlotId[]) {
            this.slots.set(slotId, {
                color: DEFAULT_COLORS[slotId],
                locked: false
            });
        }
        this.notifyChange();
    }

    /**
     * Unlocks all slots
     */
    unlockAll(): void {
        for (const slot of this.slots.values()) {
            slot.locked = false;
        }
        this.notifyChange();
    }

    /**
     * Registers a callback for palette changes
     */
    onChange(callback: PaletteChangeCallback): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * Removes a change callback
     */
    offChange(callback: PaletteChangeCallback): void {
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
     * Exports palette to JSON-serializable object
     */
    toJSON(): object {
        const slots: Record<string, { color: string; locked: boolean }> = {};
        for (const [id, slot] of this.slots) {
            slots[id] = { color: slot.color, locked: slot.locked };
        }
        return {
            version: '1.0',
            type: 'environment',
            slots
        };
    }

    /**
     * Creates a palette from JSON data
     */
    static fromJSON(data: any): EnvironmentPalette {
        const palette = new EnvironmentPalette();
        
        if (data.slots) {
            for (const [id, slot] of Object.entries(data.slots)) {
                const slotData = slot as { color: string; locked: boolean };
                if (palette.slots.has(id as SlotId)) {
                    palette.slots.set(id as SlotId, {
                        color: slotData.color || DEFAULT_COLORS[id as SlotId],
                        locked: slotData.locked || false
                    });
                }
            }
        }
        
        return palette;
    }

    /**
     * Creates a copy of this palette
     */
    clone(): EnvironmentPalette {
        return EnvironmentPalette.fromJSON(this.toJSON());
    }
}
