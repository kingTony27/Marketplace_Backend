import { z } from "zod";
import { supabase } from "../lib/client.js";
import { HttpError, PG_FOREIGN_KEY_VIOLATION, handle, parse } from "../lib/errors.js";
import { uuidSchema } from "../lib/validation.js";

const nftParams = z.object({ nftId: uuidSchema });

// PUT /api/nfts/:nftId/like  (liking twice is fine)
export const likeNft = handle(async (req, res) => {
  const { nftId } = parse(nftParams, req.params);

  const { error } = await supabase
    .from("likes")
    .upsert(
      { nft_id: nftId, user_address: req.userAddress! },
      { onConflict: "nft_id,user_address", ignoreDuplicates: true }
    );
  if (error) {
    if (error.code === PG_FOREIGN_KEY_VIOLATION) throw new HttpError(404, "NFT not found");
    throw error;
  }

  res.json({ liked: true });
});

// DELETE /api/nfts/:nftId/like  (unliking twice is fine)
export const unlikeNft = handle(async (req, res) => {
  const { nftId } = parse(nftParams, req.params);

  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("nft_id", nftId)
    .eq("user_address", req.userAddress!);
  if (error) throw error;

  res.json({ liked: false });
});

// GET /api/nfts/:nftId/likes  (likedByMe only when a valid token is sent)
export const getLikes = handle(async (req, res) => {
  const { nftId } = parse(nftParams, req.params);

  const { count, error } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("nft_id", nftId);
  if (error) throw error;

  const me = req.userAddress;
  if (!me) {
    res.json({ count: count ?? 0 });
    return;
  }

  const { data, error: mineError } = await supabase
    .from("likes")
    .select("nft_id")
    .eq("nft_id", nftId)
    .eq("user_address", me)
    .maybeSingle();
  if (mineError) throw mineError;

  res.json({ count: count ?? 0, likedByMe: Boolean(data) });
});