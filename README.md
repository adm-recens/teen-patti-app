# Funny Friends

A platform where friends gather to play card games together. Currently featuring Teen Patti, with more games coming soon!

## Features

- **Teen Patti**: The classic Indian card game with full betting mechanics
- **Multiplayer**: Support for 2-17 players per game
- **Real-time**: Live game updates via WebSocket
- **Role-based Access**: Admin, Operator, and Viewer roles
- **Secure**: JWT authentication and session management

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
- They communicate via API calls and WebSocket

**Production Mode (Render):**
1. Frontend is **built** into static files (`client/dist/`)
2. Express server **serves** these static files
3. Both frontend and backend run on **same domain** (no CORS issues)
4. WebSocket connections work through the same server

This is why we only need **one Web Service** on Render, not two!

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js + Socket.io
- **Database**: SQLite (local) / PostgreSQL (Render)
- **Real-time**: Socket.io for live game updates
- **Build Tool**: Vite (creates optimized static files)

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/funny-friends.git
cd funny-friends

# 2. Install dependencies (installs both client & server)
npm install

# 3. Setup environment
cd server && cp .env.example .env
cd ../client && cp .env.example .env.local
cd ..

# 4. Start development (runs both frontend & backend)
npm run dev
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Default Admin Credentials

- Username: `admin`
- Password: `admin123`

## Database Options

Funny Friends supports both **SQLite** (local development) and **PostgreSQL** (production/Render).

- **SQLite**: File-based, perfect for local development
- **PostgreSQL**: Production-grade, required for Render free tier

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for detailed database setup instructions.

## Deployment on Render

### Understanding the Architecture

On Render, you only need **ONE Web Service** (not two!). Here's why:

```
┌─────────────────────────────────────┐
│         Render Web Service          │
│  ┌─────────────────────────────┐   │
│  │   Express Server (Node.js)  │   │
│  │   - API endpoints           │   │
│  │   - WebSocket server        │   │
│  │   - Serves static files     │   │
│  └─────────────────────────────┘   │
│              ▲                      │
│              │                      │
│  ┌─────────────────────────────┐   │
│  │   Static Files (client/dist)│   │
│  │   - index.html              │   │
│  │   - JS/CSS bundles          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**The Process:**
1. **Build Step**: Vite builds React app into `client/dist/` (static files)
2. **Runtime**: Express serves these static files + handles API + WebSocket
3. **Result**: Everything runs on one domain (e.g., `https://your-app.onrender.com`)

### Method 1: Blueprint (Recommended - 1 Click!)

The easiest way - automatically creates PostgreSQL database:

1. **Push your code to GitHub**

2. **Connect to Render**:
   - Go to https://dashboard.render.com/
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically:
     - Create a PostgreSQL database (free tier)
     - Create a Web Service
     - Set all environment variables
     - Run migrations

3. **Deploy!**
   - Click "Apply"
   - Wait for build and deployment
   - Your app will be available at `https://your-service-name.onrender.com`

### Method 2: Manual Setup

If you prefer manual configuration:

#### Step 1: Create PostgreSQL Database

1. Go to https://dashboard.render.com/
2. Click "New +" → "PostgreSQL"
3. Name: `funny-friends-db`
4. Select **Free** plan
5. Create Database

#### Step 2: Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:

   | Setting | Value |
   |---------|-------|
   | **Name** | `funny-friends` |
   | **Environment** | `Node` |
   | **Build Command** | `npm run render-build` |
   | **Start Command** | `npm start` |

4. **Set Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=<generate-a-strong-secret>
   DATABASE_URL=<copy-from-postgresql-service>
   ```

   **To get DATABASE_URL**:
   - Go to your PostgreSQL service
   - Copy the "Internal Connection String"
   - Format: `postgresql://user:pass@host:5432/database`

5. **Deploy!**
   - Click "Create Web Service"
   - Render will build and deploy

### Build Process Explained

When you deploy, this happens:

```bash
# 1. Render runs the build command:
npm run render-build

# Which executes:
npm install                    # Install root dependencies
(cd client && npm install)     # Install client dependencies  
(cd client && npm run build)   # Build React app to client/dist/

# 2. Render runs the start command:
npm start

# Which executes:
cd server && npm start         # Start Express server

# 3. Express server:
# - Serves API endpoints
# - Handles WebSocket connections
# - Serves static files from ../client/dist/
```

### Troubleshooting Render Deployment

**Build Fails - "vite: not found"**
```
Solution: Make sure package.json has:
"render-build": "npm install && (cd client && npm install && npm run build)"
```

**Build Succeeds but Site Shows 404**
```
Problem: Express not serving static files
Solution: Check that NODE_ENV=production is set
```

**Database Connection Errors**
```
Problem: DATABASE_URL not set or incorrect
Solution: Copy exact connection string from PostgreSQL service
```

**CORS Errors**
```
Problem: Frontend can't connect to backend
Solution: In production, both run on same domain (no CORS needed)
Make sure you're accessing via the Render URL, not localhost
```

**WebSocket Connection Fails**
```
Problem: Socket.io not connecting
Solution: Check browser console for errors
Make sure you're using wss:// for WebSocket (Render handles this)
```

## Environment Variables Reference

### For Local Development (SQLite)

Create `server/.env`:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="local-dev-secret"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

### For Production (PostgreSQL)

Set in Render Dashboard:
```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
JWT_SECRET="your-production-secret-key"
PORT=10000
NODE_ENV=production
```

## Available Scripts

### Development
```bash
npm run dev          # Start both client and server
npm run server       # Start backend only
npm run client       # Start frontend only
```

### Production
```bash
npm run build        # Build client for production
npm start            # Start production server
npm run render-build # Build for Render deployment
```

### Database
```bash
cd server
npm run db:push              # Push schema (SQLite)
npm run db:push:sqlite       # Push schema (SQLite explicit)
npm run db:migrate           # Run migrations (PostgreSQL)
npm run db:studio            # Open Prisma Studio
```

## Project Structure

```
funny-friends/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── context/       # React contexts (Auth, etc.)
│   │   └── config.js      # Centralized config
│   ├── dist/              # Production build (auto-generated)
│   └── package.json
├── server/                 # Express backend
│   ├── server.js          # Main entry point
│   ├── game/
│   │   └── GameManager.js # Game logic
│   ├── prisma/
│   │   ├── schema.prisma      # PostgreSQL schema
│   │   └── schema.sqlite.prisma # SQLite schema
│   └── package.json
├── package.json           # Root config & scripts
├── render.yaml            # Render blueprint
├── README.md              # This file
└── POSTGRESQL_SETUP.md    # Database setup guide
```

## How the Static Site Works

### Development vs Production

**Development:**
```
Browser → Vite Dev Server (5173) → API calls → Express (3000)
```

**Production:**
```
Browser → Express Server (serves static files + API + WebSocket)
         ↓
    ┌────┴────┐
    ↓         ↓
Static Files   API Endpoints
(client/dist)  (/api/*)
```

### Why This Architecture?

1. **Single Domain**: No CORS issues in production
2. **Simpler Deployment**: One service instead of two
3. **Better Performance**: Static files served by Express
4. **Cost Effective**: Free tier on Render supports this
5. **Scalable**: Can add CDN later if needed

## Free Tier Limits (Render)

- **Web Service**: 512 MB RAM, sleeps after 15 min inactivity
- **PostgreSQL**: 1 GB storage, shared CPU
- **Bandwidth**: 100 GB/month

Perfect for small groups of friends playing occasionally!

## Future Roadmap

- [x] Teen Patti game
- [ ] Rummy game
- [ ] Poker game
- [ ] User avatars
- [ ] Game statistics
- [ ] Mobile app

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use this project for your own games!

---

Built with ❤️ for friends who love to play games together!

**Need Help?**
- Check [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for database setup
- Review [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) for testing checklist
- Open an issue on GitHub
