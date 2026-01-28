/**
 * Material slot definition
 */
export interface MaterialSlot {
    id: string;
    name: string;
    color: string;
    texture: HTMLCanvasElement | null;
    supportsTexture: boolean;
}

/**
 * Callback type for material slot changes
 */
export type MaterialSlotChangeCallback = (slot: MaterialSlot) => void;

/**
 * Scene Material Manager
 * Manages material slot definitions and color/texture assignments
 */
export class SceneMaterialManager {
    private slots: Map<string, MaterialSlot> = new Map();
    private changeCallbacks: MaterialSlotChangeCallback[] = [];

    constructor() {
        this.initializeSlots();
    }

    /**
     * Initializes default material slots
     */
    private initializeSlots(): void {
        const defaultSlots: MaterialSlot[] = [
            { id: 'ground', name: 'Ground', color: '#8B7355', texture: null, supportsTexture: true },
            { id: 'wall', name: 'Wall', color: '#A0A0A0', texture: null, supportsTexture: true },
            { id: 'primary', name: 'Primary Object', color: '#4A90E2', texture: null, supportsTexture: true },
            { id: 'secondary', name: 'Secondary Object', color: '#E24A4A', texture: null, supportsTexture: true },
            { id: 'accent', name: 'Accent', color: '#4AE24A', texture: null, supportsTexture: true },
            { id: 'sky', name: 'Sky/Background', color: '#87CEEB', texture: null, supportsTexture: false }
        ];

        defaultSlots.forEach(slot => {
            this.slots.set(slot.id, slot);
        });
    }

    /**
     * Gets all material slots
     */
    getAllSlots(): MaterialSlot[] {
        return Array.from(this.slots.values());
    }

    /**
     * Gets a specific slot by ID
     */
    getSlot(slotId: string): MaterialSlot | undefined {
        return this.slots.get(slotId);
    }

    /**
     * Sets the color for a material slot
     */
    setSlotColor(slotId: string, color: string): void {
        const slot = this.slots.get(slotId);
        if (slot) {
            slot.color = color;
            slot.texture = null; // Clear texture when color is set
            this.notifyChange(slot);
        }
    }

    /**
     * Sets the texture for a material slot
     */
    setSlotTexture(slotId: string, texture: HTMLCanvasElement): void {
        const slot = this.slots.get(slotId);
        if (slot && slot.supportsTexture) {
            slot.texture = texture;
            this.notifyChange(slot);
        }
    }

    /**
     * Clears the texture for a material slot (reverts to color)
     */
    clearSlotTexture(slotId: string): void {
        const slot = this.slots.get(slotId);
        if (slot) {
            slot.texture = null;
            this.notifyChange(slot);
        }
    }

    /**
     * Resets a slot to its default values
     */
    resetSlot(slotId: string): void {
        const defaults: Record<string, string> = {
            'ground': '#8B7355',
            'wall': '#A0A0A0',
            'primary': '#4A90E2',
            'secondary': '#E24A4A',
            'accent': '#4AE24A',
            'sky': '#87CEEB'
        };

        const slot = this.slots.get(slotId);
        if (slot && defaults[slotId]) {
            slot.color = defaults[slotId];
            slot.texture = null;
            this.notifyChange(slot);
        }
    }

    /**
     * Registers a callback for slot changes
     */
    onSlotChange(callback: MaterialSlotChangeCallback): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * Notifies all registered callbacks of a slot change
     */
    private notifyChange(slot: MaterialSlot): void {
        this.changeCallbacks.forEach(callback => callback(slot));
    }
}
