const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "secret";

// --- HEALTH CHECK / ROOT ROUTE ---
app.get('/', (req, res) => {
  res.send('Teen Patti Ledger Backend is running!');
});

// 1. LOGIN API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Quick hack: Auto-create admin if not exists (for first run)
  if (username === 'admin') {
    const exists = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!exists) {
      const hashed = bcrypt.hashSync('admin123', 10);
      await prisma.user.create({ data: { username: 'admin', password: hashed, role: 'OPERATOR' } });
    }
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid login' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
  res.json({ token, user: { username: user.username, role: user.role } });
});

// 2. SAVE GAME API
app.post('/api/games/hand', async (req, res) => {
  const { winner, pot, logs, netChanges } = req.body;

  // Save Hand History
  await prisma.gameHand.create({
    data: { winner: winner.name, potSize: pot, logs: logs }
  });

  // Update Player Balances
  for (const [playerId, change] of Object.entries(netChanges)) {
    const pid = parseInt(playerId);
    // Find player or create if new
    const player = await prisma.player.upsert({
      where: { id: pid },
      update: { sessionBalance: { increment: change } },
      create: { id: pid, name: "Unknown", sessionBalance: change }
    });
  }

  // Tell all viewers to update
  io.emit('game_update', { type: 'HAND_COMPLETE', winner, pot });
  res.json({ success: true });
});

// 3. REAL-TIME SOCKET
// --- IN-MEMORY STATE ---
let gameState = null;
const viewerRequests = new Map(); // socketId -> { name, socketId }
const approvedViewers = new Set(); // socketId

// 3. REAL-TIME SOCKET
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // --- OPERATOR EVENTS ---

  // Operator sends latest state to sync server & viewers
  socket.on('sync_state', (state) => {
    gameState = state;
    // Broadcast to all APPROVED viewers
    const viewerIds = Array.from(approvedViewers);
    viewerIds.forEach(vid => {
      io.to(vid).emit('game_update', gameState);
    });
  });

  // Operator approves a viewer
  socket.on('resolve_access', ({ viewerId, approved }) => {
    if (approved) {
      approvedViewers.add(viewerId);
      io.to(viewerId).emit('access_granted', gameState); // Send current state immediately
    } else {
      io.to(viewerId).emit('access_denied');
    }
    viewerRequests.delete(viewerId);
    // Notify operator that list updated (optional, or just let them manage local state)
  });

  // --- VIEWER EVENTS ---

  // Viewer requests access
  socket.on('request_access', ({ name }) => {
    viewerRequests.set(socket.id, { name, socketId: socket.id });
    // Notify all operators (broadcasting to everyone for now, client filters by role)
    io.emit('viewer_requested', { name, socketId: socket.id });
  });

  // Viewer/Operator reconnecting - send state if allowed
  socket.on('join_game', ({ role }) => {
    if (role === 'OPERATOR') {
      if (gameState) socket.emit('game_update', gameState);

      // Also send pending requests to operator
      viewerRequests.forEach(req => {
        socket.emit('viewer_requested', req);
      });
    } else if (role === 'VIEWER') {
      if (approvedViewers.has(socket.id) && gameState) {
        socket.emit('game_update', gameState);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    viewerRequests.delete(socket.id);
    approvedViewers.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
