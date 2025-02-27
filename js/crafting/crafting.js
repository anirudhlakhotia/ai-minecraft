import { controls } from '../player/controls.js';
import { updateBlockSelector } from '../ui/blockSelector.js';

// Crafting system variables
export let playerInventory = {
    grass: 0,
    dirt: 0,
    stone: 0,
    sand: 0,
    wood: 0,
    stick: 0,
    wooden_pickaxe: 0,
    stone_pickaxe: 0,
    wooden_axe: 0,
    stone_axe: 0,
    crafting_table: 0
};

// Grid state
let craftingGrid = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
];

// UI state
export let isCraftingOpen = false;
let currentRecipeResult = null;
let selectedInventorySlot = null;

// Recipe definitions
export const recipes = [
    {
        id: "stick",
        pattern: [
            [null, null, null],
            [null, "wood", null],
            [null, "wood", null]
        ],
        result: { item: "stick", quantity: 4 }
    },
    {
        id: "wooden_pickaxe",
        pattern: [
            ["wood", "wood", "wood"],
            [null, "stick", null],
            [null, "stick", null]
        ],
        result: { item: "wooden_pickaxe", quantity: 1 }
    },
    {
        id: "wooden_axe",
        pattern: [
            ["wood", "wood", null],
            ["wood", "stick", null],
            [null, "stick", null]
        ],
        result: { item: "wooden_axe", quantity: 1 }
    },
    {
        id: "stone_pickaxe",
        pattern: [
            ["stone", "stone", "stone"],
            [null, "stick", null],
            [null, "stick", null]
        ],
        result: { item: "stone_pickaxe", quantity: 1 }
    },
    {
        id: "stone_axe",
        pattern: [
            ["stone", "stone", null],
            ["stone", "stick", null],
            [null, "stick", null]
        ],
        result: { item: "stone_axe", quantity: 1 }
    },
    {
        id: "crafting_table",
        pattern: [
            ["wood", "wood", null],
            ["wood", "wood", null],
            [null, null, null]
        ],
        result: { item: "crafting_table", quantity: 1 }
    }
];

// Item display properties (colors, names, etc.)
export const itemProperties = {
    grass: { color: "#3A9D23", name: "Grass Block" },
    dirt: { color: "#59472B", name: "Dirt" },
    stone: { color: "#666666", name: "Stone" },
    sand: { color: "#DBC681", name: "Sand" },
    water: { color: "#1E90FF", name: "Water" },
    wood: { color: "#52341D", name: "Wood" },
    stick: { 
        color: "#8B5A2B", 
        name: "Stick",
        render: function(element) {
            element.style.backgroundColor = "#8B5A2B";
            element.style.width = "15px";
            element.style.height = "35px";
            element.style.margin = "auto";
        }
    },
    wooden_pickaxe: { 
        color: "#8B4513", 
        name: "Wooden Pickaxe",
        render: function(element) {
            // Create pickaxe head
            const head = document.createElement('div');
            head.style.width = "30px";
            head.style.height = "10px";
            head.style.backgroundColor = "#8B4513";
            head.style.position = "absolute";
            head.style.top = "5px";
            head.style.left = "50%";
            head.style.transform = "translateX(-50%)";
            
            // Create handle
            const handle = document.createElement('div');
            handle.style.width = "6px";
            handle.style.height = "25px";
            handle.style.backgroundColor = "#8B5A2B";
            handle.style.position = "absolute";
            handle.style.top = "15px";
            handle.style.left = "50%";
            handle.style.transform = "translateX(-50%)";
            
            element.innerHTML = '';
            element.appendChild(head);
            element.appendChild(handle);
            element.style.position = "relative";
        }
    },
    stone_pickaxe: { 
        color: "#808080", 
        name: "Stone Pickaxe",
        render: function(element) {
            // Create pickaxe head
            const head = document.createElement('div');
            head.style.width = "30px";
            head.style.height = "10px";
            head.style.backgroundColor = "#808080";
            head.style.position = "absolute";
            head.style.top = "5px";
            head.style.left = "50%";
            head.style.transform = "translateX(-50%)";
            
            // Create handle
            const handle = document.createElement('div');
            handle.style.width = "6px";
            handle.style.height = "25px";
            handle.style.backgroundColor = "#8B5A2B";
            handle.style.position = "absolute";
            handle.style.top = "15px";
            handle.style.left = "50%";
            handle.style.transform = "translateX(-50%)";
            
            element.innerHTML = '';
            element.appendChild(head);
            element.appendChild(handle);
            element.style.position = "relative";
        }
    },
    wooden_axe: { 
        color: "#8B4513", 
        name: "Wooden Axe",
        render: function(element) {
            // Create axe head
            const head = document.createElement('div');
            head.style.width = "20px";
            head.style.height = "20px";
            head.style.backgroundColor = "#8B4513";
            head.style.position = "absolute";
            head.style.top = "2px";
            head.style.left = "60%";
            head.style.clipPath = "polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)";
            
            // Create handle
            const handle = document.createElement('div');
            handle.style.width = "6px";
            handle.style.height = "30px";
            handle.style.backgroundColor = "#8B5A2B";
            handle.style.position = "absolute";
            handle.style.top = "10px";
            handle.style.left = "40%";
            handle.style.transform = "rotate(45deg)";
            
            element.innerHTML = '';
            element.appendChild(handle);
            element.appendChild(head);
            element.style.position = "relative";
        }
    },
    stone_axe: { 
        color: "#808080", 
        name: "Stone Axe",
        render: function(element) {
            // Create axe head
            const head = document.createElement('div');
            head.style.width = "20px";
            head.style.height = "20px";
            head.style.backgroundColor = "#808080";
            head.style.position = "absolute";
            head.style.top = "2px";
            head.style.left = "60%";
            head.style.clipPath = "polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)";
            
            // Create handle
            const handle = document.createElement('div');
            handle.style.width = "6px";
            handle.style.height = "30px";
            handle.style.backgroundColor = "#8B5A2B";
            handle.style.position = "absolute";
            handle.style.top = "10px";
            handle.style.left = "40%";
            handle.style.transform = "rotate(45deg)";
            
            element.innerHTML = '';
            element.appendChild(handle);
            element.appendChild(head);
            element.style.position = "relative";
        }
    },
    crafting_table: { 
        color: "#7D5A1A", 
        name: "Crafting Table",
        render: function(element) {
            // Create grid pattern
            element.style.backgroundImage = "linear-gradient(#8B5A2B 1px, transparent 1px), linear-gradient(90deg, #8B5A2B 1px, transparent 1px)";
            element.style.backgroundSize = "10px 10px";
            element.style.backgroundColor = "#7D5A1A";
        }
    }
};

// Initialize crafting system
export function initCraftingSystem() {
    // Create crafting grid slots
    const craftingGridElement = document.getElementById('craftingGrid');
    craftingGridElement.innerHTML = '';
    
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const slot = document.createElement('div');
            slot.className = 'craftingSlot';
            slot.dataset.x = x;
            slot.dataset.y = y;
            slot.addEventListener('click', () => handleCraftingSlotClick(x, y));
            craftingGridElement.appendChild(slot);
        }
    }
    
    // Create inventory slots
    updateInventoryGrid();
    
    // Set up crafting buttons
    document.getElementById('craftBtn').addEventListener('click', handleCraft);
    document.getElementById('clearBtn').addEventListener('click', clearCraftingGrid);
    document.getElementById('closeCraftingBtn').addEventListener('click', toggleCraftingUI);
    
    // Create simple inventory display (always visible)
    updateInventoryDisplay();
    
    // Make the global playerInventory variable accessible
    window.playerInventory = playerInventory;
    window.updateInventoryDisplay = updateInventoryDisplay;
}

// Toggle crafting UI visibility
export function toggleCraftingUI() {
    isCraftingOpen = !isCraftingOpen;
    document.getElementById('craftingUI').style.display = isCraftingOpen ? 'block' : 'none';
    
    if (isCraftingOpen) {
        controls.unlock();
        // Update inventory when opening
        updateInventoryGrid();
    } else {
        // Clear any selected item
        selectedInventorySlot = null;
        document.body.style.cursor = 'default';
        // Return to game
        controls.lock();
    }
}

// Update the inventory grid in the crafting UI
function updateInventoryGrid() {
    const inventoryGridElement = document.getElementById('inventoryGrid');
    inventoryGridElement.innerHTML = '';
    
    // Only show items with quantity > 0
    const inventoryItems = Object.entries(playerInventory)
        .filter(([item, quantity]) => quantity > 0);
    
    for (const [item, quantity] of inventoryItems) {
        const slot = document.createElement('div');
        slot.className = 'inventorySlot';
        slot.dataset.item = item;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'slotItem';
        
        // Use custom render function if available, otherwise use simple color
        if (itemProperties[item].render) {
            itemProperties[item].render(itemElement);
        } else {
            itemElement.style.backgroundColor = itemProperties[item].color;
        }
        
        const quantityElement = document.createElement('div');
        quantityElement.className = 'slotQuantity';
        quantityElement.textContent = quantity;
        
        slot.appendChild(itemElement);
        slot.appendChild(quantityElement);
        slot.addEventListener('click', () => handleInventorySlotClick(item));
        
        inventoryGridElement.appendChild(slot);
    }
}

// Update the simple inventory display (always visible)
export function updateInventoryDisplay() {
    const inventoryDisplayElement = document.getElementById('inventoryDisplay');
    if (!inventoryDisplayElement) return;
    
    inventoryDisplayElement.innerHTML = '';
    
    // Show all available materials in the player's inventory
    // Get all items that the player has at least one of
    const availableItems = Object.entries(playerInventory)
        .filter(([item, quantity]) => quantity > 0)
        .map(([item]) => item);
    
    // Materials to prioritize at the beginning of the display
    const priorityItems = ['wood', 'stone', 'dirt', 'grass', 'sand', 'snow'];
    
    // Sort items so priority items come first, then alphabetical
    const sortedItems = availableItems.sort((a, b) => {
        const aIndex = priorityItems.indexOf(a);
        const bIndex = priorityItems.indexOf(b);
        
        // If both are priority items, sort by priority list order
        if (aIndex >= 0 && bIndex >= 0) {
            return aIndex - bIndex;
        }
        // If only a is a priority item, it comes first
        if (aIndex >= 0) return -1;
        // If only b is a priority item, it comes first
        if (bIndex >= 0) return 1;
        // Otherwise alphabetical
        return a.localeCompare(b);
    });
    
    // Add items to the display
    for (const item of sortedItems) {
        // Skip tools and crafted items from the main display
        if (['wooden_pickaxe', 'stone_pickaxe', 'wooden_axe', 'stone_axe', 'crafting_table'].includes(item)) {
            continue;
        }
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invItem';
        
        const icon = document.createElement('div');
        icon.className = 'invIcon';
        
        // Make sure we have valid item properties
        if (!itemProperties[item]) {
            // Add missing item properties
            itemProperties[item] = {
                color: getDefaultColorForItem(item),
                name: formatItemName(item)
            };
        }
        
        // Use custom render function if available for smaller icon
        if (itemProperties[item].render) {
            icon.style.position = "relative";
            icon.style.overflow = "hidden";
            
            const miniItem = document.createElement('div');
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
        
        const count = document.createElement('span');
        count.textContent = playerInventory[item];
        
        itemDiv.appendChild(icon);
        itemDiv.appendChild(count);
        inventoryDisplayElement.appendChild(itemDiv);
    }
    
    // After updating inventory, also update block selector to show/hide craftable items
    updateBlockSelector();
}

// Handle click on crafting slot
function handleCraftingSlotClick(x, y) {
    if (!selectedInventorySlot) return;
    
    // Check if we have enough of the resource
    if (playerInventory[selectedInventorySlot] > 0) {
        // Place selected item in crafting grid
        craftingGrid[y][x] = selectedInventorySlot;
        
        // Temporarily decrease inventory count (will be restored if crafting is cleared)
        playerInventory[selectedInventorySlot]--;
        
        // Update inventory display
        updateInventoryGrid();
        updateInventoryDisplay();
        
        // Update UI
        updateCraftingGridUI();
        
        // Check for matching recipe
        checkForRecipeMatch();
    }
    
    // Reset selection
    selectedInventorySlot = null;
    
    // Clear selection highlight
    document.querySelectorAll('.inventorySlot').forEach(slot => {
        slot.style.border = '2px solid #777';
    });
}

// Handle click on inventory slot
function handleInventorySlotClick(item) {
    // Select or deselect item
    selectedInventorySlot = selectedInventorySlot === item ? null : item;
    
    // Update UI to show selection
    document.querySelectorAll('.inventorySlot').forEach(slot => {
        slot.style.border = slot.dataset.item === selectedInventorySlot 
            ? '2px solid #ffff00' 
            : '2px solid #777';
    });
    
    // Add cursor effect to show selected item
    if (selectedInventorySlot) {
        document.body.style.cursor = 'grabbing';
    } else {
        document.body.style.cursor = 'default';
    }
}

// Update crafting grid UI
function updateCraftingGridUI() {
    const slots = document.querySelectorAll('.craftingSlot');
    
    slots.forEach(slot => {
        const x = parseInt(slot.dataset.x);
        const y = parseInt(slot.dataset.y);
        const item = craftingGrid[y][x];
        
        // Clear slot
        slot.innerHTML = '';
        slot.classList.remove('filled');
        
        // Add item if exists
        if (item) {
            const itemElement = document.createElement('div');
            itemElement.className = 'slotItem';
            
            // Use custom render function if available
            if (itemProperties[item].render) {
                itemProperties[item].render(itemElement);
            } else {
                itemElement.style.backgroundColor = itemProperties[item].color;
            }
            
            slot.appendChild(itemElement);
            slot.classList.add('filled');
        }
    });
}

// Check if current crafting grid matches a recipe
function checkForRecipeMatch() {
    currentRecipeResult = null;
    const craftBtn = document.getElementById('craftBtn');
    const resultSlot = document.getElementById('resultSlot');
    
    // Clear result slot
    resultSlot.innerHTML = '';
    
    // Check each recipe
    for (const recipe of recipes) {
        if (comparePattern(craftingGrid, recipe.pattern)) {
            currentRecipeResult = recipe.result;
            
            // Show result
            const resultItem = document.createElement('div');
            resultItem.className = 'slotItem';
            
            // Use custom render function if available
            if (itemProperties[recipe.result.item].render) {
                itemProperties[recipe.result.item].render(resultItem);
            } else {
                resultItem.style.backgroundColor = itemProperties[recipe.result.item].color;
            }
            
            const resultQuantity = document.createElement('div');
            resultQuantity.className = 'slotQuantity';
            resultQuantity.textContent = recipe.result.quantity;
            
            resultSlot.appendChild(resultItem);
            resultSlot.appendChild(resultQuantity);
            
            // Enable craft button
            craftBtn.disabled = false;
            return;
        }
    }
    
    // No match found, disable craft button
    craftBtn.disabled = true;
}

// Compare crafting grid pattern with recipe pattern
function comparePattern(grid, pattern) {
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            // Skip if pattern position is null (doesn't matter)
            if (pattern[y][x] !== null && grid[y][x] !== pattern[y][x]) {
                return false;
            }
        }
    }
    return true;
}

// Handle crafting button click
function handleCraft() {
    if (!currentRecipeResult) return;
    
    // Add crafted item to inventory
    playerInventory[currentRecipeResult.item] += currentRecipeResult.quantity;
    
    // Consume ingredients from inventory (already consumed when placing in grid)
    
    // Clear crafting grid
    clearCraftingGrid();
    
    // Update UI
    updateInventoryGrid();
    updateInventoryDisplay();
}

// Clear crafting grid
function clearCraftingGrid() {
    // Return items from grid to inventory
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const item = craftingGrid[y][x];
            if (item) {
                playerInventory[item]++;
            }
        }
    }
    
    // Reset grid
    craftingGrid = [
        [null, null, null],
        [null, null, null],
        [null, null, null]
    ];
    
    // Update UI
    updateCraftingGridUI();
    updateInventoryGrid();
    updateInventoryDisplay();
    
    // Clear result
    currentRecipeResult = null;
    document.getElementById('resultSlot').innerHTML = '';
    document.getElementById('craftBtn').disabled = true;
    
    // Reset cursor
    document.body.style.cursor = 'default';
}

// Helper function to get a default color for items that may not be defined
function getDefaultColorForItem(item) {
    // Default colors for common materials
    const defaultColors = {
        grass: "#3A9D23",
        dirt: "#59472B",
        stone: "#666666",
        sand: "#DBC681",
        sand_light: "#E8D9A0",
        sand_red: "#C2A477",
        sand_gold: "#D4B16A",
        sand_dark: "#B49B6C",
        wood: "#52341D",
        snow: "#F5F5F5",
        water: "#1A45A5",
        cactus: "#2D742F",
        stick: "#8B5A2B"
    };
    
    return defaultColors[item] || "#AAAAAA"; // Default gray for unknown items
}

// Helper function to format item name for display
function formatItemName(item) {
    return item.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
} 