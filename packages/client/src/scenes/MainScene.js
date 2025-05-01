import Phaser from 'phaser';
import { API_URL } from '../main';
import axios from 'axios';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.socket = null;
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

    // Add particles
    const particles = this.add.particles(0, 0, 'red', {
      speed: 100,
      scale: { start: 1, end: 0 },
      blendMode: 'ADD'
    });

    // Add logo
    const logo = this.physics.add.image(400, 100, 'logo');
    logo.setVelocity(100, 200);
    logo.setBounce(1, 1);
    logo.setCollideWorldBounds(true);

    // Make particles follow the logo
    particles.startFollow(logo);

    // Add click handler (example of interactivity)
    this.input.on('pointerdown', (pointer) => {
      // Move logo to click position with physics
      this.physics.moveTo(logo, pointer.x, pointer.y, 200);

      // Example of what we'd do with sockets when enabled
      /*
      if (this.socket) {
        this.socket.emit('playerMove', {
          x: pointer.x,
          y: pointer.y
        });
      }
      */
    });

    // Add instruction text
    this.add.text(16, 16, 'Click anywhere to move the logo', {
      font: '18px Arial',
      fill: '#ffffff'
    });
  }

  update() {
    // Game loop logic goes here
  }
}
