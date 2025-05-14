import { getCurrentBiome, setCurrentBiome } from "../world/worldManager.js";
import { getPlayerState } from "../gameplay/player.js";
import { itemProperties, blockMaterials } from "../config.js"; // For block selector
import { focusGameCanvas } from "../core/controls.js";

let selectedBlockType = "grass"; // Default selected block
let simplexRef, sceneRef, playerRef, controlsRef, isGameStartedRef; // References from main

export function initUIManager(
	_simplex,
	_scene,
	_player,
	_controls,
	_isGameStartedRef,
	startGameCallback,
	respawnCallback
) {
	simplexRef = _simplex;
	sceneRef = _scene;
	playerRef = _player;
	controlsRef = _controls;
	isGameStartedRef = _isGameStartedRef;

	setupButtonEventListeners(startGameCallback, respawnCallback);
	setupBlockSelector();
	setupBiomeButtons();
	setupSpacebarFocusPrevention();

	// Make global for access from other modules if needed (e.g. inventory manager updating block selector)
	window.gameModules = window.gameModules || {};
	window.gameModules.uiManager = {
		getSelectedBlockType: () => selectedBlockType,
		updateBlockSelector: updateBlockSelector,
		toggleUIMode: toggleUIMode,
		showLoadingScreen: showLoadingScreen,
		hideLoadingScreen: hideLoadingScreen,
		updateLoadingProgress: updateLoadingProgress,
	};
}

function setupButtonEventListeners(startGameCallback, respawnCallback) {
	document
		.getElementById("startButton")
		.addEventListener("click", startGameCallback);
	document
		.getElementById("respawnButton")
		.addEventListener("click", respawnCallback);

	// Prevent context menu on right-click for game area
	document.querySelector("body").addEventListener("contextmenu", (event) => {
		// Only prevent if game is active and pointer is locked, or if target is canvas
		if (
			(isGameStartedRef.value && controlsRef.isLocked) ||
			event.target.tagName === "CANVAS"
		) {
			event.preventDefault();
		}
	});
}

function setupBlockSelector() {
	document.querySelectorAll("#blockSelector .block-type").forEach((element) => {
		element.addEventListener("click", () => {
			document
				.querySelectorAll("#blockSelector .block-type.selected")
				.forEach((el) => el.classList.remove("selected"));
			element.classList.add("selected");
			selectedBlockType = element.dataset.type;
		});
	});
}

function setupBiomeButtons() {
	document.querySelectorAll("#ui .biome-btn").forEach((element) => {
		element.addEventListener("click", () => {
			document
				.querySelectorAll("#ui .biome-btn.active")
				.forEach((el) => el.classList.remove("active"));
			element.classList.add("active");
			const newBiome = element.dataset.biome;
			setCurrentBiome(newBiome, playerRef, sceneRef, simplexRef); // Notify world manager

			const soundManager = window.gameModules.soundManager; // Access via global
			if (soundManager && isGameStartedRef.value) {
				soundManager.playAmbientSound(newBiome);
			}

			// Ensure controls are locked for gameplay after biome change
			if (isGameStartedRef && isGameStartedRef.value && controlsRef) {
				if (!controlsRef.isLocked) {
					controlsRef.lock();
				} else {
					// If already locked, ensure the canvas has focus,
					// as DOM interaction might have shifted it.
					focusGameCanvas();
				}
			}
		});
	});
}

export function updateTimeDisplay(isDay, cycleProgress) {
	const timeDisplay = document.getElementById("timeDisplay");
	let phase = isDay ? "Day" : "Night";
	if (isDay) {
		if (cycleProgress < 0.15) phase = "Sunrise";
		else if (cycleProgress > 0.85) phase = "Sunset";
		else phase = "Day";
	} else {
		if (cycleProgress < 0.15) phase = "Dusk";
		else if (cycleProgress > 0.85) phase = "Dawn";
		else phase = "Night";
	}
	timeDisplay.textContent = `Time: ${phase} (${Math.floor(
		cycleProgress * 100
	)}%)`;
}

export function toggleUIMode(controls) {
	const uiMessage = document.getElementById("uiModeMessage");
	if (controls.isLocked) {
		controls.unlock();
		uiMessage.style.display = "block";
		document.getElementById("instructions").style.display = "none"; // Ensure instructions are hidden
	} else {
		// Only lock if not in crafting UI
		if (document.getElementById("craftingUI").style.display === "none") {
			controls.lock();
			uiMessage.style.display = "none";
		}
	}
}

export function updateBlockSelector(playerInventory) {
	const blockSelectorContainer = document.getElementById("blockSelector");

	// Clear existing craftable/tool items except defaults
	const defaultTypes = ["grass", "dirt", "stone", "sand", "wood"];
	blockSelectorContainer.querySelectorAll(".block-type").forEach((el) => {
		if (!defaultTypes.includes(el.dataset.type)) {
			el.remove();
		}
	});

	// Add placeable crafted items if in inventory
	const placeableCrafted = ["crafting_table"]; // Extend as needed
	placeableCrafted.forEach((item) => {
		if (playerInventory[item] && playerInventory[item] > 0) {
			if (
				!blockSelectorContainer.querySelector(
					`.block-type[data-type="${item}"]`
				)
			) {
				const itemDiv = document.createElement("div");
				itemDiv.className = "block-type";
				itemDiv.dataset.type = item;
				const preview = document.createElement("div");
				preview.className = "block-preview";
				// Use itemProperties for color/style
				if (itemProperties[item] && itemProperties[item].color) {
					preview.style.backgroundColor = itemProperties[item].color;
				} else if (blockMaterials[item]) {
					preview.style.backgroundColor = `#${blockMaterials[
						item
					].color.getHexString()}`;
				} else {
					preview.style.backgroundColor = "#CCCCCC"; // Default
				}

				const span = document.createElement("span");
				span.textContent = itemProperties[item]
					? itemProperties[item].name
					: item;
				itemDiv.appendChild(preview);
				itemDiv.appendChild(span);
				itemDiv.addEventListener("click", () => {
					document
						.querySelectorAll("#blockSelector .block-type.selected")
						.forEach((el) => el.classList.remove("selected"));
					itemDiv.classList.add("selected");
					selectedBlockType = item;
				});
				blockSelectorContainer.appendChild(itemDiv);
			}
		}
	});
	// Ensure current selection is still valid
	if (
		!blockSelectorContainer.querySelector(
			`.block-type[data-type="${selectedBlockType}"].selected`
		)
	) {
		const firstAvailable = blockSelectorContainer.querySelector(".block-type");
		if (firstAvailable) {
			firstAvailable.click(); // Select the first available block
		}
	}
}

function setupSpacebarFocusPrevention() {
	// Buttons should not activate on spacebar if game is active
	const allButtons = document.querySelectorAll("button");
	allButtons.forEach((button) => {
		button.addEventListener("keydown", function (event) {
			if (
				(isGameStartedRef.value || (controlsRef && controlsRef.isLocked)) &&
				(event.code === "Space" || event.key === " ")
			) {
				event.preventDefault();
				event.stopPropagation();
			}
		});
		button.addEventListener("focus", function () {
			if (isGameStartedRef.value || (controlsRef && controlsRef.isLocked)) {
				this.blur();
				focusGameCanvas();
			}
		});
	});
}

export function showLoadingScreen() {
	document.getElementById("loadingScreen").style.display = "flex";
	document.getElementById("loadingProgress").style.width = "0%";
	document.getElementById("loadingStatus").textContent = "Initializing...";
}
export function hideLoadingScreen() {
	document.getElementById("loadingScreen").style.display = "none";
}
export function updateLoadingProgress(percentage, statusText) {
	document.getElementById("loadingProgress").style.width = percentage + "%";
	document.getElementById("loadingStatus").textContent = statusText;
}

// Called from main game loop if needed
export function updateUI() {
	// Example: Update crosshair based on interaction target, etc.
	// updateTimeDisplay is called from dayNightCycle.js
}
