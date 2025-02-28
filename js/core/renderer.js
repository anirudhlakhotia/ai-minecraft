import { updatePlayer } from '../player/physics.js';
import { updateChunkFades, processChunkQueueWithThrottling, prioritizeChunks, cleanupOldChunks } from '../terrain/chunkManager.js';
import { updateDayNightCycle } from './lighting.js';
import { updateBlockHighlight } from '../blocks/highlight.js';
import { updateBlockSelector } from '../ui/blockSelector.js';
import { scene, camera, renderer, isGameStarted } from './game.js';

// Three.js setup variables
let clock;

// Performance variables
let framesThisSecond = 0;
let lastFpsUpdate = 0;
let fpsDisplay;
let chunkCountDisplay;
let lastCleanupTime = 0;

// Setup scene including camera and fog
export function setupScene() {
    // Create Three.js scene
    const sceneObj = new THREE.Scene();
    sceneObj.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneObj.fog = new THREE.Fog(0x87CEEB, 15, 45); // Closer fog for better performance and hide pop-in
    
    // Set up camera
    const cameraObj = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Camera position will be set when the player position is determined
    
    // Initialize the clock
    clock = new THREE.Clock();
    
    // Return created objects
    return { sceneObj, cameraObj };
}

// Setup renderer with optimization settings
export function setupRenderer() {
    // Create renderer with WebGL 2 if available
    const rendererObj = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
    });
    
    // Set precision for better performance
    rendererObj.precision = 'mediump';
    
    // Enable performance optimizations
    rendererObj.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    
    // Get WebGL context
    const gl = rendererObj.getContext();
    
    // Check for and enable WebGL extensions
    const extensions = {
        // Allow larger index buffers (>65536 indices)
        uint32Indices: gl.getExtension('OES_element_index_uint'),
        // Anisotropic filtering for better texture quality at angles
        anisotropic: gl.getExtension('EXT_texture_filter_anisotropic'),
        // Depth textures for better shadow mapping
        depthTexture: gl.getExtension('WEBGL_depth_texture'),
        // Compressed textures for memory usage optimization
        compressedTextures: gl.getExtension('WEBGL_compressed_texture_s3tc'),
        // Hardware instancing for better performance with many similar objects
        instancedArrays: gl.getExtension('ANGLE_instanced_arrays'),
        // Allow vertex shader texture access
        vertexTextures: gl.getExtension('OES_texture_float')
    };
    
    // Log available extensions
    console.log("WebGL Extensions:", extensions);
    
    // Store extensions for later use
    window.glExtensions = extensions;
    
    // Set up renderer with performance optimizations and shadows
    rendererObj.shadowMap.enabled = true;
    rendererObj.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges
    
    rendererObj.setSize(window.innerWidth, window.innerHeight);
    rendererObj.setClearColor(0x87CEEB, 1);
    document.body.appendChild(rendererObj.domElement);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        rendererObj.setSize(window.innerWidth, window.innerHeight);
    });
    
    return rendererObj;
}

// Main animation loop with FPS optimization
export function animate() {
    requestAnimationFrame(animate);
    
    // Performance now gives high-resolution timestamp in milliseconds
    const now = performance.now();
    framesThisSecond++;
    
    if (now > lastFpsUpdate + 1000) {
        if (fpsDisplay) {
            fpsDisplay.textContent = `FPS: ${framesThisSecond}`;
        }
        framesThisSecond = 0;
        lastFpsUpdate = now;
        
        // Update chunk count in the stats display
        if (chunkCountDisplay) {
            chunkCountDisplay.textContent = `Chunks: ${Object.keys(window.terrain).length}`;
        }
    }
    
    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta time to prevent jumps
    
    // Update player physics if game is active
    if (isGameStarted) {
        updatePlayer(delta);
    }
    
    // Update chunk fade transitions
    updateChunkFades(delta);
    
    // Try to process the next chunk in the queue
    if (!window.processingChunk && window.chunkLoadingQueue.length > 0) {
        processChunkQueueWithThrottling();
    }
    
    // Prioritize chunks in the player's direction of movement
    prioritizeChunks();
    
    // Periodically clean up old chunks to prevent memory leaks
    if (now - lastCleanupTime > 10000) { // Every 10 seconds
        cleanupOldChunks();
        lastCleanupTime = now;
    }
    
    // Update day/night cycle
    updateDayNightCycle(delta);
    
    // Update block highlighting
    updateBlockHighlight();
    
    // Only render if the game is active
    if (isGameStarted) {
        renderer.render(scene, camera);
    }
    
    // Update block selector based on inventory changes
    updateBlockSelector();
}

// Set references to displays (called from performance.js)
export function setDisplayReferences(fps, chunkCount) {
    fpsDisplay = fps;
    chunkCountDisplay = chunkCount;
} 