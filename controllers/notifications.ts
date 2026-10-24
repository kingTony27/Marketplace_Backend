import type { Request } from "express";
import { supabase } from "../lib/client.js";
import { handle, HttpError, parse } from "../lib/errors.js";
import { addressSchema, uuidSchema, limitSchema } from "../lib/validation.js";

// Set by your auth middleware, e.g. req.user = { address: "0x..." }
const getAddress = (req: Request): string => {
  console.error("[notifications] req.user =", (req as any).user, "address =", (req as any).address, "locals =", (req as any).res?.locals);  
  const raw = (req as Request & { user?: { address?: string } }).user?.address;
  if (!raw) throw new HttpError(401, "Unauthorized");
  return parse(addressSchema, raw); // validated + lowercased
};

// get notifications for the current user, with optional limit (default 20)
export const getNotifications = handle(async (req, res) => {
  const address = getAddress(req);
  const limit = parse(limitSchema, req.query.limit);

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, href, read, created_at")
    .eq("user_address", address)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json(data);
});

// Mark a notification as read by ID (only if it belongs to the user)
export const markAsRead = handle(async (req, res) => {
  const address = getAddress(req);
  const id = parse(uuidSchema, req.params.id);

  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_address", address)
    .select("id");

  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Notification not found");
  res.json({ ok: true });
});

// Mark all notifications as read for the current user
export const markAllAsRead = handle(async (req, res) => {
  const address = getAddress(req);

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_address", address)
    .eq("read", false);

  if (error) throw error;
  res.json({ ok: true });
});

// delete a notification by ID (only if it belongs to the user)
export const deleteNotification = handle(async (req, res) => {
  const address = getAddress(req);
  const id = parse(uuidSchema, req.params.id);

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_address", address)
    .select("id");

  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Notification not found");
  res.json({ ok: true });
});