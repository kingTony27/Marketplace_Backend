import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});

// Per signed-in user. Put it AFTER requireAuth in the route.
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userAddress ?? "anonymous",
  message: { error: "You are commenting too fast, slow down" },
});