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

// 1. LOGIN API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Quick hack: Auto-create admin if not exists (for first run)
  if (username === 'admin') {
     const exists = await prisma.user.findUnique({ where: { username: 'admin' }});
     if (!exists) {
       const hashed = bcrypt.hashSync('admin123', 10);
       await prisma.user.create({ data: { username: 'admin', password: hashed, role: 'OPERATOR' }});
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
io.on('connection', (socket) => {
  console.log('User connected');
  socket.on('game_action', (data) => {
    // Re-broadcast operator moves to viewers
    socket.broadcast.emit('game_update', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
