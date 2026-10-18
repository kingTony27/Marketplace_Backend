import type { Request, RequestHandler } from "express";
import { COOKIE_NAME, verifySession } from "../lib/jwt.js";

// Authorization header first, then the cookie
function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const cookie = req.cookies?.[COOKIE_NAME];
  return typeof cookie === "string" ? cookie : null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = readToken(req);
  const address = token ? verifySession(token) : null;
  if (!address) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.userAddress = address;
  next();
};

// Never rejects. Sets req.userAddress only when a valid token is present.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  const address = token ? verifySession(token) : null;
  if (address) req.userAddress = address;
  next();
};