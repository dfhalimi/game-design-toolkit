/**
 * Palette Generator - Creates harmonious environment palettes
 * Can generate from mood presets or derive from a base color
 */

import { EnvironmentPalette, SlotId } from './EnvironmentPalette.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ColorConverter } from './ColorConverter.js';

/**
 * Available mood presets for palette generation
 */
export type MoodPreset = 'lush_forest' | 'desert' | 'autumn' | 'snowy' | 'tropical' | 'mystical';

/**
 * Preset metadata for UI display
 */
export interface PresetInfo {
    id: MoodPreset;
    name: string;
    description: string;
}

/**
 * All preset definitions
 */
export const PRESET_DEFINITIONS: PresetInfo[] = [
    { id: 'lush_forest', name: 'Lush Forest', description: 'Rich greens, earthy browns, clear blue sky' },
    { id: 'desert', name: 'Desert', description: 'Warm sandy tones, harsh sun, sparse vegetation' },
    { id: 'autumn', name: 'Autumn', description: 'Warm oranges, reds, golden yellows' },
    { id: 'snowy', name: 'Snowy', description: 'Cool blues, white highlights, muted tones' },
    { id: 'tropical', name: 'Tropical', description: 'Vibrant greens, turquoise water, warm accents' },
    { id: 'mystical', name: 'Mystical', description: 'Purple tints, magical glow, otherworldly' }
];

/**
 * Available art styles for palette generation
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
export const STYLE_DEFINITIONS: StyleInfo[] = [
    { id: 'vibrant', name: 'Vibrant', description: 'Saturated, punchy colors (cartoony/stylized games)' },
    { id: 'realistic', name: 'Realistic', description: 'Muted, natural tones (realistic/PBR textures)' },
    { id: 'stylized', name: 'Stylized', description: 'Balanced saturation (semi-realistic)' }
];

/**
 * Style modifiers for saturation
 */
const STYLE_SATURATION_MULTIPLIERS: Record<ArtStyle, number> = {
    vibrant: 1.0,    // Keep as-is (full saturation)
    realistic: 0.5,  // Halve saturation for muted tones
    stylized: 0.75   // 75% saturation for balanced look
};

/**
 * Internal preset color data (HSL values)
 * H: 0-360, S: 0-100, L: 0-100
 */
interface PresetColors {
    sky: [number, number, number];
    water: [number, number, number];
    grass: [number, number, number];
    foliage: [number, number, number];
    rock: [number, number, number];
    dirt: [number, number, number];
    bark: [number, number, number];
    accent: [number, number, number];
}

/**
 * Predefined color schemes for each mood
 */
const PRESET_COLORS: Record<MoodPreset, PresetColors> = {
    lush_forest: {
        sky: [200, 60, 75],      // Clear blue
        water: [200, 50, 55],    // Deeper blue
        grass: [100, 55, 45],    // Rich green
        foliage: [120, 50, 35],  // Darker green
        rock: [30, 10, 50],      // Gray-brown
        dirt: [30, 35, 35],      // Brown
        bark: [25, 40, 25],      // Dark brown
        accent: [45, 80, 60]     // Golden yellow
    },
    desert: {
        sky: [200, 40, 80],      // Pale blue
        water: [195, 35, 45],    // Oasis blue
        grass: [55, 30, 50],     // Dry yellow-green
        foliage: [45, 25, 40],   // Olive/dry
        rock: [35, 25, 55],      // Sandy rock
        dirt: [35, 40, 60],      // Sand
        bark: [30, 30, 30],      // Weathered wood
        accent: [15, 85, 55]     // Burnt orange
    },
    autumn: {
        sky: [210, 45, 70],      // Soft blue
        water: [205, 35, 50],    // Muted blue
        grass: [75, 35, 40],     // Yellow-green
        foliage: [25, 70, 50],   // Orange leaves
        rock: [25, 15, 45],      // Warm gray
        dirt: [30, 40, 30],      // Dark earth
        bark: [20, 35, 25],      // Dark warm brown
        accent: [5, 75, 50]      // Deep red
    },
    snowy: {
        sky: [210, 30, 85],      // Pale winter sky
        water: [200, 20, 40],    // Icy dark
        grass: [90, 15, 55],     // Muted green (showing through snow)
        foliage: [150, 25, 30],  // Evergreen
        rock: [220, 10, 60],     // Cool gray
        dirt: [30, 15, 40],      // Frozen earth
        bark: [25, 20, 30],      // Cold brown
        accent: [0, 70, 55]      // Red berries/cardinal
    },
    tropical: {
        sky: [195, 70, 75],      // Bright tropical sky
        water: [180, 65, 55],    // Turquoise
        grass: [110, 60, 50],    // Vibrant green
        foliage: [130, 55, 40],  // Rich jungle green
        rock: [25, 30, 45],      // Volcanic rock
        dirt: [25, 45, 35],      // Rich soil
        bark: [30, 45, 30],      // Tropical wood
        accent: [330, 75, 60]    // Pink/coral flower
    },
    mystical: {
        sky: [270, 40, 65],      // Purple dusk
        water: [260, 45, 45],    // Deep purple
        grass: [150, 35, 40],    // Teal-green
        foliage: [170, 40, 30],  // Dark teal
        rock: [280, 20, 40],     // Purple-gray
        dirt: [300, 15, 30],     // Dark magenta-brown
        bark: [320, 25, 25],     // Dark purple-brown
        accent: [60, 90, 65]     // Magical gold glow
    }
};

/**
 * Palette Generator class
 */
export class PaletteGenerator {
    /**
     * Generates a palette from a mood preset
     * @param preset The mood preset to use
     * @param style The art style (affects saturation levels)
     * @param respectLocked If true, won't modify locked slots
     * @param existingPalette Optional existing palette to modify
     */
    static fromPreset(
        preset: MoodPreset,
        style: ArtStyle = 'vibrant',
        respectLocked: boolean = true,
        existingPalette?: EnvironmentPalette
    ): EnvironmentPalette {
        const palette = existingPalette?.clone() ?? new EnvironmentPalette();
        const colors = PRESET_COLORS[preset];
        const saturationMultiplier = STYLE_SATURATION_MULTIPLIERS[style];

        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];
        
        for (const slotId of slotIds) {
            // Skip locked slots if respecting locks
            if (respectLocked && existingPalette?.isLocked(slotId)) {
                continue;
            }

            const [h, s, l] = colors[slotId];
            // Apply style saturation multiplier
            const adjustedS = Math.min(100, s * saturationMultiplier);
            const hex = this.hslToHex(h, adjustedS, l);
            palette.setColor(slotId, hex);
        }

        return palette;
    }

    /**
     * Derives a full palette from a single base color
     * Uses color theory to create harmonious relationships
     * @param baseHex The base color to derive from
     * @param style The art style (affects saturation levels)
     * @param respectLocked If true, won't modify locked slots
     * @param existingPalette Optional existing palette to modify
     */
    static fromBaseColor(
        baseHex: string,
        style: ArtStyle = 'vibrant',
        respectLocked: boolean = true,
        existingPalette?: EnvironmentPalette
    ): EnvironmentPalette {
        const palette = existingPalette?.clone() ?? new EnvironmentPalette();
        const rgb = ColorConverter.hexToRgb(baseHex);
        const [baseH, baseS, baseL] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);
        const saturationMultiplier = STYLE_SATURATION_MULTIPLIERS[style];

        // The base color determines the "mood" - we derive other colors from it
        // If base is green, it becomes foliage; if blue, it becomes sky; etc.

        const derivedColors = this.deriveColorsFromBase(baseH, baseS, baseL);
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];

        for (const slotId of slotIds) {
            if (respectLocked && existingPalette?.isLocked(slotId)) {
                continue;
            }

            const [h, s, l] = derivedColors[slotId];
            // Apply style saturation multiplier
            const adjustedS = Math.min(100, s * saturationMultiplier);
            const hex = this.hslToHex(h, adjustedS, l);
            palette.setColor(slotId, hex);
        }

        return palette;
    }

    /**
     * Derives all slot colors from a base HSL color
     */
    private static deriveColorsFromBase(baseH: number, baseS: number, baseL: number): Record<SlotId, [number, number, number]> {
        // Determine what the base color is closest to
        const isWarmBase = (baseH >= 0 && baseH <= 60) || (baseH >= 300 && baseH <= 360);
        const isCoolBase = baseH >= 180 && baseH <= 270;
        const isGreenBase = baseH >= 60 && baseH <= 180;

        // Base influence factor (how much the base color affects other slots)
        const influence = 0.3;

        let result: Record<SlotId, [number, number, number]>;

        if (isGreenBase) {
            // Green base → use as foliage, derive vegetation-forward palette
            result = {
                sky: [this.shiftHue(200, baseH, influence * 0.5), Math.min(70, baseS * 0.8), Math.max(70, baseL + 20)],
                water: [this.shiftHue(210, baseH, influence * 0.5), Math.min(60, baseS * 0.7), baseL * 0.8],
                grass: [this.shiftHue(baseH - 10, baseH, influence), Math.min(65, baseS), Math.min(55, baseL + 5)],
                foliage: [baseH, baseS, baseL],
                rock: [this.shiftHue(30, baseH, influence * 0.3), Math.max(10, baseS * 0.2), baseL * 0.9],
                dirt: [this.shiftHue(30, baseH, influence * 0.4), Math.max(20, baseS * 0.4), baseL * 0.7],
                bark: [this.shiftHue(25, baseH, influence * 0.3), Math.max(25, baseS * 0.5), baseL * 0.5],
                accent: [this.complementary(baseH), Math.min(85, baseS + 20), Math.min(65, baseL + 10)]
            };
        } else if (isCoolBase) {
            // Cool base (blue/purple) → use as sky, derive atmosphere-forward palette
            result = {
                sky: [baseH, baseS, Math.max(65, baseL)],
                water: [this.shiftHue(baseH - 10, baseH, 0.2), Math.min(70, baseS + 10), Math.max(40, baseL - 15)],
                grass: [this.shiftHue(100, baseH, influence), Math.min(55, baseS * 0.7), 45],
                foliage: [this.shiftHue(120, baseH, influence), Math.min(50, baseS * 0.6), 35],
                rock: [this.shiftHue(baseH, baseH, 0.1), Math.max(10, baseS * 0.15), baseL * 0.7],
                dirt: [this.shiftHue(30, baseH, influence * 0.5), Math.max(25, baseS * 0.35), 35],
                bark: [this.shiftHue(25, baseH, influence * 0.4), Math.max(30, baseS * 0.4), 25],
                accent: [this.shiftHue(this.complementary(baseH), baseH, 0.3), Math.min(80, baseS + 15), 55]
            };
        } else {
            // Warm base (red/orange/yellow) → use for accent/terrain, earthy palette
            result = {
                sky: [this.shiftHue(200, baseH, influence * 0.4), Math.min(50, baseS * 0.6), 75],
                water: [this.shiftHue(200, baseH, influence * 0.4), Math.min(45, baseS * 0.5), 50],
                grass: [this.shiftHue(90, baseH, influence * 0.6), Math.min(50, baseS * 0.6), 45],
                foliage: [this.shiftHue(80, baseH, influence * 0.5), Math.min(55, baseS * 0.65), 38],
                rock: [this.shiftHue(baseH, baseH, 0.2), Math.max(15, baseS * 0.25), baseL * 0.8],
                dirt: [baseH, Math.min(45, baseS * 0.6), Math.min(45, baseL * 0.7)],
                bark: [this.shiftHue(baseH - 5, baseH, 0.1), Math.min(40, baseS * 0.5), baseL * 0.5],
                accent: [baseH, Math.min(85, baseS + 10), Math.min(60, baseL + 5)]
            };
        }

        // Clamp all values to valid ranges
        for (const slot of Object.keys(result) as SlotId[]) {
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

    /**
     * Calculates the shortest distance between two hues
     */
    private static hueDifference(h1: number, h2: number): number {
        const diff = Math.abs(h1 - h2);
        return Math.min(diff, 360 - diff);
    }

    /**
     * Returns 1 or -1 indicating the shortest direction to shift from h1 to h2
     */
    private static hueDirection(h1: number, h2: number): number {
        const diff = h2 - h1;
        if (Math.abs(diff) <= 180) {
            return diff > 0 ? 1 : -1;
        }
        return diff > 0 ? -1 : 1;
    }

    /**
     * Returns the complementary hue (opposite on color wheel)
     */
    private static complementary(hue: number): number {
        return (hue + 180) % 360;
    }

    /**
     * Converts HSL to hex string
     */
    private static hslToHex(h: number, s: number, l: number): string {
        const rgb = ImageProcessor.hslToRgb(h, s, l);
        return ColorConverter.rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    /**
     * Adds slight random variation to a palette for more natural feel
     * Useful for generating multiple options from the same preset
     */
    static addVariation(palette: EnvironmentPalette, amount: number = 10): EnvironmentPalette {
        const varied = palette.clone();
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];

        for (const slotId of slotIds) {
            if (varied.isLocked(slotId)) {
                continue;
            }

            const hex = varied.getColor(slotId);
            const rgb = ColorConverter.hexToRgb(hex);
            const [h, s, l] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);

            // Add random variation
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
    static getPresets(): PresetInfo[] {
        return [...PRESET_DEFINITIONS];
    }
}
