import { globalSeed, biomeParams } from './terrain.js';

// Default configuration
export const defaultConfig = {
    seed: Math.floor(Math.random() * 1000000),
    biomeScale: 0.005, // How large biomes are
    terrainScale: 0.01, // How large terrain features are
    heightScale: 1.0,   // How tall terrain is
    noiseOctaves: 3,    // Number of noise layers
    persistence: 0.5,   // How much each successive noise layer contributes
    waterLevel: 16,     // Water level
    caves: false        // Whether to generate caves
};

// Current configuration
export let currentConfig = {...defaultConfig};

// Set new seed and regenerate terrain
export function setSeed(newSeed) {
    if (typeof newSeed === 'number' || !isNaN(parseInt(newSeed))) {
        // Convert to number and ensure it's an integer
        newSeed = parseInt(newSeed);
        currentConfig.seed = newSeed;
        window.globalSeed = newSeed;
        
        console.log(`Set new terrain seed: ${newSeed}`);
        return true;
    }
    
    console.error("Invalid seed. Must be a number.");
    return false;
}

// Update terrain configuration
export function updateTerrainConfig(config) {
    // Validate and set configuration options
    if (config.biomeScale !== undefined && !isNaN(config.biomeScale)) {
        currentConfig.biomeScale = Math.max(0.001, Math.min(0.1, config.biomeScale));
    }
    
    if (config.terrainScale !== undefined && !isNaN(config.terrainScale)) {
        currentConfig.terrainScale = Math.max(0.001, Math.min(0.1, config.terrainScale));
    }
    
    if (config.heightScale !== undefined && !isNaN(config.heightScale)) {
        currentConfig.heightScale = Math.max(0.1, Math.min(2.0, config.heightScale));
        
        // Update all biome height variations based on the height scale
        Object.keys(biomeParams).forEach(biome => {
            const originalHeight = biomeParams[biome].originalHeightVariation || 
                                  biomeParams[biome].heightVariation;
            
            // Store original value if not already stored
            if (!biomeParams[biome].originalHeightVariation) {
                biomeParams[biome].originalHeightVariation = biomeParams[biome].heightVariation;
            }
            
            // Apply new height scale
            biomeParams[biome].heightVariation = originalHeight * currentConfig.heightScale;
        });
    }
    
    if (config.noiseOctaves !== undefined && !isNaN(config.noiseOctaves)) {
        currentConfig.noiseOctaves = Math.max(1, Math.min(5, Math.floor(config.noiseOctaves)));
    }
    
    if (config.persistence !== undefined && !isNaN(config.persistence)) {
        currentConfig.persistence = Math.max(0.1, Math.min(0.9, config.persistence));
    }
    
    if (config.waterLevel !== undefined && !isNaN(config.waterLevel)) {
        currentConfig.waterLevel = Math.max(0, Math.min(32, Math.floor(config.waterLevel)));
    }
    
    if (config.caves !== undefined) {
        currentConfig.caves = !!config.caves;
    }
    
    console.log("Updated terrain configuration:", currentConfig);
}

// Generate a random seed and apply it
export function randomizeSeed() {
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    return newSeed;
}

// Create UI controls for seed configuration
export function createSeedControls() {
    // Create container
    const container = document.createElement('div');
    container.id = 'seedControls';
    container.style.position = 'fixed';
    container.style.right = '10px';
    container.style.top = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.color = 'white';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.zIndex = '1000';
    container.style.display = 'none'; // Start hidden
    container.style.maxWidth = '300px';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Terrain Settings';
    title.style.margin = '0 0 10px 0';
    container.appendChild(title);
    
    // Add seed input
    const seedInput = document.createElement('div');
    seedInput.style.marginBottom = '10px';
    
    const seedLabel = document.createElement('label');
    seedLabel.textContent = 'Seed: ';
    seedLabel.htmlFor = 'seedInput';
    
    const seedField = document.createElement('input');
    seedField.type = 'text';
    seedField.id = 'seedInput';
    seedField.value = currentConfig.seed;
    seedField.style.width = '100px';
    seedField.style.marginRight = '5px';
    
    const seedButton = document.createElement('button');
    seedButton.textContent = 'Apply';
    seedButton.onclick = () => {
        if (setSeed(seedField.value)) {
            // Regenerate world with new seed
            window.findSafeSpawnPoint();
            window.generateTerrain();
        }
    };
    
    const randomSeedButton = document.createElement('button');
    randomSeedButton.textContent = '🎲';
    randomSeedButton.style.marginLeft = '5px';
    randomSeedButton.onclick = () => {
        const newSeed = randomizeSeed();
        seedField.value = newSeed;
        // Regenerate world with new seed
        window.findSafeSpawnPoint();
        window.generateTerrain();
    };
    
    seedInput.appendChild(seedLabel);
    seedInput.appendChild(document.createElement('br'));
    seedInput.appendChild(seedField);
    seedInput.appendChild(seedButton);
    seedInput.appendChild(randomSeedButton);
    container.appendChild(seedInput);
    
    // Add height scale slider
    const heightDiv = document.createElement('div');
    heightDiv.style.marginBottom = '10px';
    
    const heightLabel = document.createElement('label');
    heightLabel.textContent = 'Terrain Height: ';
    heightLabel.htmlFor = 'heightScale';
    
    const heightValue = document.createElement('span');
    heightValue.textContent = currentConfig.heightScale.toFixed(1);
    heightValue.style.marginLeft = '5px';
    
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.id = 'heightScale';
    heightSlider.min = '0.1';
    heightSlider.max = '2.0';
    heightSlider.step = '0.1';
    heightSlider.value = currentConfig.heightScale;
    heightSlider.style.width = '100%';
    
    heightSlider.oninput = () => {
        heightValue.textContent = parseFloat(heightSlider.value).toFixed(1);
    };
    
    heightSlider.onchange = () => {
        updateTerrainConfig({ heightScale: parseFloat(heightSlider.value) });
        // Don't regenerate immediately as it would be disruptive
    };
    
    heightDiv.appendChild(heightLabel);
    heightDiv.appendChild(heightValue);
    heightDiv.appendChild(document.createElement('br'));
    heightDiv.appendChild(heightSlider);
    container.appendChild(heightDiv);
    
    // Add water level slider
    const waterDiv = document.createElement('div');
    waterDiv.style.marginBottom = '10px';
    
    const waterLabel = document.createElement('label');
    waterLabel.textContent = 'Water Level: ';
    waterLabel.htmlFor = 'waterLevel';
    
    const waterValue = document.createElement('span');
    waterValue.textContent = currentConfig.waterLevel;
    waterValue.style.marginLeft = '5px';
    
    const waterSlider = document.createElement('input');
    waterSlider.type = 'range';
    waterSlider.id = 'waterLevel';
    waterSlider.min = '0';
    waterSlider.max = '32';
    waterSlider.step = '1';
    waterSlider.value = currentConfig.waterLevel;
    waterSlider.style.width = '100%';
    
    waterSlider.oninput = () => {
        waterValue.textContent = waterSlider.value;
    };
    
    waterSlider.onchange = () => {
        updateTerrainConfig({ waterLevel: parseInt(waterSlider.value) });
        // Don't regenerate immediately as it would be disruptive
    };
    
    waterDiv.appendChild(waterLabel);
    waterDiv.appendChild(waterValue);
    waterDiv.appendChild(document.createElement('br'));
    waterDiv.appendChild(waterSlider);
    container.appendChild(waterDiv);
    
    // Add apply button for all changes
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply All Changes';
    applyButton.style.width = '100%';
    applyButton.style.padding = '5px';
    applyButton.style.marginTop = '10px';
    
    applyButton.onclick = () => {
        // Regenerate world with new settings
        window.findSafeSpawnPoint();
        window.generateTerrain();
    };
    
    container.appendChild(applyButton);
    
    // Add toggle button for the settings panel
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '⚙️';
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '10px';
    toggleButton.style.top = '10px';
    toggleButton.style.zIndex = '1001';
    toggleButton.style.width = '30px';
    toggleButton.style.height = '30px';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.border = 'none';
    toggleButton.style.background = 'rgba(0, 0, 0, 0.7)';
    toggleButton.style.color = 'white';
    toggleButton.style.fontSize = '16px';
    toggleButton.style.cursor = 'pointer';
    
    toggleButton.onclick = () => {
        if (container.style.display === 'none') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    };
    
    // Add to body
    document.body.appendChild(container);
    document.body.appendChild(toggleButton);
}

// Initialize seed controls
export function initSeedConfig() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSeedControls);
    } else {
        createSeedControls();
    }
} 