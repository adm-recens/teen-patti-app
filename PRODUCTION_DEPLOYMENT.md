# Production Deployment Guide

## Render Deployment

This guide covers deploying to Render.com using their managed PostgreSQL and Web Services.

## Prerequisites

- Render.com account
- GitHub repository with your code
- All environment variables configured

## Step-by-Step Deployment

### 1. Create PostgreSQL Database

1. In Render Dashboard, click **"New"** → **"PostgreSQL"**
2. Name: `funny-friends-db`
3. Region: Choose closest to your users (e.g., Oregon)
4. Instance Type: **Free** (or paid for production)
5. Click **"Create Database"**

### 2. Configure Web Service

1. In Render Dashboard, click **"New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `funny-friends`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Build Command:** `npm run render-build`
   - **Start Command:** `npm start`

### 3. Set Environment Variables

In your Web Service settings, add these environment variables:

#### Required Variables
```
NODE_ENV=production
PORT=10000
JWT_SECRET=<generate-64-char-random-string>
ADMIN_SETUP_KEY=<generate-32-char-random-string>
CLIENT_URL=https://funny-friends.onrender.com
```

#### Database URL (Auto-populated if using Blueprint)
If not using Blueprint, copy the **Internal Database URL** from your PostgreSQL service:
```
DATABASE_URL=postgresql://username:password@host:port/database
```

**Generate secure keys:**
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ADMIN_SETUP_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. First-Time Setup

After deployment:

1. Open your app URL (e.g., `https://funny-friends.onrender.com`)
2. You'll be redirected to the setup page
3. Enter your `ADMIN_SETUP_KEY` and create the first admin account
4. Login with the credentials you created

## Important Security Notes

### 1. Never Expose Secrets
- ✅ `JWT_SECRET` and `ADMIN_SETUP_KEY` are encrypted by Render
- ✅ Never commit `.env` files to Git
- ✅ Use Render's environment variable UI

### 2. Admin Setup Key
- **One-time use only** - Once an admin is created, the setup endpoint is disabled
- **Keep it secret** - Anyone with this key can create an admin account
- **Rotate if compromised** - Change the key in Render if you suspect it's been exposed

### 3. Database Security
- ✅ Render PostgreSQL is encrypted at rest
- ✅ Internal connections use SSL
- ✅ Database is not publicly accessible (only via Internal URL)

### 4. HTTPS Only
- Render automatically provides HTTPS
- All cookies are secure (httpOnly, secure, sameSite)

## Post-Deployment Checklist

### Security
- [ ] Admin account created with strong password
- [ ] `ADMIN_SETUP_KEY` changed from default (if you used a temporary one)
- [ ] `JWT_SECRET` is a cryptographically secure random string
- [ ] No `.env` files in the repository

### Functionality
- [ ] Can access the app at your domain
- [ ] Login works with admin credentials
- [ ] Can create game sessions
- [ ] Can end sessions
- [ ] Database persists between deploys

### Monitoring
- [ ] Health check endpoint returns 200: `https://your-app.onrender.com/health`
- [ ] Check Render logs for any errors
- [ ] Test all user flows (admin, operator, guest)

## Troubleshooting

### Database Connection Issues
```
Error: DatabaseAccessDenied
```
**Solution:** Ensure `DATABASE_URL` is set correctly with the Internal Database URL from your PostgreSQL service.

### CORS Errors
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**Solution:** Check that `CLIENT_URL` matches your actual domain exactly (including https://).

### 502 Bad Gateway
**Solution:** 
- Check that `PORT` environment variable matches what your app listens on
- Check Render logs for startup errors

### Setup Key Not Working
**Solution:**
- Check that `ADMIN_SETUP_KEY` is set correctly in environment variables
- Ensure no users exist in the database (check Render PostgreSQL dashboard)

### Static Files Not Loading (404)
**Solution:**
- Ensure build completed successfully
- Check that `client/dist` folder exists after build
- Verify `NODE_ENV=production` is set

## Updating Production

### Deploy New Version
1. Push changes to GitHub main branch
2. Render automatically deploys
3. Monitor logs for any issues

### Database Migrations
⚠️ **Warning:** Be careful with migrations in production

1. Backup your database first
2. Test migrations locally with production data
3. Deploy during low-traffic periods
4. Monitor for errors after migration

### Rollback
If something goes wrong:
1. In Render Dashboard, go to your service
2. Click **"Manual Deploy"** → **"Deploy a specific commit"**
3. Select a previous working commit

## Using Render Blueprint (Infrastructure as Code)

You can use the included `render.yaml` to deploy automatically:

1. In Render Dashboard, click **"Blueprints"**
2. **"New Blueprint Instance"**
3. Connect your repository
4. Render will create all services automatically

Note: You'll still need to set `JWT_SECRET` and `ADMIN_SETUP_KEY` manually after creation.

## Performance Optimization

### Free Tier Limitations
- **Spin-down:** Services sleep after 15 minutes of inactivity
- **Cold start:** ~30 seconds to wake up
- **CPU/Memory:** Limited resources

### Tips
1. Enable caching headers for static assets
2. Use database connection pooling
3. Optimize images and assets
4. Consider upgrading for production use

## Security Headers

The app automatically sets these security headers (via Helmet.js):
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (in production)

## Rate Limiting

Production endpoints are protected by rate limiting:
- General API: 100 requests per 15 minutes per IP
- Login attempts: 5 attempts per 15 minutes per IP

## Support

For deployment issues:
1. Check Render Status: https://status.render.com
2. Review Render Docs: https://render.com/docs
3. Check application logs in Render Dashboard
4. Open an issue on GitHub

## Backup & Recovery

### Database Backups
Render PostgreSQL automatically creates daily backups. To restore:
1. Go to your PostgreSQL service in Render Dashboard
2. Click **"Recovery"** tab
3. Select a backup point
4. Follow the restore process

### Manual Backup
```bash
# Export data
pg_dump $DATABASE_URL > backup.sql

# Import data
psql $DATABASE_URL < backup.sql
```

## Monitoring

### Health Check Endpoint
```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Logs
View logs in Render Dashboard:
1. Go to your Web Service
2. Click **"Logs"** tab
3. Real-time logs are displayed

## Advanced Configuration

### Custom Domain
1. In Render Dashboard, go to your Web Service
2. Click **"Settings"**
3. Under **"Custom Domain"**, add your domain
4. Follow DNS configuration instructions

### Environment-Specific Settings
You can create multiple services for different environments:
- `funny-friends-staging`
- `funny-friends-production`

Each with their own database and environment variables.
