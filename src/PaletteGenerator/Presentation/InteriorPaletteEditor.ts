/**
 * Interior Palette Editor - UI component for editing interior palettes
 * Provides slot swatches, generation controls, and harmony analysis display
 */

import { InteriorPalette, InteriorSlotId, INTERIOR_SLOT_DEFINITIONS, InteriorSlotGroup } from '../Domain/InteriorPalette.js';
import { InteriorHarmonyAnalyzer, InteriorHarmonyAnalysis, InteriorHarmonySuggestion } from '../Domain/InteriorHarmonyAnalyzer.js';
import { InteriorPaletteGenerator, InteriorMoodPreset, ArtStyle, INTERIOR_PRESET_DEFINITIONS, INTERIOR_STYLE_DEFINITIONS } from '../Domain/InteriorPaletteGenerator.js';

/**
 * Callback when a color is selected for use in texture adjuster
 */
export type OnInteriorColorSelectedCallback = (color: string, slotId: InteriorSlotId) => void;

/**
 * Interior Palette Editor component
 */
export class InteriorPaletteEditor {
    private container: HTMLElement;
    private palette: InteriorPalette;
    private analysis: InteriorHarmonyAnalysis | null = null;
    private onColorSelected: OnInteriorColorSelectedCallback | null = null;

    // UI elements
    private slotsContainer: HTMLElement | null = null;
    private analysisContainer: HTMLElement | null = null;
    private presetSelect: HTMLSelectElement | null = null;
    private styleSelect: HTMLSelectElement | null = null;
    private baseColorInput: HTMLInputElement | null = null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element not found: ${containerId}`);
        }
        this.container = container;
        this.palette = new InteriorPalette();

        this.render();
        this.updateAnalysis();

        // Listen for palette changes
        this.palette.onChange(() => {
            this.updateSlotColors();
            this.updateAnalysis();
        });
    }

    /**
     * Sets the callback for when a color is selected for texture use
     */
    setOnColorSelected(callback: OnInteriorColorSelectedCallback): void {
        this.onColorSelected = callback;
    }

    /**
     * Gets the current palette
     */
    getPalette(): InteriorPalette {
        return this.palette;
    }

    /**
     * Main render method
     */
    private render(): void {
        this.container.innerHTML = `
            <div class="int-palette-editor">
                <div class="int-palette-header">
                    <h2>Interior Palette</h2>
                    <p class="int-palette-description">
                        Create harmonious color palettes for indoor game environments.
                        Pick colors manually or generate from a mood preset.
                    </p>
                </div>

                <div class="int-palette-generation">
                    <div class="int-palette-gen-group int-palette-style-group">
                        <label>Art Style</label>
                        <select id="intStyleSelect" class="int-palette-select">
                            ${INTERIOR_STYLE_DEFINITIONS.map(s => 
                                `<option value="${s.id}" title="${s.description}">${s.name}</option>`
                            ).join('')}
                        </select>
                    </div>

                    <div class="int-palette-gen-group">
                        <label>Generate from Mood</label>
                        <div class="int-palette-gen-row">
                            <select id="intPresetSelect" class="int-palette-select">
                                ${INTERIOR_PRESET_DEFINITIONS.map(p => 
                                    `<option value="${p.id}">${p.name}</option>`
                                ).join('')}
                            </select>
                            <button id="intGeneratePresetBtn" class="int-palette-btn int-palette-btn-primary">
                                Generate
                            </button>
                        </div>
                    </div>

                    <div class="int-palette-gen-divider">or</div>

                    <div class="int-palette-gen-group">
                        <label>Derive from Base Color</label>
                        <div class="int-palette-gen-row">
                            <input type="color" id="intBaseColorInput" class="int-palette-color-input" value="#8B7355">
                            <button id="intDeriveBtn" class="int-palette-btn">
                                Derive Palette
                            </button>
                        </div>
                    </div>
                </div>

                <div class="int-palette-slots" id="intPaletteSlots">
                    ${this.renderSlotGroups()}
                </div>

                <div class="int-palette-analysis" id="intPaletteAnalysis">
                    <!-- Analysis will be rendered here -->
                </div>

                <div class="int-palette-actions">
                    <button id="intResetBtn" class="int-palette-btn int-palette-btn-secondary">
                        Reset to Defaults
                    </button>
                    <button id="intUnlockAllBtn" class="int-palette-btn int-palette-btn-secondary">
                        Unlock All
                    </button>
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindEvents();
    }

    /**
     * Renders slot groups organized by category
     */
    private renderSlotGroups(): string {
        const groups: InteriorSlotGroup[] = ['surfaces', 'materials', 'details'];
        const groupNames: Record<InteriorSlotGroup, string> = {
            surfaces: 'Surfaces',
            materials: 'Materials',
            details: 'Details'
        };

        return groups.map(group => {
            const groupSlots = INTERIOR_SLOT_DEFINITIONS.filter(s => s.group === group);
            return `
                <div class="int-palette-group">
                    <h3 class="int-palette-group-title">${groupNames[group]}</h3>
                    <div class="int-palette-group-slots">
                        ${groupSlots.map(slot => this.renderSlot(slot.id)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renders a single color slot
     */
    private renderSlot(slotId: InteriorSlotId): string {
        const slotDef = INTERIOR_SLOT_DEFINITIONS.find(s => s.id === slotId)!;
        const slot = this.palette.getSlot(slotId);

        return `
            <div class="int-palette-slot" data-slot="${slotId}">
                <div class="int-palette-slot-header">
                    <span class="int-palette-slot-name">${slotDef.name}</span>
                    <label class="int-palette-slot-lock" title="Lock color (won't change during generation)">
                        <input type="checkbox" class="int-palette-lock-checkbox" data-slot="${slotId}" ${slot.locked ? 'checked' : ''}>
                        <span class="int-palette-lock-icon">${slot.locked ? '🔒' : '🔓'}</span>
                    </label>
                </div>
                <div class="int-palette-slot-color-row">
                    <input type="color" class="int-palette-slot-color" data-slot="${slotId}" value="${slot.color}">
                    <input type="text" class="int-palette-slot-hex" data-slot="${slotId}" value="${slot.color}" maxlength="7">
                </div>
                <button class="int-palette-slot-use-btn" data-slot="${slotId}" title="Use this color in Texture Adjuster">
                    Use for Texture
                </button>
            </div>
        `;
    }

    /**
     * Caches DOM element references
     */
    private cacheElements(): void {
        this.slotsContainer = document.getElementById('intPaletteSlots');
        this.analysisContainer = document.getElementById('intPaletteAnalysis');
        this.presetSelect = document.getElementById('intPresetSelect') as HTMLSelectElement;
        this.styleSelect = document.getElementById('intStyleSelect') as HTMLSelectElement;
        this.baseColorInput = document.getElementById('intBaseColorInput') as HTMLInputElement;
    }

    /**
     * Binds event handlers
     */
    private bindEvents(): void {
        // Preset generation
        const generateBtn = document.getElementById('intGeneratePresetBtn');
        generateBtn?.addEventListener('click', () => this.generateFromPreset());

        // Base color derivation
        const deriveBtn = document.getElementById('intDeriveBtn');
        deriveBtn?.addEventListener('click', () => this.deriveFromBase());

        // Reset button
        const resetBtn = document.getElementById('intResetBtn');
        resetBtn?.addEventListener('click', () => this.resetPalette());

        // Unlock all button
        const unlockBtn = document.getElementById('intUnlockAllBtn');
        unlockBtn?.addEventListener('click', () => this.unlockAll());

        // Color inputs
        this.container.querySelectorAll('.int-palette-slot-color').forEach(input => {
            input.addEventListener('input', (e) => this.handleColorChange(e));
        });

        // Hex inputs
        this.container.querySelectorAll('.int-palette-slot-hex').forEach(input => {
            input.addEventListener('change', (e) => this.handleHexChange(e));
        });

        // Lock checkboxes
        this.container.querySelectorAll('.int-palette-lock-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleLockChange(e));
        });

        // Use for texture buttons
        this.container.querySelectorAll('.int-palette-slot-use-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUseForTexture(e));
        });
    }

    /**
     * Handles color picker change
     */
    private handleColorChange(e: Event): void {
        const input = e.target as HTMLInputElement;
        const slotId = input.dataset.slot as InteriorSlotId;
        const color = input.value;

        this.palette.setColor(slotId, color);

        // Update hex input
        const hexInput = this.container.querySelector(`.int-palette-slot-hex[data-slot="${slotId}"]`) as HTMLInputElement;
        if (hexInput) {
            hexInput.value = color;
        }
    }

    /**
     * Handles hex input change
     */
    private handleHexChange(e: Event): void {
        const input = e.target as HTMLInputElement;
        const slotId = input.dataset.slot as InteriorSlotId;
        let color = input.value.trim();

        if (!color.startsWith('#')) {
            color = '#' + color;
        }

        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            this.palette.setColor(slotId, color);

            const colorInput = this.container.querySelector(`.int-palette-slot-color[data-slot="${slotId}"]`) as HTMLInputElement;
            if (colorInput) {
                colorInput.value = color;
            }
        } else {
            input.value = this.palette.getColor(slotId);
        }
    }

    /**
     * Handles lock checkbox change
     */
    private handleLockChange(e: Event): void {
        const checkbox = e.target as HTMLInputElement;
        const slotId = checkbox.dataset.slot as InteriorSlotId;
        const locked = checkbox.checked;

        this.palette.setLocked(slotId, locked);

        const lockIcon = checkbox.parentElement?.querySelector('.int-palette-lock-icon');
        if (lockIcon) {
            lockIcon.textContent = locked ? '🔒' : '🔓';
        }
    }

    /**
     * Handles "Use for Texture" button click
     */
    private handleUseForTexture(e: Event): void {
        const btn = e.target as HTMLButtonElement;
        const slotId = btn.dataset.slot as InteriorSlotId;
        const color = this.palette.getColor(slotId);

        if (this.onColorSelected) {
            this.onColorSelected(color, slotId);
        }
    }

    /**
     * Gets the currently selected art style
     */
    private getSelectedStyle(): ArtStyle {
        return (this.styleSelect?.value as ArtStyle) || 'vibrant';
    }

    /**
     * Generates palette from selected preset
     */
    private generateFromPreset(): void {
        if (!this.presetSelect) return;

        const preset = this.presetSelect.value as InteriorMoodPreset;
        const style = this.getSelectedStyle();
        const newPalette = InteriorPaletteGenerator.fromPreset(preset, style, true, this.palette);

        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];
        for (const slotId of slotIds) {
            if (!this.palette.isLocked(slotId)) {
                this.palette.setColor(slotId, newPalette.getColor(slotId));
            }
        }
    }

    /**
     * Derives palette from base color
     */
    private deriveFromBase(): void {
        if (!this.baseColorInput) return;

        const baseColor = this.baseColorInput.value;
        const style = this.getSelectedStyle();
        const newPalette = InteriorPaletteGenerator.fromBaseColor(baseColor, style, true, this.palette);

        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];
        for (const slotId of slotIds) {
            if (!this.palette.isLocked(slotId)) {
                this.palette.setColor(slotId, newPalette.getColor(slotId));
            }
        }
    }

    /**
     * Resets palette to defaults
     */
    private resetPalette(): void {
        this.palette.reset();
    }

    /**
     * Unlocks all slots
     */
    private unlockAll(): void {
        this.palette.unlockAll();

        this.container.querySelectorAll('.int-palette-lock-checkbox').forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = false;
        });
        this.container.querySelectorAll('.int-palette-lock-icon').forEach(icon => {
            icon.textContent = '🔓';
        });
    }

    /**
     * Updates slot color displays after palette change
     */
    private updateSlotColors(): void {
        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];

        for (const slotId of slotIds) {
            const color = this.palette.getColor(slotId);

            const colorInput = this.container.querySelector(`.int-palette-slot-color[data-slot="${slotId}"]`) as HTMLInputElement;
            if (colorInput) {
                colorInput.value = color;
            }

            const hexInput = this.container.querySelector(`.int-palette-slot-hex[data-slot="${slotId}"]`) as HTMLInputElement;
            if (hexInput) {
                hexInput.value = color;
            }
        }
    }

    /**
     * Updates harmony analysis display
     */
    private updateAnalysis(): void {
        this.analysis = InteriorHarmonyAnalyzer.analyze(this.palette);

        this.analysisContainer = document.getElementById('intPaletteAnalysis');
        if (!this.analysisContainer) return;

        const scoreClass = this.analysis.score >= 80 ? 'good' : this.analysis.score >= 50 ? 'ok' : 'poor';

        this.analysisContainer.innerHTML = `
            <div class="int-palette-analysis-header">
                <h3>Harmony Analysis</h3>
                <div class="int-palette-score int-palette-score-${scoreClass}">
                    <span class="int-palette-score-value">${this.analysis.score}</span>
                    <span class="int-palette-score-label">/ 100</span>
                </div>
            </div>

            ${this.analysis.issues.length > 0 ? `
                <div class="int-palette-issues">
                    <h4>Issues Found (${this.analysis.issues.length})</h4>
                    <ul class="int-palette-issues-list">
                        ${this.analysis.issues.map(issue => `
                            <li class="int-palette-issue int-palette-issue-${issue.severity}">
                                <span class="int-palette-issue-icon">${this.getSeverityIcon(issue.severity)}</span>
                                <span class="int-palette-issue-message">${issue.message}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : `
                <div class="int-palette-issues-none">
                    <span>✓</span> No harmony issues found!
                </div>
            `}

            ${this.analysis.suggestions.length > 0 ? `
                <div class="int-palette-suggestions">
                    <h4>Suggestions</h4>
                    <ul class="int-palette-suggestions-list">
                        ${this.analysis.suggestions.map((suggestion, index) => `
                            <li class="int-palette-suggestion">
                                <div class="int-palette-suggestion-info">
                                    <span class="int-palette-suggestion-slot">${suggestion.slot}</span>
                                    <span class="int-palette-suggestion-desc">${suggestion.description}</span>
                                    <div class="int-palette-suggestion-preview">
                                        <span class="int-palette-suggestion-swatch" style="background-color: ${suggestion.newColor}"></span>
                                        <span class="int-palette-suggestion-hex">${suggestion.newColor}</span>
                                    </div>
                                </div>
                                <button class="int-palette-apply-btn" data-suggestion-index="${index}">
                                    Apply
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                    <button id="intApplyAllBtn" class="int-palette-btn int-palette-btn-primary int-palette-apply-all">
                        Apply All Suggestions
                    </button>
                </div>
            ` : ''}
        `;

        // Bind suggestion apply buttons
        this.analysisContainer.querySelectorAll('.int-palette-apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applySuggestion(e));
        });

        const applyAllBtn = document.getElementById('intApplyAllBtn');
        applyAllBtn?.addEventListener('click', () => this.applyAllSuggestions());
    }

    /**
     * Gets icon for issue severity
     */
    private getSeverityIcon(severity: string): string {
        switch (severity) {
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'suggestion': return '💡';
            default: return '•';
        }
    }

    /**
     * Applies a single suggestion
     */
    private applySuggestion(e: Event): void {
        const btn = e.target as HTMLButtonElement;
        const index = parseInt(btn.dataset.suggestionIndex || '0', 10);

        if (this.analysis && this.analysis.suggestions[index]) {
            InteriorHarmonyAnalyzer.applySuggestion(this.palette, this.analysis.suggestions[index]);
        }
        this.updateSlotColors();
        this.updateAnalysis();
    }

    /**
     * Applies all suggestions
     */
    private applyAllSuggestions(): void {
        if (this.analysis) {
            InteriorHarmonyAnalyzer.applyAllSuggestions(this.palette, this.analysis.suggestions);
        }
        this.updateSlotColors();
        this.updateAnalysis();
    }
}
