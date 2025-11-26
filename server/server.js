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
  ```
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
// Map<sessionName, { gameState, viewerRequests, approvedViewers, sessionId, totalRounds, currentRound }>
const activeSessions = new Map(); 

// 3. REAL-TIME SOCKET
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // --- OPERATOR EVENTS ---
  
  // Create/Join Session (Operator)
  socket.on('join_session', async ({ sessionName, role }) => {
    socket.join(sessionName); // Join room

    if (role === 'OPERATOR') {
      const session = activeSessions.get(sessionName);
      if (session) {
        socket.emit('game_update', session.gameState);
        // Send pending requests
        session.viewerRequests.forEach(req => {
          socket.emit('viewer_requested', req);
        });
      }
    } else if (role === 'VIEWER') {
       // Viewer logic handled in request_access/resolve_access
    }
  });

  // Operator sends latest state
  socket.on('sync_state', ({ sessionName, state }) => {
    const session = activeSessions.get(sessionName);
    if (session) {
      session.gameState = state;
      // Broadcast to all APPROVED viewers in this session
      const viewerIds = Array.from(session.approvedViewers);
      viewerIds.forEach(vid => {
        io.to(vid).emit('game_update', session.gameState);
      });
    }
  });

  // Operator approves a viewer
  socket.on('resolve_access', ({ sessionName, viewerId, approved }) => {
    const session = activeSessions.get(sessionName);
    if (!session) return;

    if (approved) {
      session.approvedViewers.add(viewerId);
      io.to(viewerId).emit('access_granted', session.gameState);
      // Join the socket room for updates
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (viewerSocket) viewerSocket.join(sessionName);
    } else {
      io.to(viewerId).emit('access_denied');
    }
    session.viewerRequests.delete(viewerId);
  });

  // End Session
  socket.on('end_session', async ({ sessionName }) => {
    const session = activeSessions.get(sessionName);
    if (session) {
       // Update DB to inactive
       await prisma.gameSession.update({
         where: { id: session.sessionId },
         data: { isActive: false }
       });
       activeSessions.delete(sessionName);
       io.to(sessionName).emit('session_ended');
    }
  });

  // --- VIEWER EVENTS ---

  // Viewer requests access
  socket.on('request_access', ({ sessionName, name }) => {
    const session = activeSessions.get(sessionName);
    if (!session) {
      socket.emit('error_message', "Session not found or inactive.");
      return;
    }

    session.viewerRequests.set(socket.id, { name, socketId: socket.id });
    // Notify operators in this session room (or just broadcast to room if operators join it)
    // Since operators join the room 'sessionName', we can emit to it, but we need to target OPERATORS only.
    // For simplicity, we'll emit to the room, client filters.
    io.to(sessionName).emit('viewer_requested', { name, socketId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Cleanup from all sessions
    activeSessions.forEach(session => {
      if (session.viewerRequests.has(socket.id)) session.viewerRequests.delete(socket.id);
      if (session.approvedViewers.has(socket.id)) session.approvedViewers.delete(socket.id);
    });
  });
});

// 4. SESSION API
app.post('/api/sessions', async (req, res) => {
  const { name, totalRounds } = req.body;
  
  try {
    // Check if exists in DB
    let session = await prisma.gameSession.findUnique({ where: { name } });
    
    if (session) {
      if (!session.isActive) {
        // Reactivate or error? Let's error for now or create new with different name
        return res.status(400).json({ error: "Session name already used." });
      }
      // If active, return existing (rejoin)
    } else {
      session = await prisma.gameSession.create({
        data: { name, totalRounds, isActive: true }
      });
    }

    // Initialize in-memory state if not present
    if (!activeSessions.has(name)) {
      activeSessions.set(name, {
        sessionId: session.id,
        totalRounds: session.totalRounds,
        currentRound: session.currentRound,
        gameState: null,
        viewerRequests: new Map(),
        approvedViewers: new Set()
      });
    }

    res.json({ success: true, session });
  } catch (e) {
    console.error(e);
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
// Map<sessionName, { gameState, viewerRequests, approvedViewers, sessionId, totalRounds, currentRound }>
const activeSessions = new Map(); 

// 3. REAL-TIME SOCKET
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // --- OPERATOR EVENTS ---
  
  // Create/Join Session (Operator)
  socket.on('join_session', async ({ sessionName, role }) => {
    socket.join(sessionName); // Join room

    if (role === 'OPERATOR') {
      const session = activeSessions.get(sessionName);
      if (session) {
        socket.emit('game_update', session.gameState);
        // Send pending requests
        session.viewerRequests.forEach(req => {
          socket.emit('viewer_requested', req);
        });
      }
    } else if (role === 'VIEWER') {
       // Viewer logic handled in request_access/resolve_access
    }
  });

  // Operator sends latest state
  socket.on('sync_state', ({ sessionName, state }) => {
    const session = activeSessions.get(sessionName);
    if (session) {
      session.gameState = state;
      // Broadcast to all APPROVED viewers in this session
      const viewerIds = Array.from(session.approvedViewers);
      viewerIds.forEach(vid => {
        io.to(vid).emit('game_update', session.gameState);
      });
    }
  });

  // Operator approves a viewer
  socket.on('resolve_access', ({ sessionName, viewerId, approved }) => {
    const session = activeSessions.get(sessionName);
    if (!session) return;

    if (approved) {
      session.approvedViewers.add(viewerId);
      io.to(viewerId).emit('access_granted', session.gameState);
      // Join the socket room for updates
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (viewerSocket) viewerSocket.join(sessionName);
    } else {
      io.to(viewerId).emit('access_denied');
    }
    session.viewerRequests.delete(viewerId);
  });

  // End Session
  socket.on('end_session', async ({ sessionName }) => {
    const session = activeSessions.get(sessionName);
    if (session) {
       // Update DB to inactive
       await prisma.gameSession.update({
         where: { id: session.sessionId },
         data: { isActive: false }
       });
       activeSessions.delete(sessionName);
       io.to(sessionName).emit('session_ended');
    }
  });

  // --- VIEWER EVENTS ---

  // Viewer requests access
  socket.on('request_access', ({ sessionName, name }) => {
    const session = activeSessions.get(sessionName);
    if (!session) {
      socket.emit('error_message', "Session not found or inactive.");
      return;
    }

    session.viewerRequests.set(socket.id, { name, socketId: socket.id });
    // Notify operators in this session room (or just broadcast to room if operators join it)
    // Since operators join the room 'sessionName', we can emit to it, but we need to target OPERATORS only.
    // For simplicity, we'll emit to the room, client filters.
    io.to(sessionName).emit('viewer_requested', { name, socketId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Cleanup from all sessions
    activeSessions.forEach(session => {
      if (session.viewerRequests.has(socket.id)) session.viewerRequests.delete(socket.id);
      if (session.approvedViewers.has(socket.id)) session.approvedViewers.delete(socket.id);
    });
  });
});

// 4. SESSION API
app.post('/api/sessions', async (req, res) => {
  const { name, totalRounds } = req.body;
  
  try {
    // Check if exists in DB
    let session = await prisma.gameSession.findUnique({ where: { name } });
    
    if (session) {
      if (!session.isActive) {
        // Reactivate or error? Let's error for now or create new with different name
        return res.status(400).json({ error: "Session name already used." });
      }
      // If active, return existing (rejoin)
    } else {
      session = await prisma.gameSession.create({
        data: { name, totalRounds, isActive: true }
      });
    }

    // Initialize in-memory state if not present
    if (!activeSessions.has(name)) {
      activeSessions.set(name, {
        sessionId: session.id,
        totalRounds: session.totalRounds,
        currentRound: session.currentRound,
        gameState: null,
        viewerRequests: new Map(),
        approvedViewers: new Set()
      });
    }

    res.json({ success: true, session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create session" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${ PORT } `));
