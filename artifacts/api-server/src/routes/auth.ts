import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authenticate, signToken, requireAdmin } from "../lib/jwt";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials or account disabled" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.status(204).end();
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const { userId } = res.locals.user;
    
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user || !user.isActive) {
      const isProd = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
      });
      res.status(401).json({ error: "Account disabled or not found" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
