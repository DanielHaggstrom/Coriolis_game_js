"use strict";

const GAME_SIZE = 800;
const CENTER = GAME_SIZE / 2;
const CYLINDER_PADDING = 10;
const PROJECTILE_RADIUS = 5;
const MAX_PROJECTILES = 5;
const MAX_DRAG_DISTANCE = 200;
const VELOCITY_SCALE = 50;
const MAX_RPM = 0.5;
const MAX_ANGULAR_VELOCITY = (2 * Math.PI) / 120;
const REFERENCE_FRAMES_PER_SECOND = 60;
const MAX_DELTA_MS = 50;

const dom = {
    speedSlider: document.getElementById("speedSlider"),
    rpmLabel: document.getElementById("rpmLabel"),
    radLabel: document.getElementById("radLabel")
};

const state = {
    angularVelocity: 0,
    cylinderRadius: CENTER - CYLINDER_PADDING,
    dragLine: null,
    graphics: null,
    isDragging: false,
    projectiles: [],
    speedRatioText: null,
    startPos: null
};

const config = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: GAME_SIZE,
    height: GAME_SIZE,
    backgroundColor: "#ffffff",
    scene: {
        create,
        update
    }
};

initializeControls();
new Phaser.Game(config);

function initializeControls() {
    if (!dom.speedSlider || !dom.rpmLabel || !dom.radLabel) {
        throw new Error("Simulation controls were not found in the DOM.");
    }

    dom.speedSlider.addEventListener("input", () => {
        setAngularVelocity(Number.parseFloat(dom.speedSlider.value));
    });

    setAngularVelocity(Number.parseFloat(dom.speedSlider.value));
}

function setAngularVelocity(rpm) {
    const normalizedRpm = Phaser.Math.Clamp(rpm, -MAX_RPM, MAX_RPM);

    state.angularVelocity = (normalizedRpm / MAX_RPM) * MAX_ANGULAR_VELOCITY;
    dom.rpmLabel.textContent = `${normalizedRpm.toFixed(2)} RPM`;
    dom.radLabel.textContent = `${state.angularVelocity.toFixed(3)} rad/s`;
}

function create() {
    state.graphics = this.add.graphics();
    state.speedRatioText = this.add.text(0, 0, "", {
        backgroundColor: "#ffffff",
        color: "#162127",
        fontFamily: "Trebuchet MS",
        fontSize: "16px",
        padding: { x: 8, y: 4 }
    });
    state.speedRatioText.setDepth(2);
    state.speedRatioText.setVisible(false);

    drawStaticElements();

    this.input.on("pointerdown", handlePointerDown, this);
    this.input.on("pointermove", handlePointerMove, this);
    this.input.on("pointerup", handlePointerUp, this);
    this.input.on("gameout", cancelDrag, this);
}

function update(_time, delta) {
    const deltaSeconds = Math.min(delta, MAX_DELTA_MS) / 1000;

    for (const projectile of state.projectiles) {
        if (projectile.stopped) {
            continue;
        }

        applyRotatingFrameForces(projectile, deltaSeconds);
        projectile.x += projectile.vx * deltaSeconds;
        projectile.y += projectile.vy * deltaSeconds;

        const radialDistance = distanceFromCenter(projectile);

        if (radialDistance >= state.cylinderRadius) {
            stopProjectileAtWall(projectile, radialDistance);
        }
    }
}

function handlePointerDown(pointer) {
    if (state.isDragging || !insideCylinder(pointer)) {
        return;
    }

    state.startPos = { x: pointer.x, y: pointer.y };
    state.isDragging = true;
    state.dragLine = new Phaser.Geom.Line(pointer.x, pointer.y, pointer.x, pointer.y);

    const textX = Phaser.Math.Clamp(pointer.x + 12, 12, GAME_SIZE - 150);
    const textY = Phaser.Math.Clamp(pointer.y - 28, 12, GAME_SIZE - 32);

    state.speedRatioText.setPosition(textX, textY);
    state.speedRatioText.setVisible(true);
}

function handlePointerMove(pointer) {
    if (!state.isDragging || !state.dragLine || !state.startPos) {
        return;
    }

    const currentPos = clampDragPosition(state.startPos, pointer);
    const dragVelocity = calculateVelocity(state.startPos, currentPos);
    const tangentialSpeed = Math.abs(distanceFromCenter(state.startPos) * state.angularVelocity);
    const launchSpeed = Math.hypot(dragVelocity.vx, dragVelocity.vy);
    const speedRatio = tangentialSpeed > 0
        ? (launchSpeed / tangentialSpeed).toFixed(2)
        : "Infinity";

    state.dragLine.setTo(
        state.startPos.x,
        state.startPos.y,
        currentPos.x,
        currentPos.y
    );

    state.speedRatioText.setText(`Speed Ratio: ${speedRatio}`);

    drawStaticElements();
    state.graphics.lineStyle(2, 0xc25a38, 1);
    state.graphics.strokeLineShape(state.dragLine);
}

function handlePointerUp(pointer) {
    if (!state.isDragging || !state.startPos) {
        return;
    }

    const launchPoint = clampDragPosition(state.startPos, pointer);
    const dragVelocity = calculateVelocity(state.startPos, launchPoint);

    if (insideCylinder(state.startPos)) {
        createProjectile(this, state.startPos, dragVelocity);
    }

    cancelDrag();
}

function cancelDrag() {
    state.isDragging = false;
    state.startPos = null;
    state.dragLine = null;
    state.speedRatioText.setVisible(false);
    drawStaticElements();
}

function createProjectile(scene, position, velocity) {
    if (state.projectiles.length >= MAX_PROJECTILES) {
        const oldestProjectile = state.projectiles.shift();
        oldestProjectile.destroy();
    }

    const projectile = scene.add.circle(position.x, position.y, PROJECTILE_RADIUS, 0x0b5ed7);

    projectile.vx = velocity.vx;
    projectile.vy = velocity.vy;
    projectile.stopped = false;

    state.projectiles.push(projectile);
}

function applyRotatingFrameForces(projectile, deltaSeconds) {
    const dx = projectile.x - CENTER;
    const dy = projectile.y - CENTER;

    const coriolisX = -2 * state.angularVelocity * projectile.vy;
    const coriolisY = 2 * state.angularVelocity * projectile.vx;
    const centrifugalX = dx * state.angularVelocity * state.angularVelocity;
    const centrifugalY = dy * state.angularVelocity * state.angularVelocity;

    projectile.vx += (coriolisX + centrifugalX) * deltaSeconds;
    projectile.vy += (coriolisY + centrifugalY) * deltaSeconds;
}

function stopProjectileAtWall(projectile, radialDistance) {
    const scale = state.cylinderRadius / radialDistance;

    projectile.x = CENTER + (projectile.x - CENTER) * scale;
    projectile.y = CENTER + (projectile.y - CENTER) * scale;
    projectile.vx = 0;
    projectile.vy = 0;
    projectile.stopped = true;
}

function clampDragPosition(startPos, pointer) {
    const dx = pointer.x - startPos.x;
    const dy = pointer.y - startPos.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= MAX_DRAG_DISTANCE || distance === 0) {
        return { x: pointer.x, y: pointer.y };
    }

    const scale = MAX_DRAG_DISTANCE / distance;

    return {
        x: startPos.x + dx * scale,
        y: startPos.y + dy * scale
    };
}

function calculateVelocity(startPos, endPos) {
    let dx = startPos.x - endPos.x;
    let dy = startPos.y - endPos.y;
    const dragDistance = Math.hypot(dx, dy);

    if (dragDistance > MAX_DRAG_DISTANCE) {
        const scale = MAX_DRAG_DISTANCE / dragDistance;

        dx *= scale;
        dy *= scale;
    }

    return {
        vx: (dx / VELOCITY_SCALE) * REFERENCE_FRAMES_PER_SECOND,
        vy: (dy / VELOCITY_SCALE) * REFERENCE_FRAMES_PER_SECOND
    };
}

function distanceFromCenter(point) {
    return Math.hypot(point.x - CENTER, point.y - CENTER);
}

function insideCylinder(point) {
    return distanceFromCenter(point) <= state.cylinderRadius;
}

function drawStaticElements() {
    state.graphics.clear();
    state.graphics.lineStyle(2, 0x87939b, 1);
    state.graphics.strokeRect(0, 0, GAME_SIZE, GAME_SIZE);
    state.graphics.lineStyle(8, 0x162127, 1);
    state.graphics.strokeCircle(CENTER, CENTER, state.cylinderRadius);
    state.graphics.lineStyle(2, 0x162127, 1);
    state.graphics.lineBetween(CENTER - 10, CENTER, CENTER + 10, CENTER);
    state.graphics.lineBetween(CENTER, CENTER - 10, CENTER, CENTER + 10);
}
