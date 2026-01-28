import { ColorConverter } from '../Domain/ColorConverter.js';
import { ColorSchemeGenerator } from '../Domain/ColorSchemeGenerator.js';

/**
 * Animation types for background effects
 */
export type AnimationType = 'rotate' | 'breathing' | 'wave' | 'pulse' | 'none';

/**
 * Color wheel component
 * Handles rendering and interaction with the color wheel canvas
 */
export class ColorWheel {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private size: number;
    private center: number;
    private radius: number;
    private selectedPosition: { x: number; y: number } | null = null;
    private currentColor: string | null = null;
    private complementaryColorEnabled: boolean = false;
    private gradientAngle: number = 135;
    private animationFrameId: number | null = null;
    private animationType: AnimationType = 'rotate';
    private animationTime: number = 0;
    private breathingPhase: number = 0;
    private wavePhase: number = 0;

    constructor(canvasId: string, size: number = 300) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2d context from canvas');
        }

        this.canvas = canvas;
        this.ctx = ctx;
        this.size = size;
        this.center = size / 2;
        this.radius = size / 2 - 10;

        this.setupEventListeners();
        this.setupSettingsMenu();
        this.startAnimation();
    }
    
    /**
     * Sets up the settings menu for animation selection
     */
    private setupSettingsMenu(): void {
        const settingsButton = document.getElementById('settingsButton');
        const settingsDropdown = document.getElementById('settingsDropdown');
        
        if (settingsButton && settingsDropdown) {
            settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!settingsButton.contains(e.target as Node) && 
                    !settingsDropdown.contains(e.target as Node)) {
                    settingsDropdown.classList.remove('show');
                }
            });
            
            // Handle animation option clicks
            const options = settingsDropdown.querySelectorAll('.settings-option');
            options.forEach(option => {
                option.addEventListener('click', () => {
                    const animationType = (option as HTMLElement).dataset.animation as AnimationType;
                    this.setAnimationType(animationType);
                    
                    // Update active state
                    options.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Close dropdown
                    settingsDropdown.classList.remove('show');
                });
            });
        }
    }
    
    /**
     * Sets the animation type and restarts animation
     */
    setAnimationType(type: AnimationType): void {
        this.animationType = type;
        this.animationTime = 0;
        this.breathingPhase = 0;
        this.wavePhase = 0;
        
        // Restart animation with new type
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.startAnimation();
    }
    
    /**
     * Starts the animation loop
     */
    private startAnimation(): void {
        if (this.animationType === 'none') {
            // Static - just update once
            this.updateBackgroundGradient();
            return;
        }
        
        const animate = () => {
            this.animationTime += 0.016; // ~60fps
            
            switch (this.animationType) {
                case 'rotate':
                    this.gradientAngle = (this.gradientAngle + 0.15) % 360;
                    break;
                case 'breathing':
                    this.breathingPhase = (this.breathingPhase + 0.005) % (Math.PI * 2);
                    break;
                case 'wave':
                    this.wavePhase = (this.wavePhase + 0.008) % (Math.PI * 2);
                    break;
                case 'pulse':
                    this.breathingPhase = (this.breathingPhase + 0.01) % (Math.PI * 2);
                    break;
            }
            
            this.updateBackgroundGradient();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    /**
     * Updates the background gradient based on current animation type
     */
    private updateBackgroundGradient(): void {
        const body = document.getElementsByTagName('body')[0];
        if (!body) {
            return;
        }
        
        // Get current colors
        let color1 = '#4A90E2';
        let color2 = '#4A90E2';
        
        if (this.currentColor) {
            color1 = this.currentColor;
            if (this.complementaryColorEnabled) {
                color2 = ColorSchemeGenerator.getComplementaryColor(this.currentColor);
            } else {
                color2 = this.currentColor;
            }
        }
        
        let gradient = '';
        
        switch (this.animationType) {
            case 'rotate':
                gradient = `linear-gradient(${this.gradientAngle}deg, ${color1} 0%, ${color2} 100%)`;
                break;
                
            case 'breathing':
                // Animate gradient stop positions
                const breathingOffset = Math.sin(this.breathingPhase) * 20;
                const stop1 = breathingOffset;
                const stop2 = 100 - breathingOffset;
                gradient = `linear-gradient(135deg, ${color1} ${stop1}%, ${color2} ${stop2}%)`;
                break;
                
            case 'wave':
                // Create wave effect with multiple stops
                const wave1 = Math.sin(this.wavePhase) * 15;
                const wave2 = 50 + Math.sin(this.wavePhase + Math.PI / 2) * 15;
                const wave3 = 100 + Math.sin(this.wavePhase + Math.PI) * 15;
                gradient = `linear-gradient(135deg, ${color1} ${wave1}%, ${color2} ${wave2}%, ${color1} ${wave3}%)`;
                break;
                
            case 'pulse':
                // Pulse the gradient angle slightly
                const pulseAngle = 135 + Math.sin(this.breathingPhase) * 30;
                gradient = `linear-gradient(${pulseAngle}deg, ${color1} 0%, ${color2} 100%)`;
                break;
                
            case 'none':
            default:
                gradient = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
                break;
        }
        
        body.style.setProperty('background', gradient);
    }

    /**
     * Draws the color wheel on the canvas
     */
    draw(): void {
        this.clearCanvas();
        
        this.drawColorWheel();
        
        // Draw indicator if a color is selected
        if (this.selectedPosition) {
            this.drawIndicator(this.selectedPosition.x, this.selectedPosition.y);
        }
    }

    private clearCanvas(): void {
        this.ctx.clearRect(0, 0, this.size, this.size);
    }

    private drawColorWheel(): void {
        for (let angle = 0; angle < 360; angle += 0.5) {
            for (let r = 0; r < this.radius; r++) {
                const x = this.center + r * Math.cos(angle * Math.PI / 180);
                const y = this.center + r * Math.sin(angle * Math.PI / 180);

                const hue = angle;
                const saturation = (r / this.radius) * 100;
                const lightness = 50;

                this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                this.ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    /**
     * Draws an indicator circle at the specified position
     */
    private drawIndicator(x: number, y: number): void {
        // Draw outer white circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        this.ctx.strokeStyle = '#2d3748';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw inner black circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#2d3748';
        this.ctx.fill();
    }

    /**
     * Handles click events on the color wheel
     * Extracts color from the clicked position and updates the display
     */
    private setupEventListeners(): void {
        this.canvas.addEventListener('click', (e: MouseEvent) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const dx = x - this.center;
            const dy = y - this.center;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.radius) {
                // Store the selected position
                this.selectedPosition = { x, y };
                
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const saturation = (distance / this.radius) * 100;
                const lightness = 50;

                const rgb = ColorConverter.hslToRgb(
                    angle / 360,
                    saturation / 100,
                    lightness / 100
                );
                const hex = ColorConverter.rgbToHex(rgb[0], rgb[1], rgb[2]);
                this.currentColor = hex;

                // Redraw with indicator
                this.draw();
                this.updateColorDisplay(hex);
                
                // Auto-update complementary color if enabled
                if (this.complementaryColorEnabled) {
                    this.updateComplementaryColor(hex);
                }
            }
        });

        // Setup hex input listener
        this.setupHexInput();
    }

    /**
     * Sets up the hex input field event listeners
     */
    private setupHexInput(): void {
        const hexInput = document.getElementById('hexInput') as HTMLInputElement;
        if (!hexInput) return;

        let lastAppliedColor = '';

        // Handle input changes - format as user types
        hexInput.addEventListener('input', () => {
            let value = hexInput.value.trim();
            
            // Add # if missing
            if (value && !value.startsWith('#')) {
                value = '#' + value;
            }
            
            // Update to uppercase
            hexInput.value = value.toUpperCase();
            
            // Reset border color when typing
            hexInput.style.borderColor = '#e2e8f0';
        });

        // Handle when user finishes editing (blur or enter)
        const applyHexColor = () => {
            const value = hexInput.value.trim().toUpperCase();
            
            // Skip if this color was already applied (prevents double-execution)
            if (value === lastAppliedColor) return;
            
            if (this.isValidHex(value)) {
                lastAppliedColor = value;
                this.setColorFromHex(value);
                hexInput.style.borderColor = '#4A90E2';
            } else if (value.length > 0) {
                // Show error state for invalid hex
                hexInput.style.borderColor = '#E24A4A';
            }
        };

        hexInput.addEventListener('blur', applyHexColor);
        hexInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyHexColor();
                hexInput.blur();
            }
        });
    }

    /**
     * Validates a hex color string (3 or 6 digit)
     */
    private isValidHex(hex: string): boolean {
        return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex);
    }

    /**
     * Normalizes a hex color to 6-digit format
     */
    private normalizeHex(hex: string): string {
        hex = hex.toUpperCase();
        // Convert 3-digit to 6-digit
        if (hex.length === 4) {
            return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        return hex;
    }

    /**
     * Sets the color from a hex string and updates the wheel indicator
     */
    setColorFromHex(hexColor: string): void {
        if (!this.isValidHex(hexColor)) return;

        // Normalize to 6-digit hex
        hexColor = this.normalizeHex(hexColor);

        // Convert hex to RGB
        const [r, g, b] = ColorConverter.hexToRgb(hexColor);

        // Convert RGB to HSL
        const hsl = this.rgbToHsl(r, g, b);
        
        // Calculate position on the color wheel
        // The wheel uses lightness of 50, so we calculate based on hue and saturation
        const angle = hsl.h * 360;
        const distance = hsl.s * this.radius;

        const x = this.center + distance * Math.cos(angle * Math.PI / 180);
        const y = this.center + distance * Math.sin(angle * Math.PI / 180);

        // Update state
        this.selectedPosition = { x, y };
        this.currentColor = hexColor.toUpperCase();

        // Redraw with indicator
        this.draw();
        this.updateColorDisplay(hexColor);

        // Auto-update complementary color if enabled
        if (this.complementaryColorEnabled) {
            this.updateComplementaryColor(hexColor);
        }
    }

    /**
     * Converts RGB to HSL
     */
    private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

        return { h, s, l };
    }

    /**
     * Updates the color display element with the selected color
     * @param hexColor HEX color string
     */
    private updateColorDisplay(hexColor: string): void {
        const normalizedHex = hexColor.toUpperCase();
        
        // Update the hex input field
        const hexInput = document.getElementById('hexInput') as HTMLInputElement;
        if (hexInput) {
            hexInput.value = normalizedHex;
            // Also reset border color to indicate success
            hexInput.style.borderColor = '#e2e8f0';
        }
        
        // Update the color swatch - use setProperty for better compatibility
        const colorSwatch = document.getElementById('colorSwatch') as HTMLElement;
        if (colorSwatch) {
            colorSwatch.style.setProperty('background-color', normalizedHex, 'important');
        }
        
        // Update background - use gradient if complementary color is enabled
        this.updateBackground();
        
        // Show the complementary color button only if not already enabled
        if (!this.complementaryColorEnabled) {
            const complementaryButton = document.getElementById('complementaryButton');
            if (complementaryButton) {
                complementaryButton.style.display = 'block';
            }
        }
    }
    
    /**
     * Updates the background with appropriate gradient
     */
    private updateBackground(): void {
        // The gradient animation will pick up the new colors automatically
        // via updateBackgroundGradient, so we just need to ensure it's called
        this.updateBackgroundGradient();
    }
    
    /**
     * Gets the currently selected color
     */
    getCurrentColor(): string | null {
        return this.currentColor;
    }
    
    /**
     * Generates and displays the complementary color
     */
    generateComplementaryColor(): void {
        if (!this.currentColor) {
            return;
        }
        
        // Enable auto-update mode
        this.complementaryColorEnabled = true;
        
        // Hide the button
        const complementaryButton = document.getElementById('complementaryButton');
        if (complementaryButton) {
            complementaryButton.style.display = 'none';
        }
        
        // Show and update the complementary color section
        const complementarySection = document.getElementById('complementarySection');
        if (complementarySection) {
            complementarySection.style.display = 'block';
        }
        
        // Update the complementary color
        this.updateComplementaryColor(this.currentColor);
    }
    
    /**
     * Updates the complementary color display
     * @param hexColor HEX color string to generate complementary for
     */
    private updateComplementaryColor(hexColor: string): void {
        const complementaryHex = ColorSchemeGenerator.getComplementaryColor(hexColor);
        
        const complementaryValueElement = document.getElementById('complementaryValue');
        if (complementaryValueElement) {
            const spanElement = complementaryValueElement.querySelector('span');
            if (spanElement) {
                spanElement.textContent = complementaryHex.toUpperCase();
            }
        }
        
        // Update the complementary color swatch
        const complementarySwatch = document.getElementById('complementarySwatch');
        if (complementarySwatch) {
            complementarySwatch.style.backgroundColor = complementaryHex;
        }
        
        // Update background gradient with both colors
        this.updateBackground();
    }
}
