import { startGame, stopGame } from '../core/game.js';
import { initInput } from './physics.js';

// Controls instance
export let controls;

// Setup pointer lock controls
export function setupControls(camera) {
    // Create controls
    controls = new THREE.PointerLockControls(camera, document.body);
    
    // Set up event listeners
    setupControlEventListeners();
    
    // Initialize input system for keyboard handling
    initInput();
    
    return controls;
}

// Add event listeners for controls
function setupControlEventListeners() {
    // Click start button to begin game
    document.getElementById('startButton').addEventListener('click', () => {
        try {
            controls.lock();
            console.log("Controls locked");
        } catch (e) {
            console.error("Error locking controls:", e);
        }
    });
    
    // Handle when controls are locked (game begins)
    controls.addEventListener('lock', () => {
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('uiModeMessage').style.display = 'none';
        startGame();
    });
    
    // Handle when controls are unlocked (game pauses)
    controls.addEventListener('unlock', () => {
        if (!window.isGameStarted) {
            document.getElementById('instructions').style.display = 'flex';
        }
    });
    
    // Add Tab key to toggle UI mode
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && window.isGameStarted) {
            controls.unlock();
            document.getElementById('instructions').style.display = 'flex';
            stopGame();
            
            // Pause all ambient sounds
            try {
                Object.values(window.ambientSounds).forEach(sound => sound.pause());
            } catch (e) {
                console.error("Error pausing sounds:", e);
            }
        }
        
        if (event.key === 'Tab' && window.isGameStarted) {
            event.preventDefault(); // Prevent tab from changing focus
            toggleUIMode();
        }
    });
    
    // Enhanced fix for spacebar triggering both jump and button clicks
    document.addEventListener('keydown', function(event) {
        // Check if the game has started and it's a spacebar event
        if (window.isGameStarted && (event.code === 'Space' || event.key === ' ')) {
            // Prevent the default action (button activation)
            event.preventDefault();
            
            // Stop the event from propagating to other listeners
            event.stopPropagation();
            
            // Return false to ensure the event is fully canceled
            return false;
        }
    }, true); // The 'true' enables capturing phase
}

// Toggle between game and UI modes
export function toggleUIMode() {
    if (controls.isLocked) {
        controls.unlock();
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('uiModeMessage').style.display = 'block';
    } else {
        controls.lock();
        document.getElementById('uiModeMessage').style.display = 'none';
    }
}

// Focus the game canvas (used to prevent spacebar issues)
export function focusGameCanvas() {
    if (!window.isGameStarted) return;
    
    const gameCanvas = document.querySelector('canvas');
    if (gameCanvas) {
        gameCanvas.focus();
        
        // Make sure no buttons have focus
        document.querySelectorAll('button').forEach(button => {
            button.blur();
        });
    }
}