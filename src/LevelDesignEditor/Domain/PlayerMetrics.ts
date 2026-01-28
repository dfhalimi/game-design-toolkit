/**
 * Player metrics constants
 * Used for reference overlays, validation, and future AI-based level analysis
 * All measurements are in meters
 */

/** Standard player standing height */
export const PLAYER_HEIGHT = 1.8;

/** Player height when crouching */
export const CROUCH_HEIGHT = 0.9;

/** Player capsule width/diameter */
export const PLAYER_WIDTH = 0.6;

/** Maximum jump height (apex of jump arc) */
export const JUMP_HEIGHT = 1.0;

/** Maximum step height player can walk up without jumping */
export const STEP_HEIGHT = 0.3;

/** Player movement speed in meters per second (for future reference) */
export const MOVE_SPEED = 5.0;

/**
 * Player metrics interface for customizable player dimensions
 */
export interface PlayerMetrics {
    height: number;
    crouchHeight: number;
    width: number;
    jumpHeight: number;
    stepHeight: number;
}

/**
 * Default player metrics based on standard FPS conventions
 */
export const DEFAULT_PLAYER_METRICS: PlayerMetrics = {
    height: PLAYER_HEIGHT,
    crouchHeight: CROUCH_HEIGHT,
    width: PLAYER_WIDTH,
    jumpHeight: JUMP_HEIGHT,
    stepHeight: STEP_HEIGHT
};
