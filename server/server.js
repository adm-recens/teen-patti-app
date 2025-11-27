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
  const { winner, pot, logs, netChanges, sessionName } = req.body;

  try {
    const session = await prisma.gameSession.findUnique({ where: { name: sessionName } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Save Hand History
    await prisma.gameHand.create({
      data: {
        winner: winner.name,
        potSize: pot,
        logs: logs,
        sessionId: session.id
      }
    });

    // Update Player Balances and Link to Session
    for (const [playerId, change] of Object.entries(netChanges)) {
      const pid = parseInt(playerId);
      await prisma.player.upsert({
        where: { id: pid },
        update: {
          sessionBalance: { increment: change },
          sessionId: session.id
        },
        create: {
          id: pid,
          name: "Unknown",
          sessionBalance: change,
          sessionId: session.id
        }
      });
    }

    // Update Session Round
    const updatedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: { currentRound: { increment: 1 } }
    });

    // Check if session should end
    if (updatedSession.currentRound > updatedSession.totalRounds) {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      io.to(sessionName).emit('session_ended', { reason: 'MAX_ROUNDS_REACHED' });
    }

    // Broadcast update
    io.to(sessionName).emit('game_update', { type: 'HAND_COMPLETE', winner, pot, currentRound: updatedSession.currentRound });
    res.json({ success: true, currentRound: updatedSession.currentRound });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save hand" });
  }
});

// 3. ADMIN API
app.get('/api/admin/sessions', async (req, res) => {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { hands: true } } }
  });
  res.json(sessions);
});

app.get('/api/admin/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true }
  });
  res.json(users);
});

// 4. SESSION API
app.post('/api/sessions', async (req, res) => {
  const { name, totalRounds } = req.body;

  try {
    let session = await prisma.gameSession.findUnique({ where: { name } });

    if (session) {
      if (!session.isActive) {
        return res.status(400).json({ error: "Session name already used and finished." });
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

// 5. REAL-TIME SOCKET
// --- IN-MEMORY STATE ---
// Map<sessionName, { gameState, viewerRequests, approvedViewers, sessionId, totalRounds, currentRound }>
const activeSessions = new Map();

// --- SOCKET MIDDLEWARE ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    jwt.verify(token, SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  } else {
    // Allow guests as VIEWERS
    socket.user = { role: 'VIEWER' };
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (Role: ${socket.user.role})`);

  // --- OPERATOR EVENTS ---

  // Create/Join Session (Operator)
  socket.on('join_session', async ({ sessionName, role }) => {
    // Security Check
    if (role === 'OPERATOR' && socket.user.role !== 'OPERATOR') {
      socket.emit('error_message', "Unauthorized: You are not an Operator.");
      return;
    }

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
    }
  });

  // Operator sends latest state
  socket.on('sync_state', ({ sessionName, state }) => {
    if (socket.user.role !== 'OPERATOR') return; // BLOCK UNAUTHORIZED

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
    if (socket.user.role !== 'OPERATOR') return; // BLOCK UNAUTHORIZED

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
    if (socket.user.role !== 'OPERATOR') return; // BLOCK UNAUTHORIZED

    const session = activeSessions.get(sessionName);
    if (session) {
      // Update DB to inactive
      await prisma.gameSession.update({
        where: { id: session.sessionId },
        data: { isActive: false }
      });
      activeSessions.delete(sessionName);
      io.to(sessionName).emit('session_ended', { reason: 'OPERATOR_ENDED' });
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
    // Notify operators in this session room
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} `));
