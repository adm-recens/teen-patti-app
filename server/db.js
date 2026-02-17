// Database Connection Module
// Centralizes Prisma Client instantiation with PostgreSQL adapter
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

let prisma;

if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
        connectionString,
        // Use SSL in production (Render)
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
}

module.exports = prisma;
