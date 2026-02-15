# Funny Friends

A platform where friends gather to play card games together. Currently featuring Teen Patti, with more games coming soon!

## Features

- **Teen Patti**: The classic Indian card game with full betting mechanics
- **Multiplayer**: Support for 2-17 players per game
- **Real-time**: Live game updates via WebSocket
- **Role-based Access**: Admin, Operator, and Viewer roles
- **Secure**: JWT authentication and session management

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js + Socket.io
- **Database**: SQLite with Prisma ORM
- **Real-time**: Socket.io for live game updates

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/funny-friends.git
cd funny-friends
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Server
cd server
cp .env.example .env

# Client
cd ../client
cp .env.example .env
```

4. Initialize the database:
```bash
cd server
npx prisma db push
npm run db:seed  # Optional: seed with admin user
```

5. Start the development servers:
```bash
# From root directory
npm run dev
```

This will start:
- Backend server on http://localhost:3000
- Frontend client on http://localhost:5173

### Default Admin Credentials

- Username: `admin`
- Password: `admin123`

## Database Options

Funny Friends supports both **SQLite** (local development) and **PostgreSQL** (production/Render).

- **SQLite**: File-based, perfect for local development
- **PostgreSQL**: Production-grade, required for Render free tier (no disk support)

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for detailed database setup instructions.

## Deployment on Render

### Method 1: Using Render Dashboard (Blueprint) - RECOMMENDED

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

1. **Create PostgreSQL Database**:
   - Go to https://dashboard.render.com/
   - Click "New +" → "PostgreSQL"
   - Name: `funny-friends-db`
   - Select **Free** plan
   - Create Database

2. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - **Name**: `funny-friends`
   - **Environment**: `Node`
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm start`

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=<generate-a-strong-secret>
   DATABASE_URL=<copy-from-postgresql-service>
   ```

4. **Deploy!**
   - Click "Create Web Service"
   - Render will build and deploy

## Environment Variables

### Server (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database file path | `file:./dev.db` |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### Client (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend API URL | Empty (same origin) |

## Building for Production

```bash
# Build the client
npm run build

# Start the production server
npm start
```

## Project Structure

```
funny-friends/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── context/       # React contexts
│   │   ├── components/    # Reusable components
│   │   └── config.js      # Centralized config
│   └── dist/              # Production build
├── server/                 # Express backend
│   ├── game/              # Game logic
│   ├── prisma/            # Database schema
│   └── server.js          # Entry point
├── package.json           # Root package.json
└── render.yaml            # Render deployment config
```

## Available Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build client for production
- `npm start` - Start production server
- `npm run render-build` - Build command for Render

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use this project for your own games!

## Future Roadmap

- [ ] Rummy game
- [ ] Poker game
- [ ] User avatars
- [ ] Game statistics
- [ ] Mobile app
- [ ] Spectator chat

---

Built with ❤️ for friends who love to play games together!
