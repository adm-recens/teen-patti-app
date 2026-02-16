# Local Development Setup Guide

## Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

## Quick Start

### 1. Clone and Install Dependencies
```bash
git clone https://github.com/adm-recens/teen-patti-app.git
cd teen-patti-app
npm run install-all
```

### 2. Environment Setup

#### Server Environment
Copy the example environment file and configure:
```bash
cd server
cp .env.example .env
```

Edit `.env` with your settings:
```env
# Database - SQLite for local development
DATABASE_URL="file:./dev.db"

# JWT Secret (generate a random string)
JWT_SECRET="your-local-dev-secret-min-32-chars"

# Admin Setup Key (for first-time setup)
ADMIN_SETUP_KEY="your-setup-key-min-10-chars"

# Development settings
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

**Generate secure keys:**
```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate ADMIN_SETUP_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Client Environment
The client uses an empty `.env` file for local development (same-origin requests):
```bash
cd client
cp .env.example .env.local
```

### 3. Database Setup

#### Initialize SQLite Database
```bash
cd server
npx prisma generate
npx prisma db push
```

This will create the SQLite database file at `server/prisma/dev.db`

### 4. First-Time Admin Setup

1. Start the development servers:
```bash
npm run dev
```

2. Open your browser to `http://localhost:5173`

3. You'll see a setup screen on first run. Use your `ADMIN_SETUP_KEY` to create the first admin user.

4. Login with the credentials you created.

## Development Workflow

### Running in Development Mode
```bash
# Start both client and server
npm run dev

# Or run separately:
npm run server  # Backend only
npm run client  # Frontend only
```

### Database Migrations
When you change the Prisma schema:
```bash
cd server
npx prisma migrate dev --name your_migration_name
```

### Reset Database
```bash
cd server
npx prisma migrate reset
# or
rm prisma/dev.db
npx prisma db push
```

### View Database
```bash
cd server
npx prisma studio
```

## Project Structure

```
teen-patti-app/
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
│   │   └── dev.db         # SQLite database (gitignored)
│   ├── game/              # Game logic
│   ├── server.js          # Main server file
│   └── package.json
└── package.json           # Root package.json
```

## Environment Variables Reference

### Server (.env)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret for JWT signing | 64-char random string |
| `ADMIN_SETUP_KEY` | Key for initial admin creation | 32-char random string |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:5173` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### Client (.env.local)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend URL (optional) | `http://localhost:3000` |

Leave empty for same-origin requests in production.

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or change the port in server/.env
PORT=3001
```

### Database Locked
```bash
# Remove lock file
rm server/prisma/dev.db-journal
```

### CORS Errors
Make sure `CLIENT_URL` in server/.env matches your actual client URL.

### Prisma Client Not Generated
```bash
cd server
npx prisma generate
```

## Security Notes for Development

1. **Never commit `.env` files** - They are already in `.gitignore`
2. **Use strong passwords** - Even in development
3. **Rotate secrets regularly** - Especially if you share the codebase
4. **Keep dependencies updated** - Run `npm audit` regularly

## Switching to PostgreSQL (Optional)

If you want to use PostgreSQL locally (matching production):

1. Install PostgreSQL locally
2. Create a database:
```sql
CREATE DATABASE funnyfriends;
CREATE USER funnyfriends WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE funnyfriends TO funnyfriends;
```

3. Update `.env`:
```env
DATABASE_URL="postgresql://funnyfriends:yourpassword@localhost:5432/funnyfriends?schema=public"
```

4. Push schema:
```bash
cd server
npx prisma db push
```

## Production Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for production deployment instructions.

## Support

For issues and questions:
- Check the [GitHub Issues](https://github.com/adm-recens/teen-patti-app/issues)
- Review the [Security Audit Report](./SECURITY_AUDIT.md)
