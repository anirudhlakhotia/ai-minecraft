import { camera, scene, isGameStarted } from '../core/game.js';
import { keyboard } from '../player/physics.js';

// Highlight box for showing which block is targeted
let highlightBox;

// Initialize the highlight box
export function initHighlightBox() {
    // Create wireframe geometry for the highlight box
    const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        linewidth: 2,
        transparent: true,
        opacity: 0.8
    });
    
    highlightBox = new THREE.LineSegments(edges, material);
    highlightBox.visible = false;
    scene.add(highlightBox);
    
    console.log("Highlight box initialized");
    
    // Add mouse event listeners for highlight color changes
    document.addEventListener('mousedown', function(event) {
        if (!highlightBox || !highlightBox.visible) return;
        
        if (event.button === 0) {
            // Left click - breaking block
            highlightBox.material.color.setHex(0xff3333); // Red for breaking
        } else if (event.button === 2) {
            // Right click - placing block
            highlightBox.material.color.setHex(0x33ff33); // Green for placing
        }
    });

    document.addEventListener('mouseup', function() {
        if (!highlightBox || !highlightBox.visible) return;
        // Reset color on mouse up
        highlightBox.material.color.setHex(0xffffff);
    });
    
    return highlightBox;
}

// Update the highlight box position
export function updateBlockHighlight() {
    if (!isGameStarted || window.isCraftingOpen) {
        // Hide highlight when game is not started or crafting UI is open
        if (highlightBox) highlightBox.visible = false;
        return;
    }
    
    // Cast ray from camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    // Find all intersections with terrain chunks
    const intersections = [];
    Object.values(window.terrain).forEach(chunk => {
        // We need to check each block in the chunk
        for (const [posKey, blockData] of Object.entries(chunk.blockPositions)) {
            const [x, y, z] = posKey.split(',').map(Number);
            const blockBox = new THREE.Box3(
                new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
                new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
            );
            
            // Check for intersection with this block
            const intersect = raycaster.ray.intersectBox(blockBox, new THREE.Vector3());
            if (intersect) {
                intersections.push({
                    distance: intersect.distanceTo(camera.position),
                    point: intersect.clone(),
                    normal: raycaster.ray.direction.clone().negate(),
                    blockPosition: { x, y, z },
                    chunk: chunk,
                    blockData: blockData
                });
            }
        }
    });
    
    // Sort by distance
    intersections.sort((a, b) => a.distance - b.distance);
    
    if (intersections.length > 0 && intersections[0].distance < 5) {
        // We have a target block in range
        const target = intersections[0];
        
        // Position the highlight box at the target block position
        highlightBox.position.set(
            target.blockPosition.x,
            target.blockPosition.y,
            target.blockPosition.z
        );
        
        // Change highlight color based on action (left click = break, right click = place)
        if (keyboard.shift) {
            // Special color when shift is held (could indicate special action)
            highlightBox.material.color.setHex(0xff3333);
        } else {
            // Regular highlight
            highlightBox.material.color.setHex(0xffffff);
        }
        
        // Make highlight visible
        highlightBox.visible = true;
        
        // Optional: pulse effect for the highlight
        const pulse = 0.8 + 0.2 * Math.sin(performance.now() * 0.005);
        highlightBox.material.opacity = pulse;
    } else {
        // No target block, hide the highlight
        highlightBox.visible = false;
    }
    
    return intersections.length > 0 ? intersections[0] : null;
} 