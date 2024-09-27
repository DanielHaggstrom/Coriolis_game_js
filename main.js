let config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    backgroundColor: '#FFFFFF', // White background
    scene: {
        create: create
    }
};

let game = new Phaser.Game(config);

function create() {
    let graphics = this.add.graphics();
    graphics.lineStyle(20, 0x000000, 1);
    graphics.strokeCircle(600, 400, 300); // Draw the black circle in the center
}