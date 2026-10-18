import { SiweMessage, generateNonce } from "siwe";
import { z } from "zod";
import { supabase } from "../lib/client.js";
import { env } from "../lib/env.js";
import { COOKIE_NAME, signSession } from "../lib/jwt.js";
import { HttpError, handle, parse } from "../lib/errors.js";
import { addressSchema } from "../lib/validation.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd || env.cookieSameSite === "none",
  sameSite: env.cookieSameSite,
  path: "/",
};

// GET /api/auth/nonce?address=0x...
export const getNonce = handle(async (req, res) => {
  const { address } = parse(z.object({ address: addressSchema }), req.query);

  const nonce = generateNonce();
  const { error } = await supabase.from("auth_nonces").insert({
    nonce,
    address,
    expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
  });
  if (error) throw error;

  res.json({ nonce });
});

const verifyBody = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature"),
});


// POST /api/auth/verify
export const verifySignIn = handle(async (req, res) => {
  const { message, signature } = parse(verifyBody, req.body);

  // 1. Parse the message, then check chain, domain and signature
  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(message);
  } catch {
    throw new HttpError(400, "Invalid SIWE message");
  }
  if (siwe.chainId !== env.siweChainId) throw new HttpError(401, "Wrong chain");
  try {
    await siwe.verify({ signature, domain: env.siweDomain });
  } catch {
    throw new HttpError(401, "Invalid signature");
  }
  const address = siwe.address.toLowerCase();

  // 2. Use up the nonce in ONE query: it must exist, match this address, be unused and unexpired.
  //    Two requests racing with the same nonce can't both win.
  const { data: consumed, error: nonceError } = await supabase
    .from("auth_nonces")
    .update({ used: true })
    .eq("nonce", siwe.nonce)
    .eq("address", address)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select("nonce");
  if (nonceError) throw nonceError;
  if (!consumed || consumed.length === 0) throw new HttpError(401, "Invalid or expired nonce");

  // 3. First sign-in creates the user row (username stays null)
  const { error: userError } = await supabase
    .from("users")
    .upsert({ wallet: address }, { onConflict: "wallet", ignoreDuplicates: true });
  if (userError) throw userError;

  const token = signSession(address);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_MS });
  res.json({ token, address });
});

// POST /api/auth/logout
export const logout = handle(async (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
});