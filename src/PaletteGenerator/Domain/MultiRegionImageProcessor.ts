import { ImageProcessor } from './ImageProcessor.js';

/**
 * Represents a detected color region in an image
 */
export interface ColorRegion {
    id: string;
    name: string;
    centroidHsl: [number, number, number];
    targetColor: string | null;
    pixelCount: number;
}

/**
 * Internal representation of a pixel's HSL values with position
 */
interface PixelHsl {
    h: number;
    s: number;
    l: number;
    index: number;
}

/**
 * Multi-region image processor for textures with distinct color areas.
 * Handles region detection, mask generation, and per-region HSL adjustments.
 */
export class MultiRegionImageProcessor {
    /**
     * Detects color regions in an image using k-means clustering on HSL values.
     * @param imageData Source image data
     * @param regionCount Number of regions to detect (2-4)
     * @returns Array of detected color regions
     */
    static detectColorRegions(imageData: ImageData, regionCount: number = 2): ColorRegion[] {
        const pixels = this.samplePixelsAsHsl(imageData);
        
        if (pixels.length === 0) {
            return [];
        }

        // Initialize centroids using k-means++ style selection
        const centroids = this.initializeCentroids(pixels, regionCount);
        
        // Run k-means iterations
        const maxIterations = 10;
        for (let i = 0; i < maxIterations; i++) {
            const assignments = this.assignPixelsToCentroids(pixels, centroids);
            const newCentroids = this.recalculateCentroids(pixels, assignments, regionCount);
            
            // Check for convergence
            let converged = true;
            for (let j = 0; j < regionCount; j++) {
                if (this.hslDistance(centroids[j], newCentroids[j]) > 1) {
                    converged = false;
                    break;
                }
            }
            
            // Update centroids
            for (let j = 0; j < regionCount; j++) {
                centroids[j] = newCentroids[j];
            }
            
            if (converged) break;
        }

        // Count pixels per region
        const assignments = this.assignPixelsToCentroids(pixels, centroids);
        const counts = new Array(regionCount).fill(0);
        for (const assignment of assignments) {
            counts[assignment]++;
        }

        // Create region objects with auto-generated names
        const regions: ColorRegion[] = centroids.map((centroid, index) => {
            const name = this.generateRegionName(centroid);
            return {
                id: `region-${index}`,
                name,
                centroidHsl: [centroid.h, centroid.s, centroid.l],
                targetColor: null,
                pixelCount: counts[index]
            };
        });

        // Sort by pixel count (largest region first)
        regions.sort((a, b) => b.pixelCount - a.pixelCount);

        return regions;
    }

    /**
     * Generates a mask for a specific region.
     * Returns an array of weights (0-1) for each pixel.
     * @param imageData Source image data
     * @param region The region to generate mask for
     * @param allRegions All regions (for relative weighting)
     * @param sharpness How sharp the mask edges are (0-1, default 0.8). Higher = sharper boundaries.
     * @param hardMask If true, each pixel is assigned to exactly one region (winner takes all)
     * @returns Float32Array of mask weights
     */
    static generateRegionMask(
        imageData: ImageData,
        region: ColorRegion,
        allRegions: ColorRegion[],
        sharpness: number = 0.8,
        hardMask: boolean = false
    ): Float32Array {
        const data = imageData.data;
        const pixelCount = data.length / 4;
        const mask = new Float32Array(pixelCount);
        
        const regionCentroid = {
            h: region.centroidHsl[0],
            s: region.centroidHsl[1],
            l: region.centroidHsl[2]
        };

        // Sharpness affects how quickly weights fall off
        // Lower divisor = sharper falloff
        // Range: 50 (very sharp) to 2000 (very soft)
        const falloffDivisor = 50 + (1 - sharpness) * 1950;

        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Skip transparent pixels
            if (a < 128) {
                mask[i] = 0;
                continue;
            }

            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);
            const pixelHsl = { h, s, l, index: i };

            // Find distance to each region and determine weights
            let minDist = Infinity;
            let distToThisRegion = 0;
            const distances: { regionId: string; dist: number }[] = [];

            for (const otherRegion of allRegions) {
                const otherCentroid = {
                    h: otherRegion.centroidHsl[0],
                    s: otherRegion.centroidHsl[1],
                    l: otherRegion.centroidHsl[2]
                };
                const dist = this.hslDistance(pixelHsl, otherCentroid);
                distances.push({ regionId: otherRegion.id, dist });
                
                if (dist < minDist) {
                    minDist = dist;
                }
                if (otherRegion.id === region.id) {
                    distToThisRegion = dist;
                }
            }

            // Calculate weight
            if (hardMask) {
                // Hard mask: winner takes all - pixel belongs to closest region only
                const closestRegion = distances.reduce((min, curr) => 
                    curr.dist < min.dist ? curr : min
                );
                mask[i] = closestRegion.regionId === region.id ? 1 : 0;
            } else {
                // Soft mask: use exponential falloff based on distance from minimum
                let totalWeight = 0;
                let regionWeight = 0;

                for (const { regionId, dist } of distances) {
                    const relDist = dist - minDist;
                    const weight = Math.exp(-relDist * relDist / falloffDivisor);
                    totalWeight += weight;
                    
                    if (regionId === region.id) {
                        regionWeight = weight;
                    }
                }

                // Normalize weight
                mask[i] = totalWeight > 0 ? regionWeight / totalWeight : 0;
            }
        }

        return mask;
    }

    /**
     * Applies multi-region HSL adjustment to an image.
     * Each region is shifted toward its target color independently.
     * @param imageData Source image data
     * @param regions Array of regions with target colors assigned
     * @param sharpness Mask sharpness (0-1, default 0.8)
     * @param hardMask If true, each pixel is assigned to exactly one region (no blending)
     * @returns New ImageData with adjusted colors
     */
    static applyMultiRegionAdjustment(
        imageData: ImageData,
        regions: ColorRegion[],
        sharpness: number = 0.8,
        hardMask: boolean = false
    ): ImageData {
        // Filter to only regions with target colors
        const activeRegions = regions.filter(r => r.targetColor !== null);
        
        if (activeRegions.length === 0) {
            // Return a copy of the original if no targets set
            const newImageData = new ImageData(imageData.width, imageData.height);
            newImageData.data.set(imageData.data);
            return newImageData;
        }

        // Generate masks for all active regions
        const masks = new Map<string, Float32Array>();
        for (const region of activeRegions) {
            masks.set(region.id, this.generateRegionMask(imageData, region, regions, sharpness, hardMask));
        }

        // Calculate HSL shifts for each region
        // Using the SAME algorithm as simple mode: additive hue/lightness, multiplicative saturation
        const shifts = new Map<string, { hueShift: number; satRatio: number; lightShift: number; targetS: number }>();
        for (const region of activeRegions) {
            const targetRgb = this.hexToRgb(region.targetColor!);
            const [targetH, targetS, targetL] = ImageProcessor.rgbToHsl(targetRgb[0], targetRgb[1], targetRgb[2]);
            const [centroidH, centroidS, centroidL] = region.centroidHsl;

            shifts.set(region.id, {
                hueShift: targetH - centroidH,
                satRatio: centroidS > 0 ? targetS / centroidS : 1,
                lightShift: targetL - centroidL,
                targetS: targetS // Store target saturation to control hue shift application
            });
        }

        // Create output image
        const newImageData = new ImageData(imageData.width, imageData.height);
        const data = imageData.data;
        const newData = newImageData.data;
        const pixelCount = data.length / 4;

        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Preserve alpha
            newData[idx + 3] = a;

            // Skip transparent pixels
            if (a < 128) {
                newData[idx] = r;
                newData[idx + 1] = g;
                newData[idx + 2] = b;
                continue;
            }

            // Convert to HSL
            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);

            // For each region, calculate what the adjusted color would be
            // using the same formula as simple mode, then blend by mask weight
            let finalR = 0, finalG = 0, finalB = 0;
            let totalWeight = 0;

            for (const region of activeRegions) {
                const mask = masks.get(region.id)!;
                const weight = mask[i];
                
                if (weight < 0.001) continue; // Skip negligible weights
                
                const shift = shifts.get(region.id)!;

                // Apply this region's shift using simple mode formula
                // IMPORTANT: Scale hue shift to avoid color artifacts in two cases:
                // 1. When target is gray (low saturation), hue shift should be minimal
                // 2. When original pixel is neutral (low saturation), preserve its neutrality
                const targetSatWeight = Math.min(1, shift.targetS / 30); // Based on target saturation
                const originalSatWeight = Math.min(1, s / 20); // Based on original pixel saturation
                const hueShiftWeight = targetSatWeight * originalSatWeight;
                const effectiveHueShift = shift.hueShift * hueShiftWeight;
                
                const regionH = (h + effectiveHueShift + 360) % 360;
                const regionS = Math.max(0, Math.min(100, s * shift.satRatio));
                const regionL = Math.max(0, Math.min(100, l + shift.lightShift));

                // Convert to RGB for blending (blending in RGB avoids hue interpolation issues)
                const [rr, rg, rb] = ImageProcessor.hslToRgb(regionH, regionS, regionL);
                
                finalR += rr * weight;
                finalG += rg * weight;
                finalB += rb * weight;
                totalWeight += weight;
            }

            // Finalize the blended color
            let newR = r, newG = g, newB = b;
            
            if (totalWeight > 0) {
                newR = Math.round(finalR / totalWeight);
                newG = Math.round(finalG / totalWeight);
                newB = Math.round(finalB / totalWeight);
            }

            newData[idx] = newR;
            newData[idx + 1] = newG;
            newData[idx + 2] = newB;
        }

        return newImageData;
    }

    /**
     * Creates a visualization of the region mask as an ImageData.
     * @param mask The mask weights
     * @param width Image width
     * @param height Image height
     * @param color Color to use for the mask visualization
     * @returns ImageData showing the mask
     */
    static visualizeMask(
        mask: Float32Array,
        width: number,
        height: number,
        color: [number, number, number] = [74, 144, 226]
    ): ImageData {
        const imageData = new ImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < mask.length; i++) {
            const idx = i * 4;
            const weight = mask[i];
            
            // Blend between gray background and colored mask
            const bgGray = 40;
            data[idx] = Math.round(bgGray + (color[0] - bgGray) * weight);
            data[idx + 1] = Math.round(bgGray + (color[1] - bgGray) * weight);
            data[idx + 2] = Math.round(bgGray + (color[2] - bgGray) * weight);
            data[idx + 3] = 255;
        }

        return imageData;
    }

    // --- Private helper methods ---

    /**
     * Samples pixels from image and converts to HSL
     */
    private static samplePixelsAsHsl(imageData: ImageData): PixelHsl[] {
        const data = imageData.data;
        const pixels: PixelHsl[] = [];
        
        // Sample every 4th pixel for performance
        const step = 16; // 4 channels * 4 pixel skip
        for (let i = 0; i < data.length; i += step) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent pixels
            if (a < 128) continue;

            const [h, s, l] = ImageProcessor.rgbToHsl(r, g, b);
            pixels.push({ h, s, l, index: i / 4 });
        }

        return pixels;
    }

    /**
     * Initializes k-means centroids using k-means++ style selection
     */
    private static initializeCentroids(pixels: PixelHsl[], k: number): PixelHsl[] {
        if (pixels.length === 0) return [];
        
        const centroids: PixelHsl[] = [];
        
        // First centroid: random pixel
        const firstIdx = Math.floor(Math.random() * pixels.length);
        centroids.push({ ...pixels[firstIdx] });

        // Subsequent centroids: choose pixels far from existing centroids
        for (let i = 1; i < k; i++) {
            let maxDist = -1;
            let bestPixel = pixels[0];

            for (const pixel of pixels) {
                let minDistToCentroid = Infinity;
                for (const centroid of centroids) {
                    const dist = this.hslDistance(pixel, centroid);
                    minDistToCentroid = Math.min(minDistToCentroid, dist);
                }
                
                if (minDistToCentroid > maxDist) {
                    maxDist = minDistToCentroid;
                    bestPixel = pixel;
                }
            }

            centroids.push({ ...bestPixel });
        }

        return centroids;
    }

    /**
     * Assigns each pixel to the nearest centroid
     */
    private static assignPixelsToCentroids(pixels: PixelHsl[], centroids: PixelHsl[]): number[] {
        return pixels.map(pixel => {
            let minDist = Infinity;
            let assignment = 0;

            for (let i = 0; i < centroids.length; i++) {
                const dist = this.hslDistance(pixel, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    assignment = i;
                }
            }

            return assignment;
        });
    }

    /**
     * Recalculates centroids based on assigned pixels
     */
    private static recalculateCentroids(
        pixels: PixelHsl[],
        assignments: number[],
        k: number
    ): PixelHsl[] {
        const sums: { h: number; s: number; l: number; count: number }[] = [];
        for (let i = 0; i < k; i++) {
            sums.push({ h: 0, s: 0, l: 0, count: 0 });
        }

        // Handle hue wrap-around by using sin/cos
        const hSin: number[] = new Array(k).fill(0);
        const hCos: number[] = new Array(k).fill(0);

        for (let i = 0; i < pixels.length; i++) {
            const cluster = assignments[i];
            const pixel = pixels[i];
            
            // Convert hue to radians for circular mean
            const hRad = (pixel.h * Math.PI) / 180;
            hSin[cluster] += Math.sin(hRad);
            hCos[cluster] += Math.cos(hRad);
            
            sums[cluster].s += pixel.s;
            sums[cluster].l += pixel.l;
            sums[cluster].count++;
        }

        return sums.map((sum, i) => {
            if (sum.count === 0) {
                // Return a random pixel if cluster is empty
                const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
                return { ...randomPixel };
            }

            // Calculate circular mean for hue
            const avgHRad = Math.atan2(hSin[i] / sum.count, hCos[i] / sum.count);
            let avgH = (avgHRad * 180) / Math.PI;
            if (avgH < 0) avgH += 360;

            return {
                h: avgH,
                s: sum.s / sum.count,
                l: sum.l / sum.count,
                index: 0
            };
        });
    }

    /**
     * Calculates distance between two HSL colors.
     * Handles hue wrap-around and weights saturation/lightness appropriately.
     */
    private static hslDistance(a: { h: number; s: number; l: number }, b: { h: number; s: number; l: number }): number {
        // Handle hue wrap-around (0 and 360 are the same)
        let hueDiff = Math.abs(a.h - b.h);
        if (hueDiff > 180) hueDiff = 360 - hueDiff;

        // Weight hue less if saturation is low (gray colors have meaningless hue)
        const avgSat = (a.s + b.s) / 2;
        const hueWeight = avgSat / 100;

        const satDiff = Math.abs(a.s - b.s);
        const lightDiff = Math.abs(a.l - b.l);

        // Weighted Euclidean distance
        return Math.sqrt(
            (hueDiff * hueWeight) ** 2 +
            satDiff ** 2 +
            lightDiff ** 2
        );
    }

    /**
     * Generates a human-readable name for a region based on its HSL centroid
     */
    private static generateRegionName(centroid: { h: number; s: number; l: number }): string {
        const { h, s, l } = centroid;

        // Low saturation = neutral/gray
        if (s < 15) {
            if (l < 30) return 'Dark Gray';
            if (l > 70) return 'Light Gray';
            return 'Gray';
        }

        // Determine base color name from hue
        let colorName: string;
        if (h < 15 || h >= 345) colorName = 'Red';
        else if (h < 45) colorName = 'Orange';
        else if (h < 75) colorName = 'Yellow';
        else if (h < 150) colorName = 'Green';
        else if (h < 195) colorName = 'Cyan';
        else if (h < 255) colorName = 'Blue';
        else if (h < 285) colorName = 'Purple';
        else colorName = 'Magenta';

        // Add lightness modifier
        if (l < 30) return `Dark ${colorName}`;
        if (l > 70) return `Light ${colorName}`;
        return colorName;
    }

    /**
     * Converts hex color to RGB tuple
     */
    private static hexToRgb(hex: string): [number, number, number] {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            return [128, 128, 128];
        }
        return [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ];
    }

    /**
     * Converts RGB to hex string
     */
    static rgbToHex(r: number, g: number, b: number): string {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Converts HSL centroid to hex color for display
     */
    static centroidToHex(centroid: [number, number, number]): string {
        const [r, g, b] = ImageProcessor.hslToRgb(centroid[0], centroid[1], centroid[2]);
        return this.rgbToHex(r, g, b);
    }
}
