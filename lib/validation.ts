//lib/validation.ts
import { z } from "zod";

// Any 0x address in, lowercase out
export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
  .transform((s) => s.toLowerCase());

export const uuidSchema = z.string().uuid("Invalid id");

export const usernameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_]{3,20}$/, "Must be 3-20 characters: letters, digits or underscore");

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty")
  .max(500, "Comment can be at most 500 characters");

export const limitSchema = z.coerce.number().int().min(1).max(50).default(20);

// Postgres gives "...+00:00". The "+" breaks in URLs, so cursors use "Z" instead.
export const toCursor = (timestamp: string) => timestamp.replace("+00:00", "Z");