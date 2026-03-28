import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function verifyUsers() {
  console.log("🔍 Verifying users...");

  try {
    const users = await prisma.user.findMany({
      include: {
        store: true,
      },
    });

    console.log(`Found ${users.length} users:`);
    
    for (const user of users) {
      console.log(`- ${user.username} (${user.email}) - Role: ${user.role}`);
      
      // Test password
      const testPassword = user.username === "admin" ? "admin1234" : 
                          user.username === "manager" ? "manager123" : "user123";
      
      const isValid = await bcrypt.compare(testPassword, user.passwordHash);
      console.log(`  Password valid: ${isValid}`);
    }

    // Test login for admin
    const admin = await prisma.user.findUnique({
      where: { email: "admin@quicktrackinc.com" },
    });

    if (admin) {
      const isValidPassword = await bcrypt.compare("admin1234", admin.passwordHash);
      console.log(`\nAdmin login test: ${isValidPassword ? "✅ PASS" : "❌ FAIL"}`);
    }

  } catch (error) {
    console.error("Error verifying users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyUsers();


