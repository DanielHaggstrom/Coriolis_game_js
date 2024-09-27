let config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: {
        create: create,
        update: update
    }
};

let game = new Phaser.Game(config);

let projectiles = [];
let isDragging = false;
let startPos = null;
let dragLine = null;
let velocityScale = 50; // Adjusted to slow down projectiles
let maxDragDistance = 200;
let maxProjectiles = 5; // Limit the number of projectiles to 5
let graphics; // Single graphics object for drawing the line

function create() {
    // Create a single graphics object for the entire scene
    graphics = this.add.graphics();

    // Draw the box boundaries
    graphics.lineStyle(2, 0x808080);  // Thin gray line for boundaries
    graphics.strokeRect(0, 0, config.width, config.height);  // Box around the entire game area

    // Draw the thick black circle in the center
    let centerX = config.width / 2;
    let centerY = config.height / 2;
    let centerCircleRadius = 50;  // Radius of the black circle
    graphics.lineStyle(8, 0x000000);  // Thick black circle
    graphics.strokeCircle(centerX, centerY, centerCircleRadius);

    // Draw the crosshairs in the center
    graphics.lineStyle(2, 0x000000);  // Thin black line for crosshairs
    graphics.lineBetween(centerX - 10, centerY, centerX + 10, centerY);  // Horizontal line
    graphics.lineBetween(centerX, centerY - 10, centerX, centerY + 10);  // Vertical line

    // Handle mouse input for dragging and launching projectiles
    this.input.on('pointerdown', (pointer) => {
        if (!isDragging) {
            startPos = { x: pointer.x, y: pointer.y };
            isDragging = true;

            // Create a line object for the drag
            dragLine = new Phaser.Geom.Line(startPos.x, startPos.y, pointer.x, pointer.y);
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (isDragging && dragLine) {
            // Update the line's end point to the current pointer position
            dragLine.setTo(startPos.x, startPos.y, pointer.x, pointer.y);

            // Clear the previous frame's graphics and draw the updated line
            graphics.clear();

            // Re-draw the static elements (box boundaries, circle, and crosshairs)
            drawStaticElements(graphics);

            graphics.lineStyle(2, 0xff0000, 1);
            graphics.strokeLineShape(dragLine);
        }
    });

    this.input.on('pointerup', (pointer) => {
        if (isDragging) {
            isDragging = false;

            // Calculate the velocity based on the drag distance and direction
            let velocity = calculateVelocity(startPos, pointer);

            // Create and launch the projectile
            createProjectile(this, startPos, velocity);

            // Clear the drag line after releasing
            graphics.clear();

            // Re-draw the static elements (box boundaries, circle, and crosshairs)
            drawStaticElements(graphics);

            dragLine = null;
        }
    });
}

function update() {
    // Update the position of each projectile
    projectiles.forEach(projectile => {
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Optionally remove projectile if it goes out of bounds
        if (projectile.x < 0 || projectile.x > config.width || projectile.y < 0 || projectile.y > config.height) {
            projectiles.splice(projectiles.indexOf(projectile), 1);  // Remove from array
            projectile.destroy();  // Destroy the visual object
        }
    });
}

function createProjectile(scene, position, velocity) {
    // Limit the number of projectiles to 5 by removing the oldest one
    if (projectiles.length >= maxProjectiles) {
        let oldestProjectile = projectiles.shift();  // Remove the first (oldest) projectile
        oldestProjectile.destroy();  // Destroy the visual object
    }

    // Create a new projectile (ball) at the starting position
    let projectile = scene.add.circle(position.x, position.y, 5, 0x0000FF);

    // Assign the velocity to the projectile
    projectile.vx = velocity.vx;
    projectile.vy = velocity.vy;

    // Add the projectile to the list
    projectiles.push(projectile);
}

function calculateVelocity(startPos, endPos) {
    // Calculate direction and distance of the drag
    let dx = startPos.x - endPos.x;
    let dy = startPos.y - endPos.y;
    let dragDistance = Math.sqrt(dx * dx + dy * dy);

    // Cap the drag distance to avoid extreme speeds
    if (dragDistance > maxDragDistance) {
        let scale = maxDragDistance / dragDistance;
        dx *= scale;
        dy *= scale;
    }

    // Return the velocity vector, scaled by velocityScale
    return {
        vx: dx / velocityScale,  // Adjusted velocity
        vy: dy / velocityScale   // Adjusted velocity
    };
}

// Function to re-draw the static elements (box, circle, and crosshairs)
function drawStaticElements(graphics) {
    let centerX = config.width / 2;
    let centerY = config.height / 2;
    let centerCircleRadius = 50;

    // Re-draw the box boundaries
    graphics.lineStyle(2, 0x808080);
    graphics.strokeRect(0, 0, config.width, config.height);

    // Re-draw the thick black circle
    graphics.lineStyle(8, 0x000000);
    graphics.strokeCircle(centerX, centerY, centerCircleRadius);

    // Re-draw the crosshairs
    graphics.lineStyle(2, 0x000000);
    graphics.lineBetween(centerX - 10, centerY, centerX + 10, centerY);  // Horizontal line
    graphics.lineBetween(centerX, centerY - 10, centerX, centerY + 10);  // Vertical line
}
