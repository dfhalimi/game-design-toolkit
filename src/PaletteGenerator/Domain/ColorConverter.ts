/**
 * Color conversion utilities
 * Handles conversion between different color formats (HSL, RGB, HEX)
 */
export class ColorConverter {
    /**
     * Converts HSL color values to RGB
     * @param h Hue (0-1)
     * @param s Saturation (0-1)
     * @param l Lightness (0-1)
     * @returns RGB values as [r, g, b] where each value is 0-255
     */
    static hslToRgb(h: number, s: number, l: number): [number, number, number] {
        let r: number, g: number, b: number;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number): number => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * Converts RGB color values to HEX string
     * @param r Red (0-255)
     * @param g Green (0-255)
     * @param b Blue (0-255)
     * @returns HEX color string (e.g., "#ff0000")
     */
    static rgbToHex(r: number, g: number, b: number): string {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    /**
     * Converts HEX color string to RGB values
     * @param hexcode HEX color string (e.g., "#ff0000")
     * @returns RGB values as [r, g, b] where each value is 0-255
     */
    static hexToRgb(hexcode: string): [number, number, number] {
        return [
            parseInt(hexcode.slice(1, 3), 16),
            parseInt(hexcode.slice(3, 5), 16),
            parseInt(hexcode.slice(5, 7), 16)
        ];
    }
}
