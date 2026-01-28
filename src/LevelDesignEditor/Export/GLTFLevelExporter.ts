/**
 * GLTF Level Exporter
 * Exports level geometry to GLTF/GLB format for use in Godot and other 3D engines
 */

import { LevelPreview3D } from '../Presentation/LevelPreview3D.js';
import { Level } from '../Domain/Level.js';

/**
 * Export options
 */
export interface GLTFExportOptions {
    /** Export as binary GLB (true) or text GLTF (false) */
    binary: boolean;
    /** Include only level geometry (exclude ground, grid, etc.) */
    levelOnly: boolean;
    /** Custom filename (without extension) */
    filename?: string;
}

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: GLTFExportOptions = {
    binary: true,
    levelOnly: true,
    filename: undefined
};

/**
 * GLTF Level Exporter class
 */
export class GLTFLevelExporter {
    private preview3D: LevelPreview3D;
    private level: Level;
    private GLTFExporter: any;

    constructor(preview3D: LevelPreview3D, level: Level) {
        this.preview3D = preview3D;
        this.level = level;
    }

    /**
     * Dynamically loads the GLTFExporter
     */
    private async loadExporter(): Promise<void> {
        if (!this.GLTFExporter) {
            const module = await import('three/addons/exporters/GLTFExporter.js' as any);
            this.GLTFExporter = module.GLTFExporter;
        }
    }

    /**
     * Exports the level to GLTF/GLB format
     * @param options Export options
     * @returns Promise resolving to Blob containing the exported data
     */
    async export(options: Partial<GLTFExportOptions> = {}): Promise<Blob> {
        const opts: GLTFExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };

        await this.loadExporter();

        const THREE = this.preview3D.getThree();
        const exporter = new this.GLTFExporter();

        // Determine what to export
        let exportTarget: any;

        if (opts.levelOnly) {
            // Export only the level group (walls, floors, spawns)
            exportTarget = this.preview3D.getLevelGroup();
        } else {
            // Export entire scene
            exportTarget = this.preview3D.getScene();
        }

        // Clone the export target to avoid modifying the original
        const exportScene = exportTarget.clone();

        // Perform the export
        return new Promise((resolve, reject) => {
            exporter.parse(
                exportScene,
                (result: any) => {
                    let blob: Blob;

                    if (opts.binary) {
                        // GLB (binary)
                        blob = new Blob([result], { type: 'model/gltf-binary' });
                    } else {
                        // GLTF (JSON)
                        const json = JSON.stringify(result, null, 2);
                        blob = new Blob([json], { type: 'model/gltf+json' });
                    }

                    resolve(blob);
                },
                (error: any) => {
                    reject(new Error(`GLTF export failed: ${error}`));
                },
                {
                    binary: opts.binary,
                    trs: false,
                    onlyVisible: true,
                    truncateDrawRange: true,
                    maxTextureSize: 4096
                }
            );
        });
    }

    /**
     * Exports and downloads the level
     * @param options Export options
     */
    async exportAndDownload(options: Partial<GLTFExportOptions> = {}): Promise<void> {
        const opts: GLTFExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };

        try {
            const blob = await this.export(opts);
            this.downloadBlob(blob, opts);
        } catch (error) {
            console.error('Failed to export level:', error);
            throw error;
        }
    }

    /**
     * Downloads a blob as a file
     */
    private downloadBlob(blob: Blob, options: GLTFExportOptions): void {
        const extension = options.binary ? '.glb' : '.gltf';
        const baseName = options.filename || this.level.getName().replace(/[^a-z0-9]/gi, '_');
        const filename = `${baseName}${extension}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Gets the estimated export size (approximate)
     */
    getEstimatedSize(): number {
        const elements = this.level.getAllElements();
        // Rough estimate: ~500 bytes per element for GLB
        return elements.length * 500 + 1024; // Base overhead
    }

    /**
     * Validates that the level can be exported
     */
    canExport(): boolean {
        return this.level.getElementCount() > 0;
    }
}
