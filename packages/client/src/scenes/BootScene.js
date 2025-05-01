import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Create loading text
    const loadingText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      'Loading...',
      { font: '20px Arial', fill: '#ffffff' }
    );
    loadingText.setOrigin(0.5);

    // Create loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(
      this.cameras.main.width / 2 - 160,
      this.cameras.main.height / 2,
      320,
      50
    );

    // Update loading progress
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(
        this.cameras.main.width / 2 - 150,
        this.cameras.main.height / 2 + 10,
        300 * value,
        30
      );
    });

    // Clean up on complete
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load game assets
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('logo', 'https://labs.phaser.io/assets/sprites/phaser3-logo.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');

    // Load warrior sprite
    this.load.spritesheet('warrior',
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
  }

  create() {
    // Create warrior animations
    this.anims.create({
      key: 'left',
      frames: this.anims.generateFrameNumbers('warrior', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'turn',
      frames: [ { key: 'warrior', frame: 4 } ],
      frameRate: 20
    });

    this.anims.create({
      key: 'right',
      frames: this.anims.generateFrameNumbers('warrior', { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1
    });

    this.scene.start('MainScene');
  }
}
