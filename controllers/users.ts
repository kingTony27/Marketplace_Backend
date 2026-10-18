import { z } from "zod";
import { supabase } from "../lib/client.js";
import { HttpError, PG_UNIQUE_VIOLATION, handle, parse } from "../lib/errors.js";
import { addressSchema, usernameSchema } from "../lib/validation.js";

async function fetchUser(address: string) {
  const { data, error } = await supabase
    .from("users")
    .select("wallet, username")
    .eq("wallet", address)
    .maybeSingle();
  if (error) throw error;
  return { address, username: data?.username ?? null };
}

// GET /api/users/:address (public)
export const getUser = handle(async (req, res) => {
  const { address } = parse(z.object({ address: addressSchema }), req.params);
  res.json(await fetchUser(address));
});

// GET /api/users/me
export const getMe = handle(async (req, res) => {
  res.json(await fetchUser(req.userAddress!));
});

// PUT /api/users/me
export const updateMe = handle(async (req, res) => {
  const { username } = parse(z.object({ username: usernameSchema }), req.body);
  const address = req.userAddress!;

  // The unique index decides who wins, so there is no check-then-write race
 const { data, error } = await supabase
  .from("users")
  .update({ username })
  .eq("wallet", address)
  .is("username", null)
  .select("wallet");
  
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) throw new HttpError(409, "Username already taken");
    throw error;
  }

  res.json({ address, username });
});