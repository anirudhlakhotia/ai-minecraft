import { DAY_NIGHT_DURATION } from "../config.js";
import { estimateHardwarePerformance } from "../ui/performanceMonitor.js";
// import { updateDayNightCycleVisuals } from "../ui/dayNightCycle.js";

let scene, camera, renderer, raycaster, mouse;
let highlightBox;
let dayNightCycleState; // Will be initialized by main.js

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

	renderer = new THREE.WebGLRenderer({
		antialias: false,
		alpha: false,
		preserveDrawingBuffer: false,
		powerPreference: "high-performance",
	});
	renderer.precision = "mediump";
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x87ceeb, 1);
	document.body.appendChild(renderer.domElement);

	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();

	setupHighlyOptimizedLights(scene, dayNightCycleState);
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

function setupHighlyOptimizedLights(_scene, _dayNightCycleState) {
	const hardwareLevel = estimateHardwarePerformance();
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

	raycaster.setFromCamera({ x: 0, y: 0 }, camera);
	const intersections = [];

	Object.values(terrainChunks).forEach((chunk) => {
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
			if (intersect) {
				intersections.push({
					distance: intersect.distanceTo(camera.position),
					point: intersect.clone(),
					normal: raycaster.ray.direction.clone().negate(), // This normal is approximate
					blockPosition: { x, y, z },
					chunk: chunk,
					blockData: blockData,
				});
			}
		}
	});

	intersections.sort((a, b) => a.distance - b.distance);

	if (intersections.length > 0 && intersections[0].distance < 5) {
		const target = intersections[0];
		highlightBox.position.set(
			target.blockPosition.x,
			target.blockPosition.y,
			target.blockPosition.z
		);

		if (keyboardState && keyboardState.shift) {
			highlightBox.material.color.setHex(0xff3333);
		} else {
			highlightBox.material.color.setHex(0xffffff);
		}
		highlightBox.visible = true;
		highlightBox.material.opacity =
			0.8 + 0.2 * Math.sin(performance.now() * 0.005);
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
