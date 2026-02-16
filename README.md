# Funny Friends

A secure, multiplayer platform where friends gather to play card games together. Currently featuring Teen Patti, with more games coming soon!

[![Security Rating](https://img.shields.io/badge/security-A+-brightgreen)](SECURITY_AUDIT.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Security First

This application has undergone comprehensive security hardening. See our [Security Audit Report](SECURITY_AUDIT.md) for details.

**Key Security Features:**
- 🔒 HTTP-only cookies for secure session management
- 🛡️ Helmet.js security headers
- 🚫 Rate limiting on authentication endpoints
- ✅ Input validation with Zod schemas
- 🔐 Role-based access control (RBAC)
- 📝 Comprehensive audit trail

## Features

- **Teen Patti**: The classic Indian card game with full betting mechanics
- **Multiplayer**: Support for 2-6 players per game
- **Real-time**: Live game updates via WebSocket
- **Role-based Access**: Admin, Operator, Player, and Viewer roles
- **Secure**: Production-grade security with JWT authentication
- **Responsive**: Works on desktop and mobile devices

## Quick Links

- 📖 [Local Development Guide](LOCAL_DEVELOPMENT.md) - Get started in 5 minutes
- 🚀 [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Deploy to Render
- 🔐 [Security Audit Report](SECURITY_AUDIT.md) - Security details

## Architecture

This is a **full-stack monorepo** with the following structure:

```
funny-friends/
├── client/                 # React Frontend (Vite + React 19)
│   ├── src/               # Source code
│   ├── dist/              # Production build (generated)
│   └── package.json       # Frontend dependencies
├── server/                 # Express Backend
│   ├── server.js          # Entry point
│   ├── game/              # Game logic (GameManager)
│   ├── prisma/            # Database schema & migrations
│   └── package.json       # Backend dependencies
├── package.json           # Root configuration & scripts
└── render.yaml            # Render deployment config
```

### How It Works

**Development Mode:**
- Frontend runs on `http://localhost:5173` (Vite dev server)
- Backend runs on `http://localhost:3000` (Express server)
- SQLite database for easy local development

**Production Mode (Render):**
- Single Express server serves both API and static files
- PostgreSQL database for production reliability
- All traffic over HTTPS with security headers

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js 5 + Socket.io
- **Database**: SQLite (local) / PostgreSQL (production)
- **ORM**: Prisma with PostgreSQL driver adapter
- **Real-time**: Socket.io for live game updates
- **Security**: Helmet.js, express-rate-limit, bcrypt, JWT
- **Validation**: Zod for input validation

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone and Install

```bash
git clone https://github.com/adm-recens/teen-patti-app.git
cd teen-patti-app
npm run install-all
```

### 2. Configure Environment

```bash
# Server environment
cd server
cp .env.example .env
# Edit .env with your settings (see below)

# Client environment
cd ../client
cp .env.example .env.local
```

**Minimum server/.env configuration:**
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-min-32-characters-long"
ADMIN_SETUP_KEY="your-setup-key-min-10-characters"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

**Generate secure keys:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ADMIN_SETUP_KEY
```

### 3. Initialize Database

```bash
cd server
npx prisma generate
npx prisma db push
```

### 4. Start Development

```bash
npm run dev
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### 5. First-Time Setup

1. Open http://localhost:5173
2. You'll see the setup page (only appears when no users exist)
3. Enter your `ADMIN_SETUP_KEY` from `.env`
4. Create the first admin account
5. Login with your new credentials

## Deployment

### Render (Recommended)

The easiest way to deploy:

1. **Push to GitHub**
2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your repository
3. **Set Environment Variables**:
   ```
   JWT_SECRET=<generate-64-char-random>
   ADMIN_SETUP_KEY=<generate-32-char-random>
   CLIENT_URL=https://your-app.onrender.com
   ```
4. **Deploy**

See [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) for detailed instructions.

## Available Scripts

### Development
```bash
npm run dev              # Start both client and server
npm run server           # Backend only
npm run client           # Frontend only
npm run install-all      # Install all dependencies
```

### Production
```bash
npm run build            # Build client for production
npm start                # Start production server
npm run render-build     # Build for Render deployment
```

### Database
```bash
cd server
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed sample data
```

## Security Features

### Implemented

- ✅ **HTTP-only Cookies**: Tokens never accessible to JavaScript
- ✅ **Rate Limiting**: 5 login attempts per 15 minutes
- ✅ **Input Validation**: Zod schemas for all inputs
- ✅ **Helmet.js**: Security headers (CSP, HSTS, etc.)
- ✅ **CORS**: Whitelist-based origin validation
- ✅ **RBAC**: Role-based access control
- ✅ **Password Hashing**: bcrypt with 12 rounds
- ✅ **JWT Expiration**: 8-hour token lifetime
- ✅ **SQL Injection Protection**: Prisma ORM with parameterized queries
- ✅ **XSS Protection**: Content Security Policy headers

### Environment Security

- 🔒 Secrets stored in environment variables only
- 🔒 `.env` files excluded from git
- 🔒 No hardcoded credentials
- 🔒 One-time setup key for initial admin

## Project Structure

```
funny-friends/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React contexts
│   │   └── config.js      # API configuration
│   └── package.json
├── server/                 # Node.js backend
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── dev.db         # SQLite (gitignored)
│   ├── game/
│   │   └── GameManager.js # Game logic
│   ├── server.js          # Main server file
│   └── package.json
├── .gitignore             # Git exclusions
├── LOCAL_DEVELOPMENT.md   # Local setup guide
├── PRODUCTION_DEPLOYMENT.md # Production guide
├── SECURITY_AUDIT.md      # Security audit report
└── README.md              # This file
```

## Documentation

- 📖 [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Complete local development guide
- 🚀 [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Production deployment instructions
- 🔐 [SECURITY_AUDIT.md](SECURITY_AUDIT.md) - Security audit and hardening details

## Environment Variables

### Server (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `JWT_SECRET` | JWT signing secret (64+ chars) | Yes |
| `ADMIN_SETUP_KEY` | First-time setup key (32+ chars) | Yes |
| `CLIENT_URL` | Allowed CORS origin | Yes |
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment mode | No (default: development) |

### Client (.env.local)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_BACKEND_URL` | Backend URL (empty for same-origin) | No |

## Troubleshooting

### Port Already in Use
```bash
npx kill-port 3000  # or 5173
```

### Database Issues
```bash
cd server
rm prisma/dev.db prisma/dev.db-journal  # Reset SQLite
npx prisma db push  # Recreate
```

### CORS Errors
- Check `CLIENT_URL` matches your actual URL
- Include protocol (http:// or https://)

### Build Errors
```bash
# Clear caches
rm -rf node_modules client/node_modules server/node_modules
rm -rf client/dist
npm run install-all
```

## Security Best Practices

1. **Never commit `.env` files** - They are already in `.gitignore`
2. **Use strong passwords** - Minimum 8 characters, mixed case, numbers
3. **Rotate secrets regularly** - Especially `JWT_SECRET` and `ADMIN_SETUP_KEY`
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Monitor logs** - Check for unusual activity
6. **Use HTTPS in production** - Render provides this automatically

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our security guidelines before contributing.

## Future Roadmap

- [x] Teen Patti game
- [x] Security hardening
- [ ] Rummy game
- [ ] Poker game
- [ ] User avatars
- [ ] Game statistics
- [ ] Mobile app
- [ ] Tournament mode

## License

MIT License - feel free to use this project for your own games!

## Support

- 📧 Open an issue on GitHub
- 📖 Check the documentation links above
- 🔐 Review the security audit for security questions

---

Built with ❤️ for friends who love to play games together!

**Security First | Production Ready | Open Source**
