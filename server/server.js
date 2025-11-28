const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
const CLIENT_URL = process.env.CLIENT_URL || "https://teen-patti-client.onrender.com";
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  "https://teen-patti-client.onrender.com",
  "https://teen-patti-app.onrender.com"
];

app.use(morgan('dev')); // Log requests to console
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.onrender.com')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

const SECRET = process.env.JWT_SECRET || "secret";

// --- HEALTH CHECK / ROOT ROUTE ---
app.get('/', (req, res) => {
  res.send('Teen Patti Ledger Backend is running!');
});

// 1. LOGIN API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // First Run: Auto-create Admin if no users exist
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    if (username === 'admin' && password === 'admin123') {
      const hashed = bcrypt.hashSync('admin123', 10);
      const admin = await prisma.user.create({ data: { username: 'admin', password: hashed, role: 'ADMIN' } });
      const token = jwt.sign({ id: admin.id, role: admin.role }, SECRET);
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });
      return res.json({ success: true, user: { username: admin.username, role: admin.role } });
    } else {
      return res.status(401).json({ error: 'System not initialized. Login as admin/admin123' });
    }
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid login' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ success: true, user: { username: user.username, role: user.role } });
});

// 1.5 CHECK SESSION API (Persist Login)
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ user: null });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.json({ user: null });
    // Fetch fresh user data to ensure role is up to date
    prisma.user.findUnique({ where: { id: decoded.id } }).then(user => {
      if (!user) return res.json({ user: null });
      res.json({ user: { id: user.id, role: user.role, username: user.username } });
    }).catch(() => res.json({ user: null }));
  });
});

// LOGOUT API
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
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

// 2.5 ACTIVE SESSIONS API (For Landing Page)
app.get('/api/sessions/active', (req, res) => {
  const activeList = [];
  activeSessions.forEach((session, name) => {
    activeList.push({
      name: name,
      currentRound: session.currentRound,
      totalRounds: session.totalRounds,
      playerCount: session.gameState?.players?.length || 0
    });
  });
  res.json(activeList);
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

app.post('/api/admin/users', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: "Only Admins can create users" });
    }

    const { username, password, role } = req.body;

    // Validate Role
    const validRoles = ['ADMIN', 'OPERATOR', 'PLAYER', 'GUEST'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashed, role }
    });

    // If creating a PLAYER, also create a Player entry linked to this user
    if (role === 'PLAYER') {
      await prisma.player.create({
        data: {
          name: username, // Default player name to username
          userId: user.id
        }
      });
    }

    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "User likely exists or invalid data" });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ error: "Only Admins can delete users" });
    }

    const { id } = req.params;
    // Prevent deleting self or super admin
    if (parseInt(id) === decoded.id || parseInt(id) === 1) {
      return res.status(400).json({ error: "Cannot delete yourself or Super Admin" });
    }

    // Delete associated player first if exists
    await prisma.player.deleteMany({ where: { userId: parseInt(id) } });
    await prisma.user.delete({ where: { id: parseInt(id) } });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.post('/api/admin/sessions/:name/end', async (req, res) => {
  // Allow Operators and Admins to end sessions
  const { name } = req.params;
  try {
    const session = await prisma.gameSession.findUnique({ where: { name } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    await prisma.gameSession.update({
      where: { id: session.id },
      data: { isActive: false }
    });

    if (activeSessions.has(name)) {
      activeSessions.delete(name);
    }

    io.to(name).emit('session_ended', { reason: 'ADMIN_ENDED' });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to end session" });
  }
});

app.post('/api/sessions', async (req, res) => {
  const { name, totalRounds, players } = req.body; // players: [{ userId, seat, name }]

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

      // Create Initial Players if provided
      if (players && players.length > 0) {
        for (const p of players) {
          // Check if player entry exists for this user, else create
          // For simplicity in this game model, we might just create a new Player entry or update existing
          // But since Player is unique by name/user, we upsert
          if (p.userId) {
            await prisma.player.upsert({
              where: { userId: p.userId },
              update: { sessionId: session.id, seatPosition: p.seat, sessionBalance: 0 },
              create: { name: p.name, userId: p.userId, sessionId: session.id, seatPosition: p.seat, sessionBalance: 0 }
            });
          }
        }
      }
    }

    // Initialize in-memory state if not present
    if (!activeSessions.has(name)) {
      // Fetch players from DB to populate state
      const dbPlayers = await prisma.player.findMany({ where: { sessionId: session.id } });
      const initialPlayers = dbPlayers.map(p => ({
        id: p.id,
        name: p.name,
        sessionBalance: p.sessionBalance,
        seat: p.seatPosition
      }));

      activeSessions.set(name, {
        sessionId: session.id,
        totalRounds: session.totalRounds,
        currentRound: session.currentRound,
        gameState: {
          players: initialPlayers, // Pre-fill players
          gamePlayers: [],
          pot: 0,
          currentStake: 20,
          activePlayerIndex: 0,
          currentLogs: []
        },
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
const activeSessions = new Map();

// --- SOCKET MIDDLEWARE ---
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  let token = null;

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    token = cookies.token;
  }

  if (token) {
    jwt.verify(token, SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  } else {
    socket.user = { role: 'GUEST' };
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (Role: ${socket.user.role})`);

  const isOperatorOrAdmin = () => socket.user.role === 'OPERATOR' || socket.user.role === 'ADMIN';

  // Create/Join Session (Operator)
  socket.on('join_session', async ({ sessionName, role }) => {
    if (role === 'OPERATOR' && !isOperatorOrAdmin()) {
      socket.emit('error_message', "Unauthorized: You are not an Operator.");
      return;
    }

    socket.join(sessionName);

    if (role === 'OPERATOR') {
      const session = activeSessions.get(sessionName);
      if (session) {
        socket.emit('game_update', session.gameState);
        session.viewerRequests.forEach(req => {
          socket.emit('viewer_requested', req);
        });
      }
    }
  });

  // Operator sends latest state
  socket.on('sync_state', ({ sessionName, state }) => {
    if (!isOperatorOrAdmin()) return;

    const session = activeSessions.get(sessionName);
    if (session) {
      session.gameState = state;
      const viewerIds = Array.from(session.approvedViewers);
      viewerIds.forEach(vid => {
        io.to(vid).emit('game_update', session.gameState);
      });
    }
  });

  // Operator approves a viewer
  socket.on('resolve_access', ({ sessionName, viewerId, approved }) => {
    if (!isOperatorOrAdmin()) return;

    const session = activeSessions.get(sessionName);
    if (!session) return;

    if (approved) {
      session.approvedViewers.add(viewerId);
      io.to(viewerId).emit('access_granted', session.gameState);
      const viewerSocket = io.sockets.sockets.get(viewerId);
      if (viewerSocket) viewerSocket.join(sessionName);
    } else {
      io.to(viewerId).emit('access_denied');
    }
    session.viewerRequests.delete(viewerId);
  });

  // End Session
  socket.on('end_session', async ({ sessionName }) => {
    if (!isOperatorOrAdmin()) return;

    const session = await prisma.gameSession.findUnique({ where: { name: sessionName } });

    if (session) {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      activeSessions.delete(sessionName);
      io.to(sessionName).emit('session_ended', { reason: 'OPERATOR_ENDED' });
    }
  });

  // --- VIEWER EVENTS ---
  socket.on('request_access', ({ sessionName, name }) => {
    const session = activeSessions.get(sessionName);
    if (!session) {
      socket.emit('error_message', "Session not found or inactive.");
      return;
    }

    session.viewerRequests.set(socket.id, { name, socketId: socket.id });
    io.to(sessionName).emit('viewer_requested', { name, socketId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeSessions.forEach(session => {
      if (session.viewerRequests.has(socket.id)) session.viewerRequests.delete(socket.id);
      if (session.approvedViewers.has(socket.id)) session.approvedViewers.delete(socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
