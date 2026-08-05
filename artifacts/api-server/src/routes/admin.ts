import { Router } from "express";
import { db, usersTable, filesTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authenticate, requireAdmin } from "../lib/jwt";

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get("/users", async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt
    }).from(usersTable);
    res.json(users);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || username.length < 3 || password.length < 8) {
      res.status(400).json({ error: "Invalid username or password length" });
      return;
    }

    const existingUser = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existingUser.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const [newUser] = await db.insert(usersTable).values({
      username,
      passwordHash,
      role: role || "user"
    }).returning({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt
    });

    res.status(201).json(newUser);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, isActive } = req.body;

    const [updatedUser] = await db.update(usersTable)
      .set({ role, isActive })
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt
      });

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const [deletedUser] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning({ id: usersTable.id });
    
    if (!deletedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.status(204).end();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db.update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt
      });

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [photoStats] = await db.select({ count: count() }).from(filesTable).where(eq(filesTable.mediaType, "photo"));
    const [videoStats] = await db.select({ count: count() }).from(filesTable).where(eq(filesTable.mediaType, "video"));
    const [storageStats] = await db.select({ totalSize: sum(filesTable.size) }).from(filesTable);

    res.json({
      totalUsers: userCount.count || 0,
      totalPhotos: photoStats.count || 0,
      totalVideos: videoStats.count || 0,
      totalStorageBytes: Number(storageStats.totalSize || 0)
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
