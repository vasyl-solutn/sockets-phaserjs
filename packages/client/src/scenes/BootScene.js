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

    // Handle loading errors
    this.load.on('loaderror', (file) => {
      console.error('Error loading file:', file.src);
      // Show error message
      this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 100,
        'Error loading assets. Please refresh.',
        { font: '16px Arial', fill: '#ff0000' }
      ).setOrigin(0.5);
    });

    // Clean up on complete
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load game assets from Phaser.io CDN
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('logo', 'https://labs.phaser.io/assets/sprites/phaser3-logo.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');

    // Load warrior sprite
    this.load.spritesheet('warrior',
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );

    // Load barrier sprites
    this.load.image('barrier-weak', 'https://labs.phaser.io/assets/sprites/orb-blue.png');
    this.load.image('barrier-medium', 'https://labs.phaser.io/assets/sprites/orb-green.png');
    this.load.image('barrier-strong', 'https://labs.phaser.io/assets/sprites/orb-red.png');

    // Add timeout for loading
    this.load.on('loaderror', () => {
      this.time.delayedCall(5000, () => {
        if (!this.scene.isActive('MainScene')) {
          this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 150,
            'Loading timeout. Please check your internet connection and refresh.',
            { font: '16px Arial', fill: '#ff0000' }
          ).setOrigin(0.5);
        }
      });
    });
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

    // Add a small delay before starting the main scene
    this.time.delayedCall(500, () => {
      this.scene.start('MainScene');
    });
  }
}
