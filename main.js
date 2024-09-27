// Create a new Phaser game
let config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF',
    physics: {
        default: 'arcade',
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let game = new Phaser.Game(config);

// global variables
let cylinderCenter, cylinderRadius, cylinderThickness;
let omega = 0.1;
let maxDragDistance = 150;
let velocityScale = 10;
let dragStart, dragEnd;
let projectiles = [];
let isDragging = false;
let omegaSlider;
let projectileGroup;

function preload() {
    // preload assets if necessary
}

function create() {
    // setting up basic game properties
    cylinderRadius = 300;
    cylinderThickness = 20;
    cylinderCenter = { x: this.sys.game.config.width / 2, y: this.sys.game.config.height / 2 };

    // drawing the cylinder and crosshairs
    drawCylinder(this);

    // creating a group to manage projectiles
    projectileGroup = this.add.group();

    // adding slider for controlling omega (rotation speed)
    omegaSlider = new OmegaSlider(this, 50, this.sys.game.config.height - 50, 300, 0, 0.5, omega);

    // mouse input events
    this.input.on('pointerdown', (pointer) => {
        dragStart = pointer;
        if (insideCylinder(dragStart)) {
            isDragging = true;
        }
    });

    this.input.on('pointerup', (pointer) => {
        if (isDragging) {
            isDragging = false;
            dragEnd = pointer;
            let velocity = calculateVelocity(dragStart, dragEnd, velocityScale);
            if (insideCylinder(dragStart)) {
                createProjectile(dragStart, velocity);
            }
        }
    });
}

function update() {
    // update logic for game loop
    if (isDragging) {
        // optional: show the drag line
    }

    // update projectiles
    projectileGroup.getChildren().forEach(projectile => {
        if (!hitCylinderBoundary(projectile)) {
            applyCoriolisAndCentrifugal(projectile, omega);
            projectile.x += projectile.body.velocity.x;
            projectile.y += projectile.body.velocity.y;

            if (!insideCylinder(projectile)) {
                projectileGroup.remove(projectile, true);
            }
        }
    });

    // update the slider value
    omega = omegaSlider.value;
}

function drawCylinder(scene) {
    let graphics = scene.add.graphics();
    graphics.lineStyle(cylinderThickness, 0x000000, 1);
    graphics.strokeCircle(cylinderCenter.x, cylinderCenter.y, cylinderRadius + cylinderThickness / 2);

    // draw crosshairs at the center
    graphics.lineStyle(2, 0x000000);
    graphics.lineBetween(cylinderCenter.x - 10, cylinderCenter.y, cylinderCenter.x + 10, cylinderCenter.y);
    graphics.lineBetween(cylinderCenter.x, cylinderCenter.y - 10, cylinderCenter.x, cylinderCenter.y + 10);
}

function insideCylinder(pos) {
    let dx = pos.x - cylinderCenter.x;
    let dy = pos.y - cylinderCenter.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= cylinderRadius;
}

function hitCylinderBoundary(pos) {
    let dx = pos.x - cylinderCenter.x;
    let dy = pos.y - cylinderCenter.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    return cylinderRadius - cylinderThickness / 2 <= distance && distance <= cylinderRadius + cylinderThickness / 2;
}

function calculateVelocity(startPos, endPos, velocityScale) {
    let dx = startPos.x - endPos.x;
    let dy = startPos.y - endPos.y;
    let dragDistance = Math.sqrt(dx * dx + dy * dy);

    if (dragDistance > maxDragDistance) {
        let scale = maxDragDistance / dragDistance;
        dx *= scale;
        dy *= scale;
    }

    return { x: dx / velocityScale, y: dy / velocityScale };
}

function applyCoriolisAndCentrifugal(projectile, omega) {
    let vx = projectile.body.velocity.x;
    let vy = projectile.body.velocity.y;
    let relX = projectile.x - cylinderCenter.x;
    let relY = projectile.y - cylinderCenter.y;

    let coriolisX = 2 * omega * vy;
    let coriolisY = -2 * omega * vx;
    let centrifugalX = omega ** 2 * relX;
    let centrifugalY = omega ** 2 * relY;

    projectile.body.velocity.x += coriolisX + centrifugalX;
    projectile.body.velocity.y += coriolisY + centrifugalY;
}

function createProjectile(position, velocity) {
    let projectile = projectileGroup.create(position.x, position.y, null);
    projectile.body.velocity.x = velocity.x;
    projectile.body.velocity.y = velocity.y;
}

// Omega Slider class
class OmegaSlider {
    constructor(scene, x, y, width, minVal, maxVal, startVal) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.value = startVal;
        this.handleX = this.x + (this.value - this.minVal) / (this.maxVal - this.minVal) * this.width;

        this.graphics = scene.add.graphics();
        this.graphics.lineStyle(5, 0x000000);
        this.graphics.strokeLineShape(new Phaser.Geom.Line(x, y, x + width, y));

        this.handle = scene.add.circle(this.handleX, y, 10, 0xFF0000);
        scene.input.setDraggable(this.handle);
        scene.input.on('drag', (pointer, gameObject, dragX) => {
            if (gameObject === this.handle) {
                this.updateValue(dragX);
            }
        });
    }

    updateValue(mouseX) {
        this.handleX = Phaser.Math.Clamp(mouseX, this.x, this.x + this.width);
        this.handle.x = this.handleX;
        this.value = this.minVal + (this.handleX - this.x) / this.width * (this.maxVal - this.minVal);
    }
}
