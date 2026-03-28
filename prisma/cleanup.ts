import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting full cleanup (keeping admin user)...");

  // 1️⃣ Find admin user(s)
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        { username: "admin" },
      ],
    },
    select: { id: true, username: true },
  });

  if (admins.length === 0) {
    throw new Error("❌ No admin user found. ABORTING cleanup.");
  }

  const adminIds = admins.map(a => a.id);
  console.log("✅ Admins preserved:", admins);

  // 2️⃣ Delete everything else (order matters - child to parent)
  await prisma.check.deleteMany();
  await prisma.storeCheckSequence.deleteMany();
  await prisma.vendorBank.deleteMany();        // Delete bank-vendor join table
  await prisma.bankSigner.deleteMany();        // Delete bank-signer join table
  await prisma.signature.deleteMany();         // Delete signatures
  await prisma.signer.deleteMany();            // Delete signers
  await prisma.vendor.deleteMany();
  await prisma.bank.deleteMany();
  await prisma.storeUser.deleteMany();         // Delete store-user join table
  await prisma.store.deleteMany();
  await prisma.corporation.deleteMany();       // Delete corporations

  // 3️⃣ Delete all users EXCEPT admin(s)
  await prisma.user.deleteMany({
    where: {
      id: { notIn: adminIds },
    },
  });

  console.log("🎉 Cleanup complete. Database is fresh (admin preserved).");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
