import { z } from "zod";
import { supabase } from "../lib/client.js";
import { handle, parse } from "../lib/errors.js";
import { addressSchema, limitSchema } from "../lib/validation.js";

const addressParams = z.object({ address: addressSchema });
const paging = z.object({
  limit: limitSchema,
  offset: z.coerce.number().int().min(0).default(0),
});

// Every NFT currently for sale, newest first (listings table)
export const getAllListed = handle(async (req, res) => {
  const { limit, offset } = parse(paging, req.query);

  const { data, error } = await supabase
    .from("listings")
    .select("listing_id, nft_id, seller_address, price, payment_token, listed_at")
    .eq("status", "active")
    .not("nft_id", "is", null)
    .order("listed_at", { ascending: false })
    .order("listing_id", { ascending: false })
    .range(offset, offset + limit); // limit + 1 rows; the extra one means "more pages"
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const nfts = await fetchNfts(page.map((row) => row.nft_id));

  const items = page.flatMap((row) => {
    const nft = nfts.get(row.nft_id);
    if (!nft) return [];
    return [
      {
        ...toNft(nft),
        listingId: String(row.listing_id),
        seller: row.seller_address,
        price: String(row.price),
        paymentToken: row.payment_token,
        listedAt: row.listed_at,
      },
    ];
  });

  res.json({ items, nextOffset: rows.length > limit ? offset + limit : null });
});

// GET all nft's added to featured table, newest first (featured table)
export const getFeatured = handle(async (req, res) => {
  const { limit, offset } = parse(paging, req.query);

  const { data, error } = await supabase
    .from("featured")
    .select("listing_id, nft_id, seller_address, price, payment_token, listed_at")
    .eq("status", "active")
    .not("nft_id", "is", null)
    .order("listed_at", { ascending: false })
    .order("listing_id", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const nfts = await fetchNfts(page.map((row) => row.nft_id));

  const items = page.flatMap((row) => {
    const nft = nfts.get(row.nft_id);
    if (!nft) return [];
    return [
      {
        ...toNft(nft),
        listingId: String(row.listing_id),
        seller: row.seller_address,
        price: String(row.price),
        paymentToken: row.payment_token,
        listedAt: row.listed_at,
      },
    ];
  });

  res.json({ items, nextOffset: rows.length > limit ? offset + limit : null });
});

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

// NFTs this wallet owns right now and has not listed
export const getGallery = handle(async (req, res) => {
  const { address } = parse(addressParams, req.params);
  const { limit, offset } = parse(paging, req.query);

  const { data, error } = await supabase
    .from("nft_holdings")
    .select("nft_id, acquired_at, last_sale_price")
    .eq("owner_address", address)
    .order("acquired_at", { ascending: false })
    .order("nft_id", { ascending: false })
    .range(offset, offset + limit); // limit + 1 rows; the extra one means "more pages"
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const nfts = await fetchNfts(page.map((row) => row.nft_id));

  const items = page.flatMap((row) => {
    const nft = nfts.get(row.nft_id);
    if (!nft) return [];
    return [
      {
        ...toNft(nft),
        acquiredAt: row.acquired_at,
        lastSalePrice: row.last_sale_price === null ? null : String(row.last_sale_price),
      },
    ];
  });

  res.json({ items, nextOffset: rows.length > limit ? offset + limit : null });
});

// NFTs this wallet currently has for sale
export const getListed = handle(async (req, res) => {
  const { address } = parse(addressParams, req.params);
  const { limit, offset } = parse(paging, req.query);

  const { data, error } = await supabase
    .from("listings")
    .select("listing_id, nft_id, price, payment_token, listed_at")
    .eq("seller_address", address)
    .eq("status", "active")
    .not("nft_id", "is", null)
    .order("listed_at", { ascending: false })
    .order("listing_id", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const nfts = await fetchNfts(page.map((row) => row.nft_id));

  const items = page.flatMap((row) => {
    const nft = nfts.get(row.nft_id);
    if (!nft) return [];
    return [
      {
        ...toNft(nft),
        listingId: String(row.listing_id),
        price: String(row.price),
        paymentToken: row.payment_token,
        listedAt: row.listed_at,
      },
    ];
  });

  res.json({ items, nextOffset: rows.length > limit ? offset + limit : null });
});