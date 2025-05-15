importScripts('../libs/simplex-noise.js');

// We'll need to duplicate or make accessible some configurations and helper functions here,
// as workers don't share the main thread's scope directly.
// For simplicity, some might be redefined or passed in initial config.

// --- Configuration (Simplified - ideally passed from main thread or in a shared config loaded by worker) ---
const CHUNK_SIZE = 16; // Example, should match main config

// Placeholder for block material types (just for structure, actual materials are on main thread)
const blockTypes = {
    grass: 1,
    dirt: 2,
    stone: 3,
    wood: 4,
    sand: 5,
    cactus: 6,
    sand_light: 7,
    snow: 8,
    water: 9,
    leaves: 10, // Added leaves
    // ... other block types
};

let noise2D = null; // Changed from simplex to noise2D, as we'll get a specific function

// --- Terrain Generation Logic (Adapted from terrainGenerator.js) ---
// These functions will be simplified or made self-contained for the worker.
// We need getTerrainHeight and a simplified createBiomeFeatures that just returns block data.

function getTerrainHeight(x, z, biome, localNoise2DFn) {
    // This function's code would be copied or adapted from terrainGenerator.js
    // For now, a placeholder:
    if (!localNoise2DFn) return 10; // Should not happen if initialized

    const scale1 = biome === "mountains" ? 0.02 : 0.01;
    const scale2 = biome === "plains" ? 0.03 : 0.05;

    switch (biome) {
        case "desert":
            return (
                7 +
                Math.floor(
                    8 *
                        (0.8 * localNoise2DFn(x * 0.01, z * 0.01) +
                            0.2 *
                                localNoise2DFn(x * 0.05, z * 0.05) *
                                Math.pow(Math.abs(localNoise2DFn(x * 0.002, z * 0.002)), 0.7))
                )
            );
        case "mountains":
            const baseElevation = 20;
            const ridgeNoise = Math.pow(
                Math.abs(localNoise2DFn(x * 0.005, z * 0.005)),
                0.8
            );
            const detailNoise =
                0.6 * localNoise2DFn(x * 0.03, z * 0.03) +
                0.4 * localNoise2DFn(x * 0.08, z * 0.08);
            const peakiness = Math.pow(
                Math.abs(localNoise2DFn(x * 0.001, z * 0.001)),
                0.3
            );
            return (
                baseElevation +
                Math.floor(60 * ridgeNoise * peakiness * (0.8 + 0.4 * detailNoise))
            );
        case "plains":
            const riverNoiseVal = localNoise2DFn(x * 0.02, z * 0.02);
            const riverChannel = Math.abs(riverNoiseVal);
            if (riverChannel < 0.05) return 8; // River level
            if (riverChannel < 0.12) return 9 + Math.floor(riverChannel * 20); // Sloping riverbank
            return (
                11 +
                Math.floor(
                    3 *
                        (0.8 * localNoise2DFn(x * 0.01, z * 0.01) +
                            0.2 * localNoise2DFn(x * 0.04, z * 0.04))
                )
            );
        case "forest":
        default:
            return (
                12 +
                Math.floor(
                    8 *
                        (0.6 * localNoise2DFn(x * 0.01, z * 0.01) +
                            0.4 * localNoise2DFn(x * 0.05, z * 0.05))
                )
            );
    }
}

// Simplified seededRandom for worker if not passed
function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}


function createTreeData(worldX, surfaceY, worldZ, modifications, addBlockFn) {
    const trunkHeight = Math.floor(4 + (Math.abs(worldX * worldZ) % 3));
    for (let i = 0; i < trunkHeight; i++) {
        const y = surfaceY + i;
        const key = `${worldX},${y},${worldZ}`;
        if (!(modifications && modifications[key] && modifications[key].action === "remove")) {
            addBlockFn(worldX, y, worldZ, "wood");
        }
    }
    const leafRadius = 2;
    const leafHeight = 3;
    for (let ly = 0; ly <= leafHeight; ly++) {
        const levelRadius = ly === 0 || ly === leafHeight ? 1 : leafRadius;
        for (let lx = -levelRadius; lx <= levelRadius; lx++) {
            for (let lz = -levelRadius; lz <= levelRadius; lz++) {
                if (Math.abs(lx) === leafRadius && Math.abs(lz) === leafRadius) continue;
                const leafSeed = (worldX + lx) * 1000 + (worldZ + lz) * 10 + ly;
                if (seededRandom(leafSeed)() > 0.8 && Math.abs(lx) === leafRadius && Math.abs(lz) === leafRadius) continue;
                
                const leafX = worldX + lx;
                const leafY = surfaceY + trunkHeight + ly - 1;
                const leafZ = worldZ + lz;
                const key = `${leafX},${leafY},${leafZ}`;
                if (!(modifications && modifications[key] && modifications[key].action === "remove")) {
                    addBlockFn(leafX, leafY, leafZ, "leaves");
                }
            }
        }
    }
}


function createBiomeFeaturesData(worldX, surfaceY, worldZ, biome, localNoise2DFn, modifications, addBlockFn) {
    const featureSeed = worldX * 10000 + worldZ;
    const random = seededRandom(featureSeed);

    if (biome === "forest" && random() < 0.03 && surfaceY > 5) {
        createTreeData(worldX, surfaceY, worldZ, modifications, addBlockFn);
    } else if (biome === "desert") {
        if (random() < 0.02 && surfaceY > 8) {
            const cactusHeight = Math.floor(1 + random() * 3);
            for (let h = 0; h < cactusHeight; h++) {
                 const y = surfaceY + h;
                 const key = `${worldX},${y},${worldZ}`;
                if (!(modifications && modifications[key] && modifications[key].action === "remove")) {
                    addBlockFn(worldX, y, worldZ, "cactus");
                }
            }
        }
        const dunePattern = localNoise2DFn(worldX * 0.03, worldZ * 0.03);
        if (dunePattern > 0.7 && surfaceY > 9) {
            const key = `${worldX},${surfaceY},${worldZ}`;
            if (!(modifications && modifications[key] && modifications[key].action === "remove")) {
                 addBlockFn(worldX, surfaceY, worldZ, "sand_light");
            }
        }
    } else if (biome === "plains") {
        const riverNoise = Math.abs(localNoise2DFn(worldX * 0.02, worldZ * 0.02));
        if (riverNoise >= 0.12 && random() < 0.001 && surfaceY > 10) {
            createTreeData(worldX, surfaceY, worldZ, modifications, addBlockFn);
        }
    }
}


self.onmessage = function(e) {
    const { chunkX, chunkZ, currentBiome, simplexSeed, modifications, viewDistance } = e.data;

    // Initialize simplex noise function for this worker thread if not already.
    // Using SimplexNoise v4.x API
    if (!noise2D) {
        // self.createNoise2D should be available if importScripts worked and the library is v4.x
        if (typeof self.createNoise2D === 'function') {
            // For true seeded randomness with v4, we'd need a PRNG like Alea:
            // Example: const prng = self.Alea ? new self.Alea(simplexSeed) : Math.random;
            // noise2D = self.createNoise2D(prng);
            // For now, using default Math.random seeding from within createNoise2D
            noise2D = self.createNoise2D(); 
        } else {
            console.error("chunkWorker: createNoise2D is not defined! Ensure simplex-noise v4.x is loaded.");
            throw new Error("createNoise2D not available in worker.");
        }
    }
    // Note: The simplexSeed from main thread is not directly used here in the same way as v3.x
    // unless we implement a PRNG like Alea and pass it to createNoise2D.

    const blocksByMaterial = {};

    function addBlockToWorkerBatch(worldX, y, worldZ, blockType) {
        if (!blockTypes[blockType]) {
            // console.warn(`Worker: Unknown block type ${blockType}`);
            return;
        }
        if (!blocksByMaterial[blockType]) {
            blocksByMaterial[blockType] = [];
        }
        blocksByMaterial[blockType].push({ x: worldX, y: y, z: worldZ });
    }
    
    // Simplified distanceFromPlayer for LOD - worker doesn't know exact player pos
    // This could be passed in or approximated if player's current chunk coords are sent.
    // For now, using a fixed render depth or one based on 'viewDistance' tier from main thread.
    const workerRenderDepth = viewDistance === 0 ? 8 : viewDistance <= 2 ? 4 : 2;


    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            
            const surfaceHeight = getTerrainHeight(worldX, worldZ, currentBiome, noise2D);

            for (let y = surfaceHeight; y > surfaceHeight - workerRenderDepth && y >= 0; y--) {
                const worldPosKey = `${worldX},${y},${worldZ}`;
                if (modifications && modifications[worldPosKey]) {
                    const mod = modifications[worldPosKey];
                    if (mod.action === "add" && blockTypes[mod.blockType]) {
                        addBlockToWorkerBatch(worldX, y, worldZ, mod.blockType);
                    }
                    // If action is 'remove', we simply don't add the original block.
                    continue; 
                }

                let blockType;
                // --- Biome block logic (copied/adapted from chunkUtils.generateChunk) ---
                if (y === surfaceHeight) {
                    switch (currentBiome) {
                        case "desert":
                            const sandNoise = noise2D(worldX * 0.05, worldZ * 0.05);
                            if (sandNoise > 0.6) blockType = "sand_light";
                            else if (sandNoise < -0.6) blockType = "sand_dark"; // Assuming sand_dark is defined
                            else blockType = "sand";
                            break;
                        case "mountains":
                            if (y > 55) blockType = "snow";
                            else if (y > 35) blockType = "stone";
                            else blockType = y > 25 ? "dirt" : "grass";
                            break;
                        case "plains":
                            const riverNoise = Math.abs(noise2D(worldX * 0.02, worldZ * 0.02));
                            const riverChannel = Math.abs(riverNoise);
                            if (riverChannel < 0.05 && y <= 8) blockType = "water";
                            else if (y === 8 && riverChannel < 0.05) blockType = "sand";
                            else if (riverChannel < 0.12 && y < 11) blockType = "dirt";
                            else blockType = "grass";
                            break;
                        case "forest":
                        default:
                            blockType = "grass";
                            if (Math.random() < 0.05) blockType = "dirt";
                            break;
                    }
                } else if (y > surfaceHeight - 4) { // Subsurface
                    if (currentBiome === "desert") blockType = "sand";
                    else if (currentBiome === "mountains") blockType = y > 35 ? "stone" : "dirt";
                    else blockType = "dirt";
                } else { // Deep layers
                    blockType = "stone";
                }
                // --- End Biome block logic ---
                if (blockType) {
                    addBlockToWorkerBatch(worldX, y, worldZ, blockType);
                }
            }
            // Add biome features
            createBiomeFeaturesData(worldX, surfaceHeight, worldZ, currentBiome, noise2D, modifications, addBlockToWorkerBatch);
        }
    }

    // Send the generated block data back to the main thread
    self.postMessage({
        chunkX: chunkX,
        chunkZ: chunkZ,
        blocksByMaterial: blocksByMaterial
    });
}; 