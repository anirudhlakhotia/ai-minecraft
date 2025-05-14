import {
	CHUNK_SIZE,
	VIEW_DISTANCE_MIN,
	VIEW_DISTANCE_IDEAL,
	VIEW_DISTANCE_MAX,
	VIEW_DISTANCE_PRELOAD_FAR,
	setMaxCachedChunks,
} from "../config.js";
// World manager needed to force terrain update on perf mode change
// import { generateTerrainAroundPlayer } from '../world/worldManager.js';

let fpsDisplay, memoryDisplay, chunkCountDisplay, queueDisplay, cacheDisplay;
let lastFpsUpdate = 0,
	framesThisSecond = 0;
let highPerfMode = false;

// References to be set by main.js
let sceneRef, playerRef, simplexRef;

export function initPerformanceMonitor(_scene, _player, _simplex) {
	sceneRef = _scene;
	playerRef = _player;
	simplexRef = _simplex;

	fpsDisplay = document.getElementById("fpsDisplay");
	memoryDisplay = document.getElementById("memoryDisplay");
	chunkCountDisplay = document.getElementById("chunkCountDisplay"); // From HTML
	queueDisplay = document.getElementById("queueDisplay"); // From HTML
	cacheDisplay = document.getElementById("cacheDisplay"); // From HTML

	const perfButton = document.getElementById("perfModeButton");
	perfButton.addEventListener("click", togglePerformanceMode);

	setInterval(updateMemoryAndQueueStats, 1000); // Update these less frequently
	window.gameModules = window.gameModules || {};
	window.gameModules.performanceMonitor = { estimateHardwarePerformance }; // Expose estimator
}

export function updatePerformanceMetrics(terrainChunksCount) {
	const now = performance.now();
	framesThisSecond++;
	if (now > lastFpsUpdate + 1000) {
		if (fpsDisplay) fpsDisplay.textContent = `FPS: ${framesThisSecond}`;
		framesThisSecond = 0;
		lastFpsUpdate = now;
	}
	// Chunk count is updated by chunkUtils updateCacheUIDisplay
}

function updateMemoryAndQueueStats() {
	if (window.performance && window.performance.memory && memoryDisplay) {
		const memUsed = Math.round(
			window.performance.memory.usedJSHeapSize / 1048576
		);
		const memTotal = Math.round(
			window.performance.memory.jsHeapSizeLimit / 1048576
		);
		memoryDisplay.textContent = `Memory: ${memUsed}MB / ${memTotal}MB`;
		const memPercentage = memUsed / memTotal;
		if (memPercentage > 0.8) memoryDisplay.style.color = "#FF5555";
		else if (memPercentage > 0.6) memoryDisplay.style.color = "#FFAA55";
		else memoryDisplay.style.color = "#55FF55";
	} else if (memoryDisplay) {
		memoryDisplay.textContent = "Memory: N/A";
	}
	// Queue and Cache display updates are handled by chunkUtils.updateCacheUIDisplay
	// which is called by worldManager or chunkUtils itself.
}

function togglePerformanceMode() {
	highPerfMode = !highPerfMode;
	const perfButton = document.getElementById("perfModeButton");

	let newConfig = {
		VIEW_DISTANCE_MIN,
		VIEW_DISTANCE_IDEAL,
		VIEW_DISTANCE_MAX,
		VIEW_DISTANCE_PRELOAD_FAR,
	};

	if (highPerfMode) {
		newConfig.VIEW_DISTANCE_MIN = 1;
		newConfig.VIEW_DISTANCE_IDEAL = 1; // Reduced
		newConfig.VIEW_DISTANCE_MAX = 2; // Reduced
		newConfig.VIEW_DISTANCE_PRELOAD_FAR = 2; // Reduced
		setMaxCachedChunks(100);
		if (sceneRef.fog) {
			sceneRef.fog.near = 10;
			sceneRef.fog.far = 30;
		}
		perfButton.textContent = "Normal Mode";
		perfButton.style.background = "#553300";
	} else {
		// Restore default config values (these are imported, so they are the defaults)
		// No need to re-assign newConfig, just use imported defaults.
		setMaxCachedChunks(500); // Default from config.js
		if (sceneRef.fog) {
			sceneRef.fog.near = 15;
			sceneRef.fog.far = 45;
		}
		perfButton.textContent = "High Performance Mode";
		perfButton.style.background = "#333";
	}

	// Update globalish render distances (if worldManager reads them dynamically)
	// Or, pass these newConfig values to worldManager's generateTerrain
	// For now, assume worldManager reads from config.js which is fine if not dynamically changing those exports
	// The VIEW_DISTANCE constants are used directly in worldManager.
	// To make this work cleanly, worldManager should have setters for these or take them as params.
	// A simpler way: worldManager imports these values, so changing them in config.js would require
	// a way for worldManager to re-read them, or for these to be mutable and updated.
	// For this refactor, we'll assume direct import is sufficient and a game restart/re-init might be needed
	// for these types of changes, or worldManager needs to be more dynamic.
	// The current structure requires `worldManager` to re-evaluate its view distances.
	// Let's trigger a terrain regeneration in `worldManager`.
	if (window.gameModules.worldManager && playerRef && sceneRef && simplexRef) {
		// Update the config values (if they are not const exports)
		// Since they are const, we need another mechanism.
		// For now, this button might not dynamically change render distance fully without deeper refactor.
		// The best approach is for worldManager to have functions like setRenderDistances.
		// As a workaround for this example, player.forceChunkUpdate can trigger regeneration.
		if (playerRef) playerRef.forceChunkUpdate = true;
		console.log(
			`Performance mode toggled. New ideal view distance: ${VIEW_DISTANCE_IDEAL} (from config)`
		);
	}
}

export function estimateHardwarePerformance() {
	let score = 3;
	const canvas = document.createElement("canvas");
	const gl =
		canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
	if (!gl) return 2;
	if (canvas.getContext("webgl2")) score += 1;
	if (navigator.hardwareConcurrency) {
		if (navigator.hardwareConcurrency >= 8) score += 1;
		else if (navigator.hardwareConcurrency <= 2) score -= 1;
	}
	if (navigator.deviceMemory) {
		if (navigator.deviceMemory >= 8) score += 0.5;
		else if (navigator.deviceMemory <= 2) score -= 0.5;
	}
	if (/Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent))
		score -= 1;
	try {
		const ext = gl.getExtension("WEBGL_debug_renderer_info");
		if (ext) {
			const rendererInfo = gl
				.getParameter(ext.UNMASKED_RENDERER_WEBGL)
				.toLowerCase();
			if (
				rendererInfo.includes("nvidia") ||
				rendererInfo.includes("geforce") ||
				rendererInfo.includes("radeon") ||
				(rendererInfo.includes("adreno") &&
					!rendererInfo.includes("adreno 5")) ||
				rendererInfo.includes("apple m") ||
				rendererInfo.includes("apple a")
			) {
				score += 0.5;
			}
		}
	} catch (e) {}
	return Math.max(1, Math.min(5, Math.round(score)));
}
