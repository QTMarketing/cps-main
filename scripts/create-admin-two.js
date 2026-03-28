import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'ADMIN',
      displayName: 'Admin User',
      isActive: true,
    },
    create: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'ADMIN',
      displayName: 'Admin User',
      isActive: true,
    },
  });

  console.log(`Admin user ensured. Username: admin, password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
