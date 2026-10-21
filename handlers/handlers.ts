import type { Result } from "ethers";
import "dotenv/config";
import { supabase } from "../lib/client.js"
import { getNftId } from "./nftIndex.js";
import { JsonRpcProvider, Contract } from "ethers";


// Info about the log, taken from the webhook payload (not from the event args)
export type EventContext = {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTime: string; // ISO string, from the block timestamp
};

//ensure NFT is gotten even if unavialable on NFT table

async function ensureNftId(tokenId: string, seller: string, ctx: EventContext) {
  const existing = await getNftId(supabase, tokenId);
  if (existing) return existing;

  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const nft = new Contract(
    process.env.NFT_CONTRACT_ADDRESS!,
    ["function tokenURI(uint256) view returns (string)"],
    provider
  );
  const uri = await nft.tokenURI(tokenId);

  const { error } = await supabase.from("nfts").upsert(
    { token_id: tokenId, owner_address: seller, token_uri: uri, created_at: ctx.blockTime },
    { onConflict: "token_id", ignoreDuplicates: true }
  );
  check(error, `backfill NFT #${tokenId}`);

  const id = await getNftId(supabase, tokenId);
  if (!id) throw new Error(`NFT #${tokenId} still missing after backfill`);
  return id;
}

// No retry loops here. If a write fails we THROW,
// the route returns 500, and Alchemy retries the whole webhook.
function check(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

// ---- Dispatcher: the route calls this once per decoded log ----
export async function handleEvent(name: string, args: Result, ctx: EventContext) {
  switch (name) {
    case "NFTCreated": // from NFTCollection.sol (different ABI than Marketplace)
      return handleNFTCreated(args, ctx);
    case "Listed":
      return handleListing(args, ctx);
    case "PriceUpdated":
      return handlePriceUpdated(args);
    case "ItemCancelled":
      return handleItemCancelled(args);
    case "ItemSold":
      return handleItemSold(args, ctx);
    case "FeeUpdated":
      return handleFeeUpdated(args);
    case "FeeRecipientUpdated":
      return handleSetFeeRecipient(args);
    case "PaymentTokenUpdated":
      return handlePaymentTokenStatus(args);
    default:
      console.log("Ignoring event:", name);
  }
}

// ---- DB events ----

async function handleNFTCreated(args: Result, ctx: EventContext) {
  const [user, nftId, nftURI] = args;

  // ignoreDuplicates: a replayed mint must not overwrite a row that has changed since
  const { error } = await supabase.from("nfts").upsert(
    {
      owner_address: user,
      token_uri: nftURI,
      token_id: nftId.toString(),
      created_at: ctx.blockTime,
    },
    { onConflict: "token_id", ignoreDuplicates: true }
  );
  check(error, `NFTCreated #${nftId}`);
}

async function handleListing(args: Result, ctx: EventContext) {
  const [listingId, seller, tokenId, price, paymentToken, featured] = args;
  const nft_id = await ensureNftId(tokenId.toString(), seller, ctx);

  const row = {
    listing_id: listingId.toString(),
    nft_id,
    seller_address: seller,
    price: price.toString(),
    payment_token: paymentToken,
    status: "active",
    listed_at: ctx.blockTime,
  };

  // Featured: store in "featured" only, skip "listings"
  if (featured) {
    const { error } = await supabase
      .from("featured")
      .upsert(row, { onConflict: "listing_id", ignoreDuplicates: true });
    check(error, `Listed (featured) ${listingId}`);
    return;
  }

  const { error } = await supabase
    .from("listings")
    .upsert(row, { onConflict: "listing_id", ignoreDuplicates: true });
  check(error, `Listed ${listingId}`);
}

async function handlePriceUpdated(args: Result) {
  const [listingId, newPrice] = args;

  const { error } = await supabase
    .from("listings")
    .update({ price: newPrice.toString() })
    .eq("listing_id", Number(listingId));
  check(error, `PriceUpdated ${listingId}`);
}

async function handleItemCancelled(args: Result) {
  const [listingId] = args; // args: listingId, seller

  const { error } = await supabase
    .from("listings")
    .update({ status: "cancelled" })
    .eq("listing_id", Number(listingId));
  check(error, `ItemCancelled ${listingId}`);
}

async function handleItemSold(args: Result, ctx: EventContext) {
  const [listingId, seller, buyer, nftContract, tokenId, price, fee, paymentToken] = args;
  console.log(listingId.toString())
  const nft_id = await ensureNftId(tokenId.toString(), seller, ctx);

  // Safe to run twice: unique on (tx_hash, log_index)
  const { error: saleError } = await supabase.from("sales").upsert(
    {
      listing_id: listingId.toString(),
      nft_id,
      nft_contract: nftContract,
      seller_address: seller,
      buyer_address: buyer,
      price: price.toString(),
      fee: fee.toString(),
      payment_token: paymentToken,
      tx_hash: ctx.txHash,
      log_index: ctx.logIndex,
      sold_at: ctx.blockTime,

    },
    { onConflict: "tx_hash, log_index", ignoreDuplicates: true }
  )
  check(saleError, `ItemSold insert ${listingId}`);
  console.error(JSON.stringify(saleError))

  const { error: listingError } = await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("listing_id", Number(listingId));
  check(listingError, `ItemSold status ${listingId}`);
}

// ---- Admin events (log only, not saved to DB) ----

async function handleFeeUpdated(args: Result) {
  const [newFeeBps] = args;
  console.log("Listing fee is now", newFeeBps.toString());
}

async function handleSetFeeRecipient(args: Result) {
  const [newRecipient] = args;
  console.log("Fee recipient is now", newRecipient.toString());
}

async function handlePaymentTokenStatus(args: Result) {
  const [paymentToken] = args;
  console.log("Payment token updated:", paymentToken.toString());
}