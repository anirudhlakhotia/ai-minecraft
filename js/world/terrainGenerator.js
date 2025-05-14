import { CHUNK_SIZE, blockMaterials, blockGeometry } from "../config.js"; // blockGeometry for potential direct use
import { seededRandom } from "../utils.js";

export function getTerrainHeight(x, z, biome, simplex) {
	const scale1 = biome === "mountains" ? 0.02 : 0.01;
	const scale2 = biome === "plains" ? 0.03 : 0.05;

	switch (biome) {
		case "desert":
			return (
				7 +
				Math.floor(
					8 *
						(0.8 * simplex.noise2D(x * 0.01, z * 0.01) +
							0.2 *
								simplex.noise2D(x * 0.05, z * 0.05) *
								Math.pow(Math.abs(simplex.noise2D(x * 0.002, z * 0.002)), 0.7))
				)
			);
		case "mountains":
			const baseElevation = 20;
			const ridgeNoise = Math.pow(
				Math.abs(simplex.noise2D(x * 0.005, z * 0.005)),
				0.8
			);
			const detailNoise =
				0.6 * simplex.noise2D(x * 0.03, z * 0.03) +
				0.4 * simplex.noise2D(x * 0.08, z * 0.08);
			const peakiness = Math.pow(
				Math.abs(simplex.noise2D(x * 0.001, z * 0.001)),
				0.3
			);
			return (
				baseElevation +
				Math.floor(60 * ridgeNoise * peakiness * (0.8 + 0.4 * detailNoise))
			);
		case "plains":
			const riverNoiseVal = simplex.noise2D(x * 0.02, z * 0.02);
			const riverChannel = Math.abs(riverNoiseVal);
			if (riverChannel < 0.05) return 8; // River level
			if (riverChannel < 0.12) return 9 + Math.floor(riverChannel * 20); // Sloping riverbank
			return (
				11 +
				Math.floor(
					3 *
						(0.8 * simplex.noise2D(x * 0.01, z * 0.01) +
							0.2 * simplex.noise2D(x * 0.04, z * 0.04))
				)
			);
		case "forest":
		default:
			return (
				12 +
				Math.floor(
					8 *
						(0.6 * simplex.noise2D(x * 0.01, z * 0.01) +
							0.4 * simplex.noise2D(x * 0.05, z * 0.05))
				)
			);
	}
}

function createBlockForFeature(x, y, z, type, parentChunkGroup, modifications) {
	const worldPosKey = `${x},${y},${z}`;
	// Check if this specific block was previously removed
	if (
		modifications &&
		modifications[worldPosKey] &&
		modifications[worldPosKey].action === "remove"
	) {
		// console.log(`Feature block at ${worldPosKey} skipped due to prior removal.`);
		return; // Do not create this block
	}

	const material = blockMaterials[type] || blockMaterials.stone;
	const mesh = new THREE.Mesh(blockGeometry, material);
	mesh.position.set(x, y, z);
	// Add userData to identify these as non-instanced feature blocks if needed later
	mesh.userData.isFeatureBlock = true;
	parentChunkGroup.add(mesh);
	if (!parentChunkGroup.blockPositions) parentChunkGroup.blockPositions = {};
	parentChunkGroup.blockPositions[worldPosKey] = { type: type };
}

export function createTreeAt(x, surfaceY, z, parentChunkGroup, modifications) {
	const trunkHeight = Math.floor(4 + (Math.abs(x * z) % 3));
	for (let i = 0; i < trunkHeight; i++) {
		createBlockForFeature(
			x,
			surfaceY + i,
			z,
			"wood",
			parentChunkGroup,
			modifications
		);
	}
	const leafRadius = 2;
	const leafHeight = 3;
	for (let ly = 0; ly <= leafHeight; ly++) {
		const levelRadius = ly === 0 || ly === leafHeight ? 1 : leafRadius;
		for (let lx = -levelRadius; lx <= levelRadius; lx++) {
			for (let lz = -levelRadius; lz <= levelRadius; lz++) {
				if (Math.abs(lx) === leafRadius && Math.abs(lz) === leafRadius)
					continue;
				const leafSeed = (x + lx) * 1000 + (z + lz) * 10 + ly;
				if (
					seededRandom(leafSeed)() > 0.8 &&
					Math.abs(lx) === leafRadius &&
					Math.abs(lz) === leafRadius
				)
					continue;
				createBlockForFeature(
					x + lx,
					surfaceY + trunkHeight + ly - 1,
					z + lz,
					"grass", // Leaves are grass type
					parentChunkGroup,
					modifications
				);
			}
		}
	}
}

export function createBiomeFeatures(
	worldX,
	surfaceY,
	worldZ,
	biome,
	simplex,
	chunkGroup,
	distanceFromPlayer,
	addToBatchCallback, // For instanced blocks like cacti
	modifications // For non-instanced features like trees
) {
	if (distanceFromPlayer > 2) return;

	const featureSeed = worldX * 10000 + worldZ;
	const random = seededRandom(featureSeed);

	if (biome === "forest" && random() < 0.03 && surfaceY > 5) {
		createTreeAt(worldX, surfaceY, worldZ, chunkGroup, modifications);
	} else if (biome === "desert") {
		if (random() < 0.02 && surfaceY > 8) {
			const cactusHeight = Math.floor(1 + random() * 3);
			for (let h = 0; h < cactusHeight; h++) {
				// Cacti use addToBatch, which already respects modifications based on its closure
				addToBatchCallback(worldX, surfaceY + h, worldZ, "cactus");
			}
		}
		const dunePattern = simplex.noise2D(worldX * 0.03, worldZ * 0.03);
		if (dunePattern > 0.7 && surfaceY > 9) {
			// Dune crests
			addToBatchCallback(worldX, surfaceY, worldZ, "sand_light");
		}
	} else if (
		biome === "mountains" &&
		random() < 0.02 &&
		surfaceY < 50 &&
		surfaceY > 30
	) {
		//addToBatchCallback(worldX, surfaceY, worldZ, 'stone'); // Variation
	} else if (biome === "plains") {
		const riverNoise = Math.abs(simplex.noise2D(worldX * 0.02, worldZ * 0.02));
		if (riverNoise >= 0.12 && random() < 0.001 && surfaceY > 10) {
			// Very sparse trees
			createTreeAt(worldX, surfaceY, worldZ, chunkGroup, modifications);
		}
		// Add tall grass or flowers (if they were separate block types/models)
	}
}

export function findSafeSpawnPoint(player, biome, simplex, _chunkSize) {
	console.log("Finding safe spawn point in biome:", biome);
	let spawnAreaX = 0,
		spawnAreaZ = 0;
	switch (biome) {
		case "desert":
			spawnAreaX = 16;
			spawnAreaZ = 16;
			break;
		case "mountains":
			spawnAreaX = 24;
			spawnAreaZ = 24;
			break;
		case "plains":
			spawnAreaX = 8;
			spawnAreaZ = 8;
			break;
		case "forest":
		default:
			spawnAreaX = 12;
			spawnAreaZ = 12;
			break;
	}

	if (biome === "mountains") {
		let bestHeight = 999,
			bestX = spawnAreaX,
			bestZ = spawnAreaZ;
		for (let xOffset = -8; xOffset <= 8; xOffset += 2) {
			for (let zOffset = -8; zOffset <= 8; zOffset += 2) {
				const testX = spawnAreaX + xOffset;
				const testZ = spawnAreaZ + zOffset;
				const height = getTerrainHeight(testX, testZ, biome, simplex);
				if (height < bestHeight) {
					bestHeight = height;
					bestX = testX;
					bestZ = testZ;
				}
			}
		}
		spawnAreaX = bestX;
		spawnAreaZ = bestZ;
	}

	const height = getTerrainHeight(spawnAreaX, spawnAreaZ, biome, simplex);
	player.position.set(spawnAreaX, height + 5, spawnAreaZ); // Start slightly above ground
	player.spawnHeight = height + 5;
	console.log(
		`Safe spawn point found at (${spawnAreaX}, ${player.position.y}, ${spawnAreaZ})`
	);

	player.lastChunkX = Math.floor(player.position.x / _chunkSize);
	player.lastChunkZ = Math.floor(player.position.z / _chunkSize);

	const camera = window.gameModules.renderer.getCamera(); // Access camera if needed
	if (camera) {
		camera.position.copy(player.position);
		camera.position.y += 1.7;
	}
	return true;
}
