import { ImageProcessor } from './ImageProcessor.js';

/**
 * A color replacement definition
 */
export interface ColorReplacement {
    id: string;
    sourceColor: string;      // Hex color sampled from image
    targetColor: string;      // Hex color to shift toward
    tolerance: number;        // 0-100, how similar pixels need to be to get adjusted
    enabled: boolean;
}

/**
 * Simple color replacement processor.
 * Uses the same HSL adjustment logic as simple mode,
 * but applies it selectively based on color similarity.
 */
export class ColorReplacementProcessor {
    
    /**
     * Generates a preview mask showing which pixels would be affected
     * by a color replacement at the given tolerance.
     * @returns Float32Array with values 0-1 indicating selection strength
     */
    static generateSelectionMask(
        imageData: ImageData,
        sourceColorHex: string,
        tolerance: number
    ): Float32Array {
        const data = imageData.data;
        const pixelCount = data.length / 4;
        const mask = new Float32Array(pixelCount);
        
        const sourceRgb = this.hexToRgb(sourceColorHex);
        const [sourceH, sourceS, sourceL] = ImageProcessor.rgbToHsl(sourceRgb[0], sourceRgb[1], sourceRgb[2]);
        
        // Tolerance maps to max distance (0 = exact match only, 100 = everything)
        const maxDistance = tolerance * 1.5; // Scale so 100% tolerance covers most colors
        
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            
            if (a < 128) {
                mask[i] = 0;
                continue;
            }
            
            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);
            const distance = this.colorDistance(h, s, l, sourceH, sourceS, sourceL);
            
            if (distance <= maxDistance) {
                // Smooth falloff at edges of selection
                const strength = 1 - (distance / maxDistance);
                mask[i] = Math.pow(strength, 0.5); // Slight curve for smoother falloff
            } else {
                mask[i] = 0;
            }
        }
        
        return mask;
    }
    
    /**
     * Calculates the average HSL of pixels matching a source color within tolerance
     */
    private static calculateAverageSourceColor(
        imageData: ImageData,
        sourceColorHex: string,
        tolerance: number
    ): [number, number, number] {
        const data = imageData.data;
        const sourceRgb = this.hexToRgb(sourceColorHex);
        const [sourceH, sourceS, sourceL] = ImageProcessor.rgbToHsl(sourceRgb[0], sourceRgb[1], sourceRgb[2]);
        const maxDistance = tolerance * 1.5;
        
        let totalH = 0, totalS = 0, totalL = 0;
        let totalWeight = 0;
        
        // For hue averaging, we need to handle wrap-around
        let sinH = 0, cosH = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a < 128) continue;
            
            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);
            const distance = this.colorDistance(h, s, l, sourceH, sourceS, sourceL);
            
            if (distance <= maxDistance) {
                const weight = 1 - (distance / maxDistance);
                
                // Use circular mean for hue
                const hRad = (h * Math.PI) / 180;
                sinH += Math.sin(hRad) * weight * s; // Weight by saturation (gray has undefined hue)
                cosH += Math.cos(hRad) * weight * s;
                
                totalS += s * weight;
                totalL += l * weight;
                totalWeight += weight;
            }
        }
        
        if (totalWeight === 0) {
            return [sourceH, sourceS, sourceL];
        }
        
        // Calculate circular mean for hue
        let avgH = (Math.atan2(sinH, cosH) * 180) / Math.PI;
        if (avgH < 0) avgH += 360;
        
        const avgS = totalS / totalWeight;
        const avgL = totalL / totalWeight;
        
        return [avgH, avgS, avgL];
    }

    /**
     * Applies color replacements to an image.
     * Each replacement uses the same HSL shift logic as simple mode.
     * Shifts are calculated from the AVERAGE of selected pixels, not just the sampled point.
     */
    static applyReplacements(
        imageData: ImageData,
        replacements: ColorReplacement[]
    ): ImageData {
        const activeReplacements = replacements.filter(r => r.enabled && r.targetColor);
        
        if (activeReplacements.length === 0) {
            const copy = new ImageData(imageData.width, imageData.height);
            copy.data.set(imageData.data);
            return copy;
        }
        
        // Pre-calculate HSL values and shifts for each replacement
        // Use the AVERAGE color of selected pixels as the source for shift calculation
        const replacementData = activeReplacements.map(r => {
            const [avgSourceH, avgSourceS, avgSourceL] = this.calculateAverageSourceColor(
                imageData, r.sourceColor, r.tolerance
            );
            
            const targetRgb = this.hexToRgb(r.targetColor);
            const [targetH, targetS, targetL] = ImageProcessor.rgbToHsl(targetRgb[0], targetRgb[1], targetRgb[2]);
            
            // For matching pixels, use the original sampled source color
            const sourceRgb = this.hexToRgb(r.sourceColor);
            const [sourceH, sourceS, sourceL] = ImageProcessor.rgbToHsl(sourceRgb[0], sourceRgb[1], sourceRgb[2]);
            
            return {
                replacement: r,
                sourceH, sourceS, sourceL,  // For distance calculation
                targetH, targetS, targetL,
                // Shifts calculated from average, so "center" of selection becomes target
                hueShift: targetH - avgSourceH,
                satRatio: avgSourceS > 0 ? targetS / avgSourceS : 1,
                lightShift: targetL - avgSourceL,
                maxDistance: r.tolerance * 1.5
            };
        });
        
        const data = imageData.data;
        const newImageData = new ImageData(imageData.width, imageData.height);
        const newData = newImageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            newData[i + 3] = a; // Preserve alpha
            
            if (a < 128) {
                newData[i] = r;
                newData[i + 1] = g;
                newData[i + 2] = b;
                continue;
            }
            
            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);
            
            // Find the best matching replacement (closest source color within tolerance)
            let bestMatch: typeof replacementData[0] | null = null;
            let bestDistance = Infinity;
            let bestStrength = 0;
            
            for (const rd of replacementData) {
                const distance = this.colorDistance(h, s, l, rd.sourceH, rd.sourceS, rd.sourceL);
                
                if (distance <= rd.maxDistance && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = rd;
                    bestStrength = 1 - (distance / rd.maxDistance);
                }
            }
            
            if (bestMatch && bestStrength > 0) {
                // Apply HSL shift
                const newS = Math.max(0, Math.min(100, s * bestMatch.satRatio));
                const newL = Math.max(0, Math.min(100, l + bestMatch.lightShift));
                
                // For hue: low-saturation pixels don't have a meaningful hue,
                // so we should adopt the target's hue to get the right tint (warm/cool gray)
                let newH: number;
                if (s < 8) {
                    // Very desaturated - use target hue directly (gives correct warm/cool tint)
                    newH = bestMatch.targetH;
                } else if (s < 20) {
                    // Low saturation - blend toward target hue
                    const blendFactor = (s - 8) / 12; // 0 at s=8, 1 at s=20
                    const shiftedH = (h + bestMatch.hueShift + 360) % 360;
                    // Interpolate hue (handling wrap-around)
                    let hueDiff = shiftedH - bestMatch.targetH;
                    if (hueDiff > 180) hueDiff -= 360;
                    if (hueDiff < -180) hueDiff += 360;
                    newH = (bestMatch.targetH + hueDiff * blendFactor + 360) % 360;
                } else {
                    // Normal saturation - apply full hue shift
                    newH = (h + bestMatch.hueShift + 360) % 360;
                }
                
                const [adjR, adjG, adjB] = ImageProcessor.hslToRgb(newH, newS, newL);
                
                // Blend based on strength for smooth edges
                const blend = Math.pow(bestStrength, 0.7); // Smooth curve
                newData[i] = Math.round(r + (adjR - r) * blend);
                newData[i + 1] = Math.round(g + (adjG - g) * blend);
                newData[i + 2] = Math.round(b + (adjB - b) * blend);
            } else {
                // No match - keep original
                newData[i] = r;
                newData[i + 1] = g;
                newData[i + 2] = b;
            }
        }
        
        return newImageData;
    }
    
    /**
     * Visualizes a selection mask
     */
    static visualizeMask(
        mask: Float32Array,
        width: number,
        height: number,
        overlayColor: [number, number, number] = [255, 100, 100]
    ): ImageData {
        const imageData = new ImageData(width, height);
        const data = imageData.data;
        
        for (let i = 0; i < mask.length; i++) {
            const idx = i * 4;
            const strength = mask[i];
            
            // Show selection as colored overlay on dark background
            const bg = 30;
            data[idx] = Math.round(bg + (overlayColor[0] - bg) * strength);
            data[idx + 1] = Math.round(bg + (overlayColor[1] - bg) * strength);
            data[idx + 2] = Math.round(bg + (overlayColor[2] - bg) * strength);
            data[idx + 3] = 255;
        }
        
        return imageData;
    }
    
    /**
     * Calculates color distance in HSL space
     */
    private static colorDistance(
        h1: number, s1: number, l1: number,
        h2: number, s2: number, l2: number
    ): number {
        // Handle hue wrap-around
        let hueDiff = Math.abs(h1 - h2);
        if (hueDiff > 180) hueDiff = 360 - hueDiff;
        
        // Weight hue by average saturation (gray colors have meaningless hue)
        const avgSat = (s1 + s2) / 2;
        const hueWeight = avgSat / 100;
        
        const satDiff = Math.abs(s1 - s2);
        const lightDiff = Math.abs(l1 - l2);
        
        return Math.sqrt(
            (hueDiff * hueWeight) ** 2 +
            satDiff ** 2 +
            lightDiff ** 2
        );
    }
    
    /**
     * Converts hex to RGB
     */
    private static hexToRgb(hex: string): [number, number, number] {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return [128, 128, 128];
        return [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ];
    }
}
