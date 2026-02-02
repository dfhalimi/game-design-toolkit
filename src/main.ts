import { ColorWheel } from './PaletteGenerator/Presentation/ColorWheel.js';
import { TextureAdjuster } from './PaletteGenerator/Presentation/TextureAdjuster.js';
import { Texture3DPreview } from './PaletteGenerator/Presentation/Texture3DPreview.js';
import { SceneMaterialManager } from './PaletteGenerator/Domain/SceneMaterialManager.js';
import { ScenePreview } from './PaletteGenerator/Presentation/ScenePreview.js';
import { EnvironmentPaletteEditor } from './PaletteGenerator/Presentation/EnvironmentPaletteEditor.js';
import { OutdoorScenePreview } from './PaletteGenerator/Presentation/OutdoorScenePreview.js';

/**
 * Application entry point
 * Initializes and sets up the color palette generator
 */
function init(): void {
    try {
        const colorWheel = new ColorWheel('colorWheel', 300);
        colorWheel.draw();
        
        // Wire up the complementary color button
        const complementaryButton = document.getElementById('complementaryButton');
        if (complementaryButton) {
            complementaryButton.addEventListener('click', () => {
                colorWheel.generateComplementaryColor();
            });
        }

        // Initialize texture adjuster
        const textureAdjuster = new TextureAdjuster(
            'originalCanvas',
            'adjustedCanvas',
            'textureFileInput',
            'targetColorInput',
            'applyAdjustmentButton',
            'downloadAdjustedButton'
        );

        // Initialize Environment Palette Editor
        const environmentPaletteEditor = new EnvironmentPaletteEditor('environmentPaletteEditor');
        
        // Wire up "Use for Texture" from environment palette to texture adjuster
        environmentPaletteEditor.setOnColorSelected((color, slotId) => {
            textureAdjuster.setTargetColor(color);
            // Also update the target color input visually
            const targetColorInput = document.getElementById('targetColorInput') as HTMLInputElement;
            if (targetColorInput) {
                targetColorInput.value = color;
            }
            console.log(`Using ${slotId} color (${color}) for texture adjustment`);
        });

        // Initialize Outdoor Scene Preview (uses the same palette as the editor)
        const outdoorScenePreview = new OutdoorScenePreview(
            'outdoorSceneContainer',
            environmentPaletteEditor.getPalette()
        );

        // Wire up outdoor scene export and reset buttons
        const exportSceneBtn = document.getElementById('exportSceneBtn');
        const resetCameraBtn = document.getElementById('resetCameraBtn');
        
        if (exportSceneBtn) {
            exportSceneBtn.addEventListener('click', () => {
                outdoorScenePreview.exportToGLTF(true); // Export as GLB (binary)
            });
        }
        
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                outdoorScenePreview.resetCamera();
            });
        }

        // Initialize 3D preview
        const texture3DPreview = new Texture3DPreview(
            'texture3dContainer',
            'modelSelector'
        );

        // Wire up texture adjuster to 3D preview
        textureAdjuster.setOnTextureUpdated((canvas) => {
            texture3DPreview.updateTexture(canvas);
        });

        // Wire up color selection to texture adjuster
        // When a color is selected, update the target color input
        const hexInput = document.getElementById('hexInput') as HTMLInputElement;
        if (hexInput) {
            // Listen for value changes (from both typing and color wheel clicks)
            const updateTargetColor = () => {
                const hexColor = hexInput.value.trim();
                if (hexColor.startsWith('#') && hexColor.length === 7) {
                    textureAdjuster.setTargetColor(hexColor);
                }
            };

            // Use input event for real-time updates and a custom event for programmatic changes
            hexInput.addEventListener('input', updateTargetColor);
            
            // Also observe value attribute changes for when the color wheel updates the input
            const observer = new MutationObserver(() => {
                updateTargetColor();
            });
            observer.observe(hexInput, { attributes: true, attributeFilter: ['value'] });
            
            // Poll for changes as a fallback (the input's value property doesn't trigger mutation)
            let lastValue = hexInput.value;
            setInterval(() => {
                if (hexInput.value !== lastValue) {
                    lastValue = hexInput.value;
                    updateTargetColor();
                }
            }, 100);
        }

        // Initialize Scene Preview with Material Slots
        const materialManager = new SceneMaterialManager();
        const scenePreview = new ScenePreview('sceneContainer', materialManager);

        // Wire up material slot color inputs
        const slotColorInputs = document.querySelectorAll('.material-slot-color');
        slotColorInputs.forEach((input) => {
            const colorInput = input as HTMLInputElement;
            const slotId = colorInput.id.replace('slotColor-', '');
            
            colorInput.addEventListener('input', () => {
                materialManager.setSlotColor(slotId, colorInput.value);
            });
        });

        // Wire up texture buttons
        const textureButtons = document.querySelectorAll('.material-slot-btn-texture');
        textureButtons.forEach((button) => {
            const btn = button as HTMLButtonElement;
            const slotId = btn.dataset.slot;
            
            if (slotId) {
                btn.addEventListener('click', () => {
                    const adjustedCanvas = textureAdjuster.getAdjustedCanvas();
                    if (adjustedCanvas && adjustedCanvas.width > 0 && adjustedCanvas.height > 0) {
                        // Create a copy of the canvas
                        const canvasCopy = document.createElement('canvas');
                        canvasCopy.width = adjustedCanvas.width;
                        canvasCopy.height = adjustedCanvas.height;
                        const ctx = canvasCopy.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(adjustedCanvas, 0, 0);
                            materialManager.setSlotTexture(slotId, canvasCopy);
                        }
                    } else {
                        alert('Please adjust a texture first using the Texture Adjuster above.');
                    }
                });
            }
        });

        // Wire up reset buttons
        const resetButtons = document.querySelectorAll('.material-slot-btn-reset');
        resetButtons.forEach((button) => {
            const btn = button as HTMLButtonElement;
            const slotId = btn.dataset.slot;
            
            if (slotId) {
                btn.addEventListener('click', () => {
                    materialManager.resetSlot(slotId);
                    // Update the color input to reflect the reset
                    const colorInput = document.getElementById(`slotColor-${slotId}`) as HTMLInputElement;
                    const slot = materialManager.getSlot(slotId);
                    if (colorInput && slot) {
                        colorInput.value = slot.color;
                    }
                });
            }
        });

        // Update material slot color inputs when slot changes
        materialManager.onSlotChange((slot) => {
            const colorInput = document.getElementById(`slotColor-${slot.id}`) as HTMLInputElement;
            if (colorInput && !slot.texture) {
                colorInput.value = slot.color;
            }
        });

    } catch (error) {
        console.error('Failed to initialize color palette generator:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
