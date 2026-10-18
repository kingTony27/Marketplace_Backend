import { z } from "zod";
import { supabase } from "../lib/client.js";
import { HttpError, handle, parse } from "../lib/errors.js";
import { commentBodySchema, limitSchema, toCursor, uuidSchema } from "../lib/validation.js";

const nftParams = z.object({ nftId: uuidSchema });
const listQuery = z.object({
  limit: limitSchema,
  before: z.string().datetime({ offset: true }).optional(),
});

const COMMENT_COLUMNS = "id, body, created_at, author_address, author:users(username)";

function toComment(row: any) {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: { address: row.author_address, username: author?.username ?? null },
  };
}

// GET /api/nfts/:nftId/comments?limit=20&before=<cursor>
export const listComments = handle(async (req, res) => {
  const { nftId } = parse(nftParams, req.params);
  const { limit, before } = parse(listQuery, req.query);

  let query = supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("nft_id", nftId)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // one extra row tells us if there is a next page
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? toCursor(page[page.length - 1].created_at) : null;

  res.json({ comments: page.map(toComment), nextCursor });
});

// POST /api/nfts/:nftId/comments
export const createComment = handle(async (req, res) => {
  const { nftId } = parse(nftParams, req.params);
  const { body } = parse(z.object({ body: commentBodySchema }), req.body);

  const { data: nft, error: nftError } = await supabase
    .from("nfts")
    .select("id")
    .eq("id", nftId)
    .maybeSingle();
  if (nftError) throw nftError;
  if (!nft) throw new HttpError(404, "NFT not found");

  const { data, error } = await supabase
    .from("comments")
    .insert({ nft_id: nftId, author_address: req.userAddress!, body })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) throw error;

  res.status(201).json(toComment(data));
});

// DELETE /api/comments/:commentId
export const deleteComment = handle(async (req, res) => {
  const { commentId } = parse(z.object({ commentId: uuidSchema }), req.params);

  const { data, error } = await supabase
    .from("comments")
    .select("author_address")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Comment not found");
  if (data.author_address !== req.userAddress) {
    throw new HttpError(403, "You can only delete your own comments");
  }

  const { error: deleteError } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_address", req.userAddress!);
  if (deleteError) throw deleteError;

  res.status(204).end();
});