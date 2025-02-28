import { setDisplayReferences } from '../core/renderer.js';

// Performance display elements
let fpsDisplay;
let lastFpsUpdate = 0;
let framesThisSecond = 0;
let memoryDisplay;
let lastMemoryUpdate = 0;
let chunkCountDisplay;

// Create the FPS counter and performance stats display
export function createFpsCounter() {
    // Create stats container
    const statsContainer = document.createElement('div');
    statsContainer.id = 'statsContainer';
    statsContainer.style.position = 'fixed';
    statsContainer.style.top = '10px';
    statsContainer.style.left = '10px';
    statsContainer.style.background = 'rgba(0, 0, 0, 0.7)';
    statsContainer.style.color = '#00FF00';
    statsContainer.style.padding = '5px 10px';
    statsContainer.style.borderRadius = '5px';
    statsContainer.style.fontFamily = 'monospace';
    statsContainer.style.fontSize = '14px';
    statsContainer.style.fontWeight = 'bold';
    statsContainer.style.zIndex = '9999';
    statsContainer.style.display = 'flex';
    statsContainer.style.flexDirection = 'column';
    statsContainer.style.gap = '5px';
    document.body.appendChild(statsContainer);
    
    // FPS display
    fpsDisplay = document.createElement('div');
    fpsDisplay.textContent = 'FPS: 0';
    statsContainer.appendChild(fpsDisplay);
    
    // Memory usage display
    memoryDisplay = document.createElement('div');
    memoryDisplay.textContent = 'Memory: N/A';
    statsContainer.appendChild(memoryDisplay);
    
    // Chunk count display
    chunkCountDisplay = document.createElement('div');
    chunkCountDisplay.textContent = 'Chunks: 0';
    statsContainer.appendChild(chunkCountDisplay);
    
    // Queue display
    const queueDisplay = document.createElement('div');
    queueDisplay.id = 'queueDisplay';
    queueDisplay.textContent = 'Queue: 0';
    statsContainer.appendChild(queueDisplay);
    
    // Cache display
    const cacheDisplay = document.createElement('div');
    cacheDisplay.id = 'cacheDisplay';
    cacheDisplay.textContent = 'Cached: 0';
    statsContainer.appendChild(cacheDisplay);
    
    // Performance mode toggle button
    const perfButton = document.createElement('button');
    perfButton.textContent = 'High Performance Mode';
    perfButton.style.marginTop = '5px';
    perfButton.style.background = '#333';
    perfButton.style.color = 'white';
    perfButton.style.border = '1px solid #555';
    perfButton.style.borderRadius = '3px';
    perfButton.style.cursor = 'pointer';
    perfButton.style.padding = '3px 6px';
    perfButton.style.fontSize = '12px';
    
    let highPerfMode = false;
    perfButton.addEventListener('click', () => {
        highPerfMode = !highPerfMode;
        
        if (highPerfMode) {
            // Reduce render distances for better performance
            window.chunkRenderDistance.minimum = 1;
            window.chunkRenderDistance.ideal = 1;
            window.chunkRenderDistance.maximum = 2;
            window.chunkRenderDistance.preloadFar = 2;
            window.maxCachedChunks = 100; // Reduce cache size in performance mode
            
            // Reduce fog distance
            window.scene.fog.near = 10;
            window.scene.fog.far = 30;
            perfButton.textContent = 'Normal Mode';
            perfButton.style.background = '#553300';
        } else {
            // Restore normal settings
            window.chunkRenderDistance.minimum = 1;
            window.chunkRenderDistance.ideal = 2;
            window.chunkRenderDistance.maximum = 3;
            window.chunkRenderDistance.preloadFar = 4;
            window.maxCachedChunks = 500; // Normal cache size
            
            // Restore fog
            window.scene.fog.near = 15;
            window.scene.fog.far = 45;
            perfButton.textContent = 'High Performance Mode';
            perfButton.style.background = '#333';
        }
        
        // Force terrain update with new render distances
        window.generateTerrain();
    });
    
    statsContainer.appendChild(perfButton);
    
    // Share references to renderer for use in animation loop
    setDisplayReferences(fpsDisplay, chunkCountDisplay);
    
    // Update stats periodically
    setInterval(() => {
        updateMemoryStats();
        
        // Update queue display
        if (document.getElementById('queueDisplay')) {
            document.getElementById('queueDisplay').textContent = `Queue: ${window.chunkLoadingQueue ? window.chunkLoadingQueue.length : 0}`;
        }
        
        // Update cache display
        if (document.getElementById('cacheDisplay')) {
            document.getElementById('cacheDisplay').textContent = `Cached: ${window.chunkCache ? Object.keys(window.chunkCache).length : 0}`;
        }
    }, 1000);
}

// Function to update memory statistics
function updateMemoryStats() {
    if (!memoryDisplay || !chunkCountDisplay) return;
    
    // Update chunk count
    const chunkCount = Object.keys(window.terrain || {}).length;
    chunkCountDisplay.textContent = `Chunks: ${chunkCount}`;
    
    // Update memory usage if available
    if (window.performance && window.performance.memory) {
        const memUsed = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
        const memTotal = Math.round(window.performance.memory.jsHeapSizeLimit / 1048576);
        memoryDisplay.textContent = `Memory: ${memUsed}MB / ${memTotal}MB`;
        
        // Change color based on memory usage
        const memPercentage = memUsed / memTotal;
        if (memPercentage > 0.8) {
            memoryDisplay.style.color = '#FF5555'; // Red for high usage
        } else if (memPercentage > 0.6) {
            memoryDisplay.style.color = '#FFAA55'; // Orange for medium usage
        } else {
            memoryDisplay.style.color = '#55FF55'; // Green for low usage
        }
    } else {
        memoryDisplay.textContent = 'Memory: N/A';
    }
} 