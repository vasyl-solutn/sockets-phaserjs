import Phaser from 'phaser';
import { API_URL } from '../main';
import axios from 'axios';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.socket = null;
    this.warrior = null;
    this.cursors = null;
    this.targetPosition = null;
    this.isMovingToTarget = false;
    this.canClick = true;
    this.cooldownTimer = null;
    this.cooldownText = null;
    this.cooldownTime = 1400; // 1400 milliseconds
    this.remainingCooldown = 0;
  }

  init() {
    // Test API connection
    axios.get(`${API_URL}/api/status`)
      .then(response => {
        console.log('Connected to server:', response.data);
      })
      .catch(error => {
        console.error('Failed to connect to server:', error);
      });

    // Setup socket connection (commented out until we're ready to use it)
    /*
    this.socket = io(API_URL);

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    this.socket.on('playerMoved', (playerInfo) => {
      // Update other players
      console.log('Player moved:', playerInfo);
    });
    */
  }

  create() {
    // Add background
    this.add.image(400, 300, 'sky');

    // Add particles that will follow the warrior
    this.particles = this.add.particles(0, 0, 'red', {
      speed: 50,
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      lifespan: 300
    });

    // Add warrior character
    this.warrior = this.physics.add.sprite(400, 300, 'warrior');
    this.warrior.setBounce(0.2);
    this.warrior.setCollideWorldBounds(true);
    this.warrior.setDepth(10); // Make sure warrior appears above other elements

    // Make particles follow the warrior
    this.particles.startFollow(this.warrior);

    // Add invisible ground platform for warrior to stand on
    const ground = this.physics.add.staticGroup();
    ground.create(400, 568, 'red').setScale(80, 1).refreshBody().setVisible(false);

    // Set up collision between warrior and ground
    this.physics.add.collider(this.warrior, ground);

    // Create cursor keys for controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add click/tap handler for warrior movement with cooldown
    this.input.on('pointerdown', (pointer) => {
      if (this.canClick) {
        // Set target position for warrior to move to
        this.targetPosition = { x: pointer.x, y: pointer.y };
        this.isMovingToTarget = true;

        // Create a small effect at the click position
        this.add.circle(pointer.x, pointer.y, 10, 0xffff00, 0.5)
          .setDepth(5)
          .setAlpha(0.7);

        // Determine which direction to face based on click position
        if (pointer.x < this.warrior.x) {
          this.warrior.anims.play('left', true);
        } else {
          this.warrior.anims.play('right', true);
        }

        // Send click coordinates to backend
        this.sendCoordinatesToBackend(pointer.x, pointer.y);

        // Example of what we'd do with sockets when enabled
        /*
        if (this.socket) {
          this.socket.emit('playerMove', {
            x: pointer.x,
            y: pointer.y
          });
        }
        */

        // Start cooldown
        this.startCooldown();
      }
    });

    // Add instruction text
    this.add.text(16, 16, 'Click/tap anywhere to move the warrior (1.4s cooldown)', {
      font: '18px Arial',
      fill: '#ffffff'
    });

    // Add cooldown text
    this.cooldownText = this.add.text(16, 40, '', {
      font: '24px Arial',
      fill: '#ff8800',
      fontStyle: 'bold'
    });
  }

  sendCoordinatesToBackend(x, y) {
    // Create data object with coordinates
    const data = {
      x: Math.round(x),
      y: Math.round(y),
      timestamp: Date.now(),
      playerId: 'player1' // In a real game, this would be the actual player ID
    };

    // Send data to backend
    axios.post(`${API_URL}/api/coordinates`, data)
      .then(response => {
        console.log('Coordinates sent to server:', response.data);
      })
      .catch(error => {
        console.error('Failed to send coordinates:', error);
      });
  }

  startCooldown() {
    // Disable clicking
    this.canClick = false;
    this.remainingCooldown = this.cooldownTime;

    // Update cooldown text
    this.updateCooldownText();

    // Create a timer that updates every 100ms
    this.cooldownTimer = this.time.addEvent({
      delay: 100,
      callback: this.updateCooldown,
      callbackScope: this,
      loop: true
    });
  }

  updateCooldown() {
    this.remainingCooldown -= 100;
    this.updateCooldownText();

    if (this.remainingCooldown <= 0) {
      // Enable clicking again
      this.canClick = true;
      this.cooldownText.setText('');

      // Stop the timer
      if (this.cooldownTimer) {
        this.cooldownTimer.remove();
        this.cooldownTimer = null;
      }
    }
  }

  updateCooldownText() {
    // Calculate tenths of a second (14 down to 0 for 1400ms)
    const tenths = Math.ceil(this.remainingCooldown / 100);
    this.cooldownText.setText(`${tenths}`);

    // Change color based on remaining time
    if (tenths <= 5) {
      this.cooldownText.setColor('#00ff00'); // Green for last 5 tenths
    } else if (tenths <= 10) {
      this.cooldownText.setColor('#ffff00'); // Yellow for middle range
    } else {
      this.cooldownText.setColor('#ff8800'); // Orange for start
    }

    // Make text size change with countdown
    const scale = 1 + (tenths / 14) * 0.5;
    this.cooldownText.setScale(scale);
  }

  update() {
    // Handle click/tap movement
    if (this.isMovingToTarget && this.targetPosition) {
      // Calculate distance from warrior to target
      const distance = Phaser.Math.Distance.Between(
        this.warrior.x, this.warrior.y,
        this.targetPosition.x, this.targetPosition.y
      );

      // If warrior is close to target, stop moving
      if (distance < 4) {
        this.warrior.setVelocity(0);
        this.warrior.anims.play('turn');
        this.isMovingToTarget = false;
      } else {
        // Move warrior toward target position
        this.physics.moveTo(
          this.warrior,
          this.targetPosition.x,
          this.targetPosition.y,
          160
        );

        // Update animation based on movement direction
        if (this.targetPosition.x < this.warrior.x) {
          this.warrior.anims.play('left', true);
        } else {
          this.warrior.anims.play('right', true);
        }
      }
    }

    // Since the cursor keys aren't working, let's use WASD instead
    const keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    // Handle keyboard movement with WASD
    if (keyA.isDown) {
      this.warrior.setVelocityX(-160);
      this.warrior.anims.play('left', true);
      this.isMovingToTarget = false; // Cancel click movement
    }
    else if (keyD.isDown) {
      this.warrior.setVelocityX(160);
      this.warrior.anims.play('right', true);
      this.isMovingToTarget = false; // Cancel click movement
    }
    else if (!this.isMovingToTarget) {
      // Only stop if not moving to target
      this.warrior.setVelocityX(0);
      this.warrior.anims.play('turn');
    }

    // Jump when W key is pressed and warrior is on ground
    if (keyW.isDown && this.warrior.body.touching.down) {
      this.warrior.setVelocityY(-330);
      this.isMovingToTarget = false; // Cancel click movement
    }
  }
}
