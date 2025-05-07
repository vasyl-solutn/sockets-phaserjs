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
    this.cooldownBar = null;
    this.cooldownTime = 1400; // 1400 milliseconds
    this.remainingCooldown = 0;
    this.otherClicks = {}; // Store other players' click markers
    this.playerId = 'player_' + Math.floor(Math.random() * 10000); // Generate random player ID
    this.barriers = null;
    this.movementLine = null;
    this.startTime = 0;
    this.timerText = null;
    this.bestTime = Infinity;
    this.bestTimeText = null;
    this.speedBar = null;
    this.isCompletionScreenActive = false;
  }

  init() {
    // Reset movement-related variables
    this.targetPosition = null;
    this.isMovingToTarget = false;
    this.canClick = true;
    this.remainingCooldown = 0;
    this.warrior = null;
    this.barriers = null;
    this.movementLine = null;

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
    // Ensure we're starting with clean input handlers
    this.input.off('pointerdown');

    // Start the timer
    this.startTime = Date.now();

    // Add timer text
    this.timerText = this.add.text(16, 150, 'Time: 0.0s', {
      font: '18px Arial',
      fill: '#ffffff'
    });

    // Add best time text with initial value
    const savedTime = localStorage.getItem('bestTime');
    this.bestTime = savedTime ? parseFloat(savedTime) : Infinity;

    // Create the best time text and store a reference
    this.bestTimeText = this.add.text(16, 180, `Best Time: ${this.bestTime === Infinity ? '--' : this.bestTime.toFixed(1)}s`, {
      font: '18px Arial',
      fill: '#ffff00'
    }).setName('bestTimeText');

    // Create speed bar background
    const speedBarBg = this.add.rectangle(16, 210, 150, 20, 0x000000, 0.8);
    speedBarBg.setOrigin(0, 0.5);

    // Create speed bar
    this.speedBar = this.add.graphics();
    this.updateSpeedBar();

    // Add speed bar label
    this.add.text(16, 195, 'SPEED', {
      font: 'bold 14px Arial',
      fill: '#ffffff'
    });

    // Create cooldown bar background
    const cooldownBarBg = this.add.rectangle(16, 250, 150, 20, 0x000000, 0.8);
    cooldownBarBg.setOrigin(0, 0.5);

    // Create cooldown bar
    this.cooldownBar = this.add.graphics();
    console.log('Cooldown bar created');
    this.updateCooldownBar();

    // Add cooldown bar label
    this.add.text(16, 235, 'COOLDOWN', {
      font: 'bold 14px Arial',
      fill: '#ffffff'
    });

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
    this.warrior.stunned = false; // Reset stun state

    // Reduce drag to allow longer sliding after bounce
    this.warrior.setDrag(20, 20); // Reduced from default values
    this.warrior.setDamping(true);

    // Make particles follow the warrior
    this.particles.startFollow(this.warrior);

    // Add invisible ground platform for warrior to stand on
    const ground = this.physics.add.staticGroup();
    ground.create(400, 568, 'red').setScale(80, 1).refreshBody().setVisible(false);

    // Set up collision between warrior and ground
    this.physics.add.collider(this.warrior, ground);

    // Set up collision between warrior and barriers
    this.physics.add.collider(this.warrior, this.barriers, this.handleBarrierCollision, null, this);

    // Create more barriers with varied positions and health
    // First row (top)
    this.createBarrier(150, 150, 'weak', 5);
    this.createBarrier(300, 120, 'medium', 10);
    this.createBarrier(450, 150, 'weak', 7);
    this.createBarrier(600, 130, 'strong', 15);

    // Second row (upper middle)
    this.createBarrier(120, 250, 'medium', 12);
    this.createBarrier(270, 230, 'weak', 6);
    this.createBarrier(420, 240, 'strong', 14);
    this.createBarrier(570, 220, 'weak', 8);

    // Third row (lower middle)
    this.createBarrier(180, 350, 'strong', 16);
    this.createBarrier(330, 370, 'medium', 11);
    this.createBarrier(480, 360, 'weak', 5);
    this.createBarrier(630, 380, 'medium', 13);

    // Fourth row (bottom)
    this.createBarrier(210, 450, 'weak', 7);
    this.createBarrier(360, 470, 'strong', 15);
    this.createBarrier(510, 460, 'medium', 10);
    this.createBarrier(660, 480, 'weak', 6);

    // Create line for movement visualization
    this.movementLine = this.add.graphics();

    // Create cursor keys for controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add click/tap handler for warrior movement with cooldown
    this.input.on('pointerdown', (pointer) => {
      // Skip if we're in the completion screen (check a flag)
      if (this.isCompletionScreenActive) {
        return;
      }

      if (this.canClick) {
        console.log('Moving warrior to:', pointer.x, pointer.y);
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

    // Comment out socket status text and update
    /*
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
    */

    // Remove reset button from main screen - it will only appear on completion screen
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

    // Calculate damage based on the original click distance
    let damage;
    if (warrior.moveDistance < 200) {
      // Short distance = small damage
      damage = 3;
    } else if (warrior.moveDistance < 400) {
      // Medium distance = medium damage
      damage = 10;
    } else {
      // Long distance = large damage
      damage = 20;
    }

    // Add a small random variation to damage
    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));

    // Calculate hit velocity for visual effect
    const hitVelocity = {
      x: warrior.moveDirection.x * warrior.moveDistance * 0.1,
      y: warrior.moveDirection.y * warrior.moveDistance * 0.1
    };

    // Apply damage to barrier and get whether it was destroyed
    const wasDestroyed = barrier.takeDamage(damage, hitVelocity);

    // Calculate bounce strength based on barrier's remaining health
    const bounceStrength = barrier.getStrength();

    // Show damage text
    this.showDamageText(barrier.x, barrier.y - 20, damage);

    // Create impact effect
    this.createImpactEffect(warrior.x, warrior.y, bounceStrength);

    // Shake camera based on impact strength and click distance
    const shakeIntensity = Math.min(0.01 * bounceStrength + (warrior.moveDistance / 2000), 0.05);
    this.cameras.main.shake(300, shakeIntensity);

    if (wasDestroyed) {
      // If barrier was destroyed, continue movement with reduced power
      const powerReduction = barrier.health / 100; // Reduce power based on barrier's health
      warrior.moveDistance *= (1 - powerReduction); // Reduce the remaining distance

      // Continue movement with reduced power
      this.physics.moveTo(
        warrior,
        warrior.x + warrior.moveDirection.x * warrior.moveDistance,
        warrior.y + warrior.moveDirection.y * warrior.moveDistance,
        100
      );

      // Check if all barriers are destroyed
      this.checkAllBarriersDestroyed();
    } else {
      // For barriers that don't get destroyed:
      // 1. Lower bounce speed with greater distance
      // 2. Make bounce distance longer by increasing stun time and reducing force

      // Calculate a gentler bounce force for slower but longer distance bounce
      const bounceForce = (40 + (bounceStrength * 5) + (warrior.moveDistance * 0.075)); // Reduced by half

      // Apply the bounce velocity
      warrior.setVelocity(
        -warrior.moveDirection.x * bounceForce,
        -warrior.moveDirection.y * bounceForce * 0.5
      );

      // Add a longer stun effect to allow more bounce distance
      warrior.stunned = true;
      this.isMovingToTarget = false;

      // Longer stun time means the warrior will slide further before player can control again
      this.time.delayedCall(800, () => {
        warrior.stunned = false;
      });

      // Reset warrior move distance
      warrior.moveDistance = 0;
    }
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

    // Update cooldown bar
    this.updateCooldownBar();

    // Create a timer that updates every 50ms for smoother animation
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
    }
    this.cooldownTimer = this.time.addEvent({
      delay: 50,
      callback: this.updateCooldown,
      callbackScope: this,
      loop: true
    });
  }

  updateCooldown() {
    this.remainingCooldown -= 50;
    console.log('Cooldown remaining:', this.remainingCooldown);
    this.updateCooldownBar();

    if (this.remainingCooldown <= 0) {
      // Enable clicking again
      this.canClick = true;

      // Stop the timer
      if (this.cooldownTimer) {
        this.cooldownTimer.remove();
        this.cooldownTimer = null;
      }
    }
  }

  updateCooldownBar() {
    if (!this.cooldownBar) {
      console.error('Cooldown bar not initialized!');
      return;
    }

    this.cooldownBar.clear();

    // Calculate fill percentage
    const fillPercentage = this.remainingCooldown / this.cooldownTime;
    const width = 150 * (1 - fillPercentage);

    // Choose color based on remaining cooldown
    let color;
    if (fillPercentage > 0.6) {
      color = 0xff3333; // Bright red
    } else if (fillPercentage > 0.3) {
      color = 0xffcc00; // Bright yellow
    } else {
      color = 0x33ff33; // Bright green
    }

    // Draw cooldown bar
    this.cooldownBar.fillStyle(color, 1);
    this.cooldownBar.fillRect(16, 250, width, 20);
  }

  updateSpeedBar() {
    this.speedBar.clear();

    // Calculate current speed
    let currentSpeed = 0;
    if (this.warrior && this.warrior.body) {
      currentSpeed = Math.sqrt(
        this.warrior.body.velocity.x * this.warrior.body.velocity.x +
        this.warrior.body.velocity.y * this.warrior.body.velocity.y
      );
    }

    // Calculate fill percentage (max speed is now 100 instead of 300)
    const fillPercentage = Math.min(currentSpeed / 100, 1);
    const width = 150 * fillPercentage;

    // Choose color based on speed
    let color;
    if (fillPercentage > 0.6) {
      color = 0xff3333; // Bright red for high speed
    } else if (fillPercentage > 0.3) {
      color = 0xffcc00; // Bright yellow for medium speed
    } else {
      color = 0x33ff33; // Bright green for low speed
    }

    // Draw speed bar
    this.speedBar.fillStyle(color, 1);
    this.speedBar.fillRect(16, 210, width, 20);
  }

  checkAllBarriersDestroyed() {
    const remainingBarriers = this.barriers.getChildren().filter(barrier => barrier.active);
    if (remainingBarriers.length === 0) {
      // Calculate final time
      const endTime = Date.now();
      const totalTime = (endTime - this.startTime) / 1000; // Convert to seconds

      // Update best time if current time is better
      if (totalTime < this.bestTime) {
        this.bestTime = totalTime;
        localStorage.setItem('bestTime', this.bestTime);

        // Update the main game UI best time display
        this.updateBestTimeDisplay(16, 180);
      }

      // Show completion screen
      this.showCompletionScreen(totalTime);
    }
  }

  showCompletionScreen(time) {
    // Set flag to disable main game input
    this.isCompletionScreenActive = true;

    // Create semi-transparent background
    const bg = this.add.rectangle(400, 300, 400, 300, 0x000000, 0.8);
    bg.setOrigin(0.5);

    // Add completion text
    this.add.text(400, 200, 'Level Complete!', {
      font: '32px Arial',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Show time
    this.add.text(400, 250, `Time: ${time.toFixed(1)}s`, {
      font: '24px Arial',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Update and position the best time text for the completion screen
    this.updateBestTimeDisplay(400, 290, 24, true);

    // Add reset record button
    const resetRecordButton = this.add.text(400, 400, 'Reset Best Time', {
      font: '20px Arial',
      fill: '#ff3333',
      backgroundColor: '#333333',
      padding: { x: 10, y: 4 }
    }).setOrigin(0.5);

    // Create a separate input zone to capture clicks
    const buttonZone = this.add.zone(400, 400, 200, 40).setInteractive();
    buttonZone.on('pointerdown', () => {
      // Reset the best time
      this.bestTime = Infinity;
      localStorage.removeItem('bestTime');

      // Update the best time text
      this.updateBestTimeDisplay(400, 290, 24, true);
    });

    // Add restart button
    const restartButton = this.add.text(400, 350, 'Click to Restart', {
      font: '24px Arial',
      fill: '#00ff00'
    }).setOrigin(0.5);

    // Make button interactive
    restartButton.setInteractive();
    restartButton.on('pointerdown', () => {
      // Clean up any existing timers
      if (this.cooldownTimer) {
        this.cooldownTimer.remove();
        this.cooldownTimer = null;
      }
      // Reset completion screen flag
      this.isCompletionScreenActive = false;
      // Restart the scene
      this.scene.restart();
    });
  }

  update() {
    // Update timer
    if (this.timerText) {
      const currentTime = (Date.now() - this.startTime) / 1000;
      this.timerText.setText(`Time: ${currentTime.toFixed(1)}s`);
    }

    // Update speed bar
    this.updateSpeedBar();

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
        // Move warrior toward target position with reduced speed
        this.physics.moveTo(
          this.warrior,
          this.targetPosition.x,
          this.targetPosition.y,
          100  // Reduced from 160 to 100 for slower movement
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
        this.warrior.setVelocityX(-100); // Reduced from -160 to -100
        this.warrior.anims.play('left', true);
        this.isMovingToTarget = false; // Cancel click movement
      }
      else if (keyD.isDown) {
        this.warrior.setVelocityX(100); // Reduced from 160 to 100
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
        this.warrior.setVelocityY(-250); // Reduced from -330 to -250
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

  // Method to update the best time text display
  updateBestTimeDisplay(x, y, fontSize = 18, centered = false) {
    // Update the text content
    this.bestTimeText.setText(`Best Time: ${this.bestTime === Infinity ? '--' : this.bestTime.toFixed(1)}s`);

    // Update position and style
    this.bestTimeText.setPosition(x, y);
    this.bestTimeText.setStyle({
      font: `${fontSize}px Arial`,
      fill: '#ffff00'
    });

    // Set origin if centered
    if (centered) {
      this.bestTimeText.setOrigin(0.5);
    } else {
      this.bestTimeText.setOrigin(0, 0);
    }

    // Ensure it's visible
    this.bestTimeText.setAlpha(1);
    this.bestTimeText.setVisible(true);
    this.bestTimeText.setDepth(100);

    return this.bestTimeText;
  }
}
