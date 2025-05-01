# Phaser Game Monorepo

A full-stack game project built with Phaser, Express, and Socket.io.

## Project Structure

```
├── packages/
│   ├── client/           # Phaser frontend
│   │   ├── src/          # Game source code
│   │   └── public/       # Static assets
│   └── server/           # Express backend
│       └── src/          # Server source code
```

## Getting Started

### Prerequisites

- Node.js 14+
- Yarn

### Installation

```bash
# Install dependencies for all workspaces
yarn install
```

### Development

```bash
# Start both server and client
yarn dev

# Or start them individually
yarn workspace @phaser-game/server dev
yarn workspace @phaser-game/client start
```

### Production

```bash
# Build client for production
yarn build

# Start production server
yarn start
```

## Features

- Phaser 3 game engine
- Express backend
- Socket.io for real-time communication
- Yarn workspaces monorepo setup

## Adding Socket.io

The Socket.io integration is already set up in the server, but commented out in the client.
To enable it:

1. Uncomment the Socket.io code in `packages/client/src/scenes/MainScene.js`
2. Add the import at the top of the file: `import { io } from 'socket.io-client';`
3. Update the client package.json to include Socket.io: `yarn workspace @phaser-game/client add socket.io-client`

## GitHub Integration

To add this project to GitHub:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/yourusername/phaser-game.git

# Push to GitHub
git push -u origin main
```
