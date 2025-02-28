// Audio elements
export const ambientSounds = {
    forest: new Audio('https://freesound.org/data/previews/462/462087_8386274-lq.mp3'),
    desert: new Audio('https://freesound.org/data/previews/361/361259_4284968-lq.mp3'),
    mountains: new Audio('https://freesound.org/data/previews/352/352149_43962-lq.mp3'),
    plains: new Audio('https://freesound.org/data/previews/211/211545_3267529-lq.mp3')
};

// Play ambient sound based on biome
export function playAmbientSound(biome) {
    // Pause all ambient sounds first
    Object.values(ambientSounds).forEach(sound => sound.pause());
    
    // Play the selected biome sound on loop
    if (ambientSounds[biome]) {
        ambientSounds[biome].loop = true;
        ambientSounds[biome].volume = 0.3;
        ambientSounds[biome].play().catch(error => console.log("Audio playback error:", error));
    }
}

// Stop all ambient sounds
export function stopAllSounds() {
    Object.values(ambientSounds).forEach(sound => {
        try {
            sound.pause();
            sound.currentTime = 0;
        } catch (e) {
            console.error("Error stopping sound:", e);
        }
    });
}

// Initialize audio system
export function initAudio() {
    // Preload sounds to improve performance
    Object.values(ambientSounds).forEach(sound => {
        sound.load();
        sound.volume = 0;
        
        // Play and immediately pause to prepare audio context on some browsers
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
            sound.volume = 0.3;
        }).catch(e => {
            console.log("Audio preload not allowed before user interaction:", e);
        });
    });
}

// Play a sound effect once
export function playSoundEffect(url, volume = 0.5) {
    const sound = new Audio(url);
    sound.volume = volume;
    sound.play().catch(error => console.log("Audio playback error:", error));
} 