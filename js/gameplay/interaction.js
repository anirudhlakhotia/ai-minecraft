import { getCamera, getRaycaster } from "../core/renderer.js";
import {
	getTerrain,
	recordChunkModification,
	getChunkModifications,
} from "../world/worldManager.js";
import {
	blockMaterials,
	blockGeometry as globalBlockGeometry,
} from "../config.js";
import {
	addBlockToInventory,
	consumeBlockFromInventory,
	getPlayerInventory,
} from "./inventoryManager.js";
import { getPlayerState } from "./player.js";

export function handleMouseClick(event, scene, selectedBlockType) {
	const camera = getCamera();
	const raycaster = getRaycaster();
	const terrain = getTerrain();
	const player = getPlayerState(); // Get current player state for position check

	if (!camera || !raycaster || !terrain) return;

	raycaster.setFromCamera({ x: 0, y: 0 }, camera);
	const intersections = [];

	Object.values(terrain).forEach((chunk) => {
		if (!chunk || !chunk.blockPositions) return;
		for (const [posKey, blockData] of Object.entries(chunk.blockPositions)) {
			const [x, y, z] = posKey.split(",").map(Number);
			const blockBox = new THREE.Box3(
				new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
				new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
			);
			const intersect = raycaster.ray.intersectBox(
				blockBox,
				new THREE.Vector3()
			);
			if (intersect && intersect.distanceTo(camera.position) < 5) {
				// Max interaction distance 5
				intersections.push({
					distance: intersect.distanceTo(camera.position),
					point: intersect.clone(),
					// Correct normal calculation requires face info, this is approximate
					normal: camera
						.getWorldDirection(new THREE.Vector3())
						.multiplyScalar(-1),
					object: { position: new THREE.Vector3(x, y, z) }, // Mimic mesh object
					blockPosition: { x, y, z }, // Store original block coords
					chunk: chunk,
					blockData: blockData,
				});
			}
		}
	});

	intersections.sort((a, b) => a.distance - b.distance);

	if (intersections.length > 0) {
		const intersection = intersections[0];
		if (event.button === 0) {
			// Left click - remove
			removeBlockFromWorld(intersection, scene);
		} else if (event.button === 2) {
			// Right click - place
			placeBlockInWorld(intersection, scene, selectedBlockType, player);
		}
	}
}

function removeBlockFromWorld(intersection, scene) {
	const {
		chunk,
		blockPosition,
		blockData: intersectedBlockData,
	} = intersection;
	if (
		!chunk ||
		!chunk.blockPositions ||
		!blockPosition ||
		!intersectedBlockData
	)
		return;

	const posKey = `${blockPosition.x},${blockPosition.y},${blockPosition.z}`;
	const blockDataFromChunk = chunk.blockPositions[posKey];

	if (
		blockDataFromChunk &&
		blockDataFromChunk.type === intersectedBlockData.type
	) {
		addBlockToInventory(blockDataFromChunk.type);
		delete chunk.blockPositions[posKey];
		recordChunkModification(
			blockPosition.x,
			blockPosition.y,
			blockPosition.z,
			"remove"
		);

		let visualChangeApplied = false;

		// Attempt 1: Handle InstancedMesh (hide instance)
		const M = new THREE.Matrix4();
		const zeroScaleMatrix = new THREE.Matrix4().scale(
			new THREE.Vector3(0, 0, 0)
		);
		for (const child of chunk.children) {
			if (
				child.userData &&
				child.userData.isInstanced &&
				child.userData.blockType === intersectedBlockData.type
			) {
				const instancedMesh = child;
				for (let i = 0; i < instancedMesh.count; i++) {
					instancedMesh.getMatrixAt(i, M);
					if (
						Math.abs(M.elements[12] - blockPosition.x) < 0.1 &&
						Math.abs(M.elements[13] - blockPosition.y) < 0.1 &&
						Math.abs(M.elements[14] - blockPosition.z) < 0.1
					) {
						instancedMesh.setMatrixAt(i, zeroScaleMatrix);
						instancedMesh.instanceMatrix.needsUpdate = true;
						visualChangeApplied = true;
						break;
					}
				}
			}
			if (visualChangeApplied) break;
		}

		// Attempt 2: Handle Non-Instanced Meshes (e.g., tree blocks, other feature blocks)
		if (!visualChangeApplied) {
			for (let i = chunk.children.length - 1; i >= 0; i--) {
				const child = chunk.children[i];
				if (
					child.isMesh &&
					(!child.userData ||
						(!child.userData.isInstanced && child.userData.isFeatureBlock)) && // Target plain meshes, or explicitly marked feature blocks
					Math.abs(child.position.x - blockPosition.x) < 0.1 &&
					Math.abs(child.position.y - blockPosition.y) < 0.1 &&
					Math.abs(child.position.z - blockPosition.z) < 0.1
				) {
					// Check block type if available in userData, though direct position match is primary for non-instanced features
					// const featureBlockType = child.userData && child.userData.blockType; // Not strictly necessary if position matches

					chunk.remove(child);
					if (child.geometry && child.geometry !== globalBlockGeometry) {
						// Avoid disposing shared geometry
						child.geometry.dispose();
					}
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
					visualChangeApplied = true;
					// console.log(`Removed non-instanced mesh at ${posKey}`);
					break;
				}
			}
		}

		// Fallback: If no visual change was applied by specific handlers, mark chunk dirty for full rebuild.
		// This might happen if the instanced hiding failed unexpectedly or if a block type has no specific visual removal logic.
		if (!visualChangeApplied) {
			// console.warn(`No specific visual removal for ${intersectedBlockData.type} at ${posKey}. Marking chunk dirty.`);
			if (chunk.userData) {
				chunk.userData.isDirty = true;
			} else {
				console.warn(
					"Chunk is missing userData, cannot mark as dirty (fallback):",
					chunk
				);
			}
		}
	} else {
		// console.warn(`Attempted to remove block at ${posKey} but data mismatch or not found.`);
	}
}

function placeBlockInWorld(intersection, scene, selectedBlockType, player) {
	const { point, normal, chunk } = intersection;
	if (!chunk || !chunk.blockPositions || !selectedBlockType) return;

	// Calculate position for new block based on clicked face
	// A robust way to get the normal of the intersected face is needed.
	// Raycaster intersection with individual blocks (not instanced mesh) gives `face.normal`.
	// For instanced mesh, it's harder. We'll use a simpler placement logic here.
	// The intersection.normal is currently approximated.

	// Estimate placement position: move 0.5 units along the approximate normal from intersection point
	// This logic is simplified. A better approach would use the normal of the face of the *clicked block*.
	// The current intersection.normal points from camera to block. True normal is face normal.
	// Let's assume the blockPosition of intersection is the block we clicked. Place adjacent.

	const clickedBlockPos = intersection.blockPosition;
	// A simple heuristic for normal: find which component of (point - clickedBlockPos) is largest
	const diff = intersection.point
		.clone()
		.sub(
			new THREE.Vector3(clickedBlockPos.x, clickedBlockPos.y, clickedBlockPos.z)
		);
	const placeNormal = new THREE.Vector3();
	if (
		Math.abs(diff.x) > Math.abs(diff.y) &&
		Math.abs(diff.x) > Math.abs(diff.z)
	)
		placeNormal.x = Math.sign(diff.x);
	else if (
		Math.abs(diff.y) > Math.abs(diff.x) &&
		Math.abs(diff.y) > Math.abs(diff.z)
	)
		placeNormal.y = Math.sign(diff.y);
	else placeNormal.z = Math.sign(diff.z);

	const x = clickedBlockPos.x + placeNormal.x;
	const y = clickedBlockPos.y + placeNormal.y;
	const z = clickedBlockPos.z + placeNormal.z;

	// Prevent placing block inside player
	const playerHead = player.position.y + 1.7;
	const playerFeet = player.position.y;
	if (
		x === Math.floor(player.position.x) &&
		z === Math.floor(player.position.z) &&
		(y === Math.floor(playerFeet) || y === Math.floor(playerHead - 0.1))
	) {
		// Check player's current and head block
		console.log("Cannot place block inside player.");
		return;
	}

	if (consumeBlockFromInventory(selectedBlockType)) {
		const posKey = `${x},${y},${z}`;
		if (!chunk.blockPositions[posKey]) {
			// Don't place if block already exists
			chunk.blockPositions[posKey] = { type: selectedBlockType };
			recordChunkModification(x, y, z, "add", selectedBlockType);

			// Add visual representation. Similar to removal, this is complex for InstancedMesh.
			const material =
				blockMaterials[selectedBlockType] || blockMaterials.stone;
			const mesh = new THREE.Mesh(blockGeometry, material.clone()); // Clone material
			mesh.position.set(x, y, z);
			chunk.add(mesh); // Add to the chunk group
			console.log(`Placed block ${selectedBlockType} at ${posKey}`);
			chunk.userData.isDirty = true; // Hypothetical flag
		} else {
			// Block already exists, refund
			addBlockToInventory(selectedBlockType); // Give it back
		}
	} else {
		console.log(`Not enough ${selectedBlockType} in inventory.`);
	}
}
