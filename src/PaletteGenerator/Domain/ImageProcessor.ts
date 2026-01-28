/**
 * Image processing utilities
 * Handles image analysis and HSL transformations
 */
export class ImageProcessor {
    /**
     * Extracts the dominant color from an image
     * Uses a simple averaging approach on sampled pixels
     * @param imageData ImageData from canvas
     * @returns Dominant color as RGB tuple [r, g, b]
     */
    static getDominantColor(imageData: ImageData): [number, number, number] {
        const data = imageData.data;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let pixelCount = 0;

        // Sample every 10th pixel for performance
        for (let i = 0; i < data.length; i += 40) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent pixels
            if (a > 128) {
                totalR += r;
                totalG += g;
                totalB += b;
                pixelCount++;
            }
        }

        if (pixelCount === 0) {
            return [128, 128, 128]; // Default gray
        }

        return [
            Math.round(totalR / pixelCount),
            Math.round(totalG / pixelCount),
            Math.round(totalB / pixelCount)
        ];
    }

    /**
     * Converts RGB to HSL
     * @param r Red (0-255)
     * @param g Green (0-255)
     * @param b Blue (0-255)
     * @returns HSL as [h, s, l] where h is 0-360, s and l are 0-100
     */
    static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        return [h * 360, s * 100, l * 100];
    }

    /**
     * Converts HSL to RGB
     * @param h Hue (0-360)
     * @param s Saturation (0-100)
     * @param l Lightness (0-100)
     * @returns RGB as [r, g, b] where each value is 0-255
     */
    static hslToRgb(h: number, s: number, l: number): [number, number, number] {
        h /= 360;
        s /= 100;
        l /= 100;

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
     * Applies global HSL adjustment to image data
     * Shifts all pixels to match target color while preserving relative differences
     * @param imageData Original image data
     * @param targetRgb Target color RGB [r, g, b]
     * @returns New ImageData with adjusted colors
     */
    static applyHslAdjustment(imageData: ImageData, targetRgb: [number, number, number]): ImageData {
        // Get dominant color of original
        const dominantRgb = this.getDominantColor(imageData);
        const [dominantH, dominantS, dominantL] = this.rgbToHsl(dominantRgb[0], dominantRgb[1], dominantRgb[2]);
        const [targetH, targetS, targetL] = this.rgbToHsl(targetRgb[0], targetRgb[1], targetRgb[2]);

        // Calculate shifts
        const hueShift = targetH - dominantH;
        const saturationRatio = dominantS > 0 ? targetS / dominantS : 1;
        const lightnessShift = targetL - dominantL;

        // Create new image data
        const newImageData = new ImageData(imageData.width, imageData.height);
        const data = imageData.data;
        const newData = newImageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Convert pixel to HSL
            const [h, s, l] = this.rgbToHsl(r, g, b);

            // Apply adjustments
            let newH = (h + hueShift + 360) % 360;
            let newS = Math.max(0, Math.min(100, s * saturationRatio));
            let newL = Math.max(0, Math.min(100, l + lightnessShift));

            // Convert back to RGB
            const [newR, newG, newB] = this.hslToRgb(newH, newS, newL);

            newData[i] = newR;
            newData[i + 1] = newG;
            newData[i + 2] = newB;
            newData[i + 3] = a; // Preserve alpha
        }

        return newImageData;
    }
}
