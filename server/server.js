// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);

// Trust proxy for rate limiting (required when behind Render's load balancer)
app.set('trust proxy', 1);

// Setup Prisma with PostgreSQL adapter for v7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
// ALLOW CONNECTION FROM ANYWHERE (For simplicity)
const CLIENT_URL = process.env.CLIENT_URL || "https://teen-patti-client.onrender.com";
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  "https://funny-friends.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' }
});

app.use(limiter);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    
    // Allow same-origin requests (for static files)
    if (process.env.NODE_ENV === 'production' && origin.includes('onrender.com')) {
      return callback(null, true);
    }
    
    // Check against allowed origins list
    if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      console.error(`CORS rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// DEBUG MIDDLEWARE (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log("Cookies:", req.cookies);
    console.log("Origin:", req.headers.origin);
    next();
  });
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost'))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

// Input validation schemas
const loginSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100)
});

const setupSchema = z.object({
  setupKey: z.string().min(10),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100)
});

const sessionSchema = z.object({
  name: z.string().min(3).max(100),
  totalRounds: z.number().int().min(1).max(50),
  players: z.array(z.object({
    name: z.string().min(1).max(50),
    seatPosition: z.number().int().min(1).max(6).optional()
  })).min(2).max(6)
});

const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

// --- HEALTH CHECK ENDPOINT ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

// Check if setup is needed
app.get('/api/setup/status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ 
      needsSetup: userCount === 0,
      userCount: userCount 
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Authorization middleware
const requireAuth = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.user = user;
  next();
};

const requireOperator = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'OPERATOR' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Operator access required' });
  }
  req.user = user;
  next();
};

// 1. SETUP API - Create first admin user (only when no users exist)
app.post('/api/auth/setup', authLimiter, async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    const { setupKey, username, password } = setupSchema.parse(req.body);

    if (setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(401).json({ error: 'Invalid setup key' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: { username, password: hashed, role: 'ADMIN' }
    });

    const token = jwt.sign({ id: admin.id, role: admin.role }, SECRET, { expiresIn: '8h' });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/'
    });

    return res.json({ success: true, user: { username: admin.username, role: admin.role } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Setup error:', error);
    return res.status(500).json({ error: 'Setup failed' });
  }
});

// 2. LOGIN API
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    // Check if setup is needed first
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return res.status(400).json({ 
        error: 'System not initialized', 
        needsSetup: true,
        message: 'Please complete system setup first' 
      });
    }

    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '8h' });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ success: true, user: { username: user.username, role: user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
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

// 2. SAVE GAME API (requires authentication)
app.post('/api/games/hand', requireAuth, async (req, res) => {
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

// 3. ADMIN API (requires admin authentication)
app.get('/api/admin/sessions', requireAdmin, async (req, res) => {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { hands: true } } }
  });
  res.json(sessions);
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true }
  });
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate Role
    const validRoles = ['ADMIN', 'OPERATOR', 'PLAYER', 'GUEST'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, password: hashed, role }
    });

    // If creating a PLAYER, also create a Player entry linked to this user
    if (role === 'PLAYER') {
      await prisma.player.create({
        data: {
          name: username,
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

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
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

app.post('/api/admin/sessions/:name/end', requireOperator, async (req, res) => {
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
app.get('/api/admin/sessions/:name', requireOperator, async (req, res) => {
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
app.delete('/api/admin/sessions/:name', requireAdmin, async (req, res) => {
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

// API 404 handler - must be before static files
app.use('/api/{*path}', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const httpServer = server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("NODE_ENV:", process.env.NODE_ENV);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    prisma.$disconnect().then(() => {
      console.log('Database disconnected');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    prisma.$disconnect().then(() => {
      console.log('Database disconnected');
      process.exit(0);
    });
  });
});
