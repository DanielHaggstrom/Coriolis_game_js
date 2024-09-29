let config = {
    type: Phaser.AUTO,
    width: 1400,  // Make the canvas wider
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
let velocityScale = 50;  // Adjust the speed scale as needed
let maxDragDistance = 200;  // Max drag distance for max velocity
let maxProjectiles = 5; // Limit the number of projectiles to 5
let graphics; // Single graphics object for drawing the line
let cylinderRadius; // Radius of the inscribed cylinder
let angularVelocity = 0; // Initial angular velocity
let angularVelocityMax = (2 * Math.PI) / 120; // 0.5 RPM in radians per second (new max angular velocity)
let speedRatioText; // Text to show the speed ratio during drag

// Constants for layout
let squareSize = config.height;  // The size of the square (height of the game canvas)
let rightRectWidth = config.width - squareSize;  // The width of the right rectangle

function create() {
    // Create a single graphics object for the entire scene
    graphics = this.add.graphics();

    // Calculate the inscribed circle's radius (cylinder radius)
    let centerX = squareSize / 2;  // Center based on the square on the left
    let centerY = squareSize / 2;
    cylinderRadius = Math.min(squareSize, squareSize) / 2 - 10;  // The -10 is for padding from the boundaries

    // Draw the box boundaries for the square on the left
    graphics.lineStyle(2, 0x808080);  // Thin gray line for boundaries
    graphics.strokeRect(0, 0, squareSize, squareSize);  // Box (square) on the left

    // Draw the large black circle (inscribed cylinder inside the square)
    graphics.lineStyle(8, 0x000000);  // Thick black circle
    graphics.strokeCircle(centerX, centerY, cylinderRadius);

    // Draw the crosshairs in the center of the cylinder
    graphics.lineStyle(2, 0x000000);  // Thin black line for crosshairs
    graphics.lineBetween(centerX - 10, centerY, centerX + 10, centerY);  // Horizontal line
    graphics.lineBetween(centerX, centerY - 10, centerX, centerY + 10);  // Vertical line

    // Create a dynamic text object for the speed ratio (initially hidden)
    speedRatioText = this.add.text(0, 0, '', { fontSize: '16px', fill: '#000', backgroundColor: '#FFFFFF', padding: 5 });
    speedRatioText.setVisible(false);  // Hide initially

    // Create the slider and place it in the right rectangle (outside the Phaser canvas)
    createSlider();

    // Handle mouse input for dragging and launching projectiles
    this.input.on('pointerdown', (pointer) => {
        if (!isDragging && insideCylinder(pointer)) {
            startPos = { x: pointer.x, y: pointer.y };
            isDragging = true;

            // Create a line object for the drag
            dragLine = new Phaser.Geom.Line(startPos.x, startPos.y, pointer.x, pointer.y);

            // Set the position of the speed ratio text near the starting point
            speedRatioText.setPosition(startPos.x + 10, startPos.y - 25);  // Position slightly to the right and above the start
            speedRatioText.setVisible(true);  // Make the text visible
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (isDragging && dragLine) {
            // Calculate the drag distance and cap it to maxDragDistance
            let currentPos = { x: pointer.x, y: pointer.y };
            let dragVector = {
                dx: currentPos.x - startPos.x,
                dy: currentPos.y - startPos.y
            };
            let dragDistance = Math.sqrt(dragVector.dx * dragVector.dx + dragVector.dy * dragVector.dy);

            // Cap the drag distance if it exceeds the max allowed
            if (dragDistance > maxDragDistance) {
                // Scale the current position back to the max drag distance
                let scale = maxDragDistance / dragDistance;
                currentPos.x = startPos.x + dragVector.dx * scale;
                currentPos.y = startPos.y + dragVector.dy * scale;
            }

            // Update the dragLine
            dragLine.setTo(startPos.x, startPos.y, currentPos.x, currentPos.y);

            // Calculate launch speed and ratio
            let dragVelocity = calculateVelocity(startPos, currentPos);
            let radialDistance = distanceFromCenter(startPos);
            let tangentialSpeed = Math.abs(radialDistance * angularVelocity);
            let launchSpeedMagnitude = Math.sqrt(dragVelocity.vx * dragVelocity.vx + dragVelocity.vy * dragVelocity.vy);
            let speedRatio = tangentialSpeed !== 0 ? (launchSpeedMagnitude / tangentialSpeed).toFixed(2) : '∞';

            // Update speed ratio text next to the starting point
            speedRatioText.setText(`Speed Ratio: ${speedRatio}`);

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
            let dragVelocity = calculateVelocity(startPos, pointer);

            // No tangential velocity is added anymore; we launch only with the drag velocity
            if (insideCylinder(startPos)) {
                createProjectile(this, startPos, dragVelocity);
            }

            // Clear the drag line after releasing
            graphics.clear();
            drawStaticElements(graphics);
            dragLine = null;

            // Hide the speed ratio text after launching
            speedRatioText.setVisible(false);
        }
    });
}

function update() {
    // Update the position of each projectile
    projectiles.forEach(projectile => {
        // Apply centrifugal force even if the projectile has zero speed (and not hit a wall)
        if (projectile.vx === 0 && projectile.vy === 0 && !projectile.stopped) {
            applyCentrifugalForceOnly(projectile);
        } else if (!projectile.stopped) {
            applyCoriolisAndCentrifugalForce(projectile);  // Apply both Coriolis and centrifugal forces
        }

        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Stop the projectile when it hits the cylinder's wall
        if (distanceFromCenter(projectile) >= cylinderRadius) {
            projectile.vx = 0;
            projectile.vy = 0;
            projectile.stopped = true;  // Mark it as stopped when hitting the wall
        }
    });
}

// Apply centrifugal force only to projectiles that are not moving
function applyCentrifugalForceOnly(projectile) {
    let centerX = squareSize / 2;
    let centerY = squareSize / 2;

    // Calculate relative position from the center of the cylinder
    let dx = projectile.x - centerX;
    let dy = projectile.y - centerY;

    // Apply centrifugal force (F_centrifugal = omega^2 * r)
    let centrifugalForceX = dx * angularVelocity * angularVelocity;
    let centrifugalForceY = dy * angularVelocity * angularVelocity;
    projectile.vx += centrifugalForceX;
    projectile.vy += centrifugalForceY;
}

// Apply both Coriolis and centrifugal forces to the projectile
function applyCoriolisAndCentrifugalForce(projectile) {
    let centerX = squareSize / 2;
    let centerY = squareSize / 2;

    // Calculate relative position from the center of the cylinder
    let dx = projectile.x - centerX;
    let dy = projectile.y - centerY;

    // Apply Coriolis force
    let coriolisX = -2 * angularVelocity * projectile.vy;
    let coriolisY = 2 * angularVelocity * projectile.vx;
    projectile.vx += coriolisX;
    projectile.vy += coriolisY;

    // Apply centrifugal force (F_centrifugal = omega^2 * r)
    let centrifugalForceX = dx * angularVelocity * angularVelocity;
    let centrifugalForceY = dy * angularVelocity * angularVelocity;
    projectile.vx += centrifugalForceX;
    projectile.vy += centrifugalForceY;
}

// Function to calculate distance from the center of the cylinder
function distanceFromCenter(point) {
    let centerX = squareSize / 2;
    let centerY = squareSize / 2;
    return Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2));
}

// Function to check if a point is inside the cylinder (within the left square)
function insideCylinder(point) {
    return distanceFromCenter(point) <= cylinderRadius;
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

    // Mark the projectile as not stopped (not yet hit a wall)
    projectile.stopped = false;

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
        vx: dx / velocityScale,
        vy: dy / velocityScale
    };
}

// Function to re-draw the static elements (box, circle, and crosshairs)
function drawStaticElements(graphics) {
    let centerX = squareSize / 2;  // Adjust for the square layout
    let centerY = squareSize / 2;
    graphics.lineStyle(2, 0x808080);
    graphics.strokeRect(0, 0, squareSize, squareSize);  // Box boundaries (square)
    graphics.lineStyle(8, 0x000000);
    graphics.strokeCircle(centerX, centerY, cylinderRadius);  // Large black circle (cylinder)
    graphics.lineStyle(2, 0x000000);
    graphics.lineBetween(centerX - 10, centerY, centerX + 10, centerY);  // Crosshairs
    graphics.lineBetween(centerX, centerY - 10, centerX, centerY + 10);  // Crosshairs
}

// Function to create the slider for angular speed
function createSlider() {
    let sliderContainer = document.createElement('div');
    sliderContainer.style.position = 'absolute';
    sliderContainer.style.bottom = '30px';
    sliderContainer.style.left = `${squareSize + rightRectWidth / 2}px`;  // Center it in the right rectangle
    sliderContainer.style.transform = 'translateX(-50%)';
    sliderContainer.innerHTML = `
        <label for="speedSlider" style="font-size:16px;">Angular Speed (RPM):</label>
        <input type="range" id="speedSlider" min="-0.5" max="0.5" value="0" step="0.01" style="width: 300px;">
        <span id="rpmLabel" style="font-size:16px;">0 RPM</span>
        <span id="radLabel" style="font-size:16px;">(0 rad/s)</span>
    `;
    document.body.appendChild(sliderContainer);

    let speedSlider = document.getElementById('speedSlider');
    let rpmLabel = document.getElementById('rpmLabel');
    let radLabel = document.getElementById('radLabel');

    speedSlider.addEventListener('input', function () {
        let rpm = parseFloat(speedSlider.value);
        angularVelocity = rpm * angularVelocityMax / 0.5;  // Convert RPM to radians per second (new scale)
        rpmLabel.innerText = `${rpm} RPM`;
        radLabel.innerText = `(${angularVelocity.toFixed(2)} rad/s)`;
    });
}
