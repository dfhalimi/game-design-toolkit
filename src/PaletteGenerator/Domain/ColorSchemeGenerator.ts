import {ColorConverter} from "./ColorConverter.js";

/**
 * Color scheme generation utilities
 * Generates related colors based on color theory (complementary, analogous, etc.)
 */
export class ColorSchemeGenerator {
    /**
     * Gets the complementary color (opposite on the color wheel)
     * @param colorHexcode HEX color string
     * @returns Complementary color as HEX string
     */
    static getComplementaryColor(colorHexcode: string): string {
        const rgb = ColorConverter.hexToRgb(colorHexcode);
        const [r, g, b] = rgb.map(x => 255 - x);
        return ColorConverter.rgbToHex(r, g, b);
    }
}
