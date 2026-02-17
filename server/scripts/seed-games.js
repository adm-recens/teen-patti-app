// Seed data for game types and default admin user
const path = require('path');
// Load from project root .env.local for local dev (server/scripts -> server -> root)
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
const bcrypt = require('bcryptjs');
const prisma = require('../db');

async function main() {
  console.log('Seeding database...');
  const gameTypes = [
    {
      code: 'teen-patti',
      name: 'Teen Patti',
      description: 'The classic Indian card game. Bet, bluff, and win!',
      icon: '♠',
      color: 'from-purple-600 to-pink-600',
      maxPlayers: 17,
      minPlayers: 2,
      status: 'active',
      isActive: true
    },
    {
      code: 'rummy',
      name: 'Rummy',
      description: 'Form sets and sequences. Coming soon!',
      icon: '♦',
      color: 'from-orange-500 to-red-500',
      maxPlayers: 6,
      minPlayers: 2,
      status: 'coming-soon',
      isActive: false
    }
  ];

  for (const gameType of gameTypes) {
    await prisma.gameType.upsert({
      where: { code: gameType.code },
      update: gameType,
      create: gameType
    });
    console.log(`✓ Game type: ${gameType.name}`);
  }

  // Check if admin exists
  const adminExists = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!adminExists) {
    console.log('\n⚠️  No admin user found.');
    console.log('Please run setup to create the first admin user.');
    console.log(`Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/setup`);
  } else {
    // Grant admin access to all active games
    const activeGames = await prisma.gameType.findMany({
      where: { isActive: true }
    });

    for (const game of activeGames) {
      await prisma.userGamePermission.upsert({
        where: {
          userId_gameTypeId: {
            userId: adminExists.id,
            gameTypeId: game.id
          }
        },
        update: {},
        create: {
          userId: adminExists.id,
          gameTypeId: game.id,
          canCreate: true,
          canManage: true
        }
      });
    }
    console.log(`✓ Admin permissions updated for ${activeGames.length} games`);
  }

  console.log('\n✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
