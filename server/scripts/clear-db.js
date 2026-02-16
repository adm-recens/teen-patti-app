// Temporary script to clear database
// Run this locally with: node clear-db.js

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function clearDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Clearing database...');
    
    // Delete in order to respect foreign keys
    await prisma.gameHand.deleteMany();
    console.log('✓ Deleted game hands');
    
    await prisma.player.deleteMany();
    console.log('✓ Deleted players');
    
    await prisma.gameSession.deleteMany();
    console.log('✓ Deleted game sessions');
    
    await prisma.user.deleteMany();
    console.log('✓ Deleted users');
    
    console.log('\n✅ Database cleared successfully!');
    console.log('You can now deploy and use the setup flow.');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

// Get DATABASE_URL from user input or environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found!');
  console.log('\nPlease set it as an environment variable:');
  console.log('  Windows: set DATABASE_URL=your-render-database-url');
  console.log('  Mac/Linux: export DATABASE_URL=your-render-database-url');
  console.log('\nOr create a .env file with DATABASE_URL=your-render-database-url');
  process.exit(1);
}

clearDatabase();
