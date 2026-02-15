# Funny Friends - PostgreSQL Setup Guide

## Overview

Funny Friends supports both **SQLite** (for local development) and **PostgreSQL** (for production/Render).

- **Local Development**: Use SQLite (simple, file-based, no setup required)
- **Production/Render**: Use PostgreSQL (free tier on Render, scalable)

## Local Development with SQLite (Default)

### Quick Start

```bash
# Install dependencies
npm install

# Setup database (uses SQLite automatically)
cd server
cp .env.example .env
npx prisma db push

# Start development
npm run dev
```

That's it! SQLite database file will be created at `server/prisma/dev.db`.

## Local Development with PostgreSQL (Optional)

If you prefer to use PostgreSQL locally to match production:

### 1. Install PostgreSQL

**Windows**: Download from https://www.postgresql.org/download/windows/
**Mac**: `brew install postgresql`
**Linux**: `sudo apt-get install postgresql`

### 2. Create Database

```bash
# Start PostgreSQL
sudo service postgresql start  # Linux
brew services start postgresql  # Mac

# Create database
createdb funnyfriends
```

### 3. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/funnyfriends?schema=public"
JWT_SECRET="your-secret-key"
NODE_ENV=development
```

### 4. Setup Database

```bash
# Make sure you're using the PostgreSQL schema
cp prisma/schema.prisma prisma/schema.prisma.backup
cp prisma/schema.sqlite.prisma prisma/schema.sqlite.prisma.backup

# Copy PostgreSQL schema
cp prisma/schema.prisma prisma/schema.postgresql.prisma

# Generate client and push schema
npm run db:generate
npm run db:push
```

### 5. Start Development

```bash
npm run dev
```

## Render Deployment with PostgreSQL

### Method 1: Blueprint (Recommended)

The `render.yaml` file is already configured to create a PostgreSQL database:

1. **Push your code to GitHub**

2. **Connect to Render**:
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your repository

3. **Render will automatically**:
   - Create a PostgreSQL database service
   - Create a Web Service
   - Set the `DATABASE_URL` environment variable
   - Run migrations
   - Deploy your app

### Method 2: Manual Setup

#### Step 1: Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Name it: `funny-friends-db`
4. Select plan: **Free** (or paid if you need more)
5. Create Database

#### Step 2: Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `funny-friends`
   - **Environment**: `Node`
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm start`

#### Step 3: Set Environment Variables

Add these in your Web Service settings:

```
NODE_ENV=production
JWT_SECRET=<generate-a-strong-secret-here>
DATABASE_URL=<copy-from-postgresql-service>
```

**To get DATABASE_URL**:
- Go to your PostgreSQL service
- Copy the "Internal Connection String" or "External Connection String"
- It looks like: `postgresql://user:pass@host:5432/database`

#### Step 4: Deploy!

Click "Create Web Service" and Render will:
1. Build the application
2. Run Prisma migrations
3. Start the server

## Environment Variables Reference

### For SQLite (Local Development)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="local-dev-secret"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

### For PostgreSQL (Production)

```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
JWT_SECRET="your-production-secret-key"
PORT=10000
NODE_ENV=production
```

## Switching Between Databases

### From SQLite to PostgreSQL Locally

1. Backup your SQLite database (optional)
2. Update `.env` with PostgreSQL connection string
3. Run:
   ```bash
   cd server
   npx prisma migrate dev
   ```

### From PostgreSQL to SQLite Locally

1. Update `.env`:
   ```
   DATABASE_URL="file:./dev.db"
   ```
2. Run:
   ```bash
   cd server
   npm run db:push:sqlite
   ```

## Troubleshooting

### PostgreSQL Connection Errors

**Error**: `P1001: Can't reach database server`

**Solution**:
- Check if PostgreSQL is running: `sudo service postgresql status`
- Verify connection string in `.env`
- Check firewall settings

### Migration Errors

**Error**: `P3005: The database schema is not empty`

**Solution**:
```bash
cd server
npx prisma migrate reset
```

**Warning**: This will delete all data!

### Render Deployment Fails

**Error**: Database connection timeout

**Solution**:
- Make sure PostgreSQL service is created first
- Check that `DATABASE_URL` is correctly copied from the PostgreSQL service
- Verify the Web Service "dependsOn" is set (if using render.yaml)

## Database Schema

Both SQLite and PostgreSQL use the same schema structure:

- **User**: Authentication and roles
- **GameSession**: Game rooms and sessions
- **GameHand**: Individual hands/rounds played
- **Player**: Players in each session

The only difference is:
- **SQLite**: `logs` field is stored as String (JSON serialized)
- **PostgreSQL**: `logs` field is stored as native JSON

## Free Tier Limits (Render)

- **Web Service**: 512 MB RAM, sleeps after 15 min inactivity
- **PostgreSQL**: 1 GB storage, shared CPU
- **Bandwidth**: 100 GB/month

Perfect for small groups of friends playing occasionally!

## Upgrading

If you outgrow the free tier:

1. **Upgrade PostgreSQL**: Go to your database service → Settings → Upgrade
2. **Upgrade Web Service**: More RAM/CPU for better performance
3. **Keep your data**: Paid tiers include backups

## Questions?

- Check the main README.md for general setup
- Review DEPLOYMENT_STATUS.md for testing checklist
- Open an issue on GitHub for help
