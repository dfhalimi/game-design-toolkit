import { ImageProcessor } from '../Domain/ImageProcessor.js';
import { ColorConverter } from '../Domain/ColorConverter.js';

/**
 * Texture adjustment component
 * Handles image upload, HSL adjustment, and preview
 */
export class TextureAdjuster {
    private originalImage: HTMLImageElement | null = null;
    private originalCanvas: HTMLCanvasElement;
    private adjustedCanvas: HTMLCanvasElement;
    private originalCtx: CanvasRenderingContext2D;
    private adjustedCtx: CanvasRenderingContext2D;
    private currentTargetColor: string | null = null;
    private onTextureUpdated: ((canvas: HTMLCanvasElement) => void) | null = null;

    constructor(
        originalCanvasId: string,
        adjustedCanvasId: string,
        fileInputId: string,
        targetColorInputId: string,
        applyButtonId: string,
        downloadButtonId: string
    ) {
        // Get canvas elements
        const originalCanvas = document.getElementById(originalCanvasId) as HTMLCanvasElement;
        const adjustedCanvas = document.getElementById(adjustedCanvasId) as HTMLCanvasElement;

        if (!originalCanvas || !adjustedCanvas) {
            throw new Error('Canvas elements not found');
        }

        const originalCtx = originalCanvas.getContext('2d');
        const adjustedCtx = adjustedCanvas.getContext('2d');

        if (!originalCtx || !adjustedCtx) {
            throw new Error('Could not get canvas context');
        }

        this.originalCanvas = originalCanvas;
        this.adjustedCanvas = adjustedCanvas;
        this.originalCtx = originalCtx;
        this.adjustedCtx = adjustedCtx;

        this.setupEventListeners(fileInputId, targetColorInputId, applyButtonId, downloadButtonId);
    }

    /**
     * Sets up event listeners for file input and buttons
     */
    private setupEventListeners(
        fileInputId: string,
        targetColorInputId: string,
        applyButtonId: string,
        downloadButtonId: string
    ): void {
        const fileInput = document.getElementById(fileInputId) as HTMLInputElement;
        const targetColorInput = document.getElementById(targetColorInputId) as HTMLInputElement;
        const applyButton = document.getElementById(applyButtonId);
        const downloadButton = document.getElementById(downloadButtonId);

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    this.loadImage(file);
                }
            });
        }

        if (targetColorInput) {
            targetColorInput.addEventListener('input', (e) => {
                this.currentTargetColor = (e.target as HTMLInputElement).value;
                this.updateButtonStates();
            });
        }

        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.applyAdjustment();
            });
        }

        if (downloadButton) {
            downloadButton.addEventListener('click', () => {
                this.downloadAdjustedImage();
            });
        }
    }

    /**
     * Loads an image file and displays it
     */
    private loadImage(file: File): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.drawOriginalImage();
                this.updateButtonStates();
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
    
    /**
     * Updates button enabled/disabled states
     */
    private updateButtonStates(): void {
        const applyButton = document.getElementById('applyAdjustmentButton') as HTMLButtonElement;
        const downloadButton = document.getElementById('downloadAdjustedButton') as HTMLButtonElement;
        
        const hasImage = this.originalImage !== null;
        const hasColor = this.currentTargetColor !== null;
        
        if (applyButton) {
            applyButton.disabled = !(hasImage && hasColor);
        }
    }

    /**
     * Draws the original image to the canvas at full resolution.
     * Display is scaled via CSS (max-width/max-height) for preview.
     */
    private drawOriginalImage(): void {
        if (!this.originalImage) {
            return;
        }

        const width = this.originalImage.width;
        const height = this.originalImage.height;

        this.originalCanvas.width = width;
        this.originalCanvas.height = height;
        this.adjustedCanvas.width = width;
        this.adjustedCanvas.height = height;

        this.originalCtx.drawImage(this.originalImage, 0, 0, width, height);
    }

    /**
     * Applies HSL adjustment to match target color
     */
    applyAdjustment(): void {
        if (!this.originalImage || !this.currentTargetColor) {
            alert('Please upload an image and select a target color');
            return;
        }

        // Get image data from original canvas
        const imageData = this.originalCtx.getImageData(
            0,
            0,
            this.originalCanvas.width,
            this.originalCanvas.height
        );

        // Convert target color hex to RGB
        const targetRgb = ColorConverter.hexToRgb(this.currentTargetColor);

        // Apply HSL adjustment
        const adjustedImageData = ImageProcessor.applyHslAdjustment(imageData, targetRgb);

        // Draw adjusted image
        this.adjustedCtx.putImageData(adjustedImageData, 0, 0);
        
        // Enable download button
        const downloadButton = document.getElementById('downloadAdjustedButton') as HTMLButtonElement;
        if (downloadButton) {
            downloadButton.disabled = false;
        }

        // Notify 3D preview if callback is set
        if (this.onTextureUpdated) {
            this.onTextureUpdated(this.adjustedCanvas);
        }
    }

    /**
     * Sets callback for when texture is updated
     * @param callback Function to call with updated canvas
     */
    setOnTextureUpdated(callback: (canvas: HTMLCanvasElement) => void): void {
        this.onTextureUpdated = callback;
    }

    /**
     * Gets the current adjusted canvas
     * @returns Canvas element with adjusted texture
     */
    getAdjustedCanvas(): HTMLCanvasElement {
        return this.adjustedCanvas;
    }

    /**
     * Sets the target color from a hex string
     */
    setTargetColor(hexColor: string): void {
        this.currentTargetColor = hexColor;
        const targetColorInput = document.getElementById('targetColorInput') as HTMLInputElement;
        if (targetColorInput) {
            targetColorInput.value = hexColor;
        }
        this.updateButtonStates();
    }

    /**
     * Downloads the adjusted image
     */
    private downloadAdjustedImage(): void {
        this.adjustedCanvas.toBlob((blob) => {
            if (!blob) {
                return;
            }

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
}
