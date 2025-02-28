import { setupScene, setupRenderer, animate } from './renderer.js';
import { setupPlayer } from '../player/player.js';
import { setupControls } from '../player/controls.js';
import { setupLights } from './lighting.js';
import { generateTerrain, findSafeSpawnPoint, initTerrain } from '../terrain/terrain.js';
import { setupUI } from '../ui/ui.js';
import { initCraftingSystem } from '../crafting/crafting.js';
import { initHighlightBox } from '../blocks/highlight.js';
import { createFpsCounter } from '../ui/performance.js';
import { playAmbientSound, initAudio } from '../audio/audio.js';
import { initSeedConfig } from '../terrain/seedConfig.js';

// Game state
export let scene, camera, renderer, controls;
export let isGameStarted = false;
export let currentBiome = 'forest';

// Export the init function
export function initGame() {
    // Create Three.js scene
    const { sceneObj, cameraObj } = setupScene();
    scene = sceneObj;
    camera = cameraObj;
    
    // Initialize the terrain system
    initTerrain();
    
    // Initialize seed configuration controls
    initSeedConfig();
    
    // First find a safe spawn point based on biome
    findSafeSpawnPoint();
    
    // Create renderer
    renderer = setupRenderer();
    
    // Set up controls
    controls = setupControls(camera);
    
    // Set up lighting system
    setupLights();
    
    // Generate initial terrain
    generateTerrain();
    
    // Setup UI interaction
    setupUI();
    
    // Check biome buttons
    setTimeout(checkBiomeButtons, 500); // Give DOM time to fully load
    
    // Initialize audio system
    initAudio();
    
    // Start animation loop
    animate();
    console.log("Game initialized with biome:", currentBiome);
    
    // Initialize crafting system after DOM is loaded
    setTimeout(() => {
        initCraftingSystem();
        // Give player some starting resources
        // Accessing through the global object until we refactor inventory management
        window.playerInventory.wood = 5;
        window.updateInventoryDisplay();
    }, 1000);
    
    // Initialize the highlight box after scene is created
    initHighlightBox();
    
    // Create FPS counter
    createFpsCounter();
}

// Add this function to ensure all buttons have proper data-biome attributes
function checkBiomeButtons() {
    const biomeButtons = document.querySelectorAll('.biome-btn');
    console.log("Biome buttons found:", biomeButtons.length);
    
    biomeButtons.forEach(button => {
        console.log(`Button: ${button.textContent}, data-biome: ${button.dataset.biome}`);
        
        // If button doesn't have data-biome attribute, try to set it based on its text content
        if (!button.dataset.biome) {
            const text = button.textContent.toLowerCase().trim();
            if (text === 'forest' || text === 'desert' || text === 'mountains' || text === 'plains') {
                button.dataset.biome = text;
                console.log(`Fixed missing data-biome attribute on button: ${text}`);
            }
        }
    });
}

// Function to be called when game starts
export function startGame() {
    isGameStarted = true;
    
    // Play ambient sound based on biome
    try {
        playAmbientSound(currentBiome);
    } catch (e) {
        console.error("Error playing sound:", e);
    }
}

// Function to be called when game stops/pauses
export function stopGame() {
    isGameStarted = false;
} 