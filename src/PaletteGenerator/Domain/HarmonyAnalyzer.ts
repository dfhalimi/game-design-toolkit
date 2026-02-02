/**
 * Harmony Analyzer - Evaluates if environment palette colors work together
 * Uses color theory rules specific to outdoor game environments
 */

import { EnvironmentPalette, SlotId } from './EnvironmentPalette.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ColorConverter } from './ColorConverter.js';

/**
 * Severity levels for harmony issues
 */
export type IssueSeverity = 'error' | 'warning' | 'suggestion';

/**
 * A harmony issue found in the palette
 */
export interface HarmonyIssue {
    slot: SlotId | SlotId[];  // Affected slot(s)
    rule: string;              // Rule that was violated
    message: string;           // Human-readable description
    severity: IssueSeverity;
}

/**
 * A suggestion to fix a harmony issue
 */
export interface HarmonySuggestion {
    slot: SlotId;
    action: string;           // e.g., "shift_hue", "adjust_saturation", "adjust_lightness"
    value: number;            // Amount to adjust (degrees for hue, percentage for S/L)
    description: string;      // Human-readable description
    newColor: string;         // The suggested new color (hex)
}

/**
 * Complete analysis result
 */
export interface HarmonyAnalysis {
    score: number;            // 0-100 score
    issues: HarmonyIssue[];
    suggestions: HarmonySuggestion[];
}

/**
 * HSL values for internal calculations
 */
interface HSL {
    h: number;  // 0-360
    s: number;  // 0-100
    l: number;  // 0-100
}

/**
 * Harmony Analyzer class
 * Analyzes environment palettes for color harmony
 */
export class HarmonyAnalyzer {
    // Rule thresholds (tuned for flexibility across different moods/styles)
    private static readonly VEGETATION_HUE_RANGE = 80;      // Max degrees between grass and foliage (increased for autumn, etc.)
    private static readonly TERRAIN_HUE_RANGE = 70;         // Max degrees between terrain colors
    private static readonly TERRAIN_SATURATION_MAX = 60;    // Max saturation for terrain colors (increased)
    private static readonly SKY_WATER_HUE_RANGE = 50;       // Max hue difference between sky and water (increased for flexibility)
    private static readonly SKY_MIN_LIGHTNESS = 40;         // Minimum lightness for sky (lowered for dusk/mystical)
    private static readonly ACCENT_MIN_CONTRAST = 2.5;      // Minimum contrast ratio for accent (slightly relaxed)

    /**
     * Analyzes a palette and returns issues and suggestions
     */
    static analyze(palette: EnvironmentPalette): HarmonyAnalysis {
        const issues: HarmonyIssue[] = [];
        const suggestions: HarmonySuggestion[] = [];

        // Get all HSL values
        const colors = this.getAllHSL(palette);

        // Run all checks
        this.checkVegetationHueFamily(palette, colors, issues, suggestions);
        this.checkTerrainColors(palette, colors, issues, suggestions);
        this.checkSkyWaterRelationship(palette, colors, issues, suggestions);
        this.checkValueHierarchy(palette, colors, issues, suggestions);
        this.checkAccentContrast(palette, colors, issues, suggestions);
        this.checkSaturationBalance(palette, colors, issues, suggestions);

        // Calculate score
        const score = this.calculateScore(issues);

        return { score, issues, suggestions };
    }

    /**
     * Gets HSL values for all slots
     */
    private static getAllHSL(palette: EnvironmentPalette): Record<SlotId, HSL> {
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];
        const result: Partial<Record<SlotId, HSL>> = {};

        for (const id of slotIds) {
            const hex = palette.getColor(id);
            const rgb = ColorConverter.hexToRgb(hex);
            const [h, s, l] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);
            result[id] = { h, s, l };
        }

        return result as Record<SlotId, HSL>;
    }

    /**
     * Converts HSL back to hex
     */
    private static hslToHex(h: number, s: number, l: number): string {
        const rgb = ImageProcessor.hslToRgb(h, s, l);
        return ColorConverter.rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    /**
     * Calculates hue difference accounting for circular nature
     */
    private static hueDifference(h1: number, h2: number): number {
        const diff = Math.abs(h1 - h2);
        return Math.min(diff, 360 - diff);
    }

    /**
     * Checks if vegetation colors are in the same hue family
     * Note: Checks RELATIONSHIPS between grass and foliage, not absolute hue ranges
     * This allows for autumn (orange), mystical (teal), desert (olive) palettes
     */
    private static checkVegetationHueFamily(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        const grass = colors.grass;
        const foliage = colors.foliage;

        // Only check that grass and foliage are in the same family (within range of each other)
        // This allows any hue as long as they're cohesive together
        const hueDiff = this.hueDifference(grass.h, foliage.h);
        
        if (hueDiff > this.VEGETATION_HUE_RANGE) {
            issues.push({
                slot: ['grass', 'foliage'],
                rule: 'vegetation_family',
                message: `Grass and foliage hues are ${Math.round(hueDiff)}° apart (recommended: <${this.VEGETATION_HUE_RANGE}° for visual cohesion)`,
                severity: 'suggestion'
            });

            // Suggest moving foliage closer to grass (if unlocked)
            if (!palette.isLocked('foliage')) {
                // Calculate a target hue that's closer to grass
                const direction = this.hueDirection(foliage.h, grass.h);
                const targetHue = (foliage.h + direction * (hueDiff - 40) + 360) % 360;
                suggestions.push({
                    slot: 'foliage',
                    action: 'shift_hue',
                    value: targetHue - foliage.h,
                    description: `Shift foliage hue closer to grass for cohesion`,
                    newColor: this.hslToHex(targetHue, foliage.s, foliage.l)
                });
            }
        }
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
     * Checks terrain colors (rock, dirt, bark) for cohesion
     * Note: Checks RELATIONSHIPS between terrain colors, not absolute hue ranges
     * This allows for mystical (purple), snowy (cool gray), etc. palettes
     */
    private static checkTerrainColors(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        const rock = colors.rock;
        const dirt = colors.dirt;
        const bark = colors.bark;

        // Check that terrain colors are in the same hue family
        const rockDirtDiff = this.hueDifference(rock.h, dirt.h);
        const dirtBarkDiff = this.hueDifference(dirt.h, bark.h);
        const rockBarkDiff = this.hueDifference(rock.h, bark.h);
        const maxDiff = Math.max(rockDirtDiff, dirtBarkDiff, rockBarkDiff);

        if (maxDiff > this.TERRAIN_HUE_RANGE) {
            issues.push({
                slot: ['rock', 'dirt', 'bark'],
                rule: 'terrain_family',
                message: `Terrain colors span ${Math.round(maxDiff)}° in hue (recommended: <${this.TERRAIN_HUE_RANGE}° for visual cohesion)`,
                severity: 'suggestion'
            });

            // Find the outlier and suggest moving it closer
            // Use dirt as the reference since it's usually the most prominent terrain
            if (rockDirtDiff > this.TERRAIN_HUE_RANGE && !palette.isLocked('rock')) {
                const targetHue = dirt.h;
                suggestions.push({
                    slot: 'rock',
                    action: 'shift_hue',
                    value: targetHue - rock.h,
                    description: 'Shift rock hue closer to dirt for cohesion',
                    newColor: this.hslToHex(targetHue, rock.s, rock.l)
                });
            }
            if (dirtBarkDiff > this.TERRAIN_HUE_RANGE && !palette.isLocked('bark')) {
                const targetHue = dirt.h;
                suggestions.push({
                    slot: 'bark',
                    action: 'shift_hue',
                    value: targetHue - bark.h,
                    description: 'Shift bark hue closer to dirt for cohesion',
                    newColor: this.hslToHex(targetHue, bark.s, bark.l)
                });
            }
        }

        // Check saturation - terrain should generally be less saturated than vegetation
        // Only flag very high saturation, allow more flexibility
        const terrainSlots: { id: SlotId; color: HSL }[] = [
            { id: 'dirt', color: dirt },
            { id: 'bark', color: bark }
        ];

        for (const { id, color } of terrainSlots) {
            if (color.s > this.TERRAIN_SATURATION_MAX) {
                issues.push({
                    slot: id,
                    rule: 'terrain_saturation',
                    message: `${id.charAt(0).toUpperCase() + id.slice(1)} saturation (${Math.round(color.s)}%) is high for terrain (recommended: <${this.TERRAIN_SATURATION_MAX}%)`,
                    severity: 'suggestion'
                });

                if (!palette.isLocked(id)) {
                    const targetSat = this.TERRAIN_SATURATION_MAX - 10;
                    suggestions.push({
                        slot: id,
                        action: 'adjust_saturation',
                        value: targetSat - color.s,
                        description: `Reduce ${id} saturation for natural look`,
                        newColor: this.hslToHex(color.h, targetSat, color.l)
                    });
                }
            }
        }
    }

    /**
     * Checks sky-water relationship
     */
    private static checkSkyWaterRelationship(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        const sky = colors.sky;
        const water = colors.water;

        const hueDiff = this.hueDifference(sky.h, water.h);

        if (hueDiff > this.SKY_WATER_HUE_RANGE) {
            issues.push({
                slot: ['sky', 'water'],
                rule: 'sky_water_relationship',
                message: `Sky and water hues are ${Math.round(hueDiff)}° apart (water reflects sky, recommended: <${this.SKY_WATER_HUE_RANGE}°)`,
                severity: 'warning'
            });

            if (!palette.isLocked('water')) {
                // Make water closer to sky but slightly different
                const targetHue = sky.h;
                suggestions.push({
                    slot: 'water',
                    action: 'shift_hue',
                    value: targetHue - water.h,
                    description: 'Shift water hue to reflect sky',
                    newColor: this.hslToHex(targetHue, water.s, water.l)
                });
            }
        }

        // Water should typically be darker and more saturated than sky
        if (water.l > sky.l) {
            issues.push({
                slot: 'water',
                rule: 'water_value',
                message: `Water (${Math.round(water.l)}% lightness) is brighter than sky (${Math.round(sky.l)}%)`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('water')) {
                const targetL = sky.l - 15;
                suggestions.push({
                    slot: 'water',
                    action: 'adjust_lightness',
                    value: targetL - water.l,
                    description: 'Darken water to be below sky brightness',
                    newColor: this.hslToHex(water.h, water.s, Math.max(20, targetL))
                });
            }
        }
    }

    /**
     * Checks value hierarchy (sky should be brightest)
     */
    private static checkValueHierarchy(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        const sky = colors.sky;

        if (sky.l < this.SKY_MIN_LIGHTNESS) {
            issues.push({
                slot: 'sky',
                rule: 'sky_brightness',
                message: `Sky lightness (${Math.round(sky.l)}%) is low (recommended: >${this.SKY_MIN_LIGHTNESS}%)`,
                severity: 'warning'
            });

            if (!palette.isLocked('sky')) {
                const targetL = 70;
                suggestions.push({
                    slot: 'sky',
                    action: 'adjust_lightness',
                    value: targetL - sky.l,
                    description: 'Brighten sky for natural daylight feel',
                    newColor: this.hslToHex(sky.h, sky.s, targetL)
                });
            }
        }

        // Check that bark/dirt are darker than grass
        const grass = colors.grass;
        const bark = colors.bark;
        
        if (bark.l > grass.l + 10) {
            issues.push({
                slot: 'bark',
                rule: 'value_hierarchy',
                message: `Bark (${Math.round(bark.l)}%) is brighter than grass (${Math.round(grass.l)}%)`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('bark')) {
                const targetL = grass.l - 15;
                suggestions.push({
                    slot: 'bark',
                    action: 'adjust_lightness',
                    value: targetL - bark.l,
                    description: 'Darken bark for proper value hierarchy',
                    newColor: this.hslToHex(bark.h, bark.s, Math.max(15, targetL))
                });
            }
        }
    }

    /**
     * Checks accent contrast against scene average
     */
    private static checkAccentContrast(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        // Calculate average scene lightness (excluding accent)
        const sceneSlots: SlotId[] = ['sky', 'grass', 'foliage', 'rock', 'dirt'];
        const avgLightness = sceneSlots.reduce((sum, id) => sum + colors[id].l, 0) / sceneSlots.length;

        const accent = colors.accent;
        const lightnessDiff = Math.abs(accent.l - avgLightness);

        // Calculate approximate contrast ratio
        const contrastRatio = this.calculateContrastRatio(accent.l, avgLightness);

        if (contrastRatio < this.ACCENT_MIN_CONTRAST) {
            issues.push({
                slot: 'accent',
                rule: 'accent_contrast',
                message: `Accent contrast ratio (${contrastRatio.toFixed(1)}) is low against scene (recommended: >${this.ACCENT_MIN_CONTRAST})`,
                severity: 'warning'
            });

            if (!palette.isLocked('accent')) {
                // Suggest moving accent further from average
                const targetL = avgLightness > 50 ? 25 : 75;
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_lightness',
                    value: targetL - accent.l,
                    description: 'Adjust accent lightness for better contrast',
                    newColor: this.hslToHex(accent.h, accent.s, targetL)
                });
            }
        }

        // Accent should typically be more saturated (but allow realistic muted accents)
        if (accent.s < 30) {
            issues.push({
                slot: 'accent',
                rule: 'accent_saturation',
                message: `Accent saturation (${Math.round(accent.s)}%) is quite low for a highlight color`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('accent')) {
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_saturation',
                    value: 50 - accent.s,
                    description: 'Increase accent saturation for more visibility',
                    newColor: this.hslToHex(accent.h, 50, accent.l)
                });
            }
        }
    }

    /**
     * Checks overall saturation balance
     * Note: Only flags extremely high saturation, allows for stylized palettes
     */
    private static checkSaturationBalance(
        palette: EnvironmentPalette,
        colors: Record<SlotId, HSL>,
        issues: HarmonyIssue[],
        suggestions: HarmonySuggestion[]
    ): void {
        // Only flag extremely saturated vegetation (>80% is very intense)
        const maxNaturalSat = 80;
        const vegSlots: SlotId[] = ['grass', 'foliage'];

        for (const slot of vegSlots) {
            const color = colors[slot];
            if (color.s > maxNaturalSat) {
                issues.push({
                    slot,
                    rule: 'saturation_balance',
                    message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} saturation (${Math.round(color.s)}%) is very high`,
                    severity: 'suggestion'
                });

                if (!palette.isLocked(slot)) {
                    suggestions.push({
                        slot,
                        action: 'adjust_saturation',
                        value: 65 - color.s,
                        description: `Reduce ${slot} saturation slightly`,
                        newColor: this.hslToHex(color.h, 65, color.l)
                    });
                }
            }
        }
    }

    /**
     * Calculates an approximate contrast ratio from lightness values
     * This is a simplified version - full WCAG contrast uses luminance
     */
    private static calculateContrastRatio(l1: number, l2: number): number {
        // Convert lightness to approximate luminance (simplified)
        const lum1 = l1 / 100;
        const lum2 = l2 / 100;
        
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Calculates overall harmony score based on issues
     */
    private static calculateScore(issues: HarmonyIssue[]): number {
        let score = 100;

        for (const issue of issues) {
            switch (issue.severity) {
                case 'error':
                    score -= 20;
                    break;
                case 'warning':
                    score -= 10;
                    break;
                case 'suggestion':
                    score -= 5;
                    break;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Applies a suggestion to the palette
     */
    static applySuggestion(palette: EnvironmentPalette, suggestion: HarmonySuggestion): void {
        palette.setColor(suggestion.slot, suggestion.newColor);
    }

    /**
     * Applies all suggestions to unlocked slots
     */
    static applyAllSuggestions(palette: EnvironmentPalette, suggestions: HarmonySuggestion[]): void {
        for (const suggestion of suggestions) {
            if (!palette.isLocked(suggestion.slot)) {
                palette.setColor(suggestion.slot, suggestion.newColor);
            }
        }
    }
}
