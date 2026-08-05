import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey-change-in-production";

export function signToken(payload: { userId: number; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch (err) {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.locals.user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
