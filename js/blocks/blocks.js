// Block materials with improved colors for realism and contrast
export const blockMaterials = {
    grass: new THREE.MeshLambertMaterial({ color: 0x3A9D23 }), // Vibrant natural green
    dirt: new THREE.MeshLambertMaterial({ color: 0x59472B }), // Rich earth brown
    stone: new THREE.MeshLambertMaterial({ color: 0x666666 }), // Medium gray
    sand: new THREE.MeshLambertMaterial({ color: 0xDBC681 }), // Base desert sand
    sand_light: new THREE.MeshLambertMaterial({ color: 0xE8D9A0 }), // Light sand for dune tops
    sand_red: new THREE.MeshLambertMaterial({ color: 0xC2A477 }), // Reddish sand
    sand_gold: new THREE.MeshLambertMaterial({ color: 0xD4B16A }), // Golden sand
    sand_dark: new THREE.MeshLambertMaterial({ color: 0xB49B6C }), // Darker sand for shadowed areas
    wood: new THREE.MeshLambertMaterial({ color: 0x52341D }), // Dark brown wood
    snow: new THREE.MeshLambertMaterial({ color: 0xF5F5F5 }), // Bright white snow
    water: new THREE.MeshLambertMaterial({ color: 0x1A45A5, transparent: true, opacity: 0.8 }), // Deep blue water
    cactus: new THREE.MeshLambertMaterial({ color: 0x2D742F }) // Dark green cactus
};

// Block geometry - shared by all blocks
export const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

// Function to create a block with improved visual depth cues
export function createBlock(x, y, z, type, parent) {
    // Create the main block
    const material = blockMaterials[type] || blockMaterials.stone;
    
    // Create the block mesh without adding any edges or outlines
    const mesh = new THREE.Mesh(blockGeometry, material);
    mesh.position.set(x, y, z);
    
    // Add the block to the parent
    parent.add(mesh);
    return mesh;
}

// Function to place a block at a specific position
export function placeBlock(intersection, selectedBlockType, chunkGroup) {
    const { point, normal } = intersection;
    const x = Math.round(point.x + normal.x * 0.5);
    const y = Math.round(point.y + normal.y * 0.5);
    const z = Math.round(point.z + normal.z * 0.5);
    
    // Don't place inside player
    const playerPos = window.camera.position;
    if (Math.abs(x - playerPos.x) < 1 && 
        Math.abs(y - playerPos.y) < 2 && 
        Math.abs(z - playerPos.z) < 1) {
        return false;
    }
    
    // Add block to chunk data
    const posKey = `${x},${y},${z}`;
    if (!chunkGroup.blockPositions[posKey]) {
        chunkGroup.blockPositions[posKey] = {
            type: selectedBlockType,
            index: Object.keys(chunkGroup.blockPositions).length
        };
        
        // Create the block in the world
        const material = blockMaterials[selectedBlockType] || blockMaterials.stone;
        const mesh = new THREE.Mesh(blockGeometry, material.clone());
        mesh.position.set(x, y, z);
        chunkGroup.add(mesh);
        
        return true;
    }
    
    return false;
}

// Function to remove a block
export function removeBlock(intersection) {
    const { chunk, blockPosition } = intersection;
    const posKey = `${blockPosition.x},${blockPosition.y},${blockPosition.z}`;
    
    // Get block type before deletion
    const blockData = chunk.blockPositions[posKey];
    if (blockData) {
        const blockType = blockData.type;
        
        // Remove block from chunk data
        delete chunk.blockPositions[posKey];
        
        // Find and remove the actual block mesh from the scene
        for (let i = chunk.children.length - 1; i >= 0; i--) {
            const blockMesh = chunk.children[i];
            // Check if this mesh is at the same position as our target block
            if (Math.abs(blockMesh.position.x - blockPosition.x) < 0.1 && 
                Math.abs(blockMesh.position.y - blockPosition.y) < 0.1 && 
                Math.abs(blockMesh.position.z - blockPosition.z) < 0.1) {
                // Remove this mesh from the scene
                chunk.remove(blockMesh);
                break; // We found and removed the block, so stop searching
            }
        }
        
        return blockType;
    }
    
    return null;
} 