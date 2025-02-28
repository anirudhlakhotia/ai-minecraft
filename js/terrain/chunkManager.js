import { processChunkQueue, chunkRenderDistance, terrain } from './terrain.js';
import { scene } from '../core/game.js';
import { player } from '../player/player.js';
import { playerDirection } from '../player/physics.js';

// Chunk transition settings
const fadeSpeed = 2.0; // Speed of chunk fade in/out
const chunkTransitionTime = 300; // Time in ms for chunk transitions
let lastChunkUpdate = 0; // Track time of last chunk update

// Update chunk fades for smooth transitions
export function updateChunkFades(delta) {
    if (!terrain) return;
    
    // Update opacity for all chunks
    Object.values(terrain).forEach(chunk => {
        // Skip if chunk doesn't have fade properties
        if (chunk.currentOpacity === undefined || !chunk.material) return;
        
        // Animate fade
        if (chunk.currentOpacity !== chunk.fadeTarget) {
            // Calculate new opacity
            const diff = chunk.fadeTarget - chunk.currentOpacity;
            const step = Math.sign(diff) * Math.min(Math.abs(diff), delta * fadeSpeed);
            chunk.currentOpacity += step;
            
            // Ensure opacity stays within valid range
            chunk.currentOpacity = Math.max(0, Math.min(1, chunk.currentOpacity));
            
            // Apply opacity to all child meshes
            chunk.children.forEach(child => {
                if (child.material) {
                    if (!child.material.transparent && chunk.fadeTarget < 1) {
                        child.material.transparent = true;
                    }
                    child.material.opacity = chunk.currentOpacity;
                    
                    // When fully opaque, disable transparency for performance
                    if (child.material.transparent && chunk.currentOpacity >= 0.99) {
                        child.material.transparent = false;
                        child.material.opacity = 1;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
    });
}

// Process the chunk loading queue with optimizations
export function processChunkQueueWithThrottling() {
    const now = performance.now();
    
    // Throttle chunk processing to avoid frame drops
    if (now - lastChunkUpdate < chunkTransitionTime && Object.keys(terrain).length > 0) {
        return;
    }
    
    lastChunkUpdate = now;
    
    // Call the main queue processor
    return processChunkQueue();
}

// Prioritize chunks in the direction the player is moving
export function prioritizeChunks() {
    if (!chunkLoadingQueue || chunkLoadingQueue.length === 0 || !player || !playerDirection) {
        return;
    }
    
    // Get player's current chunk
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // Skip if player direction is not significant
    if (playerDirection.lengthSq() < 0.01) {
        return;
    }
    
    // Normalize direction
    const direction = playerDirection.clone().normalize();
    
    // Sort chunks by priority (chunks in player's direction get higher priority)
    chunkLoadingQueue.sort((a, b) => {
        // Calculate relative positions
        const aRelX = a.x - playerChunkX;
        const aRelZ = a.z - playerChunkZ;
        const bRelX = b.x - playerChunkX;
        const bRelZ = b.z - playerChunkZ;
        
        // Calculate dot products with player direction
        const aDot = aRelX * direction.x + aRelZ * direction.z;
        const bDot = bRelX * direction.x + bRelZ * direction.z;
        
        // Sort by dot product (higher means more aligned with direction)
        return bDot - aDot;
    });
}

// Handle chunk transitions when changing biomes
export function transitionChunks(newBiome) {
    // Fade out all chunks
    Object.values(terrain).forEach(chunk => {
        if (chunk.fadeTarget !== undefined) {
            chunk.fadeTarget = 0;
            
            // Enable transparency for fade out
            chunk.children.forEach(child => {
                if (child.material) {
                    child.material.transparent = true;
                    child.material.needsUpdate = true;
                }
            });
        }
    });
    
    // Schedule removal after fade completes
    setTimeout(() => {
        // Remove all chunks from scene
        Object.values(terrain).forEach(chunk => {
            scene.remove(chunk);
        });
        
        // Clear terrain object
        Object.keys(terrain).forEach(key => {
            delete terrain[key];
        });
        
        // Generate new terrain with the new biome
        window.generateTerrain();
    }, 500); // Wait for fade out animation
}

// Clean up old chunks that haven't been visible in a while
export function cleanupOldChunks() {
    const now = performance.now();
    const maxAge = 30000; // 30 seconds
    
    // Check chunks in cache
    Object.keys(window.chunkCache).forEach(chunkKey => {
        const chunk = window.chunkCache[chunkKey];
        
        // If chunk has a lastSeen timestamp and it's too old, dispose it
        if (chunk.lastSeen && now - chunk.lastSeen > maxAge) {
            window.disposeChunk(chunk);
            delete window.chunkCache[chunkKey];
        }
    });
    
    // Limit cache size
    const cacheSize = Object.keys(window.chunkCache).length;
    if (cacheSize > window.maxCachedChunks) {
        // Get all cache keys sorted by lastSeen (oldest first)
        const sortedKeys = Object.keys(window.chunkCache).sort((a, b) => {
            const aTime = window.chunkCache[a].lastSeen || 0;
            const bTime = window.chunkCache[b].lastSeen || 0;
            return aTime - bTime;
        });
        
        // Remove oldest chunks until we're under the limit
        const keysToRemove = sortedKeys.slice(0, cacheSize - window.maxCachedChunks);
        keysToRemove.forEach(key => {
            window.disposeChunk(window.chunkCache[key]);
            delete window.chunkCache[key];
        });
    }
} 