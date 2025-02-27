import { initGame } from './core/game.js';
import { placeBlock, removeBlock } from './blocks/blocks.js';

// Make necessary functions accessible globally for UI interaction
window.placeBlock = placeBlock;
window.removeBlock = removeBlock;

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing game");
    try {
        initGame();
    } catch (e) {
        console.error("Error initializing game:", e);
    }
}); 