import jwt from "jsonwebtoken";
import { env } from "./env.js";

export const COOKIE_NAME = "session";

export function signSession(address: string): string {
  return jwt.sign({ address }, env.jwtSecret, { algorithm: "HS256", expiresIn: "7d" });
}

// Returns the lowercase address, or null if the token is bad or expired
export function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload === "string") return null;
    const address = payload.address;
    return typeof address === "string" && /^0x[a-f0-9]{40}$/.test(address) ? address : null;
  } catch {
    return null;
  }
}