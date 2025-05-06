import Phaser from 'phaser';

export class Barrier extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type, health) {
    // Choose sprite based on barrier type
    let texture;

    switch (type) {
      case 'weak':
        texture = 'barrier-weak';
        break;
      case 'medium':
        texture = 'barrier-medium';
        break;
      case 'strong':
        texture = 'barrier-strong';
        break;
      default:
        texture = 'barrier-weak';
    }

    super(scene, x, y, texture);

    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true = static body (completely immovable)

    // Set up physics properties
    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setImmovable(true);

    // Set barrier properties
    this.type = type;
    this.maxHealth = health;
    this.health = health;

    // Adjust size based on type for better collision
    if (type === 'weak') {
      this.setScale(0.8);
    } else if (type === 'medium') {
      this.setScale(1);
    } else {
      this.setScale(1.2);
    }

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.updateHealthBar();

    // Text for displaying health
    this.healthText = scene.add.text(x, y - 40, `${this.health}/${this.maxHealth}`, {
      font: '14px Arial',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5, 0.5);

    // Add scale animation on create
    scene.tweens.add({
      targets: this,
      scale: { from: 0, to: this.scale },
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  updateHealthBar() {
    this.healthBar.clear();

    // Draw background
    this.healthBar.fillStyle(0x000000, 0.7);
    this.healthBar.fillRect(this.x - 25, this.y - 30, 50, 8);

    // Calculate fill percentage
    const width = (this.health / this.maxHealth) * 46;

    // Choose color based on health percentage
    let color;
    const healthPercentage = this.health / this.maxHealth;

    if (healthPercentage > 0.6) {
      color = 0x00ff00; // Green
    } else if (healthPercentage > 0.3) {
      color = 0xffff00; // Yellow
    } else {
      color = 0xff0000; // Red
    }

    // Draw health bar
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(this.x - 23, this.y - 28, width, 4);

    // Update health text
    if (this.healthText) {
      this.healthText.setText(`${this.health}/${this.maxHealth}`);
      this.healthText.setPosition(this.x, this.y - 40);
    }
  }

  takeDamage(amount, hitVelocity) {
    this.health = Math.max(0, this.health - amount);

    // Flash red on hit
    this.scene.tweens.add({
      targets: this,
      tint: 0xff0000,
      duration: 100,
      yoyo: true
    });

    // Pulse effect on hit (instead of movement)
    this.scene.tweens.add({
      targets: this,
      scale: { value: this.scale * 1.2 },
      duration: 50,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });

    // Update health display
    this.updateHealthBar();

    // Shake effect based on damage amount
    const shakeIntensity = Math.min(0.05, amount / 100);
    this.scene.cameras.main.shake(200, shakeIntensity);

    // Destroy barrier if health is depleted
    if (this.health <= 0) {
      this.destroy();
    }

    return this.health <= 0; // Return true if barrier was destroyed
  }

  getStrength() {
    // Return a strength value based on health percentage
    const healthPercentage = this.health / this.maxHealth;
    return healthPercentage * 10; // 0-10 scale
  }

  destroy() {
    // Explosion effect on destroy
    const particles = this.scene.add.particles(0, 0, 'red', {
      x: this.x,
      y: this.y,
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      lifespan: 800,
      blendMode: 'ADD',
      quantity: 20
    });

    // Stop emitting after a short burst
    this.scene.time.delayedCall(200, () => {
      particles.destroy();
    });

    // Clean up resources
    if (this.healthBar) this.healthBar.destroy();
    if (this.healthText) this.healthText.destroy();

    super.destroy();
  }
}
