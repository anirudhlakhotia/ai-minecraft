// Game constants
export const CHUNK_SIZE = 16;
export const WORLD_SIZE = 16; // Initial, but world expands dynamically
export const VIEW_DISTANCE_MIN = 1;
export const VIEW_DISTANCE_IDEAL = 2;
export const VIEW_DISTANCE_MAX = 3;
export const VIEW_DISTANCE_PRELOAD_FAR = 4;
export const VIEW_DISTANCE_BORDER_EXPANSION = 6;

export let MAX_CACHED_CHUNKS = 500; // Can be adjusted by performance monitor

export const DAY_NIGHT_DURATION = 300; // 5 minutes per cycle

// Block geometry (shared)
export const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

// Block materials
export const blockMaterials = {
	grass: new THREE.MeshLambertMaterial({ color: 0x3a9d23 }),
	dirt: new THREE.MeshLambertMaterial({ color: 0x59472b }),
	stone: new THREE.MeshLambertMaterial({ color: 0x666666 }),
	sand: new THREE.MeshLambertMaterial({ color: 0xdbc681 }),
	sand_light: new THREE.MeshLambertMaterial({ color: 0xe8d9a0 }),
	sand_red: new THREE.MeshLambertMaterial({ color: 0xc2a477 }),
	sand_gold: new THREE.MeshLambertMaterial({ color: 0xd4b16a }),
	sand_dark: new THREE.MeshLambertMaterial({ color: 0xb49b6c }),
	wood: new THREE.MeshLambertMaterial({ color: 0x52341d }),
	snow: new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
	water: new THREE.MeshLambertMaterial({
		color: 0x1a45a5,
		transparent: true,
		opacity: 0.8,
	}),
	cactus: new THREE.MeshLambertMaterial({ color: 0x2d742f }),
};

// Item display properties (colors, names, etc.)
export const itemProperties = {
	grass: { color: "#3A9D23", name: "Grass Block" },
	dirt: { color: "#59472B", name: "Dirt" },
	stone: { color: "#666666", name: "Stone" },
	sand: { color: "#DBC681", name: "Sand" },
	water: { color: "#1E90FF", name: "Water" },
	wood: { color: "#52341D", name: "Wood" },
	stick: {
		color: "#8B5A2B",
		name: "Stick",
		render: function (element) {
			element.style.backgroundColor = "#8B5A2B";
			element.style.width = "15px";
			element.style.height = "35px";
			element.style.margin = "auto";
		},
	},
	wooden_pickaxe: {
		color: "#8B4513",
		name: "Wooden Pickaxe",
		render: function (element) {
			const head = document.createElement("div");
			head.style.width = "30px";
			head.style.height = "10px";
			head.style.backgroundColor = "#8B4513";
			head.style.position = "absolute";
			head.style.top = "5px";
			head.style.left = "50%";
			head.style.transform = "translateX(-50%)";
			const handle = document.createElement("div");
			handle.style.width = "6px";
			handle.style.height = "25px";
			handle.style.backgroundColor = "#8B5A2B";
			handle.style.position = "absolute";
			handle.style.top = "15px";
			handle.style.left = "50%";
			handle.style.transform = "translateX(-50%)";
			element.innerHTML = "";
			element.appendChild(head);
			element.appendChild(handle);
			element.style.position = "relative";
		},
	},
	stone_pickaxe: {
		color: "#808080",
		name: "Stone Pickaxe",
		render: function (element) {
			const head = document.createElement("div");
			head.style.width = "30px";
			head.style.height = "10px";
			head.style.backgroundColor = "#808080";
			head.style.position = "absolute";
			head.style.top = "5px";
			head.style.left = "50%";
			head.style.transform = "translateX(-50%)";
			const handle = document.createElement("div");
			handle.style.width = "6px";
			handle.style.height = "25px";
			handle.style.backgroundColor = "#8B5A2B";
			handle.style.position = "absolute";
			handle.style.top = "15px";
			handle.style.left = "50%";
			handle.style.transform = "translateX(-50%)";
			element.innerHTML = "";
			element.appendChild(head);
			element.appendChild(handle);
			element.style.position = "relative";
		},
	},
	wooden_axe: {
		color: "#8B4513",
		name: "Wooden Axe",
		render: function (element) {
			const head = document.createElement("div");
			head.style.width = "20px";
			head.style.height = "20px";
			head.style.backgroundColor = "#8B4513";
			head.style.position = "absolute";
			head.style.top = "2px";
			head.style.left = "60%";
			head.style.clipPath = "polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)";
			const handle = document.createElement("div");
			handle.style.width = "6px";
			handle.style.height = "30px";
			handle.style.backgroundColor = "#8B5A2B";
			handle.style.position = "absolute";
			handle.style.top = "10px";
			handle.style.left = "40%";
			handle.style.transform = "rotate(45deg)";
			element.innerHTML = "";
			element.appendChild(handle);
			element.appendChild(head);
			element.style.position = "relative";
		},
	},
	stone_axe: {
		color: "#808080",
		name: "Stone Axe",
		render: function (element) {
			const head = document.createElement("div");
			head.style.width = "20px";
			head.style.height = "20px";
			head.style.backgroundColor = "#808080";
			head.style.position = "absolute";
			head.style.top = "2px";
			head.style.left = "60%";
			head.style.clipPath = "polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)";
			const handle = document.createElement("div");
			handle.style.width = "6px";
			handle.style.height = "30px";
			handle.style.backgroundColor = "#8B5A2B";
			handle.style.position = "absolute";
			handle.style.top = "10px";
			handle.style.left = "40%";
			handle.style.transform = "rotate(45deg)";
			element.innerHTML = "";
			element.appendChild(handle);
			element.appendChild(head);
			element.style.position = "relative";
		},
	},
	crafting_table: {
		color: "#7D5A1A",
		name: "Crafting Table",
		render: function (element) {
			element.style.backgroundImage =
				"linear-gradient(#8B5A2B 1px, transparent 1px), linear-gradient(90deg, #8B5A2B 1px, transparent 1px)";
			element.style.backgroundSize = "10px 10px";
			element.style.backgroundColor = "#7D5A1A";
		},
	},
};

// Crafting recipes
export const recipes = [
	{
		id: "stick",
		pattern: [
			[null, null, null],
			[null, "wood", null],
			[null, "wood", null],
		],
		result: { item: "stick", quantity: 4 },
	},
	{
		id: "wooden_pickaxe",
		pattern: [
			["wood", "wood", "wood"],
			[null, "stick", null],
			[null, "stick", null],
		],
		result: { item: "wooden_pickaxe", quantity: 1 },
	},
	{
		id: "wooden_axe",
		pattern: [
			["wood", "wood", null],
			["wood", "stick", null],
			[null, "stick", null],
		],
		result: { item: "wooden_axe", quantity: 1 },
	},
	{
		id: "stone_pickaxe",
		pattern: [
			["stone", "stone", "stone"],
			[null, "stick", null],
			[null, "stick", null],
		],
		result: { item: "stone_pickaxe", quantity: 1 },
	},
	{
		id: "stone_axe",
		pattern: [
			["stone", "stone", null],
			["stone", "stick", null],
			[null, "stick", null],
		],
		result: { item: "stone_axe", quantity: 1 },
	},
	{
		id: "crafting_table",
		pattern: [
			["wood", "wood", null],
			["wood", "wood", null],
			[null, null, null],
		],
		result: { item: "crafting_table", quantity: 1 },
	},
];

// Initial player inventory
export const initialPlayerInventory = {
	grass: 0,
	dirt: 0,
	stone: 0,
	sand: 0,
	wood: 0,
	stick: 0,
	wooden_pickaxe: 0,
	stone_pickaxe: 0,
	wooden_axe: 0,
	stone_axe: 0,
	crafting_table: 0,
};

export function setMaxCachedChunks(value) {
	MAX_CACHED_CHUNKS = value;
}
