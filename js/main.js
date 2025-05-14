// Globals from CDN
// THREE, SimplexNoise

import {
	CHUNK_SIZE,
	DAY_NIGHT_DURATION,
	MAX_CACHED_CHUNKS,
	initialPlayerInventory,
	setMaxCachedChunks,
} from "./config.js";
import {
	initRenderer,
	getScene,
	getCamera,
	getRenderer,
	renderScene,
	updateBlockHighlight,
	onWindowResize as onRendererResize,
	setHighlightColorOnMouseDown,
	resetHighlightColorOnMouseUp,
} from "./core/renderer.js";
import {
	initControls,
	getControls,
	getKeyboardState,
	setupMouseInteraction,
	focusGameCanvas,
} from "./core/controls.js";
import {
	initWorld,
	getCurrentBiome,
	setCurrentBiome,
	getTerrain,
	generateTerrainAroundPlayer,
	updateWorld as updateWorldManagerLogic,
	findGroundLevel,
	getChunkModifications,
} from "./world/worldManager.js";
import { findSafeSpawnPoint } from "./world/terrainGenerator.js";
import {
	initPlayer,
	getPlayerState,
	updatePlayer as updatePlayerLogic,
} from "./gameplay/player.js";
import {
	initInventory,
	getPlayerInventory,
	toggleCraftingUI,
	updateInventoryDisplay,
} from "./gameplay/inventoryManager.js";
import { handleMouseClick } from "./gameplay/interaction.js";
import {
	initUIManager,
	updateTimeDisplay,
	updateBlockSelector,
	toggleUIMode as UIManagerToggleUIMode,
	showLoadingScreen,
	hideLoadingScreen,
	updateLoadingProgress,
} from "./ui/uiManager.js";
import {
	initDayNightCycle,
	getDayNightCycleState,
	updateDayNightCycle as updateDayNightCycleLogic,
} from "./ui/dayNightCycle.js";
import {
	initSoundManager,
	playAmbientSound,
	stopAllAmbientSounds,
} from "./ui/soundManager.js";
import {
	initPerformanceMonitor,
	updatePerformanceMetrics,
	estimateHardwarePerformance,
} from "./ui/performanceMonitor.js";
import {
	resetCacheSystemForBiomeChange,
	updateCacheUIDisplay,
} from "./world/chunkUtils.js";

// Game state variables
let scene, camera, renderer, controls, clock, simplex;
let player, dayNightCycleState, currentBiomeManager;
let raycasterFromCore, mouseFromCore; // From renderer.js

let isGameStarted = false;
const isGameStartedRef = { value: false }; // Pass as a reference for mutable access

// Expose modules globally for inter-module communication if strictly necessary
// (better to use direct imports or event systems)
window.gameModules = {
	main: {
		getIsGameStarted: () => isGameStartedRef.value,
		setIsGameStarted: (val) => {
			isGameStarted = val;
			isGameStartedRef.value = val;
		},
	},
	renderer: { getScene, getCamera, getRenderer }, // Will be populated after init
	worldManager: null, // Will be populated
	player: null, // Will be populated
	inventoryManager: null, // Will be populated
	uiManager: null, // Will be populated
	soundManager: null, // Will be populated
	// ... other modules can be added here
};

function init() {
	console.log("Initializing game...");
	clock = new THREE.Clock();
	simplex = new SimplexNoise(); // Global from CDN

	setMaxCachedChunks(estimateHardwarePerformance() >= 4 ? 500 : 200);
	console.log(`Max cached chunks set to: ${MAX_CACHED_CHUNKS}`);

	// Order of initialization can be important
	dayNightCycleState = initDayNightCycle(DAY_NIGHT_DURATION); // Init state first

	const coreRenderer = initRenderer(dayNightCycleState); // Pass DNC state to renderer for light setup
	scene = coreRenderer.scene;
	camera = coreRenderer.camera;
	renderer = coreRenderer.renderer;
	raycasterFromCore = coreRenderer.raycaster; // Not used directly by main, but available
	mouseFromCore = coreRenderer.mouse; // Not used directly by main

	window.gameModules.renderer = {
		getScene: () => scene,
		getCamera: () => camera,
		getRenderer: () => renderer,
	};

	player = initPlayer(camera, getCurrentBiome(), simplex); // Pass camera, current biome, simplex
	window.gameModules.player = { getPlayerState: () => player };

	controls = initControls(camera, renderer.domElement, isGameStartedRef);

	initWorld(scene, simplex, player.lastBiome, player); // Initialize world manager
	window.gameModules.worldManager = {
		getCurrentBiome,
		setCurrentBiome,
		getTerrain,
		generateTerrainAroundPlayer,
		updateWorld: updateWorldManagerLogic,
		findGroundLevel,
		getChunkModifications,
		chunkLoadingQueue: [], // expose the queue itself for perf monitor
	};
	// Link the chunkLoadingQueue for the performance monitor
	window.gameModules.worldManager.chunkLoadingQueue =
		window.gameModules.worldManager.chunkLoadingQueue;

	initUIManager(
		simplex,
		scene,
		player,
		controls,
		isGameStartedRef,
		startGame,
		respawnPlayer
	);

	initInventory(controls); // Pass controls for lock/unlock
	window.gameModules.inventoryManager = {
		getPlayerInventory,
		toggleCraftingUI,
		updateInventoryDisplay,
	};

	initSoundManager();
	window.gameModules.soundManager = { playAmbientSound, stopAllAmbientSounds };

	initPerformanceMonitor(scene, player, simplex);

	// Setup mouse interaction for block breaking/placing
	// Pass selectedBlockType from UIManager
	setupMouseInteraction((event) =>
		handleMouseClick(
			event,
			scene,
			window.gameModules.uiManager.getSelectedBlockType()
		)
	);
	document.addEventListener("mousedown", setHighlightColorOnMouseDown);
	document.addEventListener("mouseup", resetHighlightColorOnMouseUp);

	window.addEventListener("resize", () => onRendererResize(camera, renderer));
	window.addEventListener("focus", () => {
		if (isGameStarted) focusGameCanvas();
	});

	// Initial terrain generation when game starts (not on DOMContentLoaded)
	// generateTerrainAroundPlayer(player, scene, simplex); // Moved to startGame after loading screen
	updateCacheUIDisplay(); // Initial display for cache/queue counts
	console.log("Game initialized.");
}

async function startGame() {
	const instructionsScreen = document.getElementById("instructions");
	const loadingScreen = document.getElementById("loadingScreen");

	instructionsScreen.style.display = "none";
	showLoadingScreen();

	// Simulate world loading process
	const stages = [
		{ name: "Initializing Terrain", weight: 10, action: () => {} },
		{
			name: "Generating Initial Chunks",
			weight: 60,
			action: () => {
				generateTerrainAroundPlayer(player, scene, simplex);
				player.forceChunkUpdate = true;
			},
		},
		{ name: "Finalizing World", weight: 30, action: () => {} },
	];
	let totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0);
	let currentProgress = 0;

	for (let i = 0; i < stages.length; i++) {
		const stage = stages[i];
		updateLoadingProgress(currentProgress, stage.name + "...");

		// Perform the action for this stage
		await stage.action();

		// Simulate async work or allow chunk queue to process a bit
		await new Promise((resolve) =>
			setTimeout(resolve, 200 + stage.weight * 10)
		);

		currentProgress += (stage.weight / totalWeight) * 100;
		updateLoadingProgress(
			Math.min(100, currentProgress),
			stage.name + " Complete"
		);
	}

	updateLoadingProgress(100, "World Ready!");
	await new Promise((resolve) => setTimeout(resolve, 500)); // Brief pause on "World Ready!"

	hideLoadingScreen();

	try {
		controls.lock();
		window.gameModules.main.setIsGameStarted(true); // Set isGameStarted to true
		playAmbientSound(getCurrentBiome());
		focusGameCanvas();
	} catch (e) {
		console.error("Error locking controls or starting game:", e);
		// Fallback: show instructions again if lock fails
		instructionsScreen.style.display = "flex";
	}
	if (!isGameStarted && controls.isLocked) {
		// If lock succeeded but isGameStarted flag failed
		window.gameModules.main.setIsGameStarted(true);
	}

	// If after all this, game hasn't started but lock is active, force start
	if (controls.isLocked && !isGameStarted) {
		window.gameModules.main.setIsGameStarted(true);
	}

	if (isGameStarted) {
		// Ensure first animation frame runs with game state active
		if (!animationFrameId) animate(); // Start animation loop if not already running
	} else {
		console.warn("Game did not start properly after loading.");
		instructionsScreen.style.display = "flex"; // Show instructions if game failed to start
	}
}

function respawnPlayer() {
	player.isSpawning = true;
	findSafeSpawnPoint(player, getCurrentBiome(), simplex, CHUNK_SIZE);
	player.velocity.set(0, 0, 0);
	player.forceChunkUpdate = true; // Force terrain regeneration around new spawn
	// generateTerrainAroundPlayer will be called in the game loop due to forceChunkUpdate
	if (isGameStarted && controls && !controls.isLocked) {
		// If UI was open
		controls.lock();
	}
}

let animationFrameId = null;
function animate() {
	animationFrameId = requestAnimationFrame(animate);
	const delta = Math.min(clock.getDelta(), 0.1); // Cap delta time

	if (
		isGameStarted &&
		(controls.isLocked ||
			document.getElementById("craftingUI").style.display === "block")
	) {
		// Update player only if not in crafting UI or if controls are locked (even if crafting UI is bugged open)
		if (!isCraftingUIOpen() || controls.isLocked) {
			updatePlayerLogic(delta, isGameStarted, getCurrentBiome(), simplex);
		}

		updateWorldManagerLogic(delta, scene, simplex, player); // Handles chunk loading, fading etc.
		updateDayNightCycleLogic(delta, scene);

		if (controls.isLocked) {
			// Only update highlight if pointer is locked (not in UI mode)
			updateBlockHighlight(
				camera,
				getTerrain(),
				isCraftingUIOpen(),
				getKeyboardState()
			);
		} else {
			updateBlockHighlight(camera, getTerrain(), true, getKeyboardState()); // Force hide if not locked
		}

		renderScene(scene, camera, renderer);
		updatePerformanceMetrics(Object.keys(getTerrain()).length);
		updateCacheUIDisplay(); // Keep cache/queue numbers fresh
	} else if (
		document.getElementById("loadingScreen").style.display === "flex"
	) {
		// Could add loading screen specific animations here if any
	} else {
		// Game is paused or in initial instruction screen
		// We might still want to render the scene if controls are unlocked mid-game
		// but no game logic updates.
		if (camera && scene && renderer) {
			// Ensure they are initialized
			// If UI mode is active, we might want a static render or very slow updates.
			// For now, only render if game has started at least once.
			// This prevents rendering before startButton is clicked if animate is called early.
			if (window.gameModules.main.getIsGameStarted()) {
				// Check if game has started even if paused
				updateDayNightCycleLogic(delta * 0.1, scene); // Slow down day cycle when paused
				renderScene(scene, camera, renderer); // Render even if paused (UI mode)
			}
		}
	}
}

function isCraftingUIOpen() {
	const craftingUI = document.getElementById("craftingUI");
	return craftingUI && craftingUI.style.display === "block";
}

// Start initialization on DOMContentLoaded
document.addEventListener("DOMContentLoaded", init);
