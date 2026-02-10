import { MultiRegionImageProcessor, ColorRegion } from '../Domain/MultiRegionImageProcessor.js';

/**
 * Multi-region texture adjuster component.
 * Allows adjusting different color regions of a texture independently.
 */
export class MultiRegionTextureAdjuster {
    private container: HTMLElement;
    private originalImage: HTMLImageElement | null = null;
    private originalCanvas: HTMLCanvasElement;
    private maskCanvas: HTMLCanvasElement;
    private adjustedCanvas: HTMLCanvasElement;
    private originalCtx: CanvasRenderingContext2D;
    private maskCtx: CanvasRenderingContext2D;
    private adjustedCtx: CanvasRenderingContext2D;
    private regions: ColorRegion[] = [];
    private selectedRegionId: string | null = null;
    private regionCount: number = 2;
    private onTextureUpdated: ((canvas: HTMLCanvasElement) => void) | null = null;
    private pickingSourceForRegion: string | null = null; // Track which region we're picking source color for
    private maskSharpness: number = 0.85; // How sharp the region boundaries are (0-1)
    private useHardMasks: boolean = false; // If true, each pixel belongs to exactly one region (no blending)
    private adjustmentDebounceTimer: number | null = null; // Debounce timer for adjustments
    private readonly DEBOUNCE_DELAY = 300; // ms to wait before applying adjustment

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element '${containerId}' not found`);
        }
        this.container = container;

        // Create the UI
        this.createUI();

        // Get canvas references
        this.originalCanvas = document.getElementById('mrOriginalCanvas') as HTMLCanvasElement;
        this.maskCanvas = document.getElementById('mrMaskCanvas') as HTMLCanvasElement;
        this.adjustedCanvas = document.getElementById('mrAdjustedCanvas') as HTMLCanvasElement;

        const originalCtx = this.originalCanvas.getContext('2d');
        const maskCtx = this.maskCanvas.getContext('2d');
        const adjustedCtx = this.adjustedCanvas.getContext('2d');

        if (!originalCtx || !maskCtx || !adjustedCtx) {
            throw new Error('Could not get canvas contexts');
        }

        this.originalCtx = originalCtx;
        this.maskCtx = maskCtx;
        this.adjustedCtx = adjustedCtx;

        this.setupEventListeners();
    }

    /**
     * Creates the HTML UI for the multi-region adjuster
     */
    private createUI(): void {
        this.container.innerHTML = `
            <div class="mr-controls">
                <div class="mr-control-group">
                    <label for="mrFileInput">Upload Texture</label>
                    <input type="file" id="mrFileInput" class="mr-file-input" accept="image/*">
                </div>
                
                <div class="mr-control-group">
                    <label for="mrRegionCount">Number of Regions</label>
                    <select id="mrRegionCount" class="mr-select">
                        <option value="2" selected>2 Regions</option>
                        <option value="3">3 Regions</option>
                        <option value="4">4 Regions</option>
                    </select>
                </div>

                <div class="mr-control-group">
                    <label for="mrSharpness">Mask Sharpness: <span id="mrSharpnessValue">85%</span></label>
                    <input type="range" id="mrSharpness" class="mr-slider" min="0" max="100" value="85">
                    <label class="mr-checkbox-label">
                        <input type="checkbox" id="mrHardMasks" class="mr-checkbox">
                        <span>Hard masks (no blending - fixes color artifacts)</span>
                    </label>
                </div>
                
                <button id="mrDetectBtn" class="mr-btn mr-btn-secondary" disabled>
                    Auto-Detect Regions
                </button>
            </div>

            <div class="mr-regions-section">
                <h3 class="mr-section-title">Detected Regions</h3>
                <p class="mr-section-desc">
                    Click a region to view its mask. Use "Pick Source" to sample the source color from the image, then set a target color.
                </p>
                <div id="mrRegionsList" class="mr-regions-list">
                    <div class="mr-regions-empty">Upload a texture and click "Auto-Detect" to find color regions</div>
                </div>
            </div>

            <div class="mr-preview-section">
                <div class="mr-preview-grid">
                    <div class="mr-preview-item">
                        <label>Original</label>
                        <canvas id="mrOriginalCanvas" class="mr-canvas"></canvas>
                    </div>
                    <div class="mr-preview-item">
                        <label>Region Mask</label>
                        <canvas id="mrMaskCanvas" class="mr-canvas"></canvas>
                    </div>
                    <div class="mr-preview-item mr-preview-wide">
                        <label>Adjusted Result</label>
                        <canvas id="mrAdjustedCanvas" class="mr-canvas"></canvas>
                    </div>
                </div>
            </div>

            <div class="mr-actions">
                <button id="mrApplyBtn" class="mr-btn mr-btn-primary" disabled>
                    Apply Adjustments
                </button>
                <button id="mrDownloadBtn" class="mr-btn mr-btn-secondary" disabled>
                    Download Adjusted Texture
                </button>
            </div>
        `;
    }

    /**
     * Sets up event listeners for the UI
     */
    private setupEventListeners(): void {
        // File input
        const fileInput = document.getElementById('mrFileInput') as HTMLInputElement;
        fileInput?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.loadImage(file);
            }
        });

        // Region count selector
        const regionCountSelect = document.getElementById('mrRegionCount') as HTMLSelectElement;
        regionCountSelect?.addEventListener('change', (e) => {
            this.regionCount = parseInt((e.target as HTMLSelectElement).value);
        });

        // Sharpness slider
        const sharpnessSlider = document.getElementById('mrSharpness') as HTMLInputElement;
        const sharpnessValue = document.getElementById('mrSharpnessValue');
        sharpnessSlider?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            this.maskSharpness = value / 100;
            if (sharpnessValue) {
                sharpnessValue.textContent = `${value}%`;
            }
            // Update mask preview and re-apply if regions exist (debounced)
            if (this.selectedRegionId && this.regions.length > 0) {
                const region = this.regions.find(r => r.id === this.selectedRegionId);
                if (region) {
                    this.showRegionMask(region);
                }
            }
            if (this.regions.some(r => r.targetColor !== null)) {
                this.scheduleAdjustment();
            }
        });

        // Hard masks checkbox
        const hardMasksCheckbox = document.getElementById('mrHardMasks') as HTMLInputElement;
        hardMasksCheckbox?.addEventListener('change', (e) => {
            this.useHardMasks = (e.target as HTMLInputElement).checked;
            // Update mask preview and re-apply if regions exist (debounced)
            if (this.selectedRegionId && this.regions.length > 0) {
                const region = this.regions.find(r => r.id === this.selectedRegionId);
                if (region) {
                    this.showRegionMask(region);
                }
            }
            if (this.regions.some(r => r.targetColor !== null)) {
                this.scheduleAdjustment();
            }
        });

        // Detect button
        const detectBtn = document.getElementById('mrDetectBtn');
        detectBtn?.addEventListener('click', () => {
            this.detectRegions();
        });

        // Apply button
        const applyBtn = document.getElementById('mrApplyBtn');
        applyBtn?.addEventListener('click', () => {
            this.applyAdjustments();
        });

        // Download button
        const downloadBtn = document.getElementById('mrDownloadBtn');
        downloadBtn?.addEventListener('click', () => {
            this.downloadAdjustedTexture();
        });

        // Canvas click for color picking
        this.originalCanvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
    }

    /**
     * Loads an image file
     */
    private loadImage(file: File): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.drawOriginalImage();
                this.updateButtonStates();
                
                // Clear previous regions
                this.regions = [];
                this.selectedRegionId = null;
                this.renderRegionsList();
                this.clearMaskCanvas();
                this.clearAdjustedCanvas();
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Draws the original image to canvas
     */
    private drawOriginalImage(): void {
        if (!this.originalImage) return;

        const width = this.originalImage.width;
        const height = this.originalImage.height;

        // Set canvas sizes
        this.originalCanvas.width = width;
        this.originalCanvas.height = height;
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.adjustedCanvas.width = width;
        this.adjustedCanvas.height = height;

        this.originalCtx.drawImage(this.originalImage, 0, 0, width, height);
    }

    /**
     * Detects color regions in the image
     */
    private detectRegions(): void {
        if (!this.originalImage) return;

        const imageData = this.originalCtx.getImageData(
            0, 0,
            this.originalCanvas.width,
            this.originalCanvas.height
        );

        this.regions = MultiRegionImageProcessor.detectColorRegions(imageData, this.regionCount);
        
        // Select first region by default
        if (this.regions.length > 0) {
            this.selectedRegionId = this.regions[0].id;
            this.showRegionMask(this.regions[0]);
        }

        this.renderRegionsList();
        this.updateButtonStates();
    }

    /**
     * Renders the regions list UI
     */
    private renderRegionsList(): void {
        const listContainer = document.getElementById('mrRegionsList');
        if (!listContainer) return;

        if (this.regions.length === 0) {
            listContainer.innerHTML = `
                <div class="mr-regions-empty">
                    Upload a texture and click "Auto-Detect" to find color regions
                </div>
            `;
            return;
        }

        // Calculate total sampled pixels for percentage
        const totalSampledPixels = this.regions.reduce((sum, r) => sum + r.pixelCount, 0);

        listContainer.innerHTML = this.regions.map(region => {
            const centroidHex = MultiRegionImageProcessor.centroidToHex(region.centroidHsl);
            const isSelected = region.id === this.selectedRegionId;
            const percentage = totalSampledPixels > 0
                ? Math.round((region.pixelCount / totalSampledPixels) * 100)
                : 0;
            const targetHex = region.targetColor || centroidHex;

            return `
                <div class="mr-region-item ${isSelected ? 'mr-region-selected' : ''}" 
                     data-region-id="${region.id}">
                    <div class="mr-region-info">
                        <div class="mr-region-swatch" style="background-color: ${centroidHex}" title="Source color (click 'Pick' to change)"></div>
                        <div class="mr-region-details">
                            <span class="mr-region-name">${region.name}</span>
                            <span class="mr-region-percent">${percentage}% of image</span>
                            <button class="mr-region-pick-btn" 
                                    data-region-id="${region.id}"
                                    title="Click to pick source color from image">
                                Pick Source
                            </button>
                        </div>
                    </div>
                    <div class="mr-region-target">
                        <label>Target:</label>
                        <input type="color" 
                               class="mr-region-color-input" 
                               data-region-id="${region.id}"
                               value="${targetHex}">
                        <input type="text" 
                               class="mr-region-hex-input" 
                               data-region-id="${region.id}"
                               value="${targetHex}"
                               maxlength="7"
                               placeholder="#000000">
                        <button class="mr-region-clear-btn" 
                                data-region-id="${region.id}"
                                ${!region.targetColor ? 'disabled' : ''}>
                            Clear
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to region items
        const regionItems = listContainer.querySelectorAll('.mr-region-item');
        regionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Don't trigger selection when clicking inputs/buttons
                if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
                
                const regionId = item.getAttribute('data-region-id');
                if (regionId) {
                    this.selectRegion(regionId);
                }
            });
        });

        // Add event listeners to color inputs
        const colorInputs = listContainer.querySelectorAll('.mr-region-color-input');
        colorInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const regionId = (e.target as HTMLElement).getAttribute('data-region-id');
                const color = (e.target as HTMLInputElement).value;
                if (regionId) {
                    // Sync hex input
                    const hexInput = listContainer.querySelector(`.mr-region-hex-input[data-region-id="${regionId}"]`) as HTMLInputElement;
                    if (hexInput) {
                        hexInput.value = color;
                    }
                    this.setRegionTargetColor(regionId, color);
                }
            });
        });

        // Add event listeners to hex inputs
        const hexInputs = listContainer.querySelectorAll('.mr-region-hex-input');
        hexInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const regionId = (e.target as HTMLElement).getAttribute('data-region-id');
                let color = (e.target as HTMLInputElement).value.trim();
                
                // Add # if missing
                if (color && !color.startsWith('#')) {
                    color = '#' + color;
                }
                
                // Validate hex format
                if (regionId && /^#[0-9A-Fa-f]{6}$/.test(color)) {
                    // Sync color picker
                    const colorInput = listContainer.querySelector(`.mr-region-color-input[data-region-id="${regionId}"]`) as HTMLInputElement;
                    if (colorInput) {
                        colorInput.value = color;
                    }
                    this.setRegionTargetColor(regionId, color);
                }
            });
        });

        // Add event listeners to clear buttons
        const clearBtns = listContainer.querySelectorAll('.mr-region-clear-btn');
        clearBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const regionId = (e.target as HTMLElement).getAttribute('data-region-id');
                if (regionId) {
                    this.clearRegionTargetColor(regionId);
                }
            });
        });

        // Add event listeners to "Pick Source" buttons
        const pickBtns = listContainer.querySelectorAll('.mr-region-pick-btn');
        pickBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const regionId = (e.target as HTMLElement).getAttribute('data-region-id');
                if (regionId) {
                    this.startPickingSourceColor(regionId);
                }
            });
        });
    }

    /**
     * Starts the source color picking mode for a region
     */
    private startPickingSourceColor(regionId: string): void {
        this.pickingSourceForRegion = regionId;
        this.originalCanvas.style.cursor = 'crosshair';
        
        // Add visual feedback
        const pickBtns = document.querySelectorAll('.mr-region-pick-btn');
        pickBtns.forEach(btn => {
            if (btn.getAttribute('data-region-id') === regionId) {
                btn.classList.add('mr-picking-active');
                btn.textContent = 'Click image...';
            }
        });
    }

    /**
     * Handles click on the original canvas for color picking
     */
    private handleCanvasClick(e: MouseEvent): void {
        if (!this.pickingSourceForRegion || !this.originalImage) return;

        const rect = this.originalCanvas.getBoundingClientRect();
        const scaleX = this.originalCanvas.width / rect.width;
        const scaleY = this.originalCanvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        // Get the pixel color
        const imageData = this.originalCtx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;
        
        // Convert to HSL for the centroid
        const hsl = this.rgbToHsl(r, g, b);
        
        // Update the region's centroid
        const region = this.regions.find(r => r.id === this.pickingSourceForRegion);
        if (region) {
            region.centroidHsl = hsl;
            // Update the name based on new color
            region.name = this.generateRegionName(hsl);
        }

        // Reset picking state
        this.originalCanvas.style.cursor = 'default';
        this.pickingSourceForRegion = null;

        // Re-render and update
        this.renderRegionsList();
        if (region) {
            this.showRegionMask(region);
        }
        
        // Re-apply adjustments if targets are set (debounced)
        if (this.regions.some(r => r.targetColor !== null)) {
            this.scheduleAdjustment();
        }
    }

    /**
     * RGB to HSL conversion
     */
    private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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
     * Generates a region name based on HSL values
     */
    private generateRegionName(hsl: [number, number, number]): string {
        const [h, s, l] = hsl;

        if (s < 15) {
            if (l < 30) return 'Dark Gray';
            if (l > 70) return 'Light Gray';
            return 'Gray';
        }

        let colorName: string;
        if (h < 15 || h >= 345) colorName = 'Red';
        else if (h < 45) colorName = 'Orange';
        else if (h < 75) colorName = 'Yellow';
        else if (h < 150) colorName = 'Green';
        else if (h < 195) colorName = 'Cyan';
        else if (h < 255) colorName = 'Blue';
        else if (h < 285) colorName = 'Purple';
        else colorName = 'Magenta';

        if (l < 30) return `Dark ${colorName}`;
        if (l > 70) return `Light ${colorName}`;
        return colorName;
    }

    /**
     * Selects a region and shows its mask
     */
    private selectRegion(regionId: string): void {
        this.selectedRegionId = regionId;
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            this.showRegionMask(region);
        }
        this.renderRegionsList();
    }

    /**
     * Shows the mask for a specific region
     */
    private showRegionMask(region: ColorRegion): void {
        if (!this.originalImage) return;

        const imageData = this.originalCtx.getImageData(
            0, 0,
            this.originalCanvas.width,
            this.originalCanvas.height
        );

        const mask = MultiRegionImageProcessor.generateRegionMask(imageData, region, this.regions, this.maskSharpness, this.useHardMasks);
        
        // Convert centroid to RGB for mask color
        const centroidHex = MultiRegionImageProcessor.centroidToHex(region.centroidHsl);
        const r = parseInt(centroidHex.slice(1, 3), 16);
        const g = parseInt(centroidHex.slice(3, 5), 16);
        const b = parseInt(centroidHex.slice(5, 7), 16);

        const maskImageData = MultiRegionImageProcessor.visualizeMask(
            mask,
            this.originalCanvas.width,
            this.originalCanvas.height,
            [r, g, b]
        );

        this.maskCtx.putImageData(maskImageData, 0, 0);
    }

    /**
     * Sets a target color for a region
     */
    private setRegionTargetColor(regionId: string, color: string): void {
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            region.targetColor = color;
            this.renderRegionsList();
            this.updateButtonStates();
            
            // Auto-apply preview (debounced)
            this.scheduleAdjustment();
        }
    }

    /**
     * Clears the target color for a region
     */
    private clearRegionTargetColor(regionId: string): void {
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            region.targetColor = null;
            this.renderRegionsList();
            this.updateButtonStates();
            
            // Re-apply with cleared color (debounced)
            this.scheduleAdjustment();
        }
    }

    /**
     * Schedules adjustment with debouncing to improve performance
     */
    private scheduleAdjustment(): void {
        // Clear any pending adjustment
        if (this.adjustmentDebounceTimer !== null) {
            window.clearTimeout(this.adjustmentDebounceTimer);
        }
        
        // Show processing indicator
        const applyBtn = document.getElementById('mrApplyBtn') as HTMLButtonElement;
        if (applyBtn) {
            applyBtn.textContent = 'Processing...';
        }
        
        // Schedule new adjustment
        this.adjustmentDebounceTimer = window.setTimeout(() => {
            this.applyAdjustments();
            if (applyBtn) {
                applyBtn.textContent = 'Apply Adjustments';
            }
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * Applies multi-region adjustments
     */
    private applyAdjustments(): void {
        if (!this.originalImage || this.regions.length === 0) return;

        const imageData = this.originalCtx.getImageData(
            0, 0,
            this.originalCanvas.width,
            this.originalCanvas.height
        );

        const adjustedImageData = MultiRegionImageProcessor.applyMultiRegionAdjustment(
            imageData,
            this.regions,
            this.maskSharpness,
            this.useHardMasks
        );

        this.adjustedCtx.putImageData(adjustedImageData, 0, 0);

        // Enable download button
        const downloadBtn = document.getElementById('mrDownloadBtn') as HTMLButtonElement;
        if (downloadBtn) {
            downloadBtn.disabled = false;
        }

        // Notify listeners
        if (this.onTextureUpdated) {
            this.onTextureUpdated(this.adjustedCanvas);
        }
    }

    /**
     * Downloads the adjusted texture
     */
    private downloadAdjustedTexture(): void {
        this.adjustedCanvas.toBlob((blob) => {
            if (!blob) return;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'multi-region-adjusted-texture.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    /**
     * Updates button enabled/disabled states
     */
    private updateButtonStates(): void {
        const detectBtn = document.getElementById('mrDetectBtn') as HTMLButtonElement;
        const applyBtn = document.getElementById('mrApplyBtn') as HTMLButtonElement;

        const hasImage = this.originalImage !== null;
        const hasRegions = this.regions.length > 0;
        const hasTargets = this.regions.some(r => r.targetColor !== null);

        if (detectBtn) {
            detectBtn.disabled = !hasImage;
        }

        if (applyBtn) {
            applyBtn.disabled = !(hasRegions && hasTargets);
        }
    }

    /**
     * Clears the mask canvas
     */
    private clearMaskCanvas(): void {
        this.maskCtx.fillStyle = '#282828';
        this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    }

    /**
     * Clears the adjusted canvas
     */
    private clearAdjustedCanvas(): void {
        this.adjustedCtx.fillStyle = '#282828';
        this.adjustedCtx.fillRect(0, 0, this.adjustedCanvas.width, this.adjustedCanvas.height);
    }

    /**
     * Sets callback for when texture is updated
     */
    setOnTextureUpdated(callback: (canvas: HTMLCanvasElement) => void): void {
        this.onTextureUpdated = callback;
    }

    /**
     * Gets the adjusted canvas
     */
    getAdjustedCanvas(): HTMLCanvasElement {
        return this.adjustedCanvas;
    }

    /**
     * Sets a target color for a specific region by index (for palette integration)
     */
    setTargetColorForRegion(regionIndex: number, hexColor: string): void {
        if (regionIndex < 0 || regionIndex >= this.regions.length) return;
        
        this.regions[regionIndex].targetColor = hexColor;
        this.renderRegionsList();
        this.updateButtonStates();
        
        // Auto-apply if we have an image
        if (this.originalImage) {
            this.applyAdjustments();
        }
    }

    /**
     * Gets the current regions
     */
    getRegions(): ColorRegion[] {
        return [...this.regions];
    }
}
