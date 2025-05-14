export function seededRandom(seed) {
	return function () {
		const x = Math.sin(seed++) * 10000;
		return x - Math.floor(x);
	};
}

export function lerp(a, b, t) {
	return a + (b - a) * t;
}

export function lerpColor(colorA, colorB, t) {
	const a = new THREE.Color(colorA);
	const b = new THREE.Color(colorB);
	return new THREE.Color(
		a.r + (b.r - a.r) * t,
		a.g + (b.g - a.g) * t,
		a.b + (b.b - a.b) * t
	).getHex();
}

export function formatItemName(item) {
	return item
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function getDefaultColorForItem(item, itemProperties) {
	if (itemProperties[item] && itemProperties[item].color) {
		return itemProperties[item].color;
	}
	const defaultColors = {
		grass: "#3A9D23",
		dirt: "#59472B",
		stone: "#666666",
		sand: "#DBC681",
		wood: "#52341D",
		snow: "#F5F5F5",
		water: "#1A45A5",
		cactus: "#2D742F",
		stick: "#8B5A2B",
	};
	return defaultColors[item] || "#AAAAAA";
}
