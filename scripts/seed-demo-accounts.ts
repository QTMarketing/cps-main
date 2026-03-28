/*
  Seed demo accounts
  Usage: ts-node scripts/seed-demo-accounts.ts (or compile/run with ts-node/register)
*/
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const names = [
    { name: 'North Division', bankName: 'Bank of America' },
    { name: 'South Division', bankName: 'Chase Bank' },
    { name: 'Central Ops', bankName: 'Wells Fargo' },
    { name: 'West Stores', bankName: 'CitiBank' },
  ];

  for (const n of names) {
    await prisma.account.upsert({
      where: { name: n.name },
      update: { bankName: n.bankName, isActive: true },
      create: { name: n.name, bankName: n.bankName },
    });
  }

  console.log('✅ Seeded demo accounts');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



