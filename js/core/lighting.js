import { scene } from './game.js';

// Lighting state
export const dayNightCycle = { 
    time: 0, 
    duration: 300, 
    isDay: true,
    directionalLight: null,
    secondaryLight: null,
    ambientLight: null,
    hemiLight: null,
    shadowUpdateFrequency: 1,
    frameCounter: 0,
    cycleSpeed: 0.003, // Speed modifier for day/night cycle
    timeOfDay: 0.5 // Current time of day (0-1)
};

// Set up scene lighting with improved balance
export function setupLights() {
    setupHighlyOptimizedLights();
}

// The most optimized lighting setup
function setupHighlyOptimizedLights() {
    // Create a performance-aware lighting system
    const hardwareLevel = estimateHardwarePerformance();
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    
    // Create directional light with adaptive quality
    const directionalLight = new THREE.DirectionalLight(0xFFEAC3, 1.2);
    directionalLight.position.set(100, 100, 50);
    
    // Adaptive shadow quality based on hardware
    directionalLight.castShadow = hardwareLevel > 2; // Only enable shadows on medium-high hardware
    
    // Optimize shadow map size based on hardware capability
    const shadowMapSize = isMobile ? 512 : 
                         (hardwareLevel >= 4 ? 2048 : 
                         (hardwareLevel >= 3 ? 1024 : 512));
    
    directionalLight.shadow.mapSize.width = shadowMapSize;
    directionalLight.shadow.mapSize.height = shadowMapSize;
    
    // Optimize shadow camera frustum
    const shadowSize = 120; // Area covered by shadow
    directionalLight.shadow.camera.left = -shadowSize / 2;
    directionalLight.shadow.camera.right = shadowSize / 2;
    directionalLight.shadow.camera.top = shadowSize / 2;
    directionalLight.shadow.camera.bottom = -shadowSize / 2;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 350; // Reduced from 500
    
    // Optimize shadow bias to reduce artifacts
    directionalLight.shadow.bias = -0.001;
    
    // Use VSM shadow maps on high-end hardware for better quality
    if (hardwareLevel >= 4) {
        directionalLight.shadow.type = THREE.VSMShadowMap;
    }
    
    // Only update shadow maps every other frame on low-end devices
    if (hardwareLevel <= 2) {
        directionalLight.shadow.autoUpdate = false;
        directionalLight.shadow.needsUpdate = true;
        
        // Set up interval to update shadows periodically
        setInterval(() => {
            directionalLight.shadow.needsUpdate = true;
        }, 1000 / 20); // Update at 20fps instead of 60fps
    }
    
    scene.add(directionalLight);
    
    // Optimized ambient light
    // Adjust ambient intensity based on hardware to compensate for disabled features
    const ambientIntensity = hardwareLevel <= 2 ? 0.7 : 0.5;
    const ambientLight = new THREE.AmbientLight(0x8097BB, ambientIntensity);
    scene.add(ambientLight);
    
    // For mid-high end hardware, add a very subtle hemispherical light
    // This adds subtle environment lighting at minimal performance cost
    if (hardwareLevel >= 3 && !isMobile) {
        const hemiLight = new THREE.HemisphereLight(
            0x9BB8FF, // Sky color - slightly blue
            0x6A5939, // Ground color - earthy tone
            0.3       // Intensity kept low
        );
        scene.add(hemiLight);
        dayNightCycle.hemiLight = hemiLight;
    }

    // Store lights for day/night cycle
    dayNightCycle.directionalLight = directionalLight;
    dayNightCycle.ambientLight = ambientLight;
    dayNightCycle.shadowUpdateFrequency = hardwareLevel <= 2 ? 3 : 1; // Update shadows every X frames
    
    console.log(`Lighting optimized for hardware level: ${hardwareLevel}, Shadow map: ${shadowMapSize}px`);
}

// Update day/night cycle with realistic sky colors
export function updateDayNightCycle(delta) {
    dayNightCycle.time += delta;
    
    if (dayNightCycle.time > dayNightCycle.duration) {
        dayNightCycle.time = 0;
        dayNightCycle.isDay = !dayNightCycle.isDay;
    }
    
    updateHighlyOptimizedLights(delta);
    
    // Update the time display
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) {
        timeDisplay.textContent = `Time: ${dayNightCycle.isDay ? 'Day' : 'Night'}`;
    }
}

// Enhanced day/night cycle with optimized updates
function updateHighlyOptimizedLights(delta) {
    // Update directional light position based on time of day
    const timeOfDay = dayNightCycle.timeOfDay;
    dayNightCycle.frameCounter++;
    
    // Skip shadow updates on some frames for performance
    const shouldUpdateShadows = 
        dayNightCycle.frameCounter % dayNightCycle.shadowUpdateFrequency === 0;
    
    // Update time of day
    dayNightCycle.timeOfDay += delta * dayNightCycle.cycleSpeed;
    if (dayNightCycle.timeOfDay >= 1) dayNightCycle.timeOfDay = 0;
    
    // Smoothly move the sun/moon
    const angle = timeOfDay * Math.PI * 2;
    const height = Math.sin(angle) * 90 + 100; // Higher peak for more realistic arc
    
    // Position the directional light
    dayNightCycle.directionalLight.position.set(
        Math.sin(angle) * 150,
        Math.max(10, height), // Keep light above horizon
        Math.cos(angle) * 150
    );
    
    // Day/night cycle with optimized color transitions
    // Time-based light adjustments
    const isDay = timeOfDay > 0.25 && timeOfDay < 0.75;
    const isSunrise = timeOfDay > 0.2 && timeOfDay < 0.3;
    const isSunset = timeOfDay > 0.7 && timeOfDay < 0.8;
    
    // Only update shadow maps when needed
    if (shouldUpdateShadows && dayNightCycle.directionalLight.shadow) {
        dayNightCycle.directionalLight.shadow.needsUpdate = true;
    }
    
    // Light color and intensity updates
    if (isDay) {
        // Day time
        const noonIntensity = 1.2;
        const noonColor = 0xFFEAC3;
        
        if (isSunrise) {
            // Sunrise transition
            const t = (timeOfDay - 0.2) * 10; // 0 to 1 during sunrise
            dayNightCycle.directionalLight.intensity = lerp(0.5, noonIntensity, t);
            dayNightCycle.directionalLight.color.setHex(lerpColor(0xFFB08D, noonColor, t));
        } else if (isSunset) {
            // Sunset transition
            const t = (timeOfDay - 0.7) * 10; // 0 to 1 during sunset
            dayNightCycle.directionalLight.intensity = lerp(noonIntensity, 0.5, t);
            dayNightCycle.directionalLight.color.setHex(lerpColor(noonColor, 0xFFB08D, t));
        } else {
            // Full day
            dayNightCycle.directionalLight.intensity = noonIntensity;
            dayNightCycle.directionalLight.color.setHex(noonColor);
        }
        
        // Ambient light adjustment
        const ambientDayIntensity = 0.5;
        dayNightCycle.ambientLight.intensity = ambientDayIntensity;
        dayNightCycle.ambientLight.color.setHex(0x8097BB);
    } else {
        // Night time - dimmer blue light
        dayNightCycle.directionalLight.intensity = 0.3;
        dayNightCycle.directionalLight.color.setHex(0x8AA0FF);
        
        // Darker ambient at night
        dayNightCycle.ambientLight.intensity = 0.2;
        dayNightCycle.ambientLight.color.setHex(0x3A4B6D);
    }
    
    // Update hemisphere light if present
    if (dayNightCycle.hemiLight) {
        if (isDay) {
            dayNightCycle.hemiLight.intensity = 0.3;
        } else {
            dayNightCycle.hemiLight.intensity = 0.1;
        }
    }
    
    // Update sky color based on time
    const skyColor = new THREE.Color();
    if (isDay) {
        if (isSunrise) {
            const t = (timeOfDay - 0.2) * 10;
            skyColor.setRGB(
                lerp(0.2, 0.6, t),
                lerp(0.2, 0.8, t),
                lerp(0.4, 1.0, t)
            );
        } else if (isSunset) {
            const t = (timeOfDay - 0.7) * 10;
            skyColor.setRGB(
                lerp(0.6, 0.3, t),
                lerp(0.8, 0.3, t),
                lerp(1.0, 0.5, t)
            );
        } else {
            // Full day - blue sky
            skyColor.setRGB(0.6, 0.8, 1.0);
        }
    } else {
        // Night - dark blue sky
        skyColor.setRGB(0.05, 0.05, 0.15);
    }
    
    // Apply the sky color
    if (scene.background) {
        scene.background.copy(skyColor);
        if (scene.fog && scene.fog.color) {
            scene.fog.color.copy(skyColor);
        }
    }
}

// Estimate hardware capabilities for optimal settings
function estimateHardwarePerformance() {
    let score = 3; // Default medium score
    
    // WebGL detection
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return 2; // Reduce if WebGL is not available
    
    // Check for WebGL2
    if (canvas.getContext('webgl2')) {
        score += 1;
    }
    
    // Check CPU cores
    if (navigator.hardwareConcurrency) {
        if (navigator.hardwareConcurrency >= 8) score += 1;
        else if (navigator.hardwareConcurrency <= 2) score -= 1;
    }
    
    // Check memory if available
    if (navigator.deviceMemory) {
        if (navigator.deviceMemory >= 8) score += 0.5;
        else if (navigator.deviceMemory <= 2) score -= 0.5;
    }
    
    // Device detection
    if (/Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)) {
        score -= 1;
    }
    
    // Check for high-end GPU indicators
    try {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
            const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
            
            // Boost score for high-end GPUs
            if (renderer.includes('nvidia') || 
                renderer.includes('geforce') || 
                renderer.includes('radeon') ||
                renderer.includes('adreno') && !renderer.includes('adreno 5') ||
                renderer.includes('apple m') || 
                renderer.includes('apple a')) {
                score += 0.5;
            }
        }
    } catch (e) {
        // Ignore errors from this experimental feature
    }
    
    // Clamp score between 1-5
    return Math.max(1, Math.min(5, Math.round(score)));
}

// Helper functions for color and value interpolation
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(colorA, colorB, t) {
    const a = new THREE.Color(colorA);
    const b = new THREE.Color(colorB);
    
    return new THREE.Color(
        a.r + (b.r - a.r) * t,
        a.g + (b.g - a.g) * t,
        a.b + (b.b - a.b) * t
    ).getHex();
} 