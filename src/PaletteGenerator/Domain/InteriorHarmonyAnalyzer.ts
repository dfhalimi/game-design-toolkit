/**
 * Interior Harmony Analyzer - Evaluates if interior palette colors work together
 * Uses color theory rules specific to indoor game environments
 * Based on interior design principles like the 60-30-10 rule
 */

import { InteriorPalette, InteriorSlotId } from './InteriorPalette.js';
import { ImageProcessor } from './ImageProcessor.js';
import { ColorConverter } from './ColorConverter.js';
import { ACCENT_LIGHTNESS } from './PaletteRules.js';

/**
 * Severity levels for harmony issues
 */
export type InteriorIssueSeverity = 'error' | 'warning' | 'suggestion';

/**
 * A harmony issue found in the palette
 */
export interface InteriorHarmonyIssue {
    slot: InteriorSlotId | InteriorSlotId[];
    rule: string;
    message: string;
    severity: InteriorIssueSeverity;
}

/**
 * A suggestion to fix a harmony issue
 */
export interface InteriorHarmonySuggestion {
    slot: InteriorSlotId;
    action: string;
    value: number;
    description: string;
    newColor: string;
}

/**
 * Complete analysis result
 */
export interface InteriorHarmonyAnalysis {
    score: number;
    issues: InteriorHarmonyIssue[];
    suggestions: InteriorHarmonySuggestion[];
}

/**
 * HSL values for internal calculations
 */
interface HSL {
    h: number;
    s: number;
    l: number;
}

/**
 * Interior Harmony Analyzer class
 */
export class InteriorHarmonyAnalyzer {
    // Rule thresholds for interior design
    private static readonly SURFACE_HUE_RANGE = 60;      // Max hue difference between wall/floor/ceiling
    private static readonly MATERIAL_HUE_RANGE = 50;     // Max hue difference between wood/trim
    private static readonly CEILING_MIN_LIGHTNESS = 70;  // Ceiling should be bright
    private static readonly WALL_MIN_LIGHTNESS = 40;     // Wall shouldn't be too dark (unless intentional)
    private static readonly WOOD_TRIM_HUE_RANGE = 40;    // Wood and trim should be related

    /**
     * Analyzes a palette and returns issues and suggestions
     */
    static analyze(palette: InteriorPalette): InteriorHarmonyAnalysis {
        const issues: InteriorHarmonyIssue[] = [];
        const suggestions: InteriorHarmonySuggestion[] = [];

        const colors = this.getAllHSL(palette);

        // Run all checks
        this.checkSurfaceValueHierarchy(palette, colors, issues, suggestions);
        this.checkSurfaceHarmony(palette, colors, issues, suggestions);
        this.checkMaterialCohesion(palette, colors, issues, suggestions);
        this.checkWoodTrimRelationship(palette, colors, issues, suggestions);
        this.checkAccentContrast(palette, colors, issues, suggestions);
        this.checkFabricBalance(palette, colors, issues, suggestions);

        const score = this.calculateScore(issues);

        return { score, issues, suggestions };
    }

    /**
     * Gets HSL values for all slots
     */
    private static getAllHSL(palette: InteriorPalette): Record<InteriorSlotId, HSL> {
        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];
        const result: Partial<Record<InteriorSlotId, HSL>> = {};

        for (const id of slotIds) {
            const hex = palette.getColor(id);
            const rgb = ColorConverter.hexToRgb(hex);
            const [h, s, l] = ImageProcessor.rgbToHsl(rgb[0], rgb[1], rgb[2]);
            result[id] = { h, s, l };
        }

        return result as Record<InteriorSlotId, HSL>;
    }

    private static hslToHex(h: number, s: number, l: number): string {
        const rgb = ImageProcessor.hslToRgb(h, s, l);
        return ColorConverter.rgbToHex(rgb[0], rgb[1], rgb[2]);
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

    /**
     * Checks value hierarchy: Ceiling > Wall > Floor (typically)
     * Based on natural lighting where light comes from above
     */
    private static checkSurfaceValueHierarchy(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const ceiling = colors.ceiling;
        const wall = colors.wall;
        const floor = colors.floor;

        // Ceiling should be the lightest surface
        if (ceiling.l < this.CEILING_MIN_LIGHTNESS) {
            issues.push({
                slot: 'ceiling',
                rule: 'ceiling_brightness',
                message: `Ceiling lightness (${Math.round(ceiling.l)}%) is dark (recommended: >${this.CEILING_MIN_LIGHTNESS}% for natural feel)`,
                severity: 'warning'
            });

            if (!palette.isLocked('ceiling')) {
                const targetL = 90;
                suggestions.push({
                    slot: 'ceiling',
                    action: 'adjust_lightness',
                    value: targetL - ceiling.l,
                    description: 'Brighten ceiling for natural lighting feel',
                    newColor: this.hslToHex(ceiling.h, ceiling.s, targetL)
                });
            }
        }

        // Ceiling should be lighter than wall
        if (ceiling.l < wall.l) {
            issues.push({
                slot: ['ceiling', 'wall'],
                rule: 'ceiling_wall_hierarchy',
                message: `Ceiling (${Math.round(ceiling.l)}%) is darker than wall (${Math.round(wall.l)}%)`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('ceiling')) {
                const targetL = Math.min(98, wall.l + 15);
                suggestions.push({
                    slot: 'ceiling',
                    action: 'adjust_lightness',
                    value: targetL - ceiling.l,
                    description: 'Lighten ceiling to be brighter than wall',
                    newColor: this.hslToHex(ceiling.h, Math.min(ceiling.s, 10), targetL)
                });
            }
        }

        // Wall shouldn't be too dark (unless going for specific mood)
        if (wall.l < this.WALL_MIN_LIGHTNESS && wall.s > 20) {
            issues.push({
                slot: 'wall',
                rule: 'wall_darkness',
                message: `Wall lightness (${Math.round(wall.l)}%) is quite dark for main surface`,
                severity: 'suggestion'
            });
        }
    }

    /**
     * Checks that surfaces (wall, floor, ceiling) are harmonious
     */
    private static checkSurfaceHarmony(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const wall = colors.wall;
        const floor = colors.floor;
        const ceiling = colors.ceiling;

        // For saturated surfaces, check hue relationship
        // Skip this check for neutral/gray surfaces (low saturation)
        const wallSaturated = wall.s > 15;
        const floorSaturated = floor.s > 15;

        if (wallSaturated && floorSaturated) {
            const hueDiff = this.hueDifference(wall.h, floor.h);
            
            if (hueDiff > this.SURFACE_HUE_RANGE) {
                issues.push({
                    slot: ['wall', 'floor'],
                    rule: 'surface_harmony',
                    message: `Wall and floor hues are ${Math.round(hueDiff)}° apart (recommended: <${this.SURFACE_HUE_RANGE}° for cohesion)`,
                    severity: 'suggestion'
                });

                if (!palette.isLocked('floor')) {
                    const direction = this.hueDirection(floor.h, wall.h);
                    const targetHue = (floor.h + direction * (hueDiff - 30) + 360) % 360;
                    suggestions.push({
                        slot: 'floor',
                        action: 'shift_hue',
                        value: targetHue - floor.h,
                        description: 'Shift floor hue closer to wall for cohesion',
                        newColor: this.hslToHex(targetHue, floor.s, floor.l)
                    });
                }
            }
        }
    }

    /**
     * Checks that materials (wood, fabric, metal) work together
     */
    private static checkMaterialCohesion(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const wood = colors.wood;
        const fabric = colors.fabric;
        const metal = colors.metal;

        // Check wood and fabric relationship (common pairing in furniture)
        if (wood.s > 15 && fabric.s > 15) {
            const hueDiff = this.hueDifference(wood.h, fabric.h);
            
            if (hueDiff > this.MATERIAL_HUE_RANGE && hueDiff < 120) {
                // They're neither similar nor complementary
                issues.push({
                    slot: ['wood', 'fabric'],
                    rule: 'material_harmony',
                    message: `Wood and fabric hues (${Math.round(hueDiff)}° apart) may clash`,
                    severity: 'suggestion'
                });
            }
        }

        // Metal should typically be neutral or complement the palette
        if (metal.s > 50) {
            issues.push({
                slot: 'metal',
                rule: 'metal_saturation',
                message: `Metal saturation (${Math.round(metal.s)}%) is high (metals are typically desaturated)`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('metal')) {
                suggestions.push({
                    slot: 'metal',
                    action: 'adjust_saturation',
                    value: 30 - metal.s,
                    description: 'Reduce metal saturation for realistic look',
                    newColor: this.hslToHex(metal.h, 30, metal.l)
                });
            }
        }
    }

    /**
     * Checks wood and trim relationship (architectural cohesion)
     */
    private static checkWoodTrimRelationship(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const wood = colors.wood;
        const trim = colors.trim;

        // Both should be in similar temperature (both warm or both cool)
        const woodWarm = (wood.h >= 0 && wood.h <= 60) || (wood.h >= 300);
        const trimWarm = (trim.h >= 0 && trim.h <= 60) || (trim.h >= 300);
        
        // Only check if both are saturated enough to have a noticeable hue
        if (wood.s > 20 && trim.s > 20) {
            if (woodWarm !== trimWarm) {
                const hueDiff = this.hueDifference(wood.h, trim.h);
                if (hueDiff > this.WOOD_TRIM_HUE_RANGE) {
                    issues.push({
                        slot: ['wood', 'trim'],
                        rule: 'wood_trim_temperature',
                        message: `Wood and trim are different temperatures (${hueDiff}° apart) - may feel disconnected`,
                        severity: 'suggestion'
                    });
                }
            }
        }
    }

    /**
     * Checks accent contrast against wall (primary background)
     */
    private static checkAccentContrast(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const accent = colors.accent;
        const wall = colors.wall;

        // Accent should have sufficient contrast with wall
        const lightnessDiff = Math.abs(accent.l - wall.l);
        const MIN_CONTRAST = 25;

        if (lightnessDiff < MIN_CONTRAST) {
            issues.push({
                slot: 'accent',
                rule: 'accent_wall_contrast',
                message: `Accent has low contrast with wall (${Math.round(lightnessDiff)}% lightness difference, recommended: >${MIN_CONTRAST}%)`,
                severity: 'warning'
            });

            if (!palette.isLocked('accent')) {
                // Make accent lighter or darker than wall
                const targetL = accent.l > wall.l 
                    ? Math.min(85, wall.l + MIN_CONTRAST + 10)
                    : Math.max(25, wall.l - MIN_CONTRAST - 10);
                
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_lightness',
                    value: targetL - accent.l,
                    description: 'Adjust accent lightness for better contrast with wall',
                    newColor: this.hslToHex(accent.h, accent.s, targetL)
                });
            }
        }

        // Accent should be reasonably saturated
        if (accent.s < 30) {
            issues.push({
                slot: 'accent',
                rule: 'accent_saturation',
                message: `Accent saturation (${Math.round(accent.s)}%) is low for a highlight color`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('accent')) {
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_saturation',
                    value: 50 - accent.s,
                    description: 'Increase accent saturation for visibility',
                    newColor: this.hslToHex(accent.h, 50, accent.l)
                });
            }
        }

        // Check accent lightness bounds
        if (accent.l < ACCENT_LIGHTNESS.min) {
            issues.push({
                slot: 'accent',
                rule: 'accent_too_dark',
                message: `Accent lightness (${Math.round(accent.l)}%) is very dark`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('accent')) {
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_lightness',
                    value: ACCENT_LIGHTNESS.min - accent.l,
                    description: 'Brighten accent for visibility',
                    newColor: this.hslToHex(accent.h, accent.s, ACCENT_LIGHTNESS.min)
                });
            }
        }

        if (accent.l > ACCENT_LIGHTNESS.max) {
            issues.push({
                slot: 'accent',
                rule: 'accent_too_bright',
                message: `Accent lightness (${Math.round(accent.l)}%) is very bright`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('accent')) {
                suggestions.push({
                    slot: 'accent',
                    action: 'adjust_lightness',
                    value: ACCENT_LIGHTNESS.max - accent.l,
                    description: 'Tone down accent brightness',
                    newColor: this.hslToHex(accent.h, accent.s, ACCENT_LIGHTNESS.max)
                });
            }
        }
    }

    /**
     * Checks fabric doesn't overpower the palette
     */
    private static checkFabricBalance(
        palette: InteriorPalette,
        colors: Record<InteriorSlotId, HSL>,
        issues: InteriorHarmonyIssue[],
        suggestions: InteriorHarmonySuggestion[]
    ): void {
        const fabric = colors.fabric;
        const wall = colors.wall;

        // Fabric shouldn't be more saturated than 70% typically (unless accent)
        if (fabric.s > 70) {
            issues.push({
                slot: 'fabric',
                rule: 'fabric_saturation',
                message: `Fabric saturation (${Math.round(fabric.s)}%) is high - may overpower the room`,
                severity: 'suggestion'
            });

            if (!palette.isLocked('fabric')) {
                suggestions.push({
                    slot: 'fabric',
                    action: 'adjust_saturation',
                    value: 55 - fabric.s,
                    description: 'Reduce fabric saturation for balance',
                    newColor: this.hslToHex(fabric.h, 55, fabric.l)
                });
            }
        }
    }

    /**
     * Calculates overall harmony score based on issues
     */
    private static calculateScore(issues: InteriorHarmonyIssue[]): number {
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
    static applySuggestion(palette: InteriorPalette, suggestion: InteriorHarmonySuggestion): void {
        palette.setColor(suggestion.slot, suggestion.newColor);
    }

    /**
     * Applies all suggestions to unlocked slots
     */
    static applyAllSuggestions(palette: InteriorPalette, suggestions: InteriorHarmonySuggestion[]): void {
        for (const suggestion of suggestions) {
            if (!palette.isLocked(suggestion.slot)) {
                palette.setColor(suggestion.slot, suggestion.newColor);
            }
        }
    }
}
