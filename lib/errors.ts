//lib/errors.ts
import type { Request, RequestHandler, Response } from "express";
import type { z } from "zod";

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

// Throw this for errors the client should see
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Wraps a controller. HttpError -> its status. Anything else -> logged, then a generic 500.
// Raw database messages are never sent to the client.
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error(`${req.method} ${req.originalUrl} failed:`, err);
      res.status(500).json({ error: "Something went wrong" });
    }
  };

// Validate input with zod, or throw a 400
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join(".") || "input";
    throw new HttpError(400, issue ? `${where}: ${issue.message}` : "Invalid input");
  }
  return result.data;
}