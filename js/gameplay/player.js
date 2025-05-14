import { CHUNK_SIZE } from "../config.js";
import { getKeyboardState, getControls } from "../core/controls.js";
import { getTerrain, isPositionSolid } from "../world/worldManager.js"; // For collision
import { findSafeSpawnPoint } from "../world/terrainGenerator.js";

let player = {
	position: new THREE.Vector3(0, 100, 0),
	velocity: new THREE.Vector3(0, 0, 0),
	lastChunkX: 0,
	lastChunkZ: 0,
	spawnHeight: 100,
	isSpawning: true,
	spawned: false,
	lastGlobalX: null,
	lastGlobalZ: null,
	lastBiome: null, // To track biome changes
	jumpTime: 0, // To prevent jump spamming / double jumps
	isJumping: false, // Track if currently in a jump
	forceChunkUpdate: false, // Flag to manually trigger chunk update
};

let cameraInstance; // To be set by main

export function initPlayer(_cameraInstance, currentBiome, simplex) {
	cameraInstance = _cameraInstance;
	player.lastBiome = currentBiome;
	findSafeSpawnPoint(player, currentBiome, simplex, CHUNK_SIZE); // Initial spawn point
	return player;
}

export function getPlayerState() {
	return player;
}
export function getCameraInstance() {
	return cameraInstance;
} // For other modules to access camera

export function updatePlayer(delta, isGameStarted, currentBiome, simplex) {
	if (!isGameStarted) return;

	if (player.position.y < -20) {
		console.log("Player fell out of the world, respawning...");
		player.isSpawning = true;
		findSafeSpawnPoint(player, currentBiome, simplex, CHUNK_SIZE);
		player.velocity.set(0, 0, 0);
		player.forceChunkUpdate = true; // Force chunk regeneration on respawn
		return;
	}

	const keyboard = getKeyboardState();
	const controls = getControls();
	const terrain = getTerrain();

	// Apply gravity
	if (!isPlayerOnGround(terrain)) {
		player.velocity.y -= 20 * delta; // Gravity
	} else {
		if (player.velocity.y < 0) player.velocity.y = 0;
		player.isJumping = false; // Landed
	}
	player.velocity.y = Math.max(player.velocity.y, -30); // Terminal velocity

	// Handle jump
	const now = performance.now();
	if (
		keyboard[" "] &&
		isPlayerOnGround(terrain) &&
		!player.isJumping &&
		now - player.jumpTime > 300
	) {
		// 300ms delay
		player.velocity.y = 8;
		player.isJumping = true;
		player.jumpTime = now;
		// focusGameCanvas(); // Ensure focus remains on game
	}

	// Movement
	const moveDirection = new THREE.Vector3();
	const cameraDirection = new THREE.Vector3();
	controls.getDirection(cameraDirection);
	cameraDirection.y = 0;
	cameraDirection.normalize();

	const speedMultiplier = keyboard.shift ? 1.5 : 1.0;
	const moveSpeed = 5 * speedMultiplier * delta;

	if (keyboard["w"] || keyboard["arrowup"]) moveDirection.add(cameraDirection);
	if (keyboard["s"] || keyboard["arrowdown"])
		moveDirection.sub(cameraDirection);

	const cameraSide = new THREE.Vector3()
		.crossVectors(cameraInstance.up, cameraDirection)
		.normalize();
	if (keyboard["a"] || keyboard["arrowleft"]) moveDirection.add(cameraSide); // Should be sub for left if cameraSide is right
	if (keyboard["d"] || keyboard["arrowright"]) moveDirection.sub(cameraSide); // Should be add for right

	if (moveDirection.lengthSq() > 0) {
		moveDirection.normalize().multiplyScalar(moveSpeed);
		movePlayerWithCollision(moveDirection.x, 0, 0, terrain);
		movePlayerWithCollision(0, 0, moveDirection.z, terrain);
	}

	movePlayerWithCollision(0, player.velocity.y * delta, 0, terrain);

	cameraInstance.position.copy(player.position);
	cameraInstance.position.y += 1.7; // Eye height

	// Chunk update logic is in worldManager, triggered by player movement
}

function isPlayerOnGround(terrain) {
	const pos = player.position.clone();
	pos.y -= 0.1; // Check slightly below feet
	if (isPositionSolid(pos, terrain, CHUNK_SIZE)) return true;

	const checkDistance = 0.25; // Player width/depth radius
	const checkPoints = [
		new THREE.Vector3(pos.x + checkDistance, pos.y, pos.z),
		new THREE.Vector3(pos.x - checkDistance, pos.y, pos.z),
		new THREE.Vector3(pos.x, pos.y, pos.z + checkDistance),
		new THREE.Vector3(pos.x, pos.y, pos.z - checkDistance),
	];
	for (const point of checkPoints) {
		if (isPositionSolid(point, terrain, CHUNK_SIZE)) return true;
	}
	return false;
}

function movePlayerWithCollision(dx, dy, dz, terrain) {
	const oldPos = player.position.clone();

	if (dx !== 0) {
		player.position.x += dx;
		if (isPlayerColliding(terrain)) player.position.x = oldPos.x;
	}
	if (dy !== 0) {
		player.position.y += dy;
		if (isPlayerColliding(terrain)) {
			player.position.y = oldPos.y;
			if (dy < 0) player.isJumping = false; // Hit ground
			player.velocity.y = 0; // Stop vertical movement on collision
		}
	}
	if (dz !== 0) {
		player.position.z += dz;
		if (isPlayerColliding(terrain)) player.position.z = oldPos.z;
	}
}

function isPlayerColliding(terrain) {
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

	// Check corners and center points of the player's bounding box sides
	// Simplified check: iterate nearby blocks based on playerBox min/max
	const minX = Math.floor(playerBox.min.x);
	const maxX = Math.ceil(playerBox.max.x);
	const minY = Math.floor(playerBox.min.y);
	const maxY = Math.ceil(playerBox.max.y);
	const minZ = Math.floor(playerBox.min.z);
	const maxZ = Math.ceil(playerBox.max.z);

	for (let x = minX; x < maxX; x++) {
		for (let y = minY; y < maxY; y++) {
			for (let z = minZ; z < maxZ; z++) {
				if (
					isPositionSolid(
						new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
						terrain,
						CHUNK_SIZE
					)
				) {
					// Check center of block
					const blockBox = new THREE.Box3(
						new THREE.Vector3(x, y, z),
						new THREE.Vector3(x + 1, y + 1, z + 1)
					);
					if (playerBox.intersectsBox(blockBox)) return true;
				}
			}
		}
	}
	return false;
}
