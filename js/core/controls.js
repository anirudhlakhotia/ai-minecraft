let controls;
const keyboard = {};
let isGameStartedRef; // Reference to main.isGameStarted

export function initControls(camera, domElement, _isGameStartedRef) {
	isGameStartedRef = _isGameStartedRef;
	controls = new THREE.PointerLockControls(camera, domElement);

	document.getElementById("startButton").addEventListener("click", () => {
		// Locking controls is handled by UIManager after world load
	});

	controls.addEventListener("lock", () => {
		document.getElementById("instructions").style.display = "none";
		document.getElementById("uiModeMessage").style.display = "none";
	});

	controls.addEventListener("unlock", () => {
		if (isGameStartedRef && !isGameStartedRef.value) {
			// If game hasn't truly started (e.g. initial screen)
			document.getElementById("instructions").style.display = "flex";
		}
		// If crafting UI is not open, show instructions or UI mode message
		if (
			!document.getElementById("craftingUI") ||
			document.getElementById("craftingUI").style.display === "none"
		) {
			if (isGameStartedRef && isGameStartedRef.value) {
				// Game is running but paused
				document.getElementById("uiModeMessage").style.display = "block";
			} else {
				// Game not started yet
				document.getElementById("instructions").style.display = "flex";
			}
		}
	});

	initKeyboardControls();
	return controls;
}

export function getControls() {
	return controls;
}
export function getKeyboardState() {
	return keyboard;
}

function initKeyboardControls() {
	document.addEventListener("keydown", onKeyDown);
	document.addEventListener("keyup", onKeyUp);

	// Spacebar capture to prevent button activation during gameplay
	document.addEventListener(
		"keydown",
		function (event) {
			if (
				isGameStartedRef &&
				isGameStartedRef.value &&
				(event.code === "Space" || event.key === " ")
			) {
				event.preventDefault();
				event.stopPropagation();
				keyboard[" "] = true; // Manually set for jump
				return false;
			}
		},
		true
	);

	document.addEventListener(
		"keyup",
		function (event) {
			if (
				isGameStartedRef &&
				isGameStartedRef.value &&
				(event.code === "Space" || event.key === " ")
			) {
				event.preventDefault();
				event.stopPropagation();
				keyboard[" "] = false;
				return false;
			}
		},
		true
	);
}

function onKeyDown(event) {
	const key = event.key.toLowerCase();
	if (key !== " ") {
		// Space is handled by capture listener
		keyboard[key] = true;
	}

	if (event.key === "ArrowUp") keyboard["w"] = true;
	if (event.key === "ArrowDown") keyboard["s"] = true;
	if (event.key === "ArrowLeft") keyboard["a"] = true;
	if (event.key === "ArrowRight") keyboard["d"] = true;

	if (isGameStartedRef && isGameStartedRef.value) {
		if (event.key === "Escape") {
			controls.unlock();
			// isGameStarted will be set to false in UIManager or main
		}
		if (event.key === "Tab") {
			event.preventDefault();
			// toggleUIMode is in UIManager
			const uiManager = window.gameModules.uiManager; // Access via global for now
			if (uiManager) uiManager.toggleUIMode(controls);
		}
		if (event.key === "e") {
			event.preventDefault();
			// toggleCraftingUI is in InventoryManager
			const inventoryManager = window.gameModules.inventoryManager; // Access via global
			if (inventoryManager) inventoryManager.toggleCraftingUI(controls);
		}
	}
}

function onKeyUp(event) {
	const key = event.key.toLowerCase();
	if (key !== " ") {
		// Space is handled by capture listener
		keyboard[key] = false;
	}

	if (event.key === "ArrowUp") keyboard["w"] = false;
	if (event.key === "ArrowDown") keyboard["s"] = false;
	if (event.key === "ArrowLeft") keyboard["a"] = false;
	if (event.key === "ArrowRight") keyboard["d"] = false;
}

export function setupMouseInteraction(onMouseClickCallback) {
	document.addEventListener("mousedown", (event) => {
		if (isGameStartedRef && isGameStartedRef.value && controls.isLocked) {
			onMouseClickCallback(event);
		}
	});
	// Highlight color changes are handled in renderer.js via main.js
}

export function focusGameCanvas() {
	if (isGameStartedRef && !isGameStartedRef.value) return;
	const gameCanvas = document.querySelector("canvas");
	if (gameCanvas) {
		gameCanvas.focus();
		document.querySelectorAll("button").forEach((button) => button.blur());
	}
}
