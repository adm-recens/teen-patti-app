// Unified Authentication Controller with Role-Based Routing
const jwt = require('jsonwebtoken');
const {
  SECURITY_CONFIG,
  validatePasswordStrength,
  generateCSRFToken,
  generateDeviceFingerprint,
  checkAccountLockout,
  getSecureCookieOptions,
  generateSecureRandom,
  hashPassword,
  comparePassword,
} = require('../utils/security');

const prisma = require('../db');

// CSRF Token storage (in production, use Redis)
const csrfTokens = new Map();

// Username-based rate limiting
const usernameAttempts = new Map();
const USERNAME_LOCKOUT_DURATION = 15 * 60 * 1000;

// Clean up expired CSRF tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(token);
    }
  }
}, 60 * 60 * 1000);

// API Response Helpers
const ApiResponse = {
  success: (res, data, statusCode = 200) => {
    res.status(statusCode).json({ success: true, ...data });
  },
  error: (res, message, statusCode = 400, details = null) => {
    const response = { success: false, error: message };
    if (details) response.details = details;
    res.status(statusCode).json(response);
  },
  unauthorized: (res, message = 'Unauthorized') => {
    res.status(401).json({ success: false, error: message });
  },
  forbidden: (res, message = 'Forbidden') => {
    res.status(403).json({ success: false, error: message });
  },
  locked: (res, message, remainingMinutes) => {
    res.status(423).json({
      success: false,
      error: 'Account locked',
      message,
      remainingMinutes
    });
  }
};

// Check username rate limit
function checkUsernameRateLimit(username) {
  const now = Date.now();
  const attempts = usernameAttempts.get(username);

  if (!attempts) {
    usernameAttempts.set(username, { count: 1, firstAttempt: now });
    return { limited: false };
  }

  if (now - attempts.firstAttempt > USERNAME_LOCKOUT_DURATION) {
    usernameAttempts.set(username, { count: 1, firstAttempt: now });
    return { limited: false };
  }

  if (attempts.count >= SECURITY_CONFIG.AUTH_RATE_LIMIT_MAX) {
    const remainingTime = Math.ceil((USERNAME_LOCKOUT_DURATION - (now - attempts.firstAttempt)) / 1000 / 60);
    return {
      limited: true,
      remainingMinutes: remainingTime,
      message: `Too many attempts for this username. Please try again in ${remainingTime} minutes.`
    };
  }

  attempts.count++;
  return { limited: false };
}

// Get user role-based dashboard data
async function getUserDashboardData(userId, role) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      allowedGames: {
        include: { gameType: true }
      }
    }
  });

  if (!user) return null;

  const baseData = {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.allowedGames.map(ag => ({
      gameType: ag.gameType.code,
      canCreate: ag.canCreate,
      canManage: ag.canManage
    }))
  };

  // Role-specific data
  switch (role) {
    case 'ADMIN':
      const [allUsers, allSessions, allGames] = await Promise.all([
        prisma.user.count(),
        prisma.gameSession.count(),
        prisma.gameType.count()
      ]);
      return {
        ...baseData,
        stats: { users: allUsers, sessions: allSessions, games: allGames },
        redirectTo: '/admin',
        availableActions: ['manage-users', 'manage-games', 'view-analytics', 'system-settings']
      };

    case 'OPERATOR':
      const [operatorSessions, activeGames] = await Promise.all([
        prisma.gameSession.count({ where: { createdBy: userId } }),
        prisma.gameType.count({ where: { isActive: true } })
      ]);
      return {
        ...baseData,
        stats: { mySessions: operatorSessions, availableGames: activeGames },
        redirectTo: '/dashboard',
        availableActions: ['create-session', 'manage-sessions', 'view-sessions']
      };

    case 'PLAYER':
      const playerData = await prisma.player.findMany({
        where: { userId },
        include: { session: true }
      });
      return {
        ...baseData,
        sessions: playerData.map(p => ({
          sessionId: p.sessionId,
          sessionName: p.session?.name,
          balance: p.sessionBalance
        })),
        redirectTo: '/player',
        availableActions: ['join-session', 'view-history']
      };

    default: // GUEST
      const publicGames = await prisma.gameType.findMany({
        where: { isActive: true },
        select: { code: true, name: true, icon: true }
      });
      return {
        ...baseData,
        availableGames: publicGames,
        redirectTo: '/',
        availableActions: ['view-games', 'watch-games']
      };
  }
}

// Unified Login Handler
async function handleLogin(req, res) {
  const clientIp = req.ip;
  const userAgent = req.headers['user-agent'];
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Check username rate limiting
    const rateLimitCheck = checkUsernameRateLimit(req.body.username);
    if (rateLimitCheck.limited) {
      return ApiResponse.locked(res, rateLimitCheck.message, rateLimitCheck.remainingMinutes);
    }

    // Check if setup needed
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (!firstUser) {
      return ApiResponse.error(res, 'System not initialized', 400, {
        needsSetup: true,
        setupUrl: '/setup'
      });
    }

    const { username, password } = req.body;

    // Fetch user with security fields
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true
      }
    });

    // Handle non-existent user with timing-safe comparison
    if (!user) {
      await comparePassword(password, '$2a$12$abcdefghijklmnopqrstuvwxycdefghijklmnopqrstu');

      prisma.loginAttempt.create({
        data: {
          username,
          ipAddress: clientIp,
          userAgent,
          success: false,
          reason: 'Invalid credentials'
        }
      }).catch(() => { });

      return ApiResponse.error(res, 'Invalid credentials', 401);
    }

    // Check account lockout
    const lockoutStatus = checkAccountLockout(user);
    if (lockoutStatus.locked) {
      prisma.loginAttempt.create({
        data: {
          username,
          ipAddress: clientIp,
          userAgent,
          success: false,
          reason: `Account locked for ${lockoutStatus.remainingMinutes} minutes`
        }
      }).catch(() => { });

      return ApiResponse.locked(res,
        `Too many failed attempts. Please try again in ${lockoutStatus.remainingMinutes} minutes.`,
        lockoutStatus.remainingMinutes
      );
    }

    // Validate credentials
    const validCredentials = await comparePassword(password, user.password);

    if (!validCredentials) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS;

      await Promise.all([
        prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedAttempts,
            ...(shouldLock && {
              lockedUntil: new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000)
            })
          }
        }),
        prisma.loginAttempt.create({
          data: {
            username,
            ipAddress: clientIp,
            userAgent,
            success: false,
            reason: shouldLock ? 'Account locked' : 'Invalid credentials'
          }
        })
      ]);

      if (shouldLock) {
        return ApiResponse.locked(res,
          `Too many failed attempts. Account locked for ${SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES} minutes.`,
          SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES
        );
      }

      return ApiResponse.error(res, 'Invalid credentials', 401);
    }

    // === SUCCESS ===
    const sessionId = generateSecureRandom(32);
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000);

    // Parallel operations
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      }),
      prisma.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          token: sessionId,
          ipAddress: clientIp,
          userAgent,
          deviceInfo: generateDeviceFingerprint(req),
          expiresAt
        }
      }),
      prisma.loginAttempt.create({
        data: {
          username,
          ipAddress: clientIp,
          userAgent,
          success: true
        }
      })
    ]);

    // Get role-based dashboard data
    const dashboardData = await getUserDashboardData(user.id, user.role);

    // Generate tokens
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        sessionId,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      {
        expiresIn: `${SECURITY_CONFIG.SESSION_ABSOLUTE_TIMEOUT_HOURS}h`,
        issuer: SECURITY_CONFIG.JWT_ISSUER,
        audience: SECURITY_CONFIG.JWT_AUDIENCE
      }
    );

    const csrfToken = generateCSRFToken();
    csrfTokens.set(csrfToken, {
      userId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + SECURITY_CONFIG.CSRF_TOKEN_EXPIRY_MS
    });

    // Set cookie
    res.cookie('token', token, getSecureCookieOptions(
      isProduction,
      SECURITY_CONFIG.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
    ));

    // Clear rate limit on success
    usernameAttempts.delete(username);

    return ApiResponse.success(res, {
      user: dashboardData,
      csrfToken,
      message: `Welcome back, ${user.username}!`
    });

  } catch (error) {
    console.error('[ERROR] Login failed:', error);
    return ApiResponse.error(res, 'Login failed', 500);
  }
}

// Check current session
async function checkSession(req, res) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: SECURITY_CONFIG.JWT_ISSUER,
      audience: SECURITY_CONFIG.JWT_AUDIENCE
    });

    const sessionWithUser = await prisma.userSession.findFirst({
      where: {
        token: decoded.sessionId,
        isValid: true,
        expiresAt: { gt: new Date() },
        userId: decoded.id
      },
      include: {
        user: {
          select: { id: true, username: true, role: true, lockedUntil: true }
        }
      }
    });

    if (!sessionWithUser || !sessionWithUser.user) {
      return res.json({ user: null });
    }

    const lockoutStatus = checkAccountLockout(sessionWithUser.user);
    if (lockoutStatus.locked) {
      return res.json({ user: null });
    }

    // Get dashboard data for current role
    const dashboardData = await getUserDashboardData(
      sessionWithUser.user.id,
      sessionWithUser.user.role
    );

    return ApiResponse.success(res, { user: dashboardData });

  } catch (e) {
    return res.json({ user: null });
  }
}

// Logout
async function handleLogout(req, res) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await prisma.userSession.updateMany({
          where: { token: decoded.sessionId },
          data: { isValid: false }
        });
      } catch (e) {
        // Invalid token, just clear cookie
      }
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/'
    });

    return ApiResponse.success(res, { message: 'Logged out successfully' });
  } catch (e) {
    console.error('[ERROR] Logout failed:', e);
    return ApiResponse.error(res, 'Logout failed', 500);
  }
}

module.exports = {
  ApiResponse,
  handleLogin,
  checkSession,
  handleLogout,
  getUserDashboardData,
  checkUsernameRateLimit,
  csrfTokens
};
