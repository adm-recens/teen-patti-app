// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
const CLIENT_URL = process.env.CLIENT_URL || "https://teen-patti-client.onrender.com";
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  "https://teen-patti-client.onrender.com",
  "https://teen-patti-app.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];

app.use(morgan('dev')); // Log requests to console
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.onrender.com') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// DEBUG MIDDLEWARE
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Cookies:", req.cookies);
  console.log("Origin:", req.headers.origin);
  next();
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.onrender.com') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
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

// Helper to get user from Token (Cookie or Header)
const getUserFromRequest = (req) => {
  let token = req.cookies.token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
};

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
      const isProduction = process.env.NODE_ENV === 'production' || (process.env.CLIENT_URL && process.env.CLIENT_URL.includes('onrender'));
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
  const isProduction = process.env.NODE_ENV === 'production' || (process.env.CLIENT_URL && process.env.CLIENT_URL.includes('onrender'));

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ success: true, user: { username: user.username, role: user.role }, token }); // Return token for client-side storage
});

// 1.5 CHECK SESSION API (Persist Login)
app.get('/api/auth/me', (req, res) => {
  const decoded = getUserFromRequest(req);
  if (!decoded) return res.json({ user: null });

  // Fetch fresh user data to ensure role is up to date
  prisma.user.findUnique({ where: { id: decoded.id } }).then(user => {
    if (!user) return res.json({ user: null });
    res.json({ user: { id: user.id, role: user.role, username: user.username } });
  }).catch(() => res.json({ user: null }));
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

    // Save Hand History (stringify logs for SQLite)
    await prisma.gameHand.create({
      data: {
        winner: winner.name,
        potSize: pot,
        logs: JSON.stringify(logs || []),
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

    // Check if this was the final round BEFORE incrementing
    const currentRound = session.currentRound;
    const isSessionOver = currentRound >= session.totalRounds;

    let nextRound = currentRound;
    if (!isSessionOver) {
      // Only increment if session is not over
      const updatedSession = await prisma.gameSession.update({
        where: { id: session.id },
        data: { currentRound: { increment: 1 } }
      });
      nextRound = updatedSession.currentRound;
    }

    // Update in-memory manager's round as well
    const manager = activeSessions.get(sessionName);
    if (manager && !isSessionOver) {
      manager.currentRound = nextRound;
    }

    if (isSessionOver) {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      // We will emit session_ended AFTER the hand summary is shown or handled, 
      // but to be safe we emit it here too so the state is consistent.
      io.to(sessionName).emit('session_ended', { reason: 'MAX_ROUNDS_REACHED' });
      if (activeSessions.has(sessionName)) {
        activeSessions.delete(sessionName);
      }
    }

    // Broadcast update
    io.to(sessionName).emit('game_update', {
      type: 'HAND_COMPLETE',
      winner,
      pot,
      netChanges,
      currentRound: nextRound,
      isSessionOver
    });
    res.json({ success: true, currentRound: nextRound, isSessionOver });

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
  console.log("--- [DEBUG] Create User Request ---");
  console.log("Headers:", JSON.stringify(req.headers));

  const decoded = getUserFromRequest(req);
  if (!decoded) {
    console.log("[DEBUG] No valid token found");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[DEBUG] Token Decoded:", decoded);

    if (decoded.role !== 'ADMIN') {
      console.log("[DEBUG] Role mismatch:", decoded.role);
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
  const decoded = getUserFromRequest(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
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
  const decoded = getUserFromRequest(req);
  if (!decoded || (decoded.role !== 'ADMIN' && decoded.role !== 'OPERATOR')) {
    return res.status(403).json({ error: "Unauthorized" });
  }

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

// Get session details with hands
app.get('/api/admin/sessions/:name', async (req, res) => {
  const decoded = getUserFromRequest(req);
  if (!decoded || (decoded.role !== 'ADMIN' && decoded.role !== 'OPERATOR')) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { name } = req.params;
  try {
    const session = await prisma.gameSession.findUnique({
      where: { name },
      include: {
        hands: {
          orderBy: { createdAt: 'desc' }
        },
        players: true
      }
    });
    
    if (!session) return res.status(404).json({ error: "Session not found" });
    
    res.json(session);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch session details" });
  }
});

// Delete session and all related data
app.delete('/api/admin/sessions/:name', async (req, res) => {
  const decoded = getUserFromRequest(req);
  if (!decoded || decoded.role !== 'ADMIN') {
    return res.status(403).json({ error: "Only admins can delete sessions" });
  }

  const { name } = req.params;
  try {
    const session = await prisma.gameSession.findUnique({ where: { name } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Delete related data first
    await prisma.gameHand.deleteMany({ where: { sessionId: session.id } });
    await prisma.player.deleteMany({ where: { sessionId: session.id } });
    
    // Delete the session
    await prisma.gameSession.delete({ where: { id: session.id } });
    
    // Remove from active sessions if present
    if (activeSessions.has(name)) {
      activeSessions.delete(name);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete session" });
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
          if (p.userId) {
            // Registered user player
            await prisma.player.upsert({
              where: { userId: p.userId },
              update: { sessionId: session.id, seatPosition: p.seat, sessionBalance: 0 },
              create: { name: p.name, userId: p.userId, sessionId: session.id, seatPosition: p.seat, sessionBalance: 0 }
            });
          } else {
            // Guest player - create new entry
            await prisma.player.create({
              data: { 
                name: p.name, 
                sessionId: session.id, 
                seatPosition: p.seat, 
                sessionBalance: 0 
              }
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

      // Create GameManager instance
      const manager = new GameManager(session.id, name, session.totalRounds);
      manager.currentRound = session.currentRound || 1; // Default to 1 for new sessions
      manager.setPlayers(initialPlayers);
      
      console.log(`[DEBUG] Session ${name} initialized with ${initialPlayers.length} players:`, initialPlayers);

      // Hook up events
      manager.on('state_change', (state) => {
        io.to(name).emit('game_update', state);
      });
      manager.on('session_ended', async (data) => {
        // Mark session as inactive in database
        try {
          await prisma.gameSession.update({
            where: { name },
            data: { isActive: false }
          });
          console.log(`[DEBUG] Session ${name} marked as complete`);
        } catch (e) {
          console.error('[ERROR] Failed to mark session as complete:', e);
        }
        
        io.to(name).emit('session_ended', data);
        activeSessions.delete(name);
      });
      manager.on('hand_complete', async (summary) => {
        // Save hand to database
        try {
          const session = await prisma.gameSession.findUnique({ where: { name } });
          if (session) {
            // Save hand history - handle both SQLite (String) and PostgreSQL (Json)
            const logsData = process.env.DATABASE_URL?.includes('sqlite') ? JSON.stringify([]) : [];
            await prisma.gameHand.create({
              data: {
                winner: summary.winner.name,
                potSize: summary.pot,
                logs: logsData,
                sessionId: session.id
              }
            });
            
            // Update player balances
            for (const [playerId, change] of Object.entries(summary.netChanges)) {
              const pid = parseInt(playerId);
              await prisma.player.upsert({
                where: { id: pid },
                update: {
                  sessionBalance: { increment: change }
                },
                create: {
                  id: pid,
                  name: "Player " + pid,
                  sessionBalance: change,
                  sessionId: session.id
                }
              });
            }
            
            console.log(`[DEBUG] Hand saved for session ${name}`);
          }
        } catch (e) {
          console.error('[ERROR] Failed to save hand:', e);
        }
        
        io.to(name).emit('game_update', { type: 'HAND_COMPLETE', ...summary });
      });

      activeSessions.set(name, manager);
      console.log(`Initialized GameManager for session ${name}`);
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

  // 1. Try to get token from cookies
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    token = cookies.token;
  }

  // 2. Try to get token from socket auth (Client sends it here)
  if (!token && socket.handshake.auth && socket.handshake.auth.token) {
    token = socket.handshake.auth.token;
  }

  // 3. Try to get token from Authorization header
  if (!token && socket.handshake.headers.authorization) {
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
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
    console.log('[DEBUG] join_session called:', sessionName, 'role:', role, 'socket user:', socket.user.role);
    socket.join(sessionName);

    // Operator Logic: Initialize Manager
    if (role === 'OPERATOR') {
      if (!isOperatorOrAdmin()) {
        console.log('[DEBUG] Operator join unauthorized');
        return socket.emit('error_message', "Unauthorized");
      }

      let manager = activeSessions.get(sessionName);
      console.log('[DEBUG] Manager exists in activeSessions:', !!manager);
      if (!manager) {
        // Try load from DB
        try {
          const dbSession = await prisma.gameSession.findUnique({ where: { name: sessionName } });
          if (dbSession && dbSession.isActive) {
            const dbPlayers = await prisma.player.findMany({ where: { sessionId: dbSession.id } });
            const initialPlayers = dbPlayers.map(p => ({
              id: p.id,
              name: p.name,
              sessionBalance: p.sessionBalance,
              seat: p.seatPosition
            }));

            manager = new GameManager(dbSession.id, sessionName, dbSession.totalRounds);
            manager.currentRound = dbSession.currentRound || 1;
            manager.setPlayers(initialPlayers);
            console.log(`[DEBUG] Restored session ${sessionName} from DB with ${initialPlayers.length} players`);

            // Hook up events
            manager.on('state_change', (state) => {
              io.to(sessionName).emit('game_update', state);
            });
            manager.on('hand_complete', (summary) => {
              io.to(sessionName).emit('game_update', { type: 'HAND_COMPLETE', ...summary });
            });

            activeSessions.set(sessionName, manager);
            console.log(`Initialized GameManager for ${sessionName}`);
          } else {
            return socket.emit('session_ended', { reason: "Session not found" });
          }
        } catch (e) { console.error("Restore Error:", e); }
      }

      // Send current state
      if (manager) {
        const state = manager.getPublicState();
        console.log('[DEBUG] Sending game_update to operator. Phase:', state.phase, 'Players:', state.players.length, 'gamePlayers:', state.gamePlayers.length);
        socket.emit('game_update', state);
        if (manager.viewerRequests) {
          // manager.viewerRequests.forEach(req => socket.emit('viewer_requested', req)); // If mapped
        }
      }
    } else {
      // Viewer/Player Join
      const manager = activeSessions.get(sessionName);
      if (manager) {
        socket.emit('game_update', manager.getPublicState());
      }
    }
  });

  // Game Actions
  socket.on('game_action', (action) => {
    console.log('[DEBUG] game_action received:', action.type, 'for session:', action.sessionName);
    if (!isOperatorOrAdmin()) {
      console.log('[DEBUG] Unauthorized - user role:', socket.user.role);
      return;
    }

    const manager = activeSessions.get(action.sessionName);
    if (!manager) {
      console.log('[DEBUG] No manager found for session:', action.sessionName);
      return;
    }
    
    console.log('[DEBUG] Manager found. Current phase:', manager.gameState.phase, 'Players:', manager.gameState.players.length);

    if (action.type === 'START_GAME') {
      console.log('[DEBUG] Calling startRound()');
      const result = manager.startRound();
      console.log('[DEBUG] startRound result:', result);
      if (!result.success) socket.emit('error_message', result.error);
    } else {
      const result = manager.handleAction(action);
      if (!result.success) socket.emit('error_message', result.error);
    }
  });

  // End Session
  socket.on('end_session', async ({ sessionName }) => {
    if (!isOperatorOrAdmin()) return;
    const manager = activeSessions.get(sessionName);
    if (manager) {
      await prisma.gameSession.update({ where: { id: manager.sessionId }, data: { isActive: false } });
      activeSessions.delete(sessionName);
      io.to(sessionName).emit('session_ended', { reason: 'OPERATOR_ENDED' });
    }
  });

  socket.on('disconnect', () => {
    // Cleanup if needed
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("NODE_ENV:", process.env.NODE_ENV);
});
