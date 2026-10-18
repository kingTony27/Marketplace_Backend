import { z } from "zod";
import { supabase } from "../lib/client.js";
import { handle, parse } from "../lib/errors.js";
import { addressSchema, limitSchema } from "../lib/validation.js";

// Views have no foreign keys to join on, so fetch the NFT details separately
async function fetchNfts(ids: string[]) {
  const byId = new Map<string, any>();
  if (ids.length === 0) return byId;

  const { data, error } = await supabase
    .from("nfts")
    .select("id, token_id, token_uri, created_at")
    .in("id", ids);
  if (error) throw error;

  for (const nft of data ?? []) byId.set(nft.id, nft);
  return byId;
}

const toNft = (nft: any) => ({
  id: nft.id,
  tokenId: nft.token_id,
  tokenUri: nft.token_uri,
  createdAt: nft.created_at,
});

const searchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});


// Searches listings (by description) and users (by username or wallet) at once
export const searchAll = handle(async (req, res) => {
  const { q, limit } = parse(searchQuery, req.query);
  // escape LIKE wildcards so user input can't act as a pattern
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const userCols = "username, wallet, avatar_url";
  const [listingsRes, byName, byWallet] = await Promise.all([
    supabase
      .from("listings")
      .select("listing_id, nft_id, seller_address, price, payment_token, description")
      .eq("status", "active")
      .not("nft_id", "is", null)
      .ilike("description", pattern)
      .order("listed_at", { ascending: false })
      .limit(limit),
    supabase.from("users").select(userCols).ilike("username", pattern).limit(limit),
    supabase.from("users").select(userCols).ilike("wallet", pattern).limit(limit),
  ]);
  for (const r of [listingsRes, byName, byWallet]) if (r.error) throw r.error;

  // merge the two user queries, dedupe by wallet
  const usersMap = new Map<string, any>();
  for (const u of [...(byName.data ?? []), ...(byWallet.data ?? [])]) {
    usersMap.set(String(u.wallet).toLowerCase(), u);
  }
  const users = [...usersMap.values()].slice(0, limit).map((u) => ({
    username: u.username,
    wallet: u.wallet,
    avatarUrl: u.avatar_url ?? null,
  }));

  const rows = listingsRes.data ?? [];
  const nfts = await fetchNfts(rows.map((r) => r.nft_id));
  const listings = rows.flatMap((row) => {
    const nft = nfts.get(row.nft_id);
    if (!nft) return [];
    return [
      {
        ...toNft(nft),
        listingId: String(row.listing_id),
        seller: row.seller_address,
        price: String(row.price),
        paymentToken: row.payment_token,
        description: row.description,
      },
    ];
  });

  res.json({ listings, users });
});