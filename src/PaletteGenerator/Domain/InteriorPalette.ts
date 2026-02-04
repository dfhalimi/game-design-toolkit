/**
 * Interior Palette - Semantic color slots for indoor/interior game environments
 * Organizes colors by their role in interior scenes (rooms, corridors, buildings)
 */

/**
 * Slot identifiers for interior palette
 */
export type InteriorSlotId = 'wall' | 'floor' | 'ceiling' | 'wood' | 'fabric' | 'metal' | 'trim' | 'accent';

/**
 * Slot group identifiers for interior palettes
 */
export type InteriorSlotGroup = 'surfaces' | 'materials' | 'details';

/**
 * Individual color slot with lock state
 */
export interface InteriorColorSlot {
    color: string;  // Hex color string (e.g., "#4A90E2")
    locked: boolean; // If true, won't be modified by generation/suggestions
}

/**
 * Slot metadata for UI display
 */
export interface InteriorSlotInfo {
    id: InteriorSlotId;
    name: string;
    group: InteriorSlotGroup;
    description: string;
}

/**
 * All slot definitions with metadata
 */
export const INTERIOR_SLOT_DEFINITIONS: InteriorSlotInfo[] = [
    { id: 'wall', name: 'Wall', group: 'surfaces', description: 'Main wall color, dominant surface (60% rule)' },
    { id: 'floor', name: 'Floor', group: 'surfaces', description: 'Floor surface, secondary color (30% rule)' },
    { id: 'ceiling', name: 'Ceiling', group: 'surfaces', description: 'Ceiling color, typically lightest' },
    { id: 'wood', name: 'Wood', group: 'materials', description: 'Wooden furniture, cabinets, shelving' },
    { id: 'fabric', name: 'Fabric', group: 'materials', description: 'Upholstery, curtains, rugs, cushions' },
    { id: 'metal', name: 'Metal', group: 'materials', description: 'Fixtures, handles, frames, appliances' },
    { id: 'trim', name: 'Trim', group: 'details', description: 'Baseboards, door frames, molding, window frames' },
    { id: 'accent', name: 'Accent', group: 'details', description: 'Pop of color for decorative elements (10% rule)' }
];

/**
 * Default colors for a neutral interior palette
 */
const DEFAULT_INTERIOR_COLORS: Record<InteriorSlotId, string> = {
    wall: '#F5F5F5',    // Off-white walls
    floor: '#8B7355',   // Warm wood floor
    ceiling: '#FFFFFF', // White ceiling
    wood: '#A0522D',    // Sienna wood
    fabric: '#708090',  // Slate gray fabric
    metal: '#71797E',   // Gunmetal
    trim: '#E8E8E8',    // Light gray trim
    accent: '#2E86AB'   // Teal accent
};

/**
 * Callback type for palette change notifications
 */
export type InteriorPaletteChangeCallback = (palette: InteriorPalette) => void;

/**
 * Interior Palette class
 * Container for all semantic color slots for indoor environments
 */
export class InteriorPalette {
    private slots: Map<InteriorSlotId, InteriorColorSlot>;
    private changeCallbacks: InteriorPaletteChangeCallback[];

    constructor() {
        this.slots = new Map();
        this.changeCallbacks = [];
        
        // Initialize with default colors
        for (const slotId of Object.keys(DEFAULT_INTERIOR_COLORS) as InteriorSlotId[]) {
            this.slots.set(slotId, {
                color: DEFAULT_INTERIOR_COLORS[slotId],
                locked: false
            });
        }
    }

    /**
     * Gets a color slot by ID
     */
    getSlot(slotId: InteriorSlotId): InteriorColorSlot {
        const slot = this.slots.get(slotId);
        if (!slot) {
            throw new Error(`Unknown slot: ${slotId}`);
        }
        return { ...slot }; // Return copy to prevent external mutation
    }

    /**
     * Gets the color for a slot
     */
    getColor(slotId: InteriorSlotId): string {
        return this.getSlot(slotId).color;
    }

    /**
     * Checks if a slot is locked
     */
    isLocked(slotId: InteriorSlotId): boolean {
        return this.getSlot(slotId).locked;
    }

    /**
     * Sets the color for a slot
     */
    setColor(slotId: InteriorSlotId, color: string): void {
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
    setLocked(slotId: InteriorSlotId, locked: boolean): void {
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
    setSlot(slotId: InteriorSlotId, color: string, locked?: boolean): void {
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
    getAllSlots(): Record<InteriorSlotId, InteriorColorSlot> {
        const result: Partial<Record<InteriorSlotId, InteriorColorSlot>> = {};
        for (const [id, slot] of this.slots) {
            result[id] = { ...slot };
        }
        return result as Record<InteriorSlotId, InteriorColorSlot>;
    }

    /**
     * Gets slots by group
     */
    getSlotsByGroup(group: InteriorSlotGroup): { id: InteriorSlotId; slot: InteriorColorSlot }[] {
        const groupSlots = INTERIOR_SLOT_DEFINITIONS.filter(def => def.group === group);
        return groupSlots.map(def => ({
            id: def.id,
            slot: this.getSlot(def.id)
        }));
    }

    /**
     * Gets all unlocked slot IDs
     */
    getUnlockedSlots(): InteriorSlotId[] {
        return Array.from(this.slots.entries())
            .filter(([_, slot]) => !slot.locked)
            .map(([id, _]) => id);
    }

    /**
     * Resets all slots to defaults
     */
    reset(): void {
        for (const slotId of Object.keys(DEFAULT_INTERIOR_COLORS) as InteriorSlotId[]) {
            this.slots.set(slotId, {
                color: DEFAULT_INTERIOR_COLORS[slotId],
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
    onChange(callback: InteriorPaletteChangeCallback): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * Removes a change callback
     */
    offChange(callback: InteriorPaletteChangeCallback): void {
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
            type: 'interior',
            slots
        };
    }

    /**
     * Creates a palette from JSON data
     */
    static fromJSON(data: any): InteriorPalette {
        const palette = new InteriorPalette();
        
        if (data.slots) {
            for (const [id, slot] of Object.entries(data.slots)) {
                const slotData = slot as { color: string; locked: boolean };
                if (palette.slots.has(id as InteriorSlotId)) {
                    palette.slots.set(id as InteriorSlotId, {
                        color: slotData.color || DEFAULT_INTERIOR_COLORS[id as InteriorSlotId],
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
    clone(): InteriorPalette {
        return InteriorPalette.fromJSON(this.toJSON());
    }
}
