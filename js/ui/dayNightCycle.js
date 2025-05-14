import { lerp, lerpColor } from "../utils.js";
import { updateTimeDisplay } from "./uiManager.js"; // For updating time display text

let dayNightCycleState = {
	time: 0, // Current time in the cycle (seconds)
	duration: 300, // Duration of a full day-night cycle (seconds) - from config
	isDay: true, // Current phase
	// Lights will be assigned from renderer.js
	directionalLight: null,
	ambientLight: null,
	hemiLight: null,
	// For optimized updates
	shadowUpdateFrequency: 1,
	frameCounter: 0,
	cycleSpeed: 1 / 300, // Progress per second, will be set from config
	timeOfDay: 0.25, // Normalized time (0-1), 0.25 is morning
};

export function initDayNightCycle(configDuration) {
	dayNightCycleState.duration = configDuration;
	dayNightCycleState.cycleSpeed = 1 / configDuration;
	// Light objects (directionalLight, ambientLight, hemiLight) are set up
	// and assigned to dayNightCycleState by renderer.js's setupHighlyOptimizedLights
	return dayNightCycleState; // Return the state object
}

export function getDayNightCycleState() {
	return dayNightCycleState;
}

export function updateDayNightCycle(delta, scene) {
	const state = dayNightCycleState;
	if (!state.directionalLight || !state.ambientLight) return;

	state.timeOfDay += delta * state.cycleSpeed;
	if (state.timeOfDay >= 1) state.timeOfDay = 0;

	state.frameCounter++;
	const shouldUpdateShadows =
		state.frameCounter % state.shadowUpdateFrequency === 0;

	// Sun/Moon position
	const angle = state.timeOfDay * Math.PI * 2; // Full circle
	const sunHeight = Math.sin(state.timeOfDay * Math.PI); // 0 at horizon, 1 at noon, 0 at horizon again

	state.directionalLight.position.set(
		Math.cos(angle) * 150, // East-West movement
		sunHeight * 150 + 20, // Up-Down movement, ensure always above some horizon
		Math.sin(angle) * 50 // North-South tilt (less pronounced)
	);
	if (state.directionalLight.target) {
		// If a target is used for shadows
		state.directionalLight.target.position.set(
			state.directionalLight.position.x - Math.cos(angle) * 0.1, // Look slightly ahead
			0,
			state.directionalLight.position.z - Math.sin(angle) * 0.1
		);
		state.directionalLight.target.updateMatrixWorld();
	}

	if (
		shouldUpdateShadows &&
		state.directionalLight.castShadow &&
		state.directionalLight.shadow
	) {
		state.directionalLight.shadow.needsUpdate = true;
	}

	// Light color and intensity
	const t = state.timeOfDay; // 0-1
	let intensityFactor, sunColorHex, ambientColorHex, skyColorRGB, fogColorRGB;

	if (t < 0.05 || t > 0.95) {
		// Deep Night
		intensityFactor = 0.1;
		sunColorHex = 0x50608f;
		ambientColorHex = 0x101528;
		skyColorRGB = [0.02, 0.03, 0.07];
	} else if (t < 0.2) {
		// Dawn
		const p = (t - 0.05) / 0.15; // 0 to 1
		intensityFactor = lerp(0.1, 0.8, p);
		sunColorHex = lerpColor(0x50608f, 0xffdab9, p);
		ambientColorHex = lerpColor(0x101528, 0x60709f, p);
		skyColorRGB = [lerp(0.02, 0.4, p), lerp(0.03, 0.5, p), lerp(0.07, 0.7, p)];
	} else if (t < 0.25) {
		// Sunrise
		const p = (t - 0.2) / 0.05;
		intensityFactor = lerp(0.8, 1.2, p);
		sunColorHex = lerpColor(0xffdab9, 0xffeac3, p);
		ambientColorHex = lerpColor(0x60709f, 0x8097bb, p);
		skyColorRGB = [lerp(0.4, 0.6, p), lerp(0.5, 0.85, p), lerp(0.7, 0.99, p)];
	} else if (t < 0.75) {
		// Day
		intensityFactor = 1.2;
		sunColorHex = 0xffeac3;
		ambientColorHex = 0x8097bb;
		skyColorRGB = [0.6, 0.85, 0.99];
	} else if (t < 0.8) {
		// Sunset
		const p = (t - 0.75) / 0.05;
		intensityFactor = lerp(1.2, 0.8, p);
		sunColorHex = lerpColor(0xffeac3, 0xffb08d, p);
		ambientColorHex = lerpColor(0x8097bb, 0x70608f, p);
		skyColorRGB = [lerp(0.6, 0.5, p), lerp(0.85, 0.4, p), lerp(0.99, 0.6, p)];
	} else {
		// Dusk (t < 0.95 handled by first condition)
		const p = (t - 0.8) / 0.15;
		intensityFactor = lerp(0.8, 0.1, p);
		sunColorHex = lerpColor(0xffb08d, 0x50608f, p);
		ambientColorHex = lerpColor(0x70608f, 0x101528, p);
		skyColorRGB = [lerp(0.5, 0.02, p), lerp(0.4, 0.03, p), lerp(0.6, 0.07, p)];
	}

	state.directionalLight.intensity = intensityFactor;
	state.directionalLight.color.setHex(sunColorHex);
	state.ambientLight.intensity = intensityFactor * 0.4 + 0.1; // Ambient also changes
	state.ambientLight.color.setHex(ambientColorHex);

	if (state.hemiLight) {
		state.hemiLight.intensity = intensityFactor * 0.2 + 0.05;
	}

	fogColorRGB = skyColorRGB; // Fog matches sky
	scene.background = new THREE.Color().setRGB(...skyColorRGB);
	scene.fog.color.setRGB(...fogColorRGB);

	state.isDay = t > 0.22 && t < 0.78; // Broader definition of day for UI
	updateTimeDisplay(state.isDay, t);
}

// This is called from renderer.js during its init to link the light objects
export function linkLightsToCycle(
	directionalLight,
	ambientLight,
	hemiLight = null
) {
	dayNightCycleState.directionalLight = directionalLight;
	dayNightCycleState.ambientLight = ambientLight;
	dayNightCycleState.hemiLight = hemiLight;
}
