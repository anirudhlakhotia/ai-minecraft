import { playerInventory, itemProperties } from '../crafting/crafting.js';

// Track the currently selected block type
export let selectedBlockType = 'grass';

// Update the block selector UI
export function updateBlockSelector() {
    // Add crafted items
    addCraftedItemsToBlockSelector();
    
    // Update visibility based on inventory
    document.querySelectorAll('.block-type').forEach(blockType => {
        const type = blockType.dataset.type;
        // If this is a craftable item, show it only if we have it
        if (['crafting_table', 'wooden_pickaxe', 'stone_pickaxe'].includes(type)) {
            blockType.style.display = playerInventory[type] > 0 ? 'flex' : 'none';
        }
    });

    // Make the global selectedBlockType variable accessible
    window.selectedBlockType = selectedBlockType;
}

// Add crafting tools to block selector
function addCraftedItemsToBlockSelector() {
    const blockSelector = document.getElementById('blockSelector');
    if (!blockSelector) return;
    
    // Add crafted items that can be placed
    const placeableItems = ['crafting_table'];
    
    for (const item of placeableItems) {
        // Check if the item is already in the selector
        if (!document.querySelector(`.block-type[data-type="${item}"]`)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'block-type';
            itemDiv.dataset.type = item;
            
            const preview = document.createElement('div');
            preview.className = 'block-preview';
            preview.style.backgroundColor = itemProperties[item].color;
            
            const span = document.createElement('span');
            span.textContent = itemProperties[item].name;
            
            itemDiv.appendChild(preview);
            itemDiv.appendChild(span);
            
            itemDiv.addEventListener('click', () => {
                // Remove selected class from all blocks
                document.querySelectorAll('.block-type').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Add selected class to clicked block
                itemDiv.classList.add('selected');
                
                // Update selected block type
                selectedBlockType = item;
                window.selectedBlockType = selectedBlockType;
            });
            
            blockSelector.appendChild(itemDiv);
        }
    }
} 