import {
	CHUNK_SIZE,
	blockMaterials,
	blockGeometry as globalBlockGeometry,
} from "../config.js";
import {
	getTerrainHeight,
	createTreeAt,
	createBiomeFeatures,
} from "./terrainGenerator.js"; // Assuming createTree is refactored
import { terrain as worldManagerTerrain } from "./worldManager.js"; // Import terrain

// Global cache object, as it's shared across modules implicitly in original code
// This is a common way to handle it if not using a more formal state management
window.chunkCache = window.chunkCache || {};

export function generateChunk(
	chunkX,
	chunkZ,
	scene,
	simplex,
	currentBiome,
	player,
	modifications,
	priority = 0,
	fadeIn = true
) {
	const chunkKey = `${chunkX},${chunkZ}`;

	// If there are modifications for this chunk, we should NOT use the cache,
	// as the cached version might be stale regarding these modifications.
	// We must regenerate to ensure modifications are applied correctly.
	const hasPendingModifications =
		modifications && Object.keys(modifications).length > 0;

	if (
		worldManagerTerrain &&
		worldManagerTerrain[chunkKey] &&
		!hasPendingModifications
	) {
		// Chunk already exists in active terrain AND has no pending modifications to re-apply.
		// This case should ideally not be hit if called for a dirty chunk rebuild, as it would have been deleted from terrain.
		// However, if generateTerrainAroundPlayer calls this for an already existing clean chunk, return it.
		// console.log(`Chunk ${chunkKey} already exists in terrain and is clean, skipping generation.`);
		return worldManagerTerrain[chunkKey];
	}

	// Only attempt to load from cache if there are NO pending modifications for this chunk.
	if (!hasPendingModifications && isChunkInCache(chunkX, chunkZ)) {
		const cachedChunk = getChunkFromCache(chunkX, chunkZ);
		if (cachedChunk) {
			// console.log(`Restoring cached chunk: ${chunkKey} (no pending modifications)`);
			scene.add(cachedChunk);
			worldManagerTerrain[chunkKey] = cachedChunk;

			cachedChunk.userData = cachedChunk.userData || {};
			cachedChunk.userData.lastAccessed = Date.now(); // Update access time
			cachedChunk.userData.chunkX = chunkX; // Ensure these are set
			cachedChunk.userData.chunkZ = chunkZ;

			// If fadeIn is requested for a cached chunk, set it up for fading
			if (fadeIn) {
				cachedChunk.visible = true;
				cachedChunk.userData.fadeState = "in";
				cachedChunk.userData.fadeProgress = 0;
				cachedChunk.userData.fadeSpeed = 0.05; // Slower fade for cached
				cachedChunk.traverse((object) => {
					if (object.material) {
						object.material.transparent = true;
						object.material.opacity = 0;
						object.material.needsUpdate = true;
					}
				});
			} else {
				cachedChunk.userData.fadeState = "visible";
				cachedChunk.userData.fadeProgress = 1;
				cachedChunk.traverse((object) => {
					if (object.material) {
						object.material.transparent = false;
						object.material.opacity =
							object.material._originalOpacity !== undefined
								? object.material._originalOpacity
								: 1;
						object.material.needsUpdate = true;
					}
				});
			}
			// NOTE: We are deliberately NOT calling applyChunkModificationsToChunk here
			// because we only loaded from cache if hasPendingModifications was false.
			return cachedChunk;
		}
	}

	// If we reach here, it's because:
	// 1. The chunk was not in active terrain (or had pending modifications).
	// 2. It was not in cache, OR it was in cache but had pending modifications (so we skipped cache).
	// Thus, we proceed to generate the chunk geometry from scratch.

	const chunkGroup = new THREE.Group();
	chunkGroup.blockPositions = {}; // For collision and interaction
	chunkGroup.userData = {
		chunkX: chunkX,
		chunkZ: chunkZ,
		lastAccessed: Date.now(),
		fadeState: fadeIn ? "in" : "visible",
		fadeProgress: fadeIn ? 0 : 1,
		fadeSpeed: 0.1, // Faster fade for new chunks
		fullyLoaded: !fadeIn,
	};

	const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
	const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
	const distanceFromPlayer = Math.max(
		Math.abs(chunkX - playerChunkX),
		Math.abs(chunkZ - playerChunkZ)
	);

	const blocksByMaterial = {};

	function addToBatch(worldX, y, worldZ, blockType) {
		if (!blocksByMaterial[blockType]) blocksByMaterial[blockType] = [];
		blocksByMaterial[blockType].push({ x: worldX, y, z: worldZ });
		chunkGroup.blockPositions[`${worldX},${y},${worldZ}`] = { type: blockType };
	}

	for (let x = 0; x < CHUNK_SIZE; x++) {
		for (let z = 0; z < CHUNK_SIZE; z++) {
			const worldX = chunkX * CHUNK_SIZE + x;
			const worldZ = chunkZ * CHUNK_SIZE + z;
			const height = getTerrainHeight(worldX, worldZ, currentBiome, simplex);
			const renderDepth =
				distanceFromPlayer === 0 ? 8 : distanceFromPlayer <= 2 ? 4 : 2; // Simplified LOD

			for (let y = height; y > height - renderDepth && y >= 0; y--) {
				const worldPosKey = `${worldX},${y},${worldZ}`;
				if (modifications && modifications[worldPosKey]) {
					const mod = modifications[worldPosKey];
					if (mod.action === "add")
						addToBatch(worldX, y, worldZ, mod.blockType);
					continue;
				}

				let blockType;
				if (y === height) {
					// Surface block
					switch (currentBiome) {
						case "desert":
							const sandNoise = simplex.noise2D(worldX * 0.05, worldZ * 0.05);
							if (sandNoise > 0.6) blockType = "sand_light";
							else if (sandNoise < -0.6) blockType = "sand_dark";
							else blockType = "sand";
							break;
						case "mountains":
							if (y > 55) blockType = "snow";
							else if (y > 35) blockType = "stone";
							else blockType = y > 25 ? "dirt" : "grass";
							break;
						case "plains":
							const riverNoise = Math.abs(
								simplex.noise2D(worldX * 0.02, worldZ * 0.02)
							);
							if (riverNoise < 0.05 && y <= 8) blockType = "water";
							else if (y === 8 && riverNoise < 0.05)
								blockType = "sand"; // River bed
							else if (riverNoise < 0.12 && y < 11)
								blockType = "dirt"; // Riverbank
							else blockType = "grass";
							break;
						case "forest":
						default:
							blockType = "grass";
							if (Math.random() < 0.05) blockType = "dirt"; // Occasional dirt patches
							break;
					}
				} else if (y > height - 4) {
					// Subsurface
					if (currentBiome === "desert") blockType = "sand";
					else if (currentBiome === "mountains")
						blockType = y > 35 ? "stone" : "dirt";
					else blockType = "dirt";
				} else {
					// Deep layers
					blockType = "stone";
				}
				if (blockType) addToBatch(worldX, y, worldZ, blockType);
			}
			// Add biome features (trees, cacti, etc.)
			createBiomeFeatures(
				worldX,
				height,
				worldZ,
				currentBiome,
				simplex,
				chunkGroup,
				distanceFromPlayer,
				addToBatch,
				modifications
			);
		}
	}

	for (const [type, positions] of Object.entries(blocksByMaterial)) {
		if (positions.length === 0 || !blockMaterials[type]) continue;

		const finalPositionsForType = [];
		for (const pos of positions) {
			const worldPosKey = `${pos.x},${pos.y},${pos.z}`;
			// Check the FINAL block type in blockPositions
			// Ensure that the block at this position in the authoritative blockPositions map
			// is indeed of the current material type we are batching.
			// This handles cases where a feature (like a tree trunk) overwrote a base terrain block.
			if (chunkGroup.blockPositions[worldPosKey] && chunkGroup.blockPositions[worldPosKey].type === type) {
				finalPositionsForType.push(pos);
			}
		}

		if (finalPositionsForType.length === 0) continue; // Skip if no blocks of this type remain after feature overwrites

		const material = blockMaterials[type].clone(); // Clone to allow individual fade
		if (fadeIn) {
			material.transparent = true;
			material.opacity = 0;
		}
		const instancedMesh = new THREE.InstancedMesh(
			globalBlockGeometry,
			material,
			finalPositionsForType.length // Use length of filtered positions
		);
		instancedMesh.userData.blockType = type; // Store blockType in userData
		instancedMesh.userData.isInstanced = true; // Mark it as an instanced mesh for easier identification

		const matrix = new THREE.Matrix4();
		for (let i = 0; i < finalPositionsForType.length; i++) { // Iterate filtered positions
			const pos = finalPositionsForType[i];
			matrix.setPosition(pos.x, pos.y, pos.z);
			instancedMesh.setMatrixAt(i, matrix);
		}
		instancedMesh.instanceMatrix.needsUpdate = true;
		chunkGroup.add(instancedMesh);
	}

	scene.add(chunkGroup);
	return chunkGroup;
}

export function disposeChunk(chunk, scene) {
	if (!chunk) return;
	scene.remove(chunk); // Ensure it's removed from scene first
	chunk.traverse((object) => {
		if (object.geometry) {
			// Only dispose geometry if it's NOT the global shared blockGeometry.
			// Assumes features like trees will have their own unique geometry instances.
			if (object.geometry !== globalBlockGeometry) {
				object.geometry.dispose();
			}
		}
		if (object.material) {
			if (Array.isArray(object.material)) {
				object.material.forEach((mat) => mat.dispose());
			} else {
				object.material.dispose();
			}
		}
	});
	chunk.children.length = 0;
	if (chunk.blockPositions) chunk.blockPositions = {};
}

export function updateChunkFades(delta, terrain, scene) {
	Object.keys(terrain).forEach((chunkKey) => {
		const chunk = terrain[chunkKey];
		if (!chunk || !chunk.userData) return;

		const ud = chunk.userData;
		if (ud.fadeState === "in" && ud.fadeProgress < 1) {
			ud.fadeProgress = Math.min(
				1,
				ud.fadeProgress + ud.fadeSpeed * delta * 20
			); // Adjust speed
			chunk.traverse(applyOpacityToMaterial(ud.fadeProgress));
			if (ud.fadeProgress === 1) {
				ud.fadeState = "visible";
				ud.fullyLoaded = true;
				chunk.traverse(finalizeMaterialOpacity);
			}
		} else if (ud.fadeState === "out" && ud.fadeProgress > 0) {
			ud.fadeProgress = Math.max(
				0,
				ud.fadeProgress - ud.fadeSpeed * delta * 40
			); // Faster fade out
			chunk.traverse(applyOpacityToMaterial(ud.fadeProgress));
			if (ud.fadeProgress === 0) {
				if (ud.targetCache) {
					addChunkToCache(ud.chunkX, ud.chunkZ, chunk); // Use helper
				} else {
					disposeChunk(chunk, scene);
				}
				delete terrain[chunkKey]; // Remove from active terrain
			}
		}
	});
}

const applyOpacityToMaterial = (opacity) => (object) => {
	if (object.material) {
		object.material.transparent = true; // Keep transparent during fade
		object.material.opacity =
			opacity *
			(object.material._originalOpacity !== undefined
				? object.material._originalOpacity
				: 1);
		object.material.needsUpdate = true;
	}
};

const finalizeMaterialOpacity = (object) => {
	if (object.material) {
		const originalOpacity =
			object.material._originalOpacity !== undefined
				? object.material._originalOpacity
				: 1;
		object.material.opacity = originalOpacity;
		// Only set transparent to false if original was fully opaque and not water etc.
		if (
			originalOpacity >= 1 &&
			object.material.color.getHexString() !==
				blockMaterials.water.color.getHexString()
		) {
			object.material.transparent = false;
		}
		object.material.needsUpdate = true;
	}
};

export function applyChunkModificationsToChunk(chunkGroup, modifications) {
	if (!modifications || !chunkGroup || !chunkGroup.blockPositions) return;
	// console.log(`Applying ${Object.keys(modifications).length} modifications to chunk ${chunkGroup.userData.chunkX},${chunkGroup.userData.chunkZ}`);

	// This is complex because modifications might need to alter instanced meshes.
	// For simplicity, if a chunk has modifications, it might be easier to regenerate it
	// or have a separate system for modified blocks that are not part of instanced mesh.
	// The current `generateChunk` checks modifications before creating blocks.
	// When loading from cache, if it has modifications, it should ideally be "dirty" and rebuilt.
	// A simpler approach for cached chunks: if modified, remove from cache and let it regenerate.
	// This function is called when loading from cache.
	// The provided code does not have a robust way to alter instanced meshes post-creation.
	// So, if a cached chunk had modifications, it should be re-generated by not returning it from cache.
	// The `generateChunk` function already handles `modifications` when building a new chunk.
}

export function isChunkInCache(chunkX, chunkZ) {
	const key = `${chunkX},${chunkZ}`;
	return !!window.chunkCache[key];
}

export function addChunkToCache(chunkX, chunkZ, chunk) {
	if (!chunk || !chunk.isObject3D) {
		console.error("Attempted to cache invalid chunk object.");
		return false;
	}
	const key = `${chunkX},${chunkZ}`;
	if (window.chunkCache[key]) {
		// console.warn(`Chunk ${key} already in cache. Overwriting.`);
		// Potentially dispose old one if different instance
	}

	// Ensure userData is initialized
	chunk.userData = chunk.userData || {};
	chunk.userData.chunkX = chunkX;
	chunk.userData.chunkZ = chunkZ;
	chunk.userData.lastAccessed = Date.now();

	// Reset materials for caching
	chunk.traverse((object) => {
		if (object.material) {
			object.material.opacity =
				object.material._originalOpacity !== undefined
					? object.material._originalOpacity
					: 1;
			if (
				object.material.opacity >= 1 &&
				object.material.color.getHexString() !==
					blockMaterials.water.color.getHexString()
			) {
				object.material.transparent = false;
			}
			object.material.needsUpdate = true;
		}
	});

	window.chunkCache[key] = chunk;
	// console.log(`Added chunk ${key} to cache. Cache size: ${Object.keys(window.chunkCache).length}`);
	updateCacheUIDisplay();
	return true;
}

export function getChunkFromCache(chunkX, chunkZ) {
	const key = `${chunkX},${chunkZ}`;
	const chunk = window.chunkCache[key];
	if (chunk) {
		delete window.chunkCache[key];
		// console.log(`Retrieved chunk ${key} from cache. Cache size: ${Object.keys(window.chunkCache).length}`);
		updateCacheUIDisplay();
		return chunk;
	}
	return null;
}

export function pruneChunkCache(maxCachedChunks) {
	const cacheSize = Object.keys(window.chunkCache).length;
	if (cacheSize <= maxCachedChunks) return;

	// console.log(`Pruning chunk cache. Current size: ${cacheSize}, Max: ${maxCachedChunks}`);
	const chunksArray = Object.entries(window.chunkCache).map(([key, chunk]) => ({
		key,
		chunk,
		lastAccessed: chunk.userData ? chunk.userData.lastAccessed || 0 : 0,
	}));

	chunksArray.sort((a, b) => a.lastAccessed - b.lastAccessed); // Oldest first

	const toRemoveCount = cacheSize - maxCachedChunks;
	for (let i = 0; i < toRemoveCount; i++) {
		if (chunksArray[i]) {
			// console.log(`Removing old chunk from cache: ${chunksArray[i].key}`);
			disposeChunk(
				chunksArray[i].chunk,
				window.gameModules.renderer.getScene()
			); // Assuming scene is accessible
			delete window.chunkCache[chunksArray[i].key];
		}
	}
	updateCacheUIDisplay();
}

export function resetCacheSystemForBiomeChange() {
	console.log("Resetting chunk cache for biome change...");
	Object.keys(window.chunkCache).forEach((key) => {
		disposeChunk(
			window.chunkCache[key],
			window.gameModules.renderer.getScene()
		); // Assuming scene access
		delete window.chunkCache[key];
	});
	window.chunkCache = {};
	updateCacheUIDisplay();
}

export function updateCacheUIDisplay() {
	const cacheDisplay = document.getElementById("cacheDisplay");
	const queueDisplay = document.getElementById("queueDisplay");
	const chunkCountDisplay = document.getElementById("chunkCountDisplay");

	if (cacheDisplay)
		cacheDisplay.textContent = `Cached: ${
			Object.keys(window.chunkCache || {}).length
		}`;
	if (queueDisplay)
		queueDisplay.textContent = `Queue: ${
			window.gameModules.worldManager
				? window.gameModules.worldManager.chunkLoadingQueue.length
				: 0
		}`;
	if (chunkCountDisplay)
		chunkCountDisplay.textContent = `Chunks: ${
			Object.keys(worldManagerTerrain || {}).length
		}`;
}

function chunkXToKey(x) {
	// Helper if needed, but direct key usage is fine
	return x;
}
