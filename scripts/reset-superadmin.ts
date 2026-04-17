import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/roles";

async function main() {
  const username = "admin@quicktrackinc.com";
  const password = process.env.NEW_SUPERADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "Missing NEW_SUPERADMIN_PASSWORD. Example: NEW_SUPERADMIN_PASSWORD='Admin123!' npx tsx scripts/reset-superadmin.ts"
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      password_hash: passwordHash,
      role: Role.SUPER_ADMIN,
    },
    create: {
      username,
      password_hash: passwordHash,
      role: Role.SUPER_ADMIN,
    },
    select: { id: true, username: true, role: true },
  });

  // Do not log the password or hash.
  console.log("[reset-superadmin] OK", { id: user.id, username: user.username, role: user.role });
}

main()
  .catch((err) => {
    console.error("[reset-superadmin] FAILED", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

