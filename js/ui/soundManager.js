const ambientSounds = {
	forest: null,
	desert: null,
	mountains: null,
	plains: null,
};
let currentPlayingSound = null;

export function initSoundManager() {
	ambientSounds.forest = new Audio(
		"https://freesound.org/data/previews/462/462087_8386274-lq.mp3"
	);
	ambientSounds.desert = new Audio(
		"https://freesound.org/data/previews/361/361259_4284968-lq.mp3"
	);
	ambientSounds.mountains = new Audio(
		"https://freesound.org/data/previews/352/352149_43962-lq.mp3"
	);
	ambientSounds.plains = new Audio(
		"https://freesound.org/data/previews/211/211545_3267529-lq.mp3"
	);

	Object.values(ambientSounds).forEach((sound) => {
		if (sound) {
			sound.loop = true;
			sound.volume = 0.3;
		}
	});
	window.gameModules = window.gameModules || {};
	window.gameModules.soundManager = { playAmbientSound, stopAllAmbientSounds };
}

export function playAmbientSound(biome) {
	if (currentPlayingSound && currentPlayingSound !== ambientSounds[biome]) {
		currentPlayingSound.pause();
		currentPlayingSound.currentTime = 0; // Reset time
	}
	if (
		ambientSounds[biome] &&
		(!currentPlayingSound ||
			currentPlayingSound !== ambientSounds[biome] ||
			currentPlayingSound.paused)
	) {
		ambientSounds[biome]
			.play()
			.catch((error) =>
				console.log("Audio playback error for", biome, ":", error)
			);
		currentPlayingSound = ambientSounds[biome];
	} else if (!ambientSounds[biome] && currentPlayingSound) {
		currentPlayingSound.pause();
		currentPlayingSound = null;
	}
}

export function stopAllAmbientSounds() {
	Object.values(ambientSounds).forEach((sound) => {
		if (sound) sound.pause();
	});
	currentPlayingSound = null;
}
