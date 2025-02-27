import { camera } from '../core/game.js';

// Player state
export const player = { 
    position: new THREE.Vector3(0, 100, 0), // Start at a safe height
    velocity: new THREE.Vector3(0, 0, 0),
    lastChunkX: 0,
    lastChunkZ: 0,
    spawnHeight: 100, // Safe initial height
    isSpawning: true, // Flag to indicate initial spawn
    spawned: false, // Flag to track if player has safely spawned
    lastGlobalX: null,
    lastGlobalZ: null,
    jumpTime: 0,
    isJumping: false
};

// Setup the player
export function setupPlayer() {
    // Initialize player state
    // Most initialization happens in findSafeSpawnPoint in the terrain module
    console.log("Player initialized");
    return player;
}

// Update player camera position
export function updatePlayerCamera() {
    // Make sure camera follows player
    camera.position.copy(player.position);
    camera.position.y += 1.7; // Eye height
}

// Find and move to a safe position on the ground
export function movePlayerToGround() {
    const groundY = findGroundLevel(player.position.x, player.position.z);
    if (groundY !== -1) {
        player.position.y = groundY + 2; // Position 2 blocks above ground
        updatePlayerCamera();
        player.spawned = true;
    }
    player.isSpawning = false;
    console.log("Player moved to ground at:", player.position);
}

// Helper function to find ground level
function findGroundLevel(x, z) {
    // Implementation depends on terrain system
    // This will be handled by the terrain module
    return window.findGroundLevel ? window.findGroundLevel(x, z) : 0;
} 