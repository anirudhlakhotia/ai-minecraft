import {
	initialPlayerInventory,
	recipes,
	itemProperties,
	blockMaterials,
} from "../config.js";
import { formatItemName, getDefaultColorForItem } from "../utils.js";

let playerInventory = { ...initialPlayerInventory };
let craftingGrid = [
	[null, null, null],
	[null, null, null],
	[null, null, null],
];
let isCraftingOpen = false;
let currentRecipeResult = null;
let selectedInventorySlot = null; // For picking items from inventory to place in grid

let controlsRef; // To lock/unlock pointer lock

export function initInventory(_controls) {
	controlsRef = _controls;
	playerInventory.wood = 5; // Starting wood

	initCraftingSystemDOM();
	updateInventoryDisplay();
	updateBlockSelectorAvailability(); // Initial availability based on inventory

	// Keyboard shortcut for crafting ('e') is handled in controls.js
	// and calls toggleCraftingUI from here.
}

export function getPlayerInventory() {
	return playerInventory;
}
export function getSelectedBlockTypeForPlacement() {
	// This function needs to be aware of the selected block in the UI
	// For now, this is handled by uiManager's selectedBlockType
	// This inventory manager primarily deals with crafting and quantities
	return window.gameModules.uiManager.getSelectedBlockType();
}

function initCraftingSystemDOM() {
	const craftingGridElement = document.getElementById("craftingGrid");
	craftingGridElement.innerHTML = "";
	for (let y = 0; y < 3; y++) {
		for (let x = 0; x < 3; x++) {
			const slot = document.createElement("div");
			slot.className = "craftingSlot";
			slot.dataset.x = x;
			slot.dataset.y = y;
			slot.addEventListener("click", () => handleCraftingSlotClick(x, y));
			craftingGridElement.appendChild(slot);
		}
	}
	document.getElementById("craftBtn").addEventListener("click", handleCraft);
	document
		.getElementById("clearBtn")
		.addEventListener("click", clearCraftingGrid);
	document
		.getElementById("closeCraftingBtn")
		.addEventListener("click", () => toggleCraftingUI(controlsRef));
	updateInventoryGrid();
}

export function toggleCraftingUI(controls) {
	isCraftingOpen = !isCraftingOpen;
	document.getElementById("craftingUI").style.display = isCraftingOpen
		? "block"
		: "none";
	if (isCraftingOpen) {
		controls.unlock();
		updateInventoryGrid();
		document.getElementById("uiModeMessage").style.display = "none"; // Hide UI mode message
	} else {
		selectedInventorySlot = null;
		document.body.style.cursor = "default";
		if (window.gameModules.main.getIsGameStarted()) controls.lock(); // Only lock if game is running
	}
}

function updateInventoryGrid() {
	const inventoryGridElement = document.getElementById("inventoryGrid");
	inventoryGridElement.innerHTML = "";
	const inventoryItems = Object.entries(playerInventory).filter(
		([_, quantity]) => quantity > 0
	);

	for (const [item, quantity] of inventoryItems) {
		const slot = document.createElement("div");
		slot.className = "inventorySlot";
		slot.dataset.item = item;

		const itemElement = document.createElement("div");
		itemElement.className = "slotItem";
		if (itemProperties[item] && itemProperties[item].render) {
			itemProperties[item].render(itemElement);
		} else {
			itemElement.style.backgroundColor = itemProperties[item]
				? itemProperties[item].color
				: getDefaultColorForItem(item, itemProperties);
		}

		const quantityElement = document.createElement("div");
		quantityElement.className = "slotQuantity";
		quantityElement.textContent = quantity;

		slot.appendChild(itemElement);
		slot.appendChild(quantityElement);
		slot.addEventListener("click", () => handleInventorySlotClick(item));
		inventoryGridElement.appendChild(slot);
	}
}

export function updateInventoryDisplay() {
	const inventoryDisplayElement = document.getElementById("inventoryDisplay");
	inventoryDisplayElement.innerHTML = "";
	const availableItems = Object.entries(playerInventory)
		.filter(([_, q]) => q > 0)
		.map(([item]) => item);
	const priorityItems = ["wood", "stone", "dirt", "grass", "sand", "snow"];
	const sortedItems = availableItems.sort((a, b) => {
		const aP = priorityItems.indexOf(a),
			bP = priorityItems.indexOf(b);
		if (aP >= 0 && bP >= 0) return aP - bP;
		if (aP >= 0) return -1;
		if (bP >= 0) return 1;
		return a.localeCompare(b);
	});

	for (const item of sortedItems) {
		if (
			[
				"wooden_pickaxe",
				"stone_pickaxe",
				"wooden_axe",
				"stone_axe",
				"crafting_table",
				"stick",
			].includes(item)
		)
			continue; // Don't show tools/intermediate items here

		const itemDiv = document.createElement("div");
		itemDiv.className = "invItem";
		const icon = document.createElement("div");
		icon.className = "invIcon";

		if (!itemProperties[item]) {
			// Ensure item property exists
			itemProperties[item] = {
				color: getDefaultColorForItem(item, itemProperties),
				name: formatItemName(item),
			};
		}

		if (itemProperties[item].render) {
			// For complex items, scale down render
			icon.style.position = "relative";
			icon.style.overflow = "hidden";
			const miniItem = document.createElement("div");
			miniItem.style.transformOrigin = "top left";
			miniItem.style.transform = "scale(0.5)";
			miniItem.style.width = "40px";
			miniItem.style.height = "40px";
			miniItem.style.position = "absolute";
			itemProperties[item].render(miniItem);
			icon.appendChild(miniItem);
		} else {
			icon.style.backgroundColor = itemProperties[item].color;
		}
		const count = document.createElement("span");
		count.textContent = playerInventory[item];
		itemDiv.appendChild(icon);
		itemDiv.appendChild(count);
		inventoryDisplayElement.appendChild(itemDiv);
	}
	updateBlockSelectorAvailability(); // Update block selector based on new inventory
}

function handleCraftingSlotClick(x, y) {
	if (!selectedInventorySlot || playerInventory[selectedInventorySlot] <= 0) {
		// If trying to remove an item from grid by clicking on it when no inventory item is selected
		if (!selectedInventorySlot && craftingGrid[y][x]) {
			const itemInSlot = craftingGrid[y][x];
			playerInventory[itemInSlot]++; // Return to inventory
			craftingGrid[y][x] = null; // Clear from grid
		} else {
			return;
		}
	} else {
		// Placing an item from selected inventory slot
		craftingGrid[y][x] = selectedInventorySlot;
		playerInventory[selectedInventorySlot]--;
	}

	updateInventoryGrid();
	updateInventoryDisplay();
	updateCraftingGridUI();
	checkForRecipeMatch();
	if (playerInventory[selectedInventorySlot] <= 0 || !craftingGrid[y][x]) {
		// If item ran out or was removed
		selectedInventorySlot = null; // Clear selection
		document
			.querySelectorAll(".inventorySlot.selected")
			.forEach((el) => el.classList.remove("selected"));
		document.body.style.cursor = "default";
	}
}

function handleInventorySlotClick(item) {
	selectedInventorySlot = selectedInventorySlot === item ? null : item;
	document.querySelectorAll(".inventorySlot").forEach((slot) => {
		slot.style.border =
			slot.dataset.item === selectedInventorySlot
				? "2px solid #ffff00"
				: "2px solid #777";
		if (slot.dataset.item === selectedInventorySlot)
			slot.classList.add("selected");
		else slot.classList.remove("selected");
	});
	document.body.style.cursor = selectedInventorySlot ? "grabbing" : "default";
}

function updateCraftingGridUI() {
	const slots = document.querySelectorAll("#craftingGrid .craftingSlot");
	slots.forEach((slot) => {
		const x = parseInt(slot.dataset.x),
			y = parseInt(slot.dataset.y);
		const item = craftingGrid[y][x];
		slot.innerHTML = "";
		slot.classList.remove("filled");
		if (item) {
			const itemElement = document.createElement("div");
			itemElement.className = "slotItem";
			if (itemProperties[item] && itemProperties[item].render)
				itemProperties[item].render(itemElement);
			else
				itemElement.style.backgroundColor = itemProperties[item]
					? itemProperties[item].color
					: getDefaultColorForItem(item, itemProperties);
			slot.appendChild(itemElement);
			slot.classList.add("filled");
		}
	});
}

function checkForRecipeMatch() {
	currentRecipeResult = null;
	const craftBtn = document.getElementById("craftBtn");
	const resultSlot = document.getElementById("resultSlot");
	resultSlot.innerHTML = "";

	for (const recipe of recipes) {
		if (comparePattern(craftingGrid, recipe.pattern)) {
			currentRecipeResult = recipe.result;
			const resultItemDiv = document.createElement("div");
			resultItemDiv.className = "slotItem";
			if (
				itemProperties[recipe.result.item] &&
				itemProperties[recipe.result.item].render
			) {
				itemProperties[recipe.result.item].render(resultItemDiv);
			} else {
				resultItemDiv.style.backgroundColor = itemProperties[recipe.result.item]
					? itemProperties[recipe.result.item].color
					: getDefaultColorForItem(recipe.result.item, itemProperties);
			}
			const resultQuantity = document.createElement("div");
			resultQuantity.className = "slotQuantity";
			resultQuantity.textContent = recipe.result.quantity;
			resultSlot.appendChild(resultItemDiv);
			resultSlot.appendChild(resultQuantity);
			craftBtn.disabled = false;
			return;
		}
	}
	craftBtn.disabled = true;
}

function comparePattern(grid, pattern) {
	for (let y = 0; y < 3; y++) {
		for (let x = 0; x < 3; x++) {
			// If pattern expects an item but grid is empty, or vice-versa (unless pattern is null)
			if (pattern[y][x] !== null && grid[y][x] !== pattern[y][x]) return false;
			// If pattern expects null but grid has an item
			if (pattern[y][x] === null && grid[y][x] !== null) return false;
		}
	}
	return true;
}

function handleCraft() {
	if (!currentRecipeResult) return;
	playerInventory[currentRecipeResult.item] =
		(playerInventory[currentRecipeResult.item] || 0) +
		currentRecipeResult.quantity;

	// Ingredients are already "deducted" when placed on grid for UI purpose.
	// This craft confirms their consumption. If grid is cleared, they are returned.
	// So, no need to deduct from playerInventory again here.
	// What we need to do is to clear the grid *without* returning items.
	craftingGrid = [
		[null, null, null],
		[null, null, null],
		[null, null, null],
	]; // Grid is now empty

	updateCraftingGridUI(); // Update grid to show empty slots
	checkForRecipeMatch(); // This will clear result and disable craft button
	updateInventoryGrid(); // Update inventory counts (which are now final)
	updateInventoryDisplay();
}

function clearCraftingGrid() {
	for (let y = 0; y < 3; y++) {
		for (let x = 0; x < 3; x++) {
			if (craftingGrid[y][x]) {
				playerInventory[craftingGrid[y][x]]++; // Return item to inventory
				craftingGrid[y][x] = null;
			}
		}
	}
	selectedInventorySlot = null; // Clear selection
	document.body.style.cursor = "default";
	updateCraftingGridUI();
	updateInventoryGrid();
	updateInventoryDisplay();
	checkForRecipeMatch(); // Clear result and disable craft button
}

export function addBlockToInventory(blockType) {
	let resource = blockType;
	if (blockType === "grass") resource = "grass"; // or dirt based on tool
	else if (blockType.includes("sand_")) resource = "sand";

	playerInventory[resource] = (playerInventory[resource] || 0) + 1;
	updateInventoryDisplay();
	updateBlockSelectorAvailability();
}

export function consumeBlockFromInventory(blockType) {
	if (playerInventory[blockType] && playerInventory[blockType] > 0) {
		playerInventory[blockType]--;
		updateInventoryDisplay();
		updateBlockSelectorAvailability();
		return true;
	}
	return false;
}

// Update block selector based on inventory (placeable items)
export function updateBlockSelectorAvailability() {
	const uiManager = window.gameModules.uiManager;
	if (uiManager) {
		uiManager.updateBlockSelector(playerInventory);
	}
}
