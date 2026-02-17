const bcrypt = require('bcryptjs');

// Security Configuration
const SECURITY_CONFIG = {
  // Account Lockout Settings
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
  
  // Password Policy
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  PASSWORD_SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  
  // JWT Settings
  JWT_ACCESS_EXPIRY: '15m',      // Short-lived access token
  JWT_REFRESH_EXPIRY: '7d',      // Longer-lived refresh token
  JWT_ISSUER: 'teen-patti-app',
  JWT_AUDIENCE: 'teen-patti-client',
  
  // Session Settings
  SESSION_ABSOLUTE_TIMEOUT_HOURS: 8,
  SESSION_IDLE_TIMEOUT_MINUTES: 30,
  
  // Rate Limiting (per IP)
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  AUTH_RATE_LIMIT_MAX: 5,
  
  // CSRF
  CSRF_TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  // Check length
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`);
  }
  
  if (password.length > SECURITY_CONFIG.PASSWORD_MAX_LENGTH) {
    errors.push(`Password must not exceed ${SECURITY_CONFIG.PASSWORD_MAX_LENGTH} characters`);
  }
  
  // Check complexity
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && 
      !new RegExp(`[${SECURITY_CONFIG.PASSWORD_SPECIAL_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`).test(password)) {
    errors.push(`Password must contain at least one special character (${SECURITY_CONFIG.PASSWORD_SPECIAL_CHARS})`);
  }
  
  // Check for common weak patterns
  if (/^[a-zA-Z]+$/.test(password)) {
    errors.push('Password cannot contain only letters');
  }
  
  if (/^[0-9]+$/.test(password)) {
    errors.push('Password cannot contain only numbers');
  }
  
  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain 3 or more repeated characters');
  }
  
  // Check for sequential characters
  const hasSequentialChars = (str) => {
    for (let i = 0; i < str.length - 2; i++) {
      const c1 = str.charCodeAt(i);
      const c2 = str.charCodeAt(i + 1);
      const c3 = str.charCodeAt(i + 2);
      if (c2 === c1 + 1 && c3 === c2 + 1) return true;
      if (c2 === c1 - 1 && c3 === c2 - 1) return true;
    }
    return false;
  };
  
  if (hasSequentialChars(password.toLowerCase())) {
    errors.push('Password cannot contain sequential characters (e.g., "abc", "123")');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a secure CSRF token
 * @returns {string} - CSRF token
 */
function generateCSRFToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate device fingerprint from request
 * @param {Object} req - Express request object
 * @returns {string} - Device fingerprint
 */
function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['sec-ch-ua-platform'] || '',
  ];
  
  // Simple hash of components
  return require('crypto')
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Check if account is locked
 * @param {Object} user - User object from database
 * @returns {Object} - { locked: boolean, remainingMinutes: number|null }
 */
function checkAccountLockout(user) {
  if (!user.lockedUntil) {
    return { locked: false, remainingMinutes: null };
  }
  
  const now = new Date();
  const lockedUntil = new Date(user.lockedUntil);
  
  if (now < lockedUntil) {
    const remainingMinutes = Math.ceil((lockedUntil - now) / (1000 * 60));
    return { locked: true, remainingMinutes };
  }
  
  return { locked: false, remainingMinutes: null };
}

/**
 * Sanitize user input to prevent injection attacks
 * @param {string} input - Raw input
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Check if IP is in private range (for logging/security)
 * @param {string} ip - IP address
 * @returns {boolean}
 */
function isPrivateIP(ip) {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return privateRanges.some(range => range.test(ip));
}

/**
 * Create a secure HTTP cookie options object
 * @param {boolean} isProduction - Production environment flag
 * @param {number} maxAgeMs - Max age in milliseconds
 * @returns {Object} - Cookie options
 */
function getSecureCookieOptions(isProduction, maxAgeMs) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
    // In production, you might want to add:
    // domain: isProduction ? '.yourdomain.com' : undefined,
  };
}

/**
 * Generate cryptographically secure random string
 * @param {number} length - Length of string
 * @returns {string}
 */
function generateSecureRandom(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = require('crypto').randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  SECURITY_CONFIG,
  validatePasswordStrength,
  generateCSRFToken,
  generateDeviceFingerprint,
  checkAccountLockout,
  sanitizeInput,
  isPrivateIP,
  getSecureCookieOptions,
  generateSecureRandom,
  hashPassword,
  comparePassword,
};