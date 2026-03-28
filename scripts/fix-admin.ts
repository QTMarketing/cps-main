import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function fixAdminUser() {
  console.log("🔧 Fixing admin user...");

  try {
    // Update admin user email and password
    const hashedPassword = await bcrypt.hash("admin1234", 10);
    
    const admin = await prisma.user.update({
      where: { id: "cmh4jy99u0002rgk2joxgi0vc" },
      data: {
        email: "admin@quicktrackinc.com",
        passwordHash: hashedPassword,
      },
    });

    console.log("✅ Admin user updated:", admin.email);

    // Verify the fix
    const isValidPassword = await bcrypt.compare("admin1234", admin.passwordHash);
    console.log(`Admin password test: ${isValidPassword ? "✅ PASS" : "❌ FAIL"}`);

  } catch (error) {
    console.error("Error fixing admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminUser();


