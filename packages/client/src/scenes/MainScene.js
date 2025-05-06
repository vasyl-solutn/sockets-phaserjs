import Phaser from 'phaser';
import { API_URL } from '../main';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Barrier } from '../objects/Barrier';

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
    this.otherClicks = {}; // Store other players' click markers
    this.playerId = 'player_' + Math.floor(Math.random() * 10000); // Generate random player ID
    this.barriers = null;
    this.movementLine = null;
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

    // Setup socket connection
    this.socket = io(API_URL);

    this.socket.on('connect', () => {
      console.log('Connected to socket server with ID:', this.socket.id);
      // Update our playerId with the socket ID
      this.playerId = this.socket.id;
    });

    // Listen for other players' clicks
    this.socket.on('otherClick', (clickData) => {
      console.log('Other player clicked:', clickData);
      this.showOtherPlayerClick(clickData);
    });
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

    // Create barriers group
    this.barriers = this.physics.add.staticGroup();

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

    // Set up collision between warrior and barriers
    this.physics.add.collider(this.warrior, this.barriers, this.handleBarrierCollision, null, this);

    // Create barrier instances at different positions with different health
    // First row
    this.createBarrier(200, 200, 'weak', 5);
    this.createBarrier(400, 200, 'medium', 15);
    this.createBarrier(600, 200, 'strong', 30);

    // Second row
    this.createBarrier(150, 350, 'strong', 25);
    this.createBarrier(300, 350, 'weak', 8);
    this.createBarrier(450, 350, 'medium', 20);
    this.createBarrier(650, 350, 'strong', 35);

    // Create line for movement visualization
    this.movementLine = this.add.graphics();

    // Create cursor keys for controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add click/tap handler for warrior movement with cooldown
    this.input.on('pointerdown', (pointer) => {
      if (this.canClick) {
        // Set target position for warrior to move to
        this.targetPosition = { x: pointer.x, y: pointer.y };
        this.isMovingToTarget = true;

        // Calculate distance for damage calculation
        const distance = Phaser.Math.Distance.Between(
          this.warrior.x, this.warrior.y,
          pointer.x, pointer.y
        );

        // Draw movement line
        this.drawMovementLine(this.warrior.x, this.warrior.y, pointer.x, pointer.y, distance);

        // Store distance for barrier collision calculations
        this.warrior.moveDistance = distance;
        this.warrior.moveDirection = new Phaser.Math.Vector2(
          pointer.x - this.warrior.x,
          pointer.y - this.warrior.y
        ).normalize();

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

        // Emit click event to other players via Socket.io
        if (this.socket && this.socket.connected) {
          const clickData = {
            x: pointer.x,
            y: pointer.y,
            playerId: this.playerId,
            timestamp: Date.now(),
            color: 0xff8800 // Orange color for other players' clicks
          };
          this.socket.emit('playerClick', clickData);
        }

        // Start cooldown
        this.startCooldown();
      }
    });

    // Add instruction text
    this.add.text(16, 16, 'Click/tap anywhere to move the warrior (1.4s cooldown)', {
      font: '18px Arial',
      fill: '#ffffff'
    });

    // Add barrier instruction text
    this.add.text(16, 40, 'Hit barriers to destroy them! Damage depends on movement distance.', {
      font: '14px Arial',
      fill: '#ffffff'
    });

    // Add socket status text
    this.statusText = this.add.text(16, 90, 'Socket status: Connecting...', {
      font: '14px Arial',
      fill: '#ffffff'
    });

    // Update socket status periodically
    this.time.addEvent({
      delay: 2000,
      callback: () => this.updateSocketStatus(),
      callbackScope: this,
      loop: true
    });

    // Add cooldown text
    this.cooldownText = this.add.text(16, 120, '', {
      font: '24px Arial',
      fill: '#ff8800',
      fontStyle: 'bold'
    });
  }

  createBarrier(x, y, type, health) {
    const barrier = new Barrier(this, x, y, type, health);
    this.barriers.add(barrier);
    // Make sure the barrier is properly added to the physics world
    this.physics.add.existing(barrier, true);
    return barrier;
  }

  drawMovementLine(startX, startY, endX, endY, distance) {
    // Clear previous line
    this.movementLine.clear();

    // Define color based on distance (green for short, yellow for medium, red for long)
    let color;
    if (distance < 200) {
      color = 0x00ff00; // Green for short distance
    } else if (distance < 400) {
      color = 0xffff00; // Yellow for medium distance
    } else {
      color = 0xff0000; // Red for long distance
    }

    // Draw dashed line
    this.movementLine.lineStyle(2, color, 0.8);
    this.movementLine.beginPath();
    this.movementLine.moveTo(startX, startY);
    this.movementLine.lineTo(endX, endY);
    this.movementLine.closePath();
    this.movementLine.strokePath();

    // Add distance text
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Remove previous distance text if it exists
    if (this.distanceText) {
      this.distanceText.destroy();
    }

    // Create new distance text
    this.distanceText = this.add.text(midX, midY - 15, `${Math.round(distance)}px`, {
      font: '14px Arial',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5, 0.5);

    // Fade out line and text
    this.tweens.add({
      targets: [this.distanceText],
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        if (this.distanceText) this.distanceText.destroy();
        this.distanceText = null;
      }
    });

    // Fade out the line
    this.time.delayedCall(2000, () => {
      this.movementLine.clear();
    });
  }

  handleBarrierCollision(warrior, barrier) {
    if (!warrior.moveDistance) return;

    // Calculate damage based on move distance
    let damage;
    if (warrior.moveDistance < 200) {
      // Short distance = small damage
      damage = 2;
    } else if (warrior.moveDistance < 400) {
      // Medium distance = medium damage
      damage = 8;
    } else {
      // Long distance = large damage
      damage = 15;
    }

    // Calculate hit velocity for damage calculation
    const hitVelocity = {
      x: warrior.moveDirection.x * warrior.moveDistance * 0.1,
      y: warrior.moveDirection.y * warrior.moveDistance * 0.1
    };

    // Apply damage to barrier and get whether it was destroyed
    const wasDestroyed = barrier.takeDamage(damage, hitVelocity);

    // Calculate bounce strength based on barrier's remaining health
    const bounceStrength = barrier.getStrength();

    // Only bounce if the barrier wasn't destroyed
    if (!wasDestroyed) {
      // Bounce the warrior back proportional to barrier strength
      const bounceForce = 300 + (bounceStrength * 30);
      warrior.setVelocity(
        -warrior.moveDirection.x * bounceForce,
        -warrior.moveDirection.y * bounceForce * 0.5
      );

      // Add a short stun effect that stops movement
      warrior.stunned = true;
      this.isMovingToTarget = false;

      // Remove stun after a short delay
      this.time.delayedCall(300, () => {
        warrior.stunned = false;
      });
    }

    // Show damage text
    this.showDamageText(barrier.x, barrier.y - 20, damage);

    // Reset warrior move distance
    warrior.moveDistance = 0;

    // Create impact effect
    this.createImpactEffect(warrior.x, warrior.y, bounceStrength);

    // Shake camera based on impact strength
    const shakeIntensity = Math.min(0.01 * bounceStrength, 0.05);
    this.cameras.main.shake(300, shakeIntensity);
  }

  createImpactEffect(x, y, strength) {
    // Create an impact particle effect
    const particles = this.add.particles(0, 0, 'red', {
      x: x,
      y: y,
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      quantity: Math.min(5 + strength, 15)
    });

    // Stop emitting after a short burst
    this.time.delayedCall(100, () => {
      particles.destroy();
    });
  }

  showDamageText(x, y, amount) {
    // Create damage text that floats up
    const damageText = this.add.text(x, y, `-${amount}`, {
      font: 'bold 16px Arial',
      fill: '#ff0000'
    }).setOrigin(0.5, 0.5);

    // Animate the text upward and fade out
    this.tweens.add({
      targets: damageText,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => damageText.destroy()
    });
  }

  updateSocketStatus() {
    if (this.socket) {
      if (this.socket.connected) {
        this.statusText.setText(`Socket status: Connected (ID: ${this.socket.id})`);
        this.statusText.setColor('#00ff00');
      } else {
        this.statusText.setText('Socket status: Disconnected');
        this.statusText.setColor('#ff0000');
      }
    }
  }

  showOtherPlayerClick(clickData) {
    // Create a visual representation of another player's click
    const otherClick = this.add.circle(clickData.x, clickData.y, 15, clickData.color || 0xff0000, 0.6)
      .setDepth(4)
      .setAlpha(0.8);

    // Add a player ID text near the click
    const otherPlayerText = this.add.text(
      clickData.x,
      clickData.y - 20,
      `Player: ${clickData.playerId.substring(0, 5)}...`,
      {
        font: '12px Arial',
        fill: '#ffffff',
        backgroundColor: '#000000'
      }
    ).setOrigin(0.5, 0.5).setDepth(4).setAlpha(0.8);

    // Store references to clean up later
    const clickId = clickData.playerId + '_' + clickData.timestamp;
    this.otherClicks[clickId] = {
      circle: otherClick,
      text: otherPlayerText
    };

    // Fade out and remove after 2 seconds
    this.tweens.add({
      targets: [otherClick, otherPlayerText],
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        otherClick.destroy();
        otherPlayerText.destroy();
        delete this.otherClicks[clickId];
      }
    });
  }

  sendCoordinatesToBackend(x, y) {
    // Create data object with coordinates
    const data = {
      x: Math.round(x),
      y: Math.round(y),
      timestamp: Date.now(),
      playerId: this.playerId
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
    if (this.isMovingToTarget && this.targetPosition && !this.warrior.stunned) {
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

    // Handle keyboard movement with WASD (only if not stunned)
    if (!this.warrior.stunned) {
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

    // Update all barrier health bars
    this.barriers.getChildren().forEach(barrier => {
      if (barrier.updateHealthBar) {
        barrier.updateHealthBar();
      }
    });
  }
}
