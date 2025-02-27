import { currentBiome } from '../core/game.js';
import { player } from '../player/player.js';
import { generateTerrain, findSafeSpawnPoint } from '../terrain/terrain.js';
import { playAmbientSound } from '../audio/audio.js';
import { toggleCraftingUI } from '../crafting/crafting.js';

// Setup UI interaction
export function setupUI() {
    // Block selection
    document.querySelectorAll('.block-type').forEach(element => {
        element.addEventListener('click', () => {
            // Remove selected class from all blocks
            document.querySelectorAll('.block-type').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Add selected class to clicked block
            element.classList.add('selected');
            
            // Update selected block type
            window.selectedBlockType = element.dataset.type;
        });
    });
    
    // Biome selection with proper spawn handling
    document.querySelectorAll('.biome-btn').forEach(element => {
        element.addEventListener('click', () => {
            console.log("Biome button clicked:", element.dataset.biome);
            
            // Remove active class from all biome buttons
            document.querySelectorAll('.biome-btn').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to clicked button
            element.classList.add('active');
            
            // Update current biome (we need to update the imported reference via window for now)
            window.currentBiome = element.dataset.biome;
            
            // Reset player for safe spawning in new biome
            player.isSpawning = true;
            
            // Find a safe spawn location in the new biome
            findSafeSpawnPoint();
            
            // Force regeneration of terrain with new biome
            Object.keys(window.terrain).forEach(chunkKey => {
                window.scene.remove(window.terrain[chunkKey]);
                delete window.terrain[chunkKey];
            });
            window.terrain = {};
            generateTerrain();
            
            // Update ambient sound
            if (window.isGameStarted) {
                playAmbientSound(window.currentBiome);
            }
            
            console.log("Changed biome to:", window.currentBiome);
        });
    });
    
    // Add respawn button
    const respawnButton = document.createElement('button');
    respawnButton.textContent = 'Respawn';
    respawnButton.style.position = 'absolute';
    respawnButton.style.bottom = '10px';
    respawnButton.style.right = '10px';
    respawnButton.style.padding = '8px 12px';
    respawnButton.style.background = '#4CAF50';
    respawnButton.style.color = 'white';
    respawnButton.style.border = 'none';
    respawnButton.style.borderRadius = '4px';
    respawnButton.style.cursor = 'pointer';
    respawnButton.style.zIndex = '1000';
    
    respawnButton.addEventListener('click', () => {
        player.isSpawning = true;
        findSafeSpawnPoint();
        player.velocity.set(0, 0, 0);
        generateTerrain();
    });
    
    document.body.appendChild(respawnButton);
    
    // Prevent context menu on right-click
    document.addEventListener('contextmenu', event => event.preventDefault());
    
    // Add crafting instructions
    const craftingTip = document.createElement('p');
    craftingTip.textContent = 'Press E to open crafting menu';
    document.getElementById('instructions').insertBefore(
        craftingTip, 
        document.getElementById('startButton')
    );
    
    // Add E key for crafting menu
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'e' && window.isGameStarted) {
            event.preventDefault();
            toggleCraftingUI();
        }
    });
    
    // Create UI mode message if it doesn't exist
    if (!document.getElementById('uiModeMessage')) {
        const uiModeMessage = document.createElement('div');
        uiModeMessage.id = 'uiModeMessage';
        uiModeMessage.style.position = 'absolute';
        uiModeMessage.style.top = '10px';
        uiModeMessage.style.left = '50%';
        uiModeMessage.style.transform = 'translateX(-50%)';
        uiModeMessage.style.background = 'rgba(0,0,0,0.7)';
        uiModeMessage.style.color = 'white';
        uiModeMessage.style.padding = '10px';
        uiModeMessage.style.borderRadius = '5px';
        uiModeMessage.style.zIndex = '1000';
        uiModeMessage.style.display = 'none';
        uiModeMessage.innerHTML = 'UI Mode Active - Click game to resume or press Tab';
        document.body.appendChild(uiModeMessage);
    }
    
    // Setup mouse event listeners for block manipulation
    document.addEventListener('mousedown', onMouseClick);
}

// Handle mouse clicks for block manipulation
function onMouseClick(event) {
    if (!window.isGameStarted) return;
    
    // Handle block interaction through updateBlockHighlight
    const intersection = window.updateBlockHighlight ? window.updateBlockHighlight() : null;
    
    if (intersection) {
        if (event.button === 0) {
            // Left click - remove block
            const blockType = window.removeBlock ? window.removeBlock(intersection) : null;
            
            if (blockType) {
                // Map block type to inventory resource
                let resource = blockType;
                
                // Handle special block types
                if (blockType.includes('sand_')) resource = 'sand'; // All sand variants give sand
                
                // Add to inventory
                window.playerInventory[resource] = (window.playerInventory[resource] || 0) + 1;
                
                // Update inventory display
                window.updateInventoryDisplay();
                
                // Record modification 
                window.recordChunkModification(
                    intersection.blockPosition.x, 
                    intersection.blockPosition.y, 
                    intersection.blockPosition.z, 
                    'remove'
                );
            }
        } else if (event.button === 2) {
            // Right click - place block
            // Check if we have the resource in inventory
            if (window.playerInventory[window.selectedBlockType] && window.playerInventory[window.selectedBlockType] > 0) {
                // Place block using the placeBlock function
                const placed = window.placeBlock(intersection, window.selectedBlockType, intersection.chunk);
                
                if (placed) {
                    // Deduct resource from inventory
                    window.playerInventory[window.selectedBlockType]--;
                    
                    // Update inventory display
                    window.updateInventoryDisplay();
                    
                    // Record modification 
                    window.recordChunkModification(
                        Math.round(intersection.point.x + intersection.normal.x * 0.5),
                        Math.round(intersection.point.y + intersection.normal.y * 0.5),
                        Math.round(intersection.point.z + intersection.normal.z * 0.5),
                        'add',
                        window.selectedBlockType
                    );
                }
            } else {
                console.log("Not enough resources to place this block");
            }
        }
    }
} 