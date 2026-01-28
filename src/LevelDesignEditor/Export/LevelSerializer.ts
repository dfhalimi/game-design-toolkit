/**
 * Level Serializer
 * Handles saving and loading levels to/from JSON
 */

import { Level } from '../Domain/Level.js';

/**
 * Level file format version
 */
export const LEVEL_FORMAT_VERSION = '1.0';

/**
 * Level file structure
 */
export interface LevelFile {
    version: string;
    level: object;
}

/**
 * Level Serializer class
 */
export class LevelSerializer {
    /**
     * Serializes a level to JSON string
     */
    static serialize(level: Level): string {
        const levelFile: LevelFile = {
            version: LEVEL_FORMAT_VERSION,
            level: level.toJSON()
        };

        return JSON.stringify(levelFile, null, 2);
    }

    /**
     * Deserializes a JSON string to a Level
     */
    static deserialize(json: string): Level {
        try {
            const levelFile: LevelFile = JSON.parse(json);

            // Check version compatibility
            if (!levelFile.version) {
                console.warn('Level file has no version, assuming compatible');
            }

            return Level.fromJSON(levelFile.level);
        } catch (error) {
            throw new Error(`Failed to parse level file: ${error}`);
        }
    }

    /**
     * Downloads a level as a JSON file
     */
    static downloadLevel(level: Level, filename?: string): void {
        const json = this.serialize(level);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const name = filename || `${level.getName().replace(/[^a-z0-9]/gi, '_')}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Opens a file picker and loads a level from the selected file
     * Returns a promise that resolves to the loaded Level
     */
    static loadLevelFromFile(): Promise<Level> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const json = event.target?.result as string;
                        const level = this.deserialize(json);
                        resolve(level);
                    } catch (error) {
                        reject(error);
                    }
                };

                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };

                reader.readAsText(file);
            };

            input.click();
        });
    }

    /**
     * Saves level to browser localStorage
     */
    static saveToLocalStorage(level: Level, key: string = 'savedLevel'): void {
        const json = this.serialize(level);
        localStorage.setItem(key, json);
    }

    /**
     * Loads level from browser localStorage
     */
    static loadFromLocalStorage(key: string = 'savedLevel'): Level | null {
        const json = localStorage.getItem(key);
        if (!json) {
            return null;
        }

        try {
            return this.deserialize(json);
        } catch (error) {
            console.error('Failed to load level from localStorage:', error);
            return null;
        }
    }

    /**
     * Checks if a level exists in localStorage
     */
    static hasLocalStorage(key: string = 'savedLevel'): boolean {
        return localStorage.getItem(key) !== null;
    }

    /**
     * Clears level from localStorage
     */
    static clearLocalStorage(key: string = 'savedLevel'): void {
        localStorage.removeItem(key);
    }
}
