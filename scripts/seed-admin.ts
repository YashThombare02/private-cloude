import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  console.log("Seeding admin user...");
  try {
    const username = "admin";
    const password = "password123";

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    
    if (existing) {
      console.log("Admin user already exists!");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.insert(usersTable).values({
      username,
      password: hashedPassword,
      isAdmin: true,
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB limit
    });
    
    console.log("========================================");
    console.log("Admin user successfully created!");
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log("========================================");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed admin:", error);
    process.exit(1);
  }
}

seedAdmin();
