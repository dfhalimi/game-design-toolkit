import { ColorReplacementProcessor, ColorReplacement } from '../Domain/ColorReplacementProcessor.js';
import { ImageProcessor } from '../Domain/ImageProcessor.js';

/**
 * Color Replacement Adjuster - A simpler approach to multi-color texture adjustment.
 * 
 * Workflow:
 * 1. Upload image
 * 2. Click on image to sample a color you want to adjust
 * 3. Adjust tolerance to select similar pixels
 * 4. Pick target color from your palette
 * 5. Repeat for other colors
 */
export class ColorReplacementAdjuster {
    private container: HTMLElement;
    private originalImage: HTMLImageElement | null = null;
    private originalCanvas: HTMLCanvasElement;
    private previewCanvas: HTMLCanvasElement;
    private resultCanvas: HTMLCanvasElement;
    private originalCtx: CanvasRenderingContext2D;
    private previewCtx: CanvasRenderingContext2D;
    private resultCtx: CanvasRenderingContext2D;
    
    private replacements: ColorReplacement[] = [];
    private activeReplacementId: string | null = null;
    private nextId: number = 1;
    
    private onTextureUpdated: ((canvas: HTMLCanvasElement) => void) | null = null;
    private debounceTimer: number | null = null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container '${containerId}' not found`);
        }
        this.container = container;
        this.createUI();
        
        this.originalCanvas = document.getElementById('crOriginalCanvas') as HTMLCanvasElement;
        this.previewCanvas = document.getElementById('crPreviewCanvas') as HTMLCanvasElement;
        this.resultCanvas = document.getElementById('crResultCanvas') as HTMLCanvasElement;
        
        this.originalCtx = this.originalCanvas.getContext('2d')!;
        this.previewCtx = this.previewCanvas.getContext('2d')!;
        this.resultCtx = this.resultCanvas.getContext('2d')!;
        
        this.setupEventListeners();
    }

    private createUI(): void {
        this.container.innerHTML = `
            <div class="cr-upload-section">
                <label for="crFileInput">Upload Texture</label>
                <input type="file" id="crFileInput" class="cr-file-input" accept="image/*">
            </div>
            
            <div class="cr-main-content">
                <div class="cr-image-section">
                    <div class="cr-canvas-container">
                        <label>Original (click to sample color)</label>
                        <canvas id="crOriginalCanvas" class="cr-canvas"></canvas>
                    </div>
                    <div class="cr-canvas-container">
                        <label>Selection Preview</label>
                        <canvas id="crPreviewCanvas" class="cr-canvas"></canvas>
                    </div>
                </div>
                
                <div class="cr-replacements-section">
                    <div class="cr-replacements-header">
                        <h3>Color Replacements</h3>
                        <button id="crAddBtn" class="cr-btn cr-btn-primary" disabled>
                            + Add Color
                        </button>
                    </div>
                    <p class="cr-help-text">
                        Click "Add Color", then click on the image to sample a color you want to adjust.
                    </p>
                    <div id="crReplacementsList" class="cr-replacements-list"></div>
                </div>
                
                <div class="cr-result-section">
                    <label>Result</label>
                    <canvas id="crResultCanvas" class="cr-canvas cr-canvas-large"></canvas>
                    <div class="cr-actions">
                        <button id="crDownloadBtn" class="cr-btn cr-btn-primary" disabled>
                            Download Result
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    private setupEventListeners(): void {
        // File input
        const fileInput = document.getElementById('crFileInput') as HTMLInputElement;
        fileInput?.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) this.loadImage(file);
        });
        
        // Add button
        const addBtn = document.getElementById('crAddBtn');
        addBtn?.addEventListener('click', () => this.addReplacement());
        
        // Canvas click for color sampling
        this.originalCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // Download button
        const downloadBtn = document.getElementById('crDownloadBtn');
        downloadBtn?.addEventListener('click', () => this.downloadResult());
    }

    private loadImage(file: File): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.setupCanvases();
                this.drawOriginal();
                this.clearPreview();
                this.clearResult();
                this.replacements = [];
                this.renderReplacementsList();
                this.updateButtonStates();
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    private setupCanvases(): void {
        if (!this.originalImage) return;
        const w = this.originalImage.width;
        const h = this.originalImage.height;
        
        this.originalCanvas.width = w;
        this.originalCanvas.height = h;
        this.previewCanvas.width = w;
        this.previewCanvas.height = h;
        this.resultCanvas.width = w;
        this.resultCanvas.height = h;
    }

    private drawOriginal(): void {
        if (!this.originalImage) return;
        this.originalCtx.drawImage(this.originalImage, 0, 0);
    }

    private clearPreview(): void {
        this.previewCtx.fillStyle = '#1e1e1e';
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    private clearResult(): void {
        this.resultCtx.fillStyle = '#1e1e1e';
        this.resultCtx.fillRect(0, 0, this.resultCanvas.width, this.resultCanvas.height);
    }

    private addReplacement(): void {
        const replacement: ColorReplacement = {
            id: `replacement-${this.nextId++}`,
            sourceColor: '#808080',
            targetColor: '#808080',
            tolerance: 30,
            enabled: true
        };
        this.replacements.push(replacement);
        this.activeReplacementId = replacement.id;
        this.renderReplacementsList();
        this.updateButtonStates();
        
        // Set cursor to indicate sampling mode
        this.originalCanvas.style.cursor = 'crosshair';
    }

    private handleCanvasClick(e: MouseEvent): void {
        if (!this.originalImage || !this.activeReplacementId) return;
        
        const rect = this.originalCanvas.getBoundingClientRect();
        const scaleX = this.originalCanvas.width / rect.width;
        const scaleY = this.originalCanvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Sample the color
        const pixel = this.originalCtx.getImageData(x, y, 1, 1).data;
        const hex = this.rgbToHex(pixel[0], pixel[1], pixel[2]);
        
        // Update the active replacement
        const replacement = this.replacements.find(r => r.id === this.activeReplacementId);
        if (replacement) {
            replacement.sourceColor = hex;
            replacement.targetColor = hex; // Start with same color
            this.renderReplacementsList();
            this.updatePreview();
            this.scheduleApply();
        }
        
        // Reset cursor
        this.originalCanvas.style.cursor = 'default';
    }

    private renderReplacementsList(): void {
        const list = document.getElementById('crReplacementsList');
        if (!list) return;
        
        if (this.replacements.length === 0) {
            list.innerHTML = '<div class="cr-empty">No color replacements yet</div>';
            return;
        }
        
        list.innerHTML = this.replacements.map((r, index) => `
            <div class="cr-replacement-item ${r.id === this.activeReplacementId ? 'cr-active' : ''}" 
                 data-id="${r.id}">
                <div class="cr-replacement-header">
                    <span class="cr-replacement-title">Color ${index + 1}</span>
                    <button class="cr-remove-btn" data-id="${r.id}">×</button>
                </div>
                
                <div class="cr-replacement-row">
                    <div class="cr-color-group">
                        <label>Source</label>
                        <div class="cr-color-display">
                            <div class="cr-swatch" style="background: ${r.sourceColor}"></div>
                            <span class="cr-hex">${r.sourceColor}</span>
                        </div>
                        <button class="cr-resample-btn" data-id="${r.id}">Re-sample</button>
                    </div>
                    
                    <div class="cr-arrow">→</div>
                    
                    <div class="cr-color-group">
                        <label>Target</label>
                        <div class="cr-target-inputs">
                            <input type="color" class="cr-target-color" data-id="${r.id}" value="${r.targetColor}">
                            <input type="text" class="cr-target-hex" data-id="${r.id}" value="${r.targetColor}" maxlength="7">
                        </div>
                    </div>
                </div>
                
                <div class="cr-tolerance-row">
                    <label>Tolerance: <span class="cr-tolerance-value">${r.tolerance}%</span></label>
                    <input type="range" class="cr-tolerance-slider" data-id="${r.id}" 
                           min="5" max="100" value="${r.tolerance}">
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        this.attachReplacementListeners();
    }

    private attachReplacementListeners(): void {
        // Remove buttons
        document.querySelectorAll('.cr-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.id;
                if (id) this.removeReplacement(id);
            });
        });
        
        // Re-sample buttons
        document.querySelectorAll('.cr-resample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.id;
                if (id) {
                    this.activeReplacementId = id;
                    this.originalCanvas.style.cursor = 'crosshair';
                    this.renderReplacementsList();
                }
            });
        });
        
        // Target color pickers
        document.querySelectorAll('.cr-target-color').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = (input as HTMLElement).dataset.id;
                const value = (e.target as HTMLInputElement).value;
                if (id) this.updateTargetColor(id, value);
            });
        });
        
        // Target hex inputs
        document.querySelectorAll('.cr-target-hex').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = (input as HTMLElement).dataset.id;
                let value = (e.target as HTMLInputElement).value.trim();
                if (!value.startsWith('#')) value = '#' + value;
                if (id && /^#[0-9A-Fa-f]{6}$/.test(value)) {
                    this.updateTargetColor(id, value);
                }
            });
        });
        
        // Tolerance sliders
        document.querySelectorAll('.cr-tolerance-slider').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = (input as HTMLElement).dataset.id;
                const value = parseInt((e.target as HTMLInputElement).value);
                if (id) this.updateTolerance(id, value);
            });
        });
        
        // Click on item to select
        document.querySelectorAll('.cr-replacement-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = (item as HTMLElement).dataset.id;
                if (id && id !== this.activeReplacementId) {
                    this.activeReplacementId = id;
                    this.renderReplacementsList();
                    this.updatePreview();
                }
            });
        });
    }

    private removeReplacement(id: string): void {
        this.replacements = this.replacements.filter(r => r.id !== id);
        if (this.activeReplacementId === id) {
            this.activeReplacementId = this.replacements[0]?.id || null;
        }
        this.renderReplacementsList();
        this.updatePreview();
        this.scheduleApply();
        this.updateButtonStates();
    }

    private updateTargetColor(id: string, color: string): void {
        const replacement = this.replacements.find(r => r.id === id);
        if (replacement) {
            replacement.targetColor = color;
            this.renderReplacementsList();
            this.scheduleApply();
        }
    }

    private updateTolerance(id: string, tolerance: number): void {
        const replacement = this.replacements.find(r => r.id === id);
        if (replacement) {
            replacement.tolerance = tolerance;
            // Update display
            const item = document.querySelector(`.cr-replacement-item[data-id="${id}"]`);
            const valueSpan = item?.querySelector('.cr-tolerance-value');
            if (valueSpan) valueSpan.textContent = `${tolerance}%`;
            
            this.updatePreview();
            this.scheduleApply();
        }
    }

    private updatePreview(): void {
        if (!this.originalImage || !this.activeReplacementId) {
            this.clearPreview();
            return;
        }
        
        const replacement = this.replacements.find(r => r.id === this.activeReplacementId);
        if (!replacement) {
            this.clearPreview();
            return;
        }
        
        const imageData = this.originalCtx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const mask = ColorReplacementProcessor.generateSelectionMask(
            imageData,
            replacement.sourceColor,
            replacement.tolerance
        );
        
        // Parse source color for overlay
        const rgb = this.hexToRgb(replacement.sourceColor);
        const overlayColor: [number, number, number] = [
            Math.min(255, rgb[0] + 100),
            Math.min(255, rgb[1] + 100),
            Math.min(255, rgb[2] + 100)
        ];
        
        const previewData = ColorReplacementProcessor.visualizeMask(
            mask,
            this.originalCanvas.width,
            this.originalCanvas.height,
            overlayColor
        );
        
        this.previewCtx.putImageData(previewData, 0, 0);
    }

    private scheduleApply(): void {
        if (this.debounceTimer !== null) {
            window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            this.applyReplacements();
        }, 200);
    }

    private applyReplacements(): void {
        if (!this.originalImage || this.replacements.length === 0) {
            this.clearResult();
            return;
        }
        
        const imageData = this.originalCtx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const resultData = ColorReplacementProcessor.applyReplacements(imageData, this.replacements);
        
        this.resultCtx.putImageData(resultData, 0, 0);
        
        const downloadBtn = document.getElementById('crDownloadBtn') as HTMLButtonElement;
        if (downloadBtn) downloadBtn.disabled = false;
        
        if (this.onTextureUpdated) {
            this.onTextureUpdated(this.resultCanvas);
        }
    }

    private downloadResult(): void {
        this.resultCanvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'adjusted-texture.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    private updateButtonStates(): void {
        const addBtn = document.getElementById('crAddBtn') as HTMLButtonElement;
        if (addBtn) {
            addBtn.disabled = !this.originalImage;
        }
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    private hexToRgb(hex: string): [number, number, number] {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return [128, 128, 128];
        return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    }

    setOnTextureUpdated(callback: (canvas: HTMLCanvasElement) => void): void {
        this.onTextureUpdated = callback;
    }

    getResultCanvas(): HTMLCanvasElement {
        return this.resultCanvas;
    }
    
    /**
     * Sets target color for the active replacement (for palette integration)
     */
    setTargetColorForActive(hexColor: string): void {
        if (this.activeReplacementId) {
            this.updateTargetColor(this.activeReplacementId, hexColor);
        }
    }
}
