import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { BootScene } from './scenes/BootScene';

// Enable physics debugging with URL parameter
const urlParams = new URLSearchParams(window.location.search);
const debugPhysics = urlParams.has('debug');

// Game configuration
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      debug: debugPhysics
    }
  },
  scene: [BootScene, MainScene]
};

// Initialize the game
const game = new Phaser.Game(config);

// Optional: Setup for API and Socket connections
const API_URL = 'http://localhost:3002';

// Export for use in other files
export { game, API_URL };
