/**
 * Environment Palette Editor - UI component for editing environment palettes
 * Provides slot swatches, generation controls, and harmony analysis display
 */

import { EnvironmentPalette, SlotId, SLOT_DEFINITIONS, SlotGroup } from '../Domain/EnvironmentPalette.js';
import { HarmonyAnalyzer, HarmonyAnalysis, HarmonySuggestion } from '../Domain/HarmonyAnalyzer.js';
import { PaletteGenerator, MoodPreset, ArtStyle, PRESET_DEFINITIONS, STYLE_DEFINITIONS } from '../Domain/PaletteGenerator.js';

/**
 * Callback when a color is selected for use in texture adjuster
 */
export type OnColorSelectedCallback = (color: string, slotId: SlotId) => void;

/**
 * Environment Palette Editor component
 */
export class EnvironmentPaletteEditor {
    private container: HTMLElement;
    private palette: EnvironmentPalette;
    private analysis: HarmonyAnalysis | null = null;
    private onColorSelected: OnColorSelectedCallback | null = null;

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
        this.palette = new EnvironmentPalette();

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
    setOnColorSelected(callback: OnColorSelectedCallback): void {
        this.onColorSelected = callback;
    }

    /**
     * Gets the current palette
     */
    getPalette(): EnvironmentPalette {
        return this.palette;
    }

    /**
     * Main render method
     */
    private render(): void {
        this.container.innerHTML = `
            <div class="env-palette-editor">
                <div class="env-palette-header">
                    <h2>Environment Palette</h2>
                    <p class="env-palette-description">
                        Create harmonious color palettes for outdoor game environments.
                        Pick colors manually or generate from a mood preset.
                    </p>
                </div>

                <div class="env-palette-generation">
                    <div class="env-palette-gen-group env-palette-style-group">
                        <label>Art Style</label>
                        <select id="envStyleSelect" class="env-palette-select">
                            ${STYLE_DEFINITIONS.map(s => 
                                `<option value="${s.id}" title="${s.description}">${s.name}</option>`
                            ).join('')}
                        </select>
                    </div>

                    <div class="env-palette-gen-group">
                        <label>Generate from Mood</label>
                        <div class="env-palette-gen-row">
                            <select id="envPresetSelect" class="env-palette-select">
                                ${PRESET_DEFINITIONS.map(p => 
                                    `<option value="${p.id}">${p.name}</option>`
                                ).join('')}
                            </select>
                            <button id="envGeneratePresetBtn" class="env-palette-btn env-palette-btn-primary">
                                Generate
                            </button>
                        </div>
                    </div>

                    <div class="env-palette-gen-divider">or</div>

                    <div class="env-palette-gen-group">
                        <label>Derive from Base Color</label>
                        <div class="env-palette-gen-row">
                            <input type="color" id="envBaseColorInput" class="env-palette-color-input" value="#4A90E2">
                            <button id="envDeriveBtn" class="env-palette-btn">
                                Derive Palette
                            </button>
                        </div>
                    </div>
                </div>

                <div class="env-palette-slots" id="envPaletteSlots">
                    ${this.renderSlotGroups()}
                </div>

                <div class="env-palette-analysis" id="envPaletteAnalysis">
                    <!-- Analysis will be rendered here -->
                </div>

                <div class="env-palette-actions">
                    <button id="envResetBtn" class="env-palette-btn env-palette-btn-secondary">
                        Reset to Defaults
                    </button>
                    <button id="envUnlockAllBtn" class="env-palette-btn env-palette-btn-secondary">
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
        const groups: SlotGroup[] = ['atmosphere', 'vegetation', 'terrain', 'accent'];
        const groupNames: Record<SlotGroup, string> = {
            atmosphere: 'Atmosphere',
            vegetation: 'Vegetation',
            terrain: 'Terrain',
            accent: 'Accent'
        };

        return groups.map(group => {
            const groupSlots = SLOT_DEFINITIONS.filter(s => s.group === group);
            return `
                <div class="env-palette-group">
                    <h3 class="env-palette-group-title">${groupNames[group]}</h3>
                    <div class="env-palette-group-slots">
                        ${groupSlots.map(slot => this.renderSlot(slot.id)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renders a single color slot
     */
    private renderSlot(slotId: SlotId): string {
        const slotDef = SLOT_DEFINITIONS.find(s => s.id === slotId)!;
        const slot = this.palette.getSlot(slotId);

        return `
            <div class="env-palette-slot" data-slot="${slotId}">
                <div class="env-palette-slot-header">
                    <span class="env-palette-slot-name">${slotDef.name}</span>
                    <label class="env-palette-slot-lock" title="Lock color (won't change during generation)">
                        <input type="checkbox" class="env-palette-lock-checkbox" data-slot="${slotId}" ${slot.locked ? 'checked' : ''}>
                        <span class="env-palette-lock-icon">${slot.locked ? '🔒' : '🔓'}</span>
                    </label>
                </div>
                <div class="env-palette-slot-color-row">
                    <input type="color" class="env-palette-slot-color" data-slot="${slotId}" value="${slot.color}">
                    <input type="text" class="env-palette-slot-hex" data-slot="${slotId}" value="${slot.color}" maxlength="7">
                </div>
                <button class="env-palette-slot-use-btn" data-slot="${slotId}" title="Use this color in Texture Adjuster">
                    Use for Texture
                </button>
            </div>
        `;
    }

    /**
     * Caches DOM element references
     */
    private cacheElements(): void {
        this.slotsContainer = document.getElementById('envPaletteSlots');
        this.analysisContainer = document.getElementById('envPaletteAnalysis');
        this.presetSelect = document.getElementById('envPresetSelect') as HTMLSelectElement;
        this.styleSelect = document.getElementById('envStyleSelect') as HTMLSelectElement;
        this.baseColorInput = document.getElementById('envBaseColorInput') as HTMLInputElement;
    }

    /**
     * Binds event handlers
     */
    private bindEvents(): void {
        // Preset generation
        const generateBtn = document.getElementById('envGeneratePresetBtn');
        generateBtn?.addEventListener('click', () => this.generateFromPreset());

        // Base color derivation
        const deriveBtn = document.getElementById('envDeriveBtn');
        deriveBtn?.addEventListener('click', () => this.deriveFromBase());

        // Reset button
        const resetBtn = document.getElementById('envResetBtn');
        resetBtn?.addEventListener('click', () => this.resetPalette());

        // Unlock all button
        const unlockBtn = document.getElementById('envUnlockAllBtn');
        unlockBtn?.addEventListener('click', () => this.unlockAll());

        // Color inputs
        this.container.querySelectorAll('.env-palette-slot-color').forEach(input => {
            input.addEventListener('input', (e) => this.handleColorChange(e));
        });

        // Hex inputs
        this.container.querySelectorAll('.env-palette-slot-hex').forEach(input => {
            input.addEventListener('change', (e) => this.handleHexChange(e));
        });

        // Lock checkboxes
        this.container.querySelectorAll('.env-palette-lock-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleLockChange(e));
        });

        // Use for texture buttons
        this.container.querySelectorAll('.env-palette-slot-use-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUseForTexture(e));
        });
    }

    /**
     * Handles color picker change
     */
    private handleColorChange(e: Event): void {
        const input = e.target as HTMLInputElement;
        const slotId = input.dataset.slot as SlotId;
        const color = input.value;

        this.palette.setColor(slotId, color);

        // Update hex input
        const hexInput = this.container.querySelector(`.env-palette-slot-hex[data-slot="${slotId}"]`) as HTMLInputElement;
        if (hexInput) {
            hexInput.value = color;
        }
    }

    /**
     * Handles hex input change
     */
    private handleHexChange(e: Event): void {
        const input = e.target as HTMLInputElement;
        const slotId = input.dataset.slot as SlotId;
        let color = input.value.trim();

        // Validate hex format
        if (!color.startsWith('#')) {
            color = '#' + color;
        }

        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            this.palette.setColor(slotId, color);

            // Update color input
            const colorInput = this.container.querySelector(`.env-palette-slot-color[data-slot="${slotId}"]`) as HTMLInputElement;
            if (colorInput) {
                colorInput.value = color;
            }
        } else {
            // Reset to current value
            input.value = this.palette.getColor(slotId);
        }
    }

    /**
     * Handles lock checkbox change
     */
    private handleLockChange(e: Event): void {
        const checkbox = e.target as HTMLInputElement;
        const slotId = checkbox.dataset.slot as SlotId;
        const locked = checkbox.checked;

        this.palette.setLocked(slotId, locked);

        // Update lock icon
        const lockIcon = checkbox.parentElement?.querySelector('.env-palette-lock-icon');
        if (lockIcon) {
            lockIcon.textContent = locked ? '🔒' : '🔓';
        }
    }

    /**
     * Handles "Use for Texture" button click
     */
    private handleUseForTexture(e: Event): void {
        const btn = e.target as HTMLButtonElement;
        const slotId = btn.dataset.slot as SlotId;
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

        const preset = this.presetSelect.value as MoodPreset;
        const style = this.getSelectedStyle();
        const newPalette = PaletteGenerator.fromPreset(preset, style, true, this.palette);

        // Copy colors from new palette to current (respecting locks handled by generator)
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];
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
        const newPalette = PaletteGenerator.fromBaseColor(baseColor, style, true, this.palette);

        // Copy colors from new palette
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];
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

        // Update UI
        this.container.querySelectorAll('.env-palette-lock-checkbox').forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = false;
        });
        this.container.querySelectorAll('.env-palette-lock-icon').forEach(icon => {
            icon.textContent = '🔓';
        });
    }

    /**
     * Updates slot color displays after palette change
     */
    private updateSlotColors(): void {
        const slotIds: SlotId[] = ['sky', 'water', 'grass', 'foliage', 'rock', 'dirt', 'bark', 'accent'];

        for (const slotId of slotIds) {
            const color = this.palette.getColor(slotId);

            const colorInput = this.container.querySelector(`.env-palette-slot-color[data-slot="${slotId}"]`) as HTMLInputElement;
            if (colorInput) {
                colorInput.value = color;
            }

            const hexInput = this.container.querySelector(`.env-palette-slot-hex[data-slot="${slotId}"]`) as HTMLInputElement;
            if (hexInput) {
                hexInput.value = color;
            }
        }
    }

    /**
     * Updates harmony analysis display
     */
    private updateAnalysis(): void {
        this.analysis = HarmonyAnalyzer.analyze(this.palette);

        // Refresh container reference to ensure it's valid
        this.analysisContainer = document.getElementById('envPaletteAnalysis');
        if (!this.analysisContainer) return;

        const scoreClass = this.analysis.score >= 80 ? 'good' : this.analysis.score >= 50 ? 'ok' : 'poor';

        this.analysisContainer.innerHTML = `
            <div class="env-palette-analysis-header">
                <h3>Harmony Analysis</h3>
                <div class="env-palette-score env-palette-score-${scoreClass}">
                    <span class="env-palette-score-value">${this.analysis.score}</span>
                    <span class="env-palette-score-label">/ 100</span>
                </div>
            </div>

            ${this.analysis.issues.length > 0 ? `
                <div class="env-palette-issues">
                    <h4>Issues Found (${this.analysis.issues.length})</h4>
                    <ul class="env-palette-issues-list">
                        ${this.analysis.issues.map(issue => `
                            <li class="env-palette-issue env-palette-issue-${issue.severity}">
                                <span class="env-palette-issue-icon">${this.getSeverityIcon(issue.severity)}</span>
                                <span class="env-palette-issue-message">${issue.message}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : `
                <div class="env-palette-issues-none">
                    <span>✓</span> No harmony issues found!
                </div>
            `}

            ${this.analysis.suggestions.length > 0 ? `
                <div class="env-palette-suggestions">
                    <h4>Suggestions</h4>
                    <ul class="env-palette-suggestions-list">
                        ${this.analysis.suggestions.map((suggestion, index) => `
                            <li class="env-palette-suggestion">
                                <div class="env-palette-suggestion-info">
                                    <span class="env-palette-suggestion-slot">${suggestion.slot}</span>
                                    <span class="env-palette-suggestion-desc">${suggestion.description}</span>
                                    <div class="env-palette-suggestion-preview">
                                        <span class="env-palette-suggestion-swatch" style="background-color: ${suggestion.newColor}"></span>
                                        <span class="env-palette-suggestion-hex">${suggestion.newColor}</span>
                                    </div>
                                </div>
                                <button class="env-palette-apply-btn" data-suggestion-index="${index}">
                                    Apply
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                    <button id="envApplyAllBtn" class="env-palette-btn env-palette-btn-primary env-palette-apply-all">
                        Apply All Suggestions
                    </button>
                </div>
            ` : ''}
        `;

        // Bind suggestion apply buttons
        this.analysisContainer.querySelectorAll('.env-palette-apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applySuggestion(e));
        });

        const applyAllBtn = document.getElementById('envApplyAllBtn');
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
            HarmonyAnalyzer.applySuggestion(this.palette, this.analysis.suggestions[index]);
        }
        // Explicitly update analysis and UI after applying suggestion
        this.updateSlotColors();
        this.updateAnalysis();
    }

    /**
     * Applies all suggestions
     */
    private applyAllSuggestions(): void {
        if (this.analysis) {
            HarmonyAnalyzer.applyAllSuggestions(this.palette, this.analysis.suggestions);
        }
        // Explicitly update analysis and UI after applying all suggestions
        this.updateSlotColors();
        this.updateAnalysis();
    }
}
