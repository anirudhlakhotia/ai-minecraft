import {
	CHUNK_SIZE,
	VIEW_DISTANCE_MIN,
	VIEW_DISTANCE_IDEAL,
	VIEW_DISTANCE_MAX,
	VIEW_DISTANCE_PRELOAD_FAR,
	VIEW_DISTANCE_BORDER_EXPANSION,
	setMaxCachedChunks,
	updateActiveViewDistances,
	currentViewDistanceMin,
	currentViewDistanceIdeal,
	currentViewDistanceMax,
	currentViewDistancePreloadFar,
	currentViewDistanceBorderExpansion
} from "../config.js";
// World manager needed to force terrain update on perf mode change
// import { generateTerrainAroundPlayer } from '../world/worldManager.js';

let fpsDisplay, memoryDisplay, chunkCountDisplay, queueDisplay, cacheDisplay;
let lastFpsUpdate = 0,
	framesThisSecond = 0;
let highPerfMode = false;
let initialHardwareLevel = 3; // Default, will be overridden

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

	// Estimate hardware performance and set initial view distances
	initialHardwareLevel = estimateHardwarePerformance();
	console.log(`[PerformanceMonitor] Initial hardware level detected: ${initialHardwareLevel}`);
	setViewDistancesForHardwareLevel(initialHardwareLevel);

	// --- DEBUG: Force a specific hardware level for view distance for testing ---
	// console.log("[PerformanceMonitor] DEBUG: Forcing hardware level 3 for view distance settings.");
	// setViewDistancesForHardwareLevel(3); 
	// if (playerRef) playerRef.forceChunkUpdate = true; // Force update if debugging
	// --- END DEBUG ---
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

	if (highPerfMode) {
		updateActiveViewDistances(1, 1, 2, 3, 4); // min, ideal, max, preload, border
		setMaxCachedChunks(100);
		if (sceneRef.fog) {
			sceneRef.fog.near = 10;
			sceneRef.fog.far = 30;
		}
		perfButton.textContent = "Normal Mode";
		perfButton.style.background = "#553300";
	} else {
		setViewDistancesForHardwareLevel(initialHardwareLevel); // Restore based on initial hardware level
		setMaxCachedChunks(500); // Default from config.js
		if (sceneRef.fog) {
			sceneRef.fog.near = 15;
			sceneRef.fog.far = 45;
		}
		perfButton.textContent = "High Performance Mode";
		perfButton.style.background = "#333";
	}

	if (playerRef) playerRef.forceChunkUpdate = true;
	console.log(
		`Performance mode toggled. New ideal view distance: ${currentViewDistanceIdeal} (active)`
	);
}

function setViewDistancesForHardwareLevel(hardwareLevel) {
	let minVD, idealVD, maxVD, preloadVD, borderVD;
	switch (hardwareLevel) {
		case 1: // Lowest performance
			minVD = 1; idealVD = 1; maxVD = 1;
			preloadVD = 2; borderVD = 3;
			break;
		case 2:
			minVD = 1; idealVD = 1; maxVD = 2;
			preloadVD = 3; borderVD = 4;
			break;
		case 3: // Medium
			minVD = VIEW_DISTANCE_MIN; idealVD = VIEW_DISTANCE_IDEAL; maxVD = VIEW_DISTANCE_MAX;
			preloadVD = VIEW_DISTANCE_PRELOAD_FAR; borderVD = VIEW_DISTANCE_BORDER_EXPANSION;
			break;
		case 4: // High
			minVD = VIEW_DISTANCE_MIN; idealVD = VIEW_DISTANCE_IDEAL + 1; maxVD = VIEW_DISTANCE_MAX + 1;
			preloadVD = maxVD + 1; borderVD = maxVD + 2;
			break;
		case 5: // Highest performance
		default:
			minVD = VIEW_DISTANCE_MIN + 1; idealVD = VIEW_DISTANCE_IDEAL + 1; maxVD = VIEW_DISTANCE_MAX + 1;
			preloadVD = maxVD + 1; borderVD = maxVD + 2;
			break;
	}
	updateActiveViewDistances(minVD, idealVD, maxVD, preloadVD, borderVD);
	console.log(`[PerformanceMonitor] View distances set for hardware level ${hardwareLevel}: Min=${minVD}, Ideal=${idealVD}, Max=${maxVD}, Preload=${preloadVD}, Border=${borderVD}`);
	console.log(`[PerformanceMonitor] Config check: currentIdealVD = ${currentViewDistanceIdeal}, currentPreloadFar = ${currentViewDistancePreloadFar}`);
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
