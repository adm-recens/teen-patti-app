# Clear Production Database Script

## Quick Steps

### 1. Copy Your DATABASE_URL from Render

1. Go to your **funny-friends-db** PostgreSQL service on Render
2. Copy the **Internal Database URL** 
   - Format: `postgresql://username:password@host:port/database`

### 2. Run the Clear Script

```bash
cd server

# Windows Command Prompt
set DATABASE_URL=postgresql://your-username:your-password@your-host:5432/your-database
node scripts/clear-db.js

# Windows PowerShell
$env:DATABASE_URL="postgresql://your-username:your-password@your-host:5432/your-database"
node scripts/clear-db.js

# Mac/Linux
export DATABASE_URL="postgresql://your-username:your-password@your-host:5432/your-database"
node scripts/clear-db.js
```

### 3. Or Create .env File

Create `server/.env`:
```env
DATABASE_URL=postgresql://your-username:your-password@your-host:5432/your-database
```

Then run:
```bash
cd server
node scripts/clear-db.js
```

## What This Does

- Deletes all game hands
- Deletes all players  
- Deletes all game sessions
- Deletes all users

This allows the setup page to appear when you deploy.

## Alternative: Reset Database Completely

If you prefer, you can delete and recreate the database on Render:

1. Go to **funny-friends-db** on Render Dashboard
2. Scroll down and click **"Destroy"**
3. Confirm deletion
4. Create a new PostgreSQL database with the same name
5. Copy the new DATABASE_URL
6. Update it in your **funny-friends** Web Service environment variables
7. Redeploy

This gives you a completely fresh database.

## After Clearing Database

1. Add `ADMIN_SETUP_KEY` to your Web Service environment variables
2. Redeploy the service
3. Visit your app URL
4. Complete the setup flow
