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

// Simple API route
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Endpoint to receive coordinates
app.post('/api/coordinates', (req, res) => {
  const coordinates = req.body;

  // Log the coordinates in the server console
  console.log('Received coordinates:', coordinates);

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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Example game events (to be implemented later)
  socket.on('playerMove', (data) => {
    // Broadcast to other players
    socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
