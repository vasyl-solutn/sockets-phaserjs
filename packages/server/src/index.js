const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Track connected players
const connectedPlayers = new Map();

// Simple API route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    connectedPlayers: connectedPlayers.size
  });
});

// Endpoint to receive coordinates
app.post('/api/coordinates', (req, res) => {
  const coordinates = req.body;

  // Log the coordinates in the server console
  console.log('Received coordinates via API:', coordinates);

  // Store coordinates in memory (could be a database in a real app)
  if (!app.locals.coordinates) {
    app.locals.coordinates = [];
  }
  app.locals.coordinates.push(coordinates);

  // Return a confirmation
  res.json({
    success: true,
    message: 'Coordinates received',
    data: coordinates
  });
});

// Endpoint to get all stored coordinates (for debugging)
app.get('/api/coordinates', (req, res) => {
  res.json(app.locals.coordinates || []);
});

// Endpoint to get active players
app.get('/api/players', (req, res) => {
  const players = Array.from(connectedPlayers.entries()).map(([id, data]) => ({
    id,
    lastActive: data.lastActive,
    clickCount: data.clickCount
  }));

  res.json({
    count: connectedPlayers.size,
    players
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Add player to connected players
  connectedPlayers.set(socket.id, {
    lastActive: Date.now(),
    clickCount: 0
  });

  // Broadcast updated player count
  io.emit('playerCount', { count: connectedPlayers.size });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove player from connected players
    connectedPlayers.delete(socket.id);

    // Broadcast updated player count
    io.emit('playerCount', { count: connectedPlayers.size });
  });

  // Handle click events from players
  socket.on('playerClick', (clickData) => {
    console.log('Received click via socket from', socket.id, ':', clickData);

    // Update player stats
    if (connectedPlayers.has(socket.id)) {
      const playerData = connectedPlayers.get(socket.id);
      playerData.lastActive = Date.now();
      playerData.clickCount++;
      connectedPlayers.set(socket.id, playerData);
    }

    // Store click data
    if (!app.locals.coordinates) {
      app.locals.coordinates = [];
    }
    app.locals.coordinates.push(clickData);

    // Broadcast click to all other clients
    socket.broadcast.emit('otherClick', clickData);
  });
});

// Start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
