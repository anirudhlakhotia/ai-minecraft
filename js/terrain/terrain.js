import { scene, camera, currentBiome } from '../core/game.js';
import { player, updatePlayerCamera, movePlayerToGround } from '../player/player.js';
import { createBlock, blockMaterials } from '../blocks/blocks.js';

// Global variables
export let globalSeed = Math.floor(Math.random() * 1000000);
export const biomeTypes = ['forest', 'desert', 'mountains', 'plains'];

// Terrain state
export let terrain = {};
export let chunkLoadingQueue = [];
export let processingChunk = false;
export let chunkCache = {};
export const maxCachedChunks = 500;

// Chunk settings
export const chunkSize = 16;
export const chunkHeight = 64;
export const renderDistance = 3;
export const chunkRenderDistance = {
    minimum: 1,     // Minimum render distance (closest to player)
    ideal: 2,       // Standard render distance
    maximum: 3,     // Maximum render distance for high-end devices
    preloadFar: 4   // Distance to preload chunks in player movement direction
};

// Noise generators
let simplex;
let simplexHeight;
let simplexRiver;
let simplexBiome;

// Biome-specific parameters
export const biomeParams = {
    forest: {
        baseHeight: 20,
        heightVariation: 8,
        roughness: 0.5,
        treeFrequency: 0.05,
        treeDensity: 0.7,
        primaryBlock: 'grass',
        secondaryBlock: 'dirt',
        underwaterBlock: 'dirt',
        deepBlock: 'stone'
    },
    desert: {
        baseHeight: 15,
        heightVariation: 10,
        roughness: 0.7,
        duneFrequency: 0.1,
        cactiFrequency: 0.01,
        primaryBlock: 'sand',
        secondaryBlock: 'sand_dark',
        underwaterBlock: 'sand',
        deepBlock: 'stone',
        // Desert can have different sand variations
        sandVariants: ['sand', 'sand_gold', 'sand_light', 'sand_dark']
    },
    mountains: {
        baseHeight: 25,
        heightVariation: 30,
        roughness: 0.9,
        snowLevel: 40,
        rockinessThreshold: 0.6,
        primaryBlock: 'stone',
        secondaryBlock: 'dirt',
        topBlock: 'grass',
        snowBlock: 'snow',
        underwaterBlock: 'dirt',
        deepBlock: 'stone'
    },
    plains: {
        baseHeight: 18,
        heightVariation: 4,
        roughness: 0.3,
        grassVariation: 0.7,
        lakeFrequency: 0.02,
        primaryBlock: 'grass',
        secondaryBlock: 'dirt',
        underwaterBlock: 'dirt',
        deepBlock: 'stone'
    }
};

// Initialize terrain system
export function initTerrain() {
    console.log("Initializing terrain system with seed:", globalSeed);
    
    // Initialize noise generators with seed
    simplex = new SimplexNoise(globalSeed.toString());
    simplexHeight = new SimplexNoise((globalSeed + 1).toString());
    simplexRiver = new SimplexNoise((globalSeed + 2).toString());
    simplexBiome = new SimplexNoise((globalSeed + 3).toString());
    
    // Initialize global variables
    window.terrain = terrain;
    window.chunkLoadingQueue = chunkLoadingQueue;
    window.chunkSize = chunkSize;
    window.chunkRenderDistance = chunkRenderDistance;
    window.maxCachedChunks = maxCachedChunks;
    window.chunkCache = chunkCache;
    window.findGroundLevel = findGroundLevel;
    window.disposeChunk = disposeChunk;
    window.recordChunkModification = recordChunkModification;
    
    // For debugging
    console.log("Terrain system initialized");
}

// Generate terrain around player
export function generateTerrain() {
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // Clear any existing queue
    chunkLoadingQueue = [];
    window.chunkLoadingQueue = chunkLoadingQueue;
    
    // Generate chunks in order from nearest to farthest (concentric squares)
    for (let distance = 0; distance <= chunkRenderDistance.maximum; distance++) {
        // Generate the perimeter of a square at the current distance
        for (let dx = -distance; dx <= distance; dx++) {
            for (let dz = -distance; dz <= distance; dz++) {
                // Only consider positions exactly at the current distance
                // This ensures we're only adding the perimeter, not filling the square
                if (Math.max(Math.abs(dx), Math.abs(dz)) === distance) {
                    const chunkX = playerChunkX + dx;
                    const chunkZ = playerChunkZ + dz;
                    const chunkKey = `${chunkX},${chunkZ}`;
                    
                    // Check if chunk already exists at this position
                    if (!terrain[chunkKey]) {
                        // First check cache
                        if (chunkCache[chunkKey]) {
                            // Retrieve from cache and add to scene
                            console.log(`Retrieving chunk ${chunkKey} from cache`);
                            terrain[chunkKey] = chunkCache[chunkKey];
                            scene.add(terrain[chunkKey]);
                            
                            // Remove from cache
                            delete chunkCache[chunkKey];
                        } else {
                            // Add to loading queue
                            chunkLoadingQueue.push({x: chunkX, z: chunkZ});
                        }
                    }
                }
            }
        }
    }
    
    // If player has spawned, adjust unload logic
    if (player.spawned) {
        // Unload chunks that are too far away
        for (const chunkKey in terrain) {
            const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
            const distanceX = Math.abs(chunkX - playerChunkX);
            const distanceZ = Math.abs(chunkZ - playerChunkZ);
            const maxDistance = Math.max(distanceX, distanceZ);
            
            if (maxDistance > chunkRenderDistance.maximum) {
                // Remove chunk from scene
                const chunk = terrain[chunkKey];
                scene.remove(chunk);
                
                // Cache chunk for potential reuse
                if (Object.keys(chunkCache).length < maxCachedChunks) {
                    chunkCache[chunkKey] = chunk;
                } else {
                    // If cache is full, dispose this chunk completely
                    disposeChunk(chunk);
                }
                
                delete terrain[chunkKey];
            }
        }
    }
    
    console.log(`Terrain generation queued ${chunkLoadingQueue.length} chunks`);
    window.chunkLoadingQueue = chunkLoadingQueue;
    
    return terrain;
}

// Process the chunk loading queue
export function processChunkQueue() {
    if (chunkLoadingQueue.length === 0 || processingChunk) {
        return;
    }
    
    processingChunk = true;
    window.processingChunk = true;
    
    // Grab the next chunk from the queue
    const chunkData = chunkLoadingQueue.shift();
    const { x, z } = chunkData;
    
    // Generate the chunk
    setTimeout(() => {
        try {
            const chunk = createChunk(x, z);
            terrain[`${x},${z}`] = chunk;
            scene.add(chunk);
            
            // If this is the player's chunk and they're still spawning, move them to ground
            const playerChunkX = Math.floor(player.position.x / chunkSize);
            const playerChunkZ = Math.floor(player.position.z / chunkSize);
            
            if (player.isSpawning && x === playerChunkX && z === playerChunkZ) {
                movePlayerToGround();
            }
        } catch (e) {
            console.error("Error generating chunk:", e);
        }
        
        processingChunk = false;
        window.processingChunk = false;
    }, 0); // Using setTimeout with 0 delay to avoid blocking the main thread
}

// Create a single chunk
function createChunk(chunkX, chunkZ) {
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `chunk_${chunkX}_${chunkZ}`;
    chunkGroup.blockPositions = {}; // Store block positions and types
    
    // Keep track of modifications
    chunkGroup.modifications = {};
    
    // Reference to the chunk's position
    chunkGroup.chunkX = chunkX;
    chunkGroup.chunkZ = chunkZ;
    
    // Calculate absolute position of chunk corner
    const xOffset = chunkX * chunkSize;
    const zOffset = chunkZ * chunkSize;
    
    // Generate blocks for this chunk
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            // Get world coordinates
            const worldX = xOffset + x;
            const worldZ = zOffset + z;
            
            // Get biome and height at this position
            const localBiome = getBiomeAt(worldX, worldZ);
            const height = getHeightAt(worldX, worldZ, localBiome);
            
            // Generate column of blocks
            generateBlockColumn(worldX, worldZ, height, localBiome, chunkGroup);
        }
    }
    
    // Add fade-in effect for new chunks
    chunkGroup.material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0
    });
    
    chunkGroup.fadeTarget = 1.0;
    chunkGroup.currentOpacity = 0;
    
    return chunkGroup;
}

// Generate a column of blocks at the given position
function generateBlockColumn(x, z, height, biome, chunkGroup) {
    const params = biomeParams[biome];
    
    // Determine sea level
    const seaLevel = 16;
    
    // Round height to get clean blocks
    const blockHeight = Math.round(height);
    
    // Generate the column from bottom to top
    for (let y = 0; y <= blockHeight; y++) {
        let blockType;
        
        // Select block type based on biome and depth
        if (y < blockHeight - 3) {
            blockType = params.deepBlock;
        } else if (y < blockHeight - 1) {
            blockType = params.secondaryBlock;
        } else {
            // Top block depends on biome
            if (biome === 'mountains' && y > params.snowLevel) {
                blockType = params.snowBlock;
            } else if (biome === 'mountains' && Math.random() < params.rockinessThreshold) {
                blockType = params.primaryBlock; // More stone exposed in mountains
            } else {
                blockType = params.primaryBlock;
            }
            
            // Desert special case - different sand variants
            if (biome === 'desert' && blockType === 'sand') {
                // Use noise to determine sand variant
                const sandNoiseValue = simplex.noise2D(x * 0.05, z * 0.05);
                
                if (sandNoiseValue > 0.6) {
                    blockType = 'sand_light';
                } else if (sandNoiseValue < -0.6) {
                    blockType = 'sand_dark';
                } else if (sandNoiseValue > 0.2) {
                    blockType = 'sand_gold';
                }
            }
        }
        
        // Underwater blocks
        if (blockHeight < seaLevel && y > blockHeight) {
            blockType = 'water';
        }
        
        // Generate block
        createBlock(x, y, z, blockType, chunkGroup);
        
        // Store block in chunk data
        const posKey = `${x},${y},${z}`;
        chunkGroup.blockPositions[posKey] = {
            type: blockType,
            index: Object.keys(chunkGroup.blockPositions).length
        };
    }
    
    // Add biome-specific features
    if (biome === 'forest' && Math.random() < params.treeFrequency) {
        generateTree(x, blockHeight + 1, z, chunkGroup);
    } else if (biome === 'desert' && Math.random() < params.cactiFrequency) {
        generateCactus(x, blockHeight + 1, z, chunkGroup);
    }
}

// Generate a tree at the specified position
function generateTree(x, y, z, chunkGroup) {
    // Don't place trees at chunk edges to avoid incomplete trees
    if (x % chunkSize <= 1 || x % chunkSize >= chunkSize - 2 ||
        z % chunkSize <= 1 || z % chunkSize >= chunkSize - 2) {
        return;
    }
    
    // Tree trunk
    const trunkHeight = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < trunkHeight; i++) {
        createBlock(x, y + i, z, 'wood', chunkGroup);
        
        // Store block in chunk data
        const posKey = `${x},${y + i},${z}`;
        chunkGroup.blockPositions[posKey] = {
            type: 'wood',
            index: Object.keys(chunkGroup.blockPositions).length
        };
    }
    
    // Tree leaves
    const leafRadius = 2;
    for (let dx = -leafRadius; dx <= leafRadius; dx++) {
        for (let dz = -leafRadius; dz <= leafRadius; dz++) {
            for (let dy = 0; dy <= 2; dy++) {
                // Skip corners for a more rounded shape
                if (Math.abs(dx) === leafRadius && Math.abs(dz) === leafRadius) {
                    continue;
                }
                
                // Leave some random gaps
                if (Math.random() < 0.2) {
                    continue;
                }
                
                // Create leaves
                createBlock(x + dx, y + trunkHeight - 1 + dy, z + dz, 'grass', chunkGroup);
                
                // Store block in chunk data
                const posKey = `${x + dx},${y + trunkHeight - 1 + dy},${z + dz}`;
                chunkGroup.blockPositions[posKey] = {
                    type: 'grass',
                    index: Object.keys(chunkGroup.blockPositions).length
                };
            }
        }
    }
}

// Generate a cactus at the specified position
function generateCactus(x, y, z, chunkGroup) {
    // Make cactus height between 2-4 blocks
    const height = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < height; i++) {
        createBlock(x, y + i, z, 'cactus', chunkGroup);
        
        // Store block in chunk data
        const posKey = `${x},${y + i},${z}`;
        chunkGroup.blockPositions[posKey] = {
            type: 'cactus',
            index: Object.keys(chunkGroup.blockPositions).length
        };
    }
}

// Get the biome at a specific position
function getBiomeAt(x, z) {
    // If the game has a current biome setting, use that
    if (currentBiome && biomeTypes.includes(currentBiome)) {
        return currentBiome;
    }
    
    // Otherwise use noise to determine biome
    const biomeNoise = simplexBiome.noise2D(x * 0.005, z * 0.005);
    
    // Map noise value to biome
    if (biomeNoise > 0.6) {
        return 'mountains';
    } else if (biomeNoise > 0.2) {
        return 'forest';
    } else if (biomeNoise < -0.5) {
        return 'desert';
    } else {
        return 'plains';
    }
}

// Get terrain height at a specific position
function getHeightAt(x, z, biome) {
    const params = biomeParams[biome];
    
    // Base terrain using 2D noise (normalized to -1 to 1)
    const baseNoise = simplexHeight.noise2D(x * 0.01, z * 0.01) * 0.5 + 0.5;
    
    // Detail terrain using 2D noise at higher frequency
    const detailNoise = simplex.noise2D(x * 0.05, z * 0.05) * 0.25 + 0.25;
    
    // Combine base and detail noise
    let height = baseNoise * detailNoise;
    
    // Scale by biome parameters
    height = params.baseHeight + height * params.heightVariation * params.roughness;
    
    // Add biome-specific features
    if (biome === 'desert') {
        // Desert dunes
        const duneNoise = simplex.noise2D(x * 0.03, z * 0.03);
        height += duneNoise * 3 * params.duneFrequency;
    } else if (biome === 'mountains') {
        // Sharper peaks for mountains
        const peakNoise = Math.abs(simplex.noise2D(x * 0.02, z * 0.02));
        height += Math.pow(peakNoise, 1.5) * 20;
    } else if (biome === 'plains') {
        // Flatter terrain with occasional hills
        const hillNoise = simplex.noise2D(x * 0.02, z * 0.02);
        if (hillNoise > 0.7) {
            height += (hillNoise - 0.7) * 10;
        }
    }
    
    // Add large-scale river system
    const riverNoise = Math.abs(simplexRiver.noise2D(x * 0.008, z * 0.008));
    if (riverNoise < 0.05) {
        // Scale depth by distance from river center
        const riverDepth = 10 * (0.05 - riverNoise) / 0.05;
        height -= riverDepth;
    }
    
    return height;
}

// Find ground level at a specific position
export function findGroundLevel(x, z) {
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / chunkSize);
    const chunkZ = Math.floor(z / chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Check if the chunk exists
    if (terrain[chunkKey]) {
        // Search from top down for the first solid block
        for (let y = chunkHeight - 1; y >= 0; y--) {
            const posKey = `${x},${y},${z}`;
            if (terrain[chunkKey].blockPositions[posKey]) {
                return y;
            }
        }
    }
    
    // If chunk doesn't exist or no ground found, use noise function
    const biome = getBiomeAt(x, z);
    const height = Math.floor(getHeightAt(x, z, biome));
    return height;
}

// Find a safe spawn point for the player
export function findSafeSpawnPoint() {
    // Use current biome
    const biome = currentBiome || 'forest';
    
    // Find a relatively flat area based on biome
    let spawnX, spawnZ, spawnY;
    let attempts = 0;
    let maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        // Start at random position
        spawnX = (Math.random() - 0.5) * 100;
        spawnZ = (Math.random() - 0.5) * 100;
        
        // Check flatness by sampling points around this position
        let isFlat = true;
        const sampleRadius = 3;
        const centerHeight = getHeightAt(spawnX, spawnZ, biome);
        
        for (let dx = -sampleRadius; dx <= sampleRadius; dx += 2) {
            for (let dz = -sampleRadius; dz <= sampleRadius; dz += 2) {
                const sampleHeight = getHeightAt(spawnX + dx, spawnZ + dz, biome);
                if (Math.abs(sampleHeight - centerHeight) > 2) {
                    isFlat = false;
                    break;
                }
            }
            if (!isFlat) break;
        }
        
        // If flat and above water level, use this position
        if (isFlat && centerHeight > 18) {
            spawnY = centerHeight + 2; // 2 blocks above ground
            break;
        }
        
        attempts++;
    }
    
    // If could not find a good spot, use a default
    if (attempts >= maxAttempts) {
        console.warn("Could not find a suitable spawn point, using default");
        spawnX = 0;
        spawnZ = 0;
        spawnY = 50; // Start high and let gravity pull player down
    }
    
    // Set player position to spawn point
    player.position.set(spawnX, spawnY, spawnZ);
    player.velocity.set(0, 0, 0);
    player.spawnHeight = spawnY;
    updatePlayerCamera();
    
    console.log(`Player spawned at ${spawnX.toFixed(2)}, ${spawnY.toFixed(2)}, ${spawnZ.toFixed(2)}`);
    
    // Set chunk position
    player.lastChunkX = Math.floor(spawnX / chunkSize);
    player.lastChunkZ = Math.floor(spawnZ / chunkSize);
    
    return { x: spawnX, y: spawnY, z: spawnZ };
}

// Dispose a chunk and free its resources
export function disposeChunk(chunk) {
    if (!chunk || !chunk.children) return;
    
    // Dispose of geometries and materials
    for (let i = chunk.children.length - 1; i >= 0; i--) {
        const child = chunk.children[i];
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
            } else {
                child.material.dispose();
            }
        }
    }
    
    // Clear references to help garbage collection
    chunk.blockPositions = null;
    chunk.modifications = null;
}

// Record a modification to a chunk (block added/removed)
export function recordChunkModification(x, y, z, action, blockType) {
    // Determine which chunk this block belongs to
    const chunkX = Math.floor(x / chunkSize);
    const chunkZ = Math.floor(z / chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Make sure chunk exists
    if (!terrain[chunkKey]) return;
    
    // Initialize modifications if needed
    if (!terrain[chunkKey].modifications) {
        terrain[chunkKey].modifications = {};
    }
    
    // Record the modification
    const posKey = `${x},${y},${z}`;
    terrain[chunkKey].modifications[posKey] = {
        action: action,
        blockType: blockType,
        timestamp: Date.now()
    };
    
    console.log(`Recorded modification: ${action} at ${posKey}`);
} 