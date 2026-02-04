/**
 * Interior Palette Generator - Creates harmonious interior palettes
 * Can generate from mood presets or derive from a base color
 */

import { InteriorPalette, InteriorSlotId } from './InteriorPalette.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ColorConverter } from './ColorConverter.js';
import { ACCENT_LIGHTNESS } from './PaletteRules.js';

/**
 * Available mood presets for interior palette generation
 */
export type InteriorMoodPreset = 'modern_minimalist' | 'cozy_cabin' | 'industrial_loft' | 'victorian' | 'scandinavian' | 'scifi_corridor';

/**
 * Preset metadata for UI display
 */
export interface InteriorPresetInfo {
    id: InteriorMoodPreset;
    name: string;
    description: string;
}

/**
 * All interior preset definitions
 */
export const INTERIOR_PRESET_DEFINITIONS: InteriorPresetInfo[] = [
    { id: 'modern_minimalist', name: 'Modern Minimalist', description: 'Clean whites, light wood, gray accents' },
    { id: 'cozy_cabin', name: 'Cozy Cabin', description: 'Warm creams, rich wood, earth-tone fabrics' },
    { id: 'industrial_loft', name: 'Industrial Loft', description: 'Concrete gray, exposed brick, dark metals' },
    { id: 'victorian', name: 'Victorian Elegance', description: 'Deep jewel tones, dark wood, gold accents' },
    { id: 'scandinavian', name: 'Scandinavian', description: 'Bright white, pale wood, muted pastels' },
    { id: 'scifi_corridor', name: 'Sci-Fi Corridor', description: 'Cool gray/blue, chrome metal, neon accents' }
];

/**
 * Available art styles for palette generation (shared with outdoor)
 */
export type ArtStyle = 'vibrant' | 'realistic' | 'stylized';

/**
 * Art style metadata for UI display
 */
export interface StyleInfo {
    id: ArtStyle;
    name: string;
    description: string;
}

/**
 * All art style definitions
 */
export const INTERIOR_STYLE_DEFINITIONS: StyleInfo[] = [
    { id: 'vibrant', name: 'Vibrant', description: 'Saturated, punchy colors (stylized games)' },
    { id: 'realistic', name: 'Realistic', description: 'Muted, natural tones (realistic/PBR)' },
    { id: 'stylized', name: 'Stylized', description: 'Balanced saturation (semi-realistic)' }
];

/**
 * Style modifiers for saturation
 */
const STYLE_SATURATION_MULTIPLIERS: Record<ArtStyle, number> = {
    vibrant: 1.0,
    realistic: 0.5,
    stylized: 0.75
};

/**
 * Internal preset color data (HSL values)
 * H: 0-360, S: 0-100, L: 0-100
 */
interface InteriorPresetColors {
    wall: [number, number, number];
    floor: [number, number, number];
    ceiling: [number, number, number];
    wood: [number, number, number];
    fabric: [number, number, number];
    metal: [number, number, number];
    trim: [number, number, number];
    accent: [number, number, number];
}

/**
 * Predefined color schemes for each interior mood
 */
const INTERIOR_PRESET_COLORS: Record<InteriorMoodPreset, InteriorPresetColors> = {
    modern_minimalist: {
        wall: [0, 0, 96],           // Almost white
        floor: [30, 20, 70],        // Light wood
        ceiling: [0, 0, 98],        // Pure white
        wood: [35, 25, 55],         // Light oak
        fabric: [210, 10, 55],      // Cool gray
        metal: [0, 0, 25],          // Black metal
        trim: [0, 0, 90],           // Light gray
        accent: [200, 70, 45]       // Teal blue
    },
    cozy_cabin: {
        wall: [35, 20, 85],         // Warm cream
        floor: [25, 45, 35],        // Dark hardwood
        ceiling: [35, 15, 90],      // Warm off-white
        wood: [25, 55, 30],         // Rich walnut
        fabric: [25, 35, 45],       // Warm brown fabric
        metal: [30, 40, 35],        // Bronze/brass
        trim: [30, 30, 50],         // Medium wood
        accent: [15, 60, 50]        // Terracotta
    },
    industrial_loft: {
        wall: [30, 8, 65],          // Concrete gray
        floor: [25, 15, 25],        // Dark concrete/wood
        ceiling: [30, 5, 70],       // Light gray
        wood: [25, 30, 35],         // Reclaimed wood
        fabric: [210, 15, 40],      // Charcoal gray
        metal: [0, 0, 20],          // Dark iron
        trim: [20, 50, 45],         // Exposed brick
        accent: [45, 70, 55]        // Industrial amber
    },
    victorian: {
        wall: [340, 35, 35],        // Deep burgundy
        floor: [25, 50, 20],        // Dark mahogany
        ceiling: [40, 15, 80],      // Antique white
        wood: [25, 55, 22],         // Dark cherry
        fabric: [270, 40, 35],      // Deep purple velvet
        metal: [45, 70, 50],        // Gold
        trim: [40, 25, 35],         // Dark wood
        accent: [45, 80, 55]        // Bright gold
    },
    scandinavian: {
        wall: [0, 0, 97],           // Pure white
        floor: [40, 15, 75],        // Pale pine
        ceiling: [0, 0, 99],        // Bright white
        wood: [40, 20, 70],         // Light birch
        fabric: [200, 25, 75],      // Soft blue-gray
        metal: [0, 0, 35],          // Dark gray
        trim: [0, 0, 95],           // White
        accent: [180, 40, 50]       // Muted teal
    },
    scifi_corridor: {
        wall: [210, 20, 35],        // Dark blue-gray
        floor: [220, 15, 20],       // Very dark blue
        ceiling: [210, 15, 40],     // Medium gray-blue
        wood: [210, 10, 30],        // (Synthetic) dark panel
        fabric: [220, 20, 45],      // Blue-gray
        metal: [200, 30, 70],       // Chrome/silver
        trim: [210, 25, 50],        // Metallic trim
        accent: [180, 100, 50]      // Cyan neon
    }
};

/**
 * Interior Palette Generator class
 */
export class InteriorPaletteGenerator {
    /**
     * Generates a palette from a mood preset
     */
    static fromPreset(
        preset: InteriorMoodPreset,
        style: ArtStyle = 'vibrant',
        respectLocked: boolean = true,
        existingPalette?: InteriorPalette
    ): InteriorPalette {
        const palette = existingPalette?.clone() ?? new InteriorPalette();
        const colors = INTERIOR_PRESET_COLORS[preset];
        const saturationMultiplier = STYLE_SATURATION_MULTIPLIERS[style];

        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];
        
        for (const slotId of slotIds) {
            if (respectLocked && existingPalette?.isLocked(slotId)) {
                continue;
            }

            let [h, s, l] = colors[slotId];
            const adjustedS = Math.min(100, s * saturationMultiplier);

            // Enforce accent constraints
            if (slotId === 'accent') {
                l = this.clampAccentLightness(l);
            }

            const hex = this.hslToHex(h, adjustedS, l);
            palette.setColor(slotId, hex);
        }

        return palette;
    }

    /**
     * Derives a full palette from a single base color
     * Uses color theory to create harmonious relationships
     */
    static fromBaseColor(
        baseHex: string,
        style: ArtStyle = 'vibrant',
        respectLocked: boolean = true,
        existingPalette?: InteriorPalette
    ): InteriorPalette {
        const palette = existingPalette?.clone() ?? new InteriorPalette();
        const rgb = ColorConverter.hexToRgb(baseHex);
        const [baseH, baseS, baseL] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);
        const saturationMultiplier = STYLE_SATURATION_MULTIPLIERS[style];

        const derivedColors = this.deriveColorsFromBase(baseH, baseS, baseL);
        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];

        for (const slotId of slotIds) {
            if (respectLocked && existingPalette?.isLocked(slotId)) {
                continue;
            }

            let [h, s, l] = derivedColors[slotId];
            const adjustedS = Math.min(100, s * saturationMultiplier);

            if (slotId === 'accent') {
                l = this.clampAccentLightness(l);
            }

            const hex = this.hslToHex(h, adjustedS, l);
            palette.setColor(slotId, hex);
        }

        return palette;
    }

    private static clampAccentLightness(l: number): number {
        return Math.max(ACCENT_LIGHTNESS.min, Math.min(ACCENT_LIGHTNESS.max, l));
    }

    /**
     * Derives all slot colors from a base HSL color for interiors
     */
    private static deriveColorsFromBase(baseH: number, baseS: number, baseL: number): Record<InteriorSlotId, [number, number, number]> {
        // Determine if base is warm, cool, or neutral
        const isWarm = (baseH >= 0 && baseH <= 60) || (baseH >= 300 && baseH <= 360);
        const isCool = baseH >= 180 && baseH <= 270;
        const isNeutral = baseS < 15;

        // Interior palettes follow the 60-30-10 rule
        // Wall is dominant (60%), floor is secondary (30%), accent is minimal (10%)

        let result: Record<InteriorSlotId, [number, number, number]>;

        if (isNeutral) {
            // Neutral base → monochromatic with subtle warmth
            result = {
                wall: [baseH, Math.min(10, baseS), Math.max(85, baseL + 20)],
                floor: [25, Math.max(15, baseS), Math.max(40, baseL - 20)],
                ceiling: [baseH, Math.min(5, baseS * 0.5), Math.min(98, baseL + 30)],
                wood: [30, Math.max(25, baseS + 15), Math.max(35, baseL - 15)],
                fabric: [baseH, Math.max(10, baseS), baseL],
                metal: [baseH, Math.min(5, baseS * 0.3), Math.max(30, baseL - 25)],
                trim: [baseH, Math.min(8, baseS), Math.max(90, baseL + 25)],
                accent: [this.shiftHue(200, baseH, 0.3), Math.min(70, baseS + 50), 50]
            };
        } else if (isWarm) {
            // Warm base → cozy, inviting palette
            result = {
                wall: [baseH, Math.min(20, baseS * 0.4), Math.max(85, baseL + 25)],
                floor: [baseH, Math.min(40, baseS * 0.7), Math.max(30, baseL - 25)],
                ceiling: [baseH, Math.min(10, baseS * 0.3), Math.min(95, baseL + 30)],
                wood: [this.shiftHue(baseH, 30, 0.5), Math.min(50, baseS * 0.9), Math.max(30, baseL - 20)],
                fabric: [baseH, Math.min(35, baseS * 0.6), baseL],
                metal: [35, Math.min(50, baseS * 0.7), Math.max(40, baseL - 10)],
                trim: [baseH, Math.min(25, baseS * 0.5), Math.max(50, baseL)],
                accent: [this.complementary(baseH), Math.min(80, baseS + 10), Math.min(55, baseL)]
            };
        } else {
            // Cool base → modern, calming palette
            result = {
                wall: [baseH, Math.min(15, baseS * 0.3), Math.max(90, baseL + 30)],
                floor: [this.shiftHue(baseH, 30, 0.6), Math.min(25, baseS * 0.5), Math.max(35, baseL - 30)],
                ceiling: [baseH, Math.min(8, baseS * 0.2), Math.min(98, baseL + 35)],
                wood: [35, Math.min(30, baseS * 0.5), Math.max(45, baseL - 10)],
                fabric: [baseH, Math.min(30, baseS * 0.5), Math.max(55, baseL)],
                metal: [baseH, Math.min(15, baseS * 0.3), Math.max(50, baseL - 5)],
                trim: [baseH, Math.min(10, baseS * 0.2), Math.max(92, baseL + 30)],
                accent: [this.shiftHue(baseH + 120, baseH, 0.3), Math.min(75, baseS + 20), 50]
            };
        }

        // Clamp all values
        for (const slot of Object.keys(result) as InteriorSlotId[]) {
            const [h, s, l] = result[slot];
            result[slot] = [
                ((h % 360) + 360) % 360,
                Math.max(0, Math.min(100, s)),
                Math.max(0, Math.min(100, l))
            ];
        }

        return result;
    }

    /**
     * Shifts a hue towards a target hue by a factor
     */
    private static shiftHue(hue: number, targetHue: number, factor: number): number {
        const diff = this.hueDifference(hue, targetHue);
        const direction = this.hueDirection(hue, targetHue);
        return (hue + direction * diff * factor + 360) % 360;
    }

    private static hueDifference(h1: number, h2: number): number {
        const diff = Math.abs(h1 - h2);
        return Math.min(diff, 360 - diff);
    }

    private static hueDirection(h1: number, h2: number): number {
        const diff = h2 - h1;
        if (Math.abs(diff) <= 180) {
            return diff > 0 ? 1 : -1;
        }
        return diff > 0 ? -1 : 1;
    }

    private static complementary(hue: number): number {
        return (hue + 180) % 360;
    }

    private static hslToHex(h: number, s: number, l: number): string {
        const rgb = ImageProcessor.hslToRgb(h, s, l);
        return ColorConverter.rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    /**
     * Adds slight random variation to a palette
     */
    static addVariation(palette: InteriorPalette, amount: number = 10): InteriorPalette {
        const varied = palette.clone();
        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];

        for (const slotId of slotIds) {
            if (varied.isLocked(slotId)) {
                continue;
            }

            const hex = varied.getColor(slotId);
            const rgb = ColorConverter.hexToRgb(hex);
            const [h, s, l] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);

            const newH = (h + (Math.random() - 0.5) * amount * 2 + 360) % 360;
            const newS = Math.max(0, Math.min(100, s + (Math.random() - 0.5) * amount));
            const newL = Math.max(0, Math.min(100, l + (Math.random() - 0.5) * amount * 0.5));

            const newHex = this.hslToHex(newH, newS, newL);
            varied.setColor(slotId, newHex);
        }

        return varied;
    }

    /**
     * Gets all available preset definitions
     */
    static getPresets(): InteriorPresetInfo[] {
        return [...INTERIOR_PRESET_DEFINITIONS];
    }
}
