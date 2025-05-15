import { DAY_NIGHT_DURATION, CHUNK_SIZE } from "../config.js";
import { estimateHardwarePerformance } from "../ui/performanceMonitor.js";
// import { updateDayNightCycleVisuals } from "../ui/dayNightCycle.js";

let scene, camera, renderer, raycaster, mouse;
let highlightBox;
let dayNightCycleState; // Will be initialized by main.js

// Reusable objects for updateBlockHighlight
const reusableBox = new THREE.Box3();
const reusableVec1 = new THREE.Vector3();
const reusableVec2 = new THREE.Vector3();
const reusableIntersectPoint = new THREE.Vector3(); // For intersectBox result
const reusableRayDirection = new THREE.Vector3(); // For normal calculation

export function initRenderer(_dayNightCycleState) {
	dayNightCycleState = _dayNightCycleState;

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87ceeb);
	scene.fog = new THREE.Fog(0x87ceeb, 15, 45);

	camera = new THREE.PerspectiveCamera(
		70,
		window.innerWidth / window.innerHeight,
		0.1,
		1000
	);

	const hardwareLevel = estimateHardwarePerformance();
	renderer = new THREE.WebGLRenderer({
		antialias: hardwareLevel > 3,
		alpha: false,
		preserveDrawingBuffer: false,
		powerPreference: "high-performance",
	});
	renderer.precision = "mediump";

	if (hardwareLevel <= 1) {
		renderer.setPixelRatio(0.75);
	} else if (hardwareLevel === 2) {
		renderer.setPixelRatio(1);
	} else if (hardwareLevel === 3) {
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
	} else {
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	}

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x87ceeb, 1);
	document.body.appendChild(renderer.domElement);

	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();

	setupHighlyOptimizedLights(scene, dayNightCycleState, hardwareLevel);
	initHighlightBox(scene);

	return { scene, camera, renderer, raycaster, mouse };
}

export function getScene() {
	return scene;
}
export function getCamera() {
	return camera;
}
export function getRenderer() {
	return renderer;
}
export function getRaycaster() {
	return raycaster;
}
export function getMouse() {
	return mouse;
}

function setupHighlyOptimizedLights(_scene, _dayNightCycleState, hardwareLevel) {
	const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(
		navigator.userAgent
	);

	const directionalLight = new THREE.DirectionalLight(0xffeac3, 1.2);
	directionalLight.position.set(100, 100, 50);
	directionalLight.castShadow = hardwareLevel > 2;

	const shadowMapSize = isMobile
		? 512
		: hardwareLevel >= 4
		? 2048
		: hardwareLevel >= 3
		? 1024
		: 512;
	directionalLight.shadow.mapSize.width = shadowMapSize;
	directionalLight.shadow.mapSize.height = shadowMapSize;

	const shadowSize = 120;
	directionalLight.shadow.camera.left = -shadowSize / 2;
	directionalLight.shadow.camera.right = shadowSize / 2;
	directionalLight.shadow.camera.top = shadowSize / 2;
	directionalLight.shadow.camera.bottom = -shadowSize / 2;
	directionalLight.shadow.camera.near = 0.5;
	directionalLight.shadow.camera.far = 350;
	directionalLight.shadow.bias = -0.001;

	if (hardwareLevel >= 4) directionalLight.shadow.type = THREE.VSMShadowMap;

	if (hardwareLevel <= 2) {
		directionalLight.shadow.autoUpdate = false;
		directionalLight.shadow.needsUpdate = true;
		setInterval(() => {
			directionalLight.shadow.needsUpdate = true;
		}, 1000 / 20);
	}
	_scene.add(directionalLight);

	const ambientIntensity = hardwareLevel <= 2 ? 0.7 : 0.5;
	const ambientLight = new THREE.AmbientLight(0x8097bb, ambientIntensity);
	_scene.add(ambientLight);

	if (hardwareLevel >= 3 && !isMobile) {
		const hemiLight = new THREE.HemisphereLight(0x9bb8ff, 0x6a5939, 0.3);
		_scene.add(hemiLight);
		_dayNightCycleState.hemiLight = hemiLight;
	}

	_dayNightCycleState.directionalLight = directionalLight;
	_dayNightCycleState.ambientLight = ambientLight;
	_dayNightCycleState.shadowUpdateFrequency = hardwareLevel <= 2 ? 3 : 1;
	_dayNightCycleState.frameCounter = 0;
	_dayNightCycleState.cycleSpeed = 1 / DAY_NIGHT_DURATION; // Progress per second
	_dayNightCycleState.timeOfDay = 0.25; // Start at morning

	console.log(
		`Lighting optimized for hardware level: ${hardwareLevel}, Shadow map: ${shadowMapSize}px`
	);
}

export function initHighlightBox(_scene) {
	const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
	const edges = new THREE.EdgesGeometry(geometry);
	const material = new THREE.LineBasicMaterial({
		color: 0xffffff,
		linewidth: 2,
		transparent: true,
		opacity: 0.8,
	});
	highlightBox = new THREE.LineSegments(edges, material);
	highlightBox.visible = false;
	_scene.add(highlightBox);
}

export function updateBlockHighlight(
	camera,
	terrainChunks,
	isCraftingOpen,
	keyboardState
) {
	if (!highlightBox) return;
	if (isCraftingOpen) {
		highlightBox.visible = false;
		return;
	}

	raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Center of screen

	const ray = raycaster.ray;
	const interactionRange = 5; // Max distance to check for blocks

	// Voxel Traversal (Amanatides & Woo)
	let cvx = Math.floor(ray.origin.x);
	let cvy = Math.floor(ray.origin.y);
	let cvz = Math.floor(ray.origin.z);

	const stepX = ray.direction.x > 0 ? 1 : -1;
	const stepY = ray.direction.y > 0 ? 1 : -1;
	const stepZ = ray.direction.z > 0 ? 1 : -1;

	// Prevent division by zero, if ray is parallel to an axis, tDelta will be Infinity
	const tDeltaX = Math.abs(1 / ray.direction.x);
	const tDeltaY = Math.abs(1 / ray.direction.y);
	const tDeltaZ = Math.abs(1 / ray.direction.z);

	let tMaxX, tMaxY, tMaxZ;
	if (ray.direction.x > 0) {
		tMaxX = (cvx + 1 - ray.origin.x) * tDeltaX;
	} else if (ray.direction.x < 0) {
		tMaxX = (ray.origin.x - cvx) * tDeltaX;
	} else {
		tMaxX = Infinity;
	}
	if (ray.direction.y > 0) {
		tMaxY = (cvy + 1 - ray.origin.y) * tDeltaY;
	} else if (ray.direction.y < 0) {
		tMaxY = (ray.origin.y - cvy) * tDeltaY;
	} else {
		tMaxY = Infinity;
	}
	if (ray.direction.z > 0) {
		tMaxZ = (cvz + 1 - ray.origin.z) * tDeltaZ;
	} else if (ray.direction.z < 0) {
		tMaxZ = (ray.origin.z - cvz) * tDeltaZ;
	} else {
		tMaxZ = Infinity;
	}

	let targetIntersection = null;
	let currentDistance = 0;

	for (let i = 0; i < Math.ceil(interactionRange * Math.max(tDeltaX, tDeltaY, tDeltaZ)) + 2 && currentDistance < interactionRange; i++) {
		const chunkX = Math.floor(cvx / CHUNK_SIZE);
		const chunkZ = Math.floor(cvz / CHUNK_SIZE);
		const chunkKey = `${chunkX},${chunkZ}`;
		const currentChunk = terrainChunks[chunkKey];
		const blockKey = `${cvx},${cvy},${cvz}`;
		const blockData = currentChunk?.blockPositions?.[blockKey];

		if (blockData) {
			// Block found, calculate intersection details
			let hitPoint = reusableIntersectPoint.copy(ray.origin);
			let normal = reusableRayDirection; // Will be set below
			let t;

			if (tMaxX < tMaxY) {
				if (tMaxX < tMaxZ) {
					t = tMaxX;
					normal.set(-stepX, 0, 0);
				} else {
					t = tMaxZ;
					normal.set(0, 0, -stepZ);
				}
			} else {
				if (tMaxY < tMaxZ) {
					t = tMaxY;
					normal.set(0, -stepY, 0);
				} else {
					t = tMaxZ;
					normal.set(0, 0, -stepZ);
				}
			}

			hitPoint.addScaledVector(ray.direction, t);
			currentDistance = ray.origin.distanceTo(hitPoint);

			if (currentDistance <= interactionRange) {
				targetIntersection = {
					distance: currentDistance,
					point: hitPoint.clone(),
					normal: normal.clone(),
					blockPosition: { x: cvx, y: cvy, z: cvz },
					chunk: currentChunk, // May be undefined if block found at edge of loaded area
					blockData: blockData,
				};
			}
			break; // Found a block
		}

		// Advance to next voxel
		if (tMaxX < tMaxY) {
			if (tMaxX < tMaxZ) {
				cvx += stepX;
				tMaxX += tDeltaX;
				currentDistance = tMaxX / tDeltaX; // Approximation of voxel units traveled
			} else {
				cvz += stepZ;
				tMaxZ += tDeltaZ;
				currentDistance = tMaxZ / tDeltaZ;
			}
		} else {
			if (tMaxY < tMaxZ) {
				cvy += stepY;
				tMaxY += tDeltaY;
				currentDistance = tMaxY / tDeltaY;
			} else {
				cvz += stepZ;
				tMaxZ += tDeltaZ;
				currentDistance = tMaxZ / tDeltaZ;
			}
		}
		if (currentDistance > interactionRange) break; // Exceeded interaction range
	}


	if (targetIntersection) {
		const target = targetIntersection;
		highlightBox.position.set(
			target.blockPosition.x,
			target.blockPosition.y,
			target.blockPosition.z
		);

		if (keyboardState && keyboardState.shift) {
			highlightBox.material.color.setHex(0xff3333); // Red for breaking (shift)
		} else {
			highlightBox.material.color.setHex(0xffffff); // Default white
		}
		highlightBox.visible = true;
		highlightBox.material.opacity =
			0.8 + 0.2 * Math.sin(performance.now() * 0.005); // Pulsating effect
	} else {
		highlightBox.visible = false;
	}
}

export function setHighlightColorOnMouseDown(event) {
	if (!highlightBox || !highlightBox.visible) return;
	if (event.button === 0)
		highlightBox.material.color.setHex(0xff3333); // Red for breaking
	else if (event.button === 2) highlightBox.material.color.setHex(0x33ff33); // Green for placing
}

export function resetHighlightColorOnMouseUp() {
	if (!highlightBox || !highlightBox.visible) return;
	highlightBox.material.color.setHex(0xffffff);
}

export function onWindowResize(_camera, _renderer) {
	_camera.aspect = window.innerWidth / window.innerHeight;
	_camera.updateProjectionMatrix();
	_renderer.setSize(window.innerWidth, window.innerHeight);
}

export function renderScene(_scene, _camera, _renderer) {
	_renderer.render(_scene, _camera);
}
