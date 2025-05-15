import {
	CHUNK_SIZE,
	// VIEW_DISTANCE_MIN, // Use currentViewDistanceMin instead
	// VIEW_DISTANCE_IDEAL, // Use currentViewDistanceIdeal instead
	// VIEW_DISTANCE_MAX, // Use currentViewDistanceMax instead
	currentViewDistanceMin,
	currentViewDistanceIdeal,
	currentViewDistanceMax,
	VIEW_DISTANCE_PRELOAD_FAR,
	VIEW_DISTANCE_BORDER_EXPANSION,
	MAX_CACHED_CHUNKS,
	DAY_NIGHT_DURATION,
} from "../config.js";
import {
	generateChunk,
	disposeChunk,
	updateChunkFades,
	applyChunkModificationsToChunk,
	isChunkInCache,
	addChunkToCache,
	getChunkFromCache,
	pruneChunkCache,
	resetCacheSystemForBiomeChange,
	updateCacheUIDisplay,
} from "./chunkUtils.js";
import { getPlayerState, getCameraInstance } from "../gameplay/player.js"; // For player position
import { findSafeSpawnPoint } from "./terrainGenerator.js";

export let terrain = {}; // Active chunks in scene
export let chunkLoadingQueue = [];
export let processingChunk = false;
let queuedChunkKeys = new Set(); // Declare queuedChunkKeys
export let currentBiome = "forest"; // Default biome

// For predictive loading
let playerDirection = new THREE.Vector3();
let previousPlayerPosition = new THREE.Vector3();
let lastDirectionUpdateTime = 0;

let chunkModifications = {}; // Player's changes to chunks

export function initWorld(scene, simplex, _currentBiome, _player) {
	currentBiome = _currentBiome; // Ensure currentBiome is set from main
	// `terrain` is managed here.
	// `chunkCache` is managed in chunkUtils.js
	console.log("World Manager Initialized");
}

export function getCurrentBiome() {
	return currentBiome;
}
export function setCurrentBiome(newBiome, player, scene, simplex) {
	const oldBiome = currentBiome;
	currentBiome = newBiome;
	if (oldBiome !== newBiome) {
		console.log(
			`Biome changed from ${oldBiome} to ${newBiome}, clearing cache and modifications.`
		);
		resetCacheSystemForBiomeChange();
		chunkModifications = {};
	}

	// Reset player for safe spawning in new biome
	player.isSpawning = true;
	findSafeSpawnPoint(player, currentBiome, simplex, CHUNK_SIZE); // Pass CHUNK_SIZE

	// Force regeneration of terrain with new biome
	Object.keys(terrain).forEach((chunkKey) => {
		disposeChunk(terrain[chunkKey], scene); // Pass scene
		delete terrain[chunkKey];
	});
	terrain = {};
	chunkLoadingQueue = []; // Clear loading queue
	queuedChunkKeys.clear(); // Clear the set too

	generateTerrainAroundPlayer(player, scene, simplex); // Regenerate
	updateCacheUIDisplay();
}

export function getTerrain() {
	return terrain;
}
export function getChunkModifications() {
	return chunkModifications;
}

export function recordChunkModification(x, y, z, action, blockType = null) {
	const chunkX = Math.floor(x / CHUNK_SIZE);
	const chunkZ = Math.floor(z / CHUNK_SIZE);
	const chunkKey = `${chunkX},${chunkZ}`;
	const posKey = `${x},${y},${z}`;

	if (!chunkModifications[chunkKey]) {
		chunkModifications[chunkKey] = {};
	}
	chunkModifications[chunkKey][posKey] = {
		action,
		blockType,
		timestamp: Date.now(),
	};
}

function updatePlayerDirectionForWorld(player) {
	const now = performance.now();
	if (now - lastDirectionUpdateTime < 500) return;

	if (previousPlayerPosition.distanceToSquared(player.position) > 0.01) {
		playerDirection
			.subVectors(player.position, previousPlayerPosition)
			.normalize();
		previousPlayerPosition.copy(player.position);
		lastDirectionUpdateTime = now;
	} else {
		// If not moving, try to use camera direction
		const camera = getCameraInstance();
		if (camera) {
			camera.getWorldDirection(playerDirection);
			playerDirection.y = 0;
			playerDirection.normalize();
		}
	}
}

export function generateTerrainAroundPlayer(player, scene, simplex) {
	if (player.isSpawning) {
		Object.keys(terrain).forEach((chunkKey) => {
			disposeChunk(terrain[chunkKey], scene);
			delete terrain[chunkKey];
		});
		terrain = {};
		chunkLoadingQueue = [];
		queuedChunkKeys.clear(); // Clear the set too
	}

	const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
	const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

	updatePlayerDirectionForWorld(player);

	const activeChunks = new Set();
	let newChunksAddedToQueue = false;

	// Pass 1: Immediate visibility (Minimum Render Distance)
	for (let x = -currentViewDistanceMin; x <= currentViewDistanceMin; x++) {
		for (let z = -currentViewDistanceMin; z <= currentViewDistanceMin; z++) {
			const chunkX = playerChunkX + x;
			const chunkZ = playerChunkZ + z;
			const chunkKey = `${chunkX},${chunkZ}`;
			activeChunks.add(chunkKey);
			if (!terrain[chunkKey]) { // No need to check queue, this pass is immediate
				const newChunk = generateChunk(
					chunkX,
					chunkZ,
					scene,
					simplex,
					currentBiome,
					player,
					chunkModifications[chunkKey],
					3,
					false
				);
				if (newChunk) terrain[chunkKey] = newChunk;
			} else if (terrain[chunkKey].userData) {
				terrain[chunkKey].userData.lastAccessed = Date.now();
			}
		}
	}

	// Pass 2: Standard visibility (Ideal Render Distance)
	for (let x = -currentViewDistanceIdeal; x <= currentViewDistanceIdeal; x++) {
		for (let z = -currentViewDistanceIdeal; z <= currentViewDistanceIdeal; z++) {
			if (Math.abs(x) <= currentViewDistanceMin && Math.abs(z) <= currentViewDistanceMin)
				continue;
			const chunkX = playerChunkX + x;
			const chunkZ = playerChunkZ + z;
			const chunkKey = `${chunkX},${chunkZ}`;
			activeChunks.add(chunkKey);
			if (!terrain[chunkKey] && !queuedChunkKeys.has(chunkKey)) { // Use Set
				if (addChunkToLoadingQueue(chunkX, chunkZ, 2, true))
					newChunksAddedToQueue = true;
			} else if (terrain[chunkKey] && terrain[chunkKey].userData) {
				terrain[chunkKey].userData.lastAccessed = Date.now();
			}
		}
	}

	// Pass 3: Extended visibility (Maximum Render Distance)
	for (let x = -currentViewDistanceMax; x <= currentViewDistanceMax; x++) {
		for (let z = -currentViewDistanceMax; z <= currentViewDistanceMax; z++) {
			if (
				Math.abs(x) <= currentViewDistanceIdeal &&
				Math.abs(z) <= currentViewDistanceIdeal
			)
				continue;
			const chunkX = playerChunkX + x;
			const chunkZ = playerChunkZ + z;
			const chunkKey = `${chunkX},${chunkZ}`;
			activeChunks.add(chunkKey);
			if (!terrain[chunkKey] && !queuedChunkKeys.has(chunkKey)) { // Use Set
				if (addChunkToLoadingQueue(chunkX, chunkZ, 1, true))
					newChunksAddedToQueue = true;
			} else if (terrain[chunkKey] && terrain[chunkKey].userData) {
				terrain[chunkKey].userData.lastAccessed = Date.now();
			}
		}
	}

	// Pass 4: Look-ahead chunks (Preload Far Distance)
	if (playerDirection.lengthSq() > 0.1) {
		const lookAheadX = Math.round(playerDirection.x * 2);
		const lookAheadZ = Math.round(playerDirection.z * 2);

		for (
			let dist = currentViewDistanceMax + 1;
			dist <= VIEW_DISTANCE_PRELOAD_FAR;
			dist++
		) {
			for (let spread = -1; spread <= 1; spread++) {
				let preloadX, preloadZ;
				if (Math.abs(lookAheadX) > Math.abs(lookAheadZ)) {
					preloadX = playerChunkX + (lookAheadX > 0 ? dist : -dist);
					preloadZ = playerChunkZ + spread;
				} else {
					preloadX = playerChunkX + spread;
					preloadZ = playerChunkZ + (lookAheadZ > 0 ? dist : -dist);
				}
				const chunkKey = `${preloadX},${preloadZ}`;
				activeChunks.add(chunkKey);
				if (!terrain[chunkKey] && !queuedChunkKeys.has(chunkKey)) { // Use Set
					if (addChunkToLoadingQueue(preloadX, preloadZ, 0, true))
						newChunksAddedToQueue = true;
				} else if (terrain[chunkKey] && terrain[chunkKey].userData) {
					terrain[chunkKey].userData.lastAccessed = Date.now();
				}
			}
		}
	}

	// Pass 5: World Border Expansion
	if (detectAndExpandWorldBorder(playerChunkX, playerChunkZ, playerDirection, activeChunks)) { // Pass playerChunkX/Z and direction
		newChunksAddedToQueue = true;
	}

	// Manage chunk hibernation (move to cache or dispose)
	Object.keys(terrain).forEach((chunkKey) => {
		if (!activeChunks.has(chunkKey)) {
			const chunk = terrain[chunkKey];
			if (chunk.userData && chunk.userData.fadeState !== "out") {
				chunk.userData.fadeState = "out";
				chunk.userData.fadeProgress = 1;
				chunk.userData.targetCache = true;
				chunk.traverse((object) => {
					if (object.material) {
						object.material.transparent = true;
						if (
							typeof object.material.opacity === "undefined" ||
							!object.material.hasOwnProperty("_originalOpacity")
						) {
							object.material._originalOpacity = object.material.opacity || 1;
						}
						object.material.needsUpdate = true;
					}
				});
			}
		}
	});

	if (newChunksAddedToQueue) {
		processChunkLoadingQueue(scene, simplex, player);
	}

	if (player.isSpawning) {
		setTimeout(() => {
			const groundY = findGroundLevel(
				player.position.x,
				player.position.z,
				terrain,
				CHUNK_SIZE
			);
			if (groundY !== -1) {
				player.position.y = groundY + 2;
				if (getCameraInstance()) {
					getCameraInstance().position.copy(player.position);
					getCameraInstance().position.y += 1.7;
				}
			}
			player.isSpawning = false;
			player.spawned = true;
			console.log("Player spawned at:", player.position);
		}, 100);
	}
	pruneChunkCacheIfNeeded();
	updateCacheUIDisplay();
}

function addChunkToLoadingQueue(x, z, priority, fadeIn, isBorder = false) {
	const key = `${x},${z}`;
	if (
		terrain[key] ||
		isChunkInCache(x, z) ||
		queuedChunkKeys.has(key) // Use Set for check
	) {
		return false; // Already loaded, in cache, or in queue
	}
	chunkLoadingQueue.push({ x, z, priority, fadeIn, isBorderChunk: isBorder });
	queuedChunkKeys.add(key); // Add to Set
	return true;
}

export function processChunkLoadingQueue(scene, simplex, player) {
	if (processingChunk || chunkLoadingQueue.length === 0) return;

	chunkLoadingQueue.sort((a, b) => {
		if (a.priority !== b.priority) return b.priority - a.priority;
		const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
		const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
		const distA = Math.max(
			Math.abs(a.x - playerChunkX),
			Math.abs(a.z - playerChunkZ)
		);
		const distB = Math.max(
			Math.abs(b.x - playerChunkX),
			Math.abs(b.z - playerChunkZ)
		);
		return distA - distB;
	});

	const nextChunkData = chunkLoadingQueue.shift();
	const chunkKey = `${nextChunkData.x},${nextChunkData.z}`;
	queuedChunkKeys.delete(chunkKey); // Remove from Set

	processingChunk = true;

	setTimeout(() => {
		try {
			if (!terrain[chunkKey]) {
				const mods =
					chunkModifications[chunkKey];
				const newChunk = generateChunk(
					nextChunkData.x,
					nextChunkData.z,
					scene,
					simplex,
					currentBiome,
					player,
					mods,
					nextChunkData.priority,
					nextChunkData.fadeIn
				);
				if (newChunk)
					terrain[chunkKey] = newChunk;
			}
		} catch (error) {
			console.error("Error processing chunk from queue:", error);
		} finally {
			processingChunk = false;
			if (chunkLoadingQueue.length > 0) {
				processChunkLoadingQueue(scene, simplex, player);
			}
		}
	}, 0); // Yield to browser
}

function detectAndExpandWorldBorder(playerChunkX, playerChunkZ, playerDirection, activeChunks) { // Added playerDirection
	const directions = [
		{ x: 1, z: 0 }, { x: -1, z: 0 },
		{ x: 0, z: 1 }, { x: 0, z: -1 },
		// Optional: Add player's current general direction if moving significantly
	];
    // Consider adding player's actual direction to the 'directions' array if they are moving consistently
    // This can make border expansion more targeted towards where the player is heading.
    // Example:
    // if (playerDirection.lengthSq() > 0.5) { // Threshold for consistent movement
    //    const primaryDir = {x: Math.round(playerDirection.x), z: Math.round(playerDirection.z)};
    //    if ((primaryDir.x !== 0 || primaryDir.z !== 0) && !directions.some(d => d.x === primaryDir.x && d.z === primaryDir.z)) {
    //        directions.push(primaryDir);
    //    }
    // }

	let expansionOccurred = false;
	const expansionIndicator = document.getElementById("worldExpansionIndicator");

	directions.forEach((dir) => {
		for (
			let dist = currentViewDistanceMax; // Start checking from max visible distance
			dist <= VIEW_DISTANCE_BORDER_EXPANSION;
			dist++
		) {
			let borderFoundAtThisDist = false;
			for (let spread = -2; spread <= 2; spread++) {
				const checkX = playerChunkX + dir.x * dist + (dir.z !== 0 ? spread : 0);
				const checkZ = playerChunkZ + dir.z * dist + (dir.x !== 0 ? spread : 0);
				const checkKey = `${checkX},${checkZ}`;

				if (
					!terrain[checkKey] &&
					!isChunkInCache(checkX, checkZ) &&
					!queuedChunkKeys.has(checkKey) // Use Set
				) {
					for (
						let expansionDist = dist; // Start from current distance
						expansionDist <= VIEW_DISTANCE_BORDER_EXPANSION;
						expansionDist++
					) {
						for (
							let expansionSpread = -1; // Narrower spread for actual expansion
							expansionSpread <= 1;
							expansionSpread++
						) {
							const newChunkX =
								playerChunkX +
								dir.x * expansionDist +
								(dir.z !== 0 ? expansionSpread : 0);
							const newChunkZ =
								playerChunkZ +
								dir.z * expansionDist +
								(dir.x !== 0 ? expansionSpread : 0);
							if (addChunkToLoadingQueue(newChunkX, newChunkZ, 0, true, true)) {
								activeChunks.add(`${newChunkX},${newChunkZ}`);
								expansionOccurred = true;
							}
						}
					}
					borderFoundAtThisDist = true;
					break; 
				}
			}
			if (borderFoundAtThisDist) break; 
		}
	});

	if (expansionOccurred && expansionIndicator) {
		expansionIndicator.style.display = "block";
		setTimeout(() => {
			expansionIndicator.style.display = "none";
		}, 3000);
	}
	return expansionOccurred;
}

export function updateWorld(delta, scene, simplex, player) {
	updateChunkFades(delta, terrain, scene); // Pass necessary args

	// Check for and rebuild dirty chunks (e.g., after block removal/placement)
	let rebuiltDirtyChunkThisFrame = false;
	for (const chunkKey in terrain) {
		const chunk = terrain[chunkKey];
		if (chunk && chunk.userData && chunk.userData.isDirty) {
			// console.log(`Rebuilding dirty chunk: ${chunkKey}`);
			const chunkX = chunk.userData.chunkX;
			const chunkZ = chunk.userData.chunkZ;

			disposeChunk(chunk, scene); // Dispose old meshes
			delete terrain[chunkKey]; // Remove from active terrain so generateChunk runs fully

			const newChunkInstance = generateChunk(
				chunkX,
				chunkZ,
				scene,
				simplex,
				currentBiome, // currentBiome is available in worldManager's scope
				player,
				chunkModifications[chunkKey], // Get modifications for this chunk
				3, // Priority for rebuild (e.g., high)
				false // No fade-in for instant rebuilds
			);

			if (newChunkInstance) {
				terrain[chunkKey] = newChunkInstance;
				if (terrain[chunkKey].userData) {
					// Should always have userData from generateChunk
					terrain[chunkKey].userData.isDirty = false; // Clear the flag
				}
			} else {
				console.error(
					`Failed to rebuild dirty chunk: ${chunkKey}. It will be missing.`
				);
			}
			rebuiltDirtyChunkThisFrame = true;
			break; // Rebuild one dirty chunk per frame to avoid lag spikes
		}
	}

	// Check if player moved to a new chunk or if a chunk needs forced update
	const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
	const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

	if (
		!rebuiltDirtyChunkThisFrame && // Only run regular terrain gen if no dirty chunk was rebuilt
		(player.lastChunkX !== playerChunkX ||
			player.lastChunkZ !== playerChunkZ ||
			player.forceChunkUpdate)
	) {
		player.lastChunkX = playerChunkX;
		player.lastChunkZ = playerChunkZ;
		player.forceChunkUpdate = false; // Reset flag
		generateTerrainAroundPlayer(player, scene, simplex);
	} else if (
		!rebuiltDirtyChunkThisFrame &&
		chunkLoadingQueue.length > 0 &&
		!processingChunk
	) {
		// If not moving to new chunk and no dirty chunk rebuild, still try to process queue
		processChunkLoadingQueue(scene, simplex, player);
	}
	pruneChunkCacheIfNeeded();
}

function pruneChunkCacheIfNeeded() {
	if (Object.keys(window.chunkCache || {}).length > MAX_CACHED_CHUNKS) {
		// Access global chunkCache
		pruneChunkCache(MAX_CACHED_CHUNKS); // Pass limit
	}
}

// Utility to find ground level for spawning
export function findGroundLevel(x, z, _terrain, _chunkSize) {
	const checkY = 150; // Start checking from a high Y
	for (let y = checkY; y >= 0; y--) {
		if (isPositionSolid(new THREE.Vector3(x, y, z), _terrain, _chunkSize)) {
			return y + 1; // Spawn on top of this block
		}
	}
	return 20; // Fallback height
}

export function isPositionSolid(position, _terrain, _chunkSize) {
	const blockX = Math.floor(position.x + 0.5);
	const blockY = Math.floor(position.y); // Check block player is 'in'
	const blockZ = Math.floor(position.z + 0.5);

	const chunkX = Math.floor(blockX / _chunkSize);
	const chunkZ = Math.floor(blockZ / _chunkSize);
	const chunkKey = `${chunkX},${chunkZ}`;

	const chunk = _terrain[chunkKey];
	if (chunk && chunk.blockPositions) {
		const posKey = `${blockX},${blockY},${blockZ}`;
		if (chunk.blockPositions[posKey]) {
			const blockType = chunk.blockPositions[posKey].type;
			return blockType !== "water"; // Water is not solid for standing
		}
	}
	return false;
}
