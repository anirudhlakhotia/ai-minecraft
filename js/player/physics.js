import { player, updatePlayerCamera } from './player.js';
import { controls } from './controls.js';
import { camera, scene, isGameStarted, currentBiome } from '../core/game.js';
import { generateTerrain } from '../terrain/terrain.js';

// Input state
export let keyboard = {};

// Movement direction tracking for predictive loading
export let playerDirection = new THREE.Vector3();
export let previousPlayerPosition = new THREE.Vector3();
export let lastDirectionUpdateTime = 0;

// Initialize input
export function initInput() {
    // Setup keyboard listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Initialize player direction tracking
    previousPlayerPosition.copy(player.position);
}

// Handle keyboard input
function onKeyDown(event) {
    keyboard[event.key.toLowerCase()] = true;
    
    // Alternative movement keys for trackpad users
    if (event.key === 'ArrowUp') keyboard['w'] = true;
    if (event.key === 'ArrowDown') keyboard['s'] = true;
    if (event.key === 'ArrowLeft') keyboard['a'] = true;
    if (event.key === 'ArrowRight') keyboard['d'] = true;
}

function onKeyUp(event) {
    keyboard[event.key.toLowerCase()] = false;
    
    // Alternative movement keys for trackpad users
    if (event.key === 'ArrowUp') keyboard['w'] = false;
    if (event.key === 'ArrowDown') keyboard['s'] = false;
    if (event.key === 'ArrowLeft') keyboard['a'] = false;
    if (event.key === 'ArrowRight') keyboard['d'] = false;
}

// Update player physics with falling detection
export function updatePlayer(delta) {
    if (!isGameStarted) return;
    
    // Store previous position for direction calculation
    previousPlayerPosition.copy(player.position);
    
    // Check if player fell out of the world - add a more reliable threshold and logging
    if (player.position.y < -20) { // Lowered from -10 to -20 to give more leeway
        console.log("Player fell out of the world, respawning...");
        // Reset player position to safe spawn point
        player.isSpawning = true;
        window.findSafeSpawnPoint(); // This will be imported properly
        generateTerrain();
        player.velocity.set(0, 0, 0);
        return;
    }
    
    // Store previous position to detect sudden large changes
    const previousY = player.position.y;
    
    // Apply gravity
    if (!isPlayerOnGround()) {
        player.velocity.y -= 20 * delta; // Gravity
    } else if (player.velocity.y < 0) {
        player.velocity.y = 0;
    }
    
    // Cap falling speed
    if (player.velocity.y < -30) {
        player.velocity.y = -30;
    }
    
    // Handle jump with improved tracking and button interference prevention
    if (isGameStarted && (keyboard[' '] || keyboard['arrowup']) && isPlayerOnGround()) {
        player.velocity.y = 8;
        player.jumpTime = performance.now();
        player.isJumping = true;
        console.log("Jump executed at position:", player.position.y);
        
        // Force focus back to the canvas to prevent UI interference
        const gameCanvas = document.querySelector('canvas');
        if (gameCanvas) {
            gameCanvas.focus();
        }
    }
    
    // Movement direction based on camera orientation
    const moveDirection = new THREE.Vector3();
    const cameraDirection = controls.getDirection(new THREE.Vector3());
    cameraDirection.y = 0; // Keep movement on horizontal plane
    cameraDirection.normalize();
    
    const speedMultiplier = keyboard.shift ? 1.5 : 1.0; // Sprint with shift
    
    if (keyboard['w'] || keyboard['arrowup']) {
        moveDirection.add(cameraDirection);
    }
    if (keyboard['s'] || keyboard['arrowdown']) {
        moveDirection.sub(cameraDirection);
    }
    
    const cameraSide = new THREE.Vector3();
    cameraSide.crossVectors(camera.up, cameraDirection).normalize();
    
    if (keyboard['a'] || keyboard['arrowleft']) {
        moveDirection.add(cameraSide);
    }
    if (keyboard['d'] || keyboard['arrowright']) {
        moveDirection.sub(cameraSide);
    }
    
    // Apply movement with collision detection
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        moveDirection.multiplyScalar(5 * speedMultiplier * delta); // Speed
        movePlayerWithCollision(moveDirection);
    }
    
    // Apply vertical velocity
    movePlayerWithCollision(new THREE.Vector3(0, player.velocity.y * delta, 0));
    
    // Update camera position
    updatePlayerCamera();
    
    // Check if terrain needs to be updated
    const playerChunkX = Math.floor(player.position.x / window.chunkSize);
    const playerChunkZ = Math.floor(player.position.z / window.chunkSize);
    
    // Track very large changes in position for chunk management
    if (!player.lastGlobalX) player.lastGlobalX = player.position.x;
    if (!player.lastGlobalZ) player.lastGlobalZ = player.position.z;
    
    // If player has moved a large distance, reset terrain completely
    const distanceMoved = Math.sqrt(
        Math.pow(player.position.x - player.lastGlobalX, 2) +
        Math.pow(player.position.z - player.lastGlobalZ, 2)
    );
    
    if (distanceMoved > window.chunkSize * window.chunkRenderDistance.maximum * 2) {
        console.log("Player moved a large distance, resetting terrain completely");
        player.lastGlobalX = player.position.x;
        player.lastGlobalZ = player.position.z;
        
        // Clear all chunks and regenerate terrain
        Object.keys(window.terrain).forEach(chunkKey => {
            window.disposeChunk(window.terrain[chunkKey]);
            scene.remove(window.terrain[chunkKey]);
            delete window.terrain[chunkKey];
        });
        
        // Clear loading queue
        window.chunkLoadingQueue = [];
        
        // Regenerate immediately
        generateTerrain();
    }
    // Normal chunk update when player moves to a new chunk
    else if (playerChunkX !== player.lastChunkX || playerChunkZ !== player.lastChunkZ) {
        console.log(`Player moved to new chunk: ${playerChunkX},${playerChunkZ} (from ${player.lastChunkX},${player.lastChunkZ})`);
        player.lastChunkX = playerChunkX;
        player.lastChunkZ = playerChunkZ;
        generateTerrain();
    }
    
    // Update player direction for predictive loading
    updatePlayerDirection();
}

// Check if player is on ground
export function isPlayerOnGround() {
    const pos = player.position.clone();
    
    // Check slightly below feet with multiple sample points for more reliable detection
    pos.y -= 0.1;
    
    // Center point check
    if (isPositionSolid(pos)) return true;
    
    // Check a few points around the player for more reliable ground detection
    const checkDistance = 0.25;
    const checkPoints = [
        new THREE.Vector3(pos.x + checkDistance, pos.y, pos.z),
        new THREE.Vector3(pos.x - checkDistance, pos.y, pos.z),
        new THREE.Vector3(pos.x, pos.y, pos.z + checkDistance),
        new THREE.Vector3(pos.x, pos.y, pos.z - checkDistance)
    ];
    
    for (const point of checkPoints) {
        if (isPositionSolid(point)) return true;
    }
    
    return false;
}

// Move player with collision detection
export function movePlayerWithCollision(moveVector) {
    // X-axis movement
    if (moveVector.x !== 0) {
        player.position.x += moveVector.x;
        
        // Check for collision in X direction
        if (isPlayerColliding()) {
            player.position.x -= moveVector.x;
        }
    }
    
    // Y-axis movement with improved handling
    if (moveVector.y !== 0) {
        // Get current position before moving
        const beforeY = player.position.y;
        
        // Apply movement
        player.position.y += moveVector.y;
        
        // Check for collision in Y direction
        if (isPlayerColliding()) {
            player.position.y = beforeY; // Restore exact previous position
            player.velocity.y = 0;
        }
        
        // Safety check - don't allow extreme changes in Y position
        if (Math.abs(player.position.y - beforeY) > 10 && !player.isSpawning) {
            console.log("Prevented extreme Y position change:", beforeY, "->", player.position.y);
            player.position.y = beforeY;
            player.velocity.y = 0;
        }
    }
    
    // Z-axis movement
    if (moveVector.z !== 0) {
        player.position.z += moveVector.z;
        
        // Check for collision in Z direction
        if (isPlayerColliding()) {
            player.position.z -= moveVector.z;
        }
    }
}

// Check if player is colliding with blocks
export function isPlayerColliding() {
    // Player collision box
    const playerBox = new THREE.Box3(
        new THREE.Vector3(
            player.position.x - 0.3,
            player.position.y,
            player.position.z - 0.3
        ),
        new THREE.Vector3(
            player.position.x + 0.3,
            player.position.y + 1.7,
            player.position.z + 0.3
        )
    );
    
    // Check each corner of the player box
    for (let x = -1; x <= 1; x += 2) {
        for (let y = 0; y <= 1; y += 1) {
            for (let z = -1; z <= 1; z += 2) {
                const checkPos = new THREE.Vector3(
                    player.position.x + x * 0.3,
                    player.position.y + y * 1.7,
                    player.position.z + z * 0.3
                );
                
                if (isPositionSolid(checkPos)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Check if a position is inside a solid block
export function isPositionSolid(position) {
    const blockX = Math.floor(position.x + 0.5);
    const blockY = Math.floor(position.y);
    const blockZ = Math.floor(position.z + 0.5);
    const posKey = `${blockX},${blockY},${blockZ}`;
    
    // Check all chunks
    for (const chunk of Object.values(window.terrain)) {
        if (chunk.blockPositions[posKey]) {
            return true;
        }
    }
    
    return false;
}

// Calculate player movement direction for predictive loading
export function updatePlayerDirection() {
    const now = performance.now();
    
    // Only update direction periodically to avoid jitter
    if (now - lastDirectionUpdateTime < 500) return;
    
    // Calculate movement direction
    if (previousPlayerPosition.distanceToSquared(player.position) > 0.01) {
        playerDirection.subVectors(player.position, previousPlayerPosition).normalize();
        previousPlayerPosition.copy(player.position);
        lastDirectionUpdateTime = now;
    }
} 