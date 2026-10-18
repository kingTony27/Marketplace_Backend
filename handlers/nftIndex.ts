import type { SupabaseClient } from "@supabase/supabase-js";

// Looks up the internal `nfts.id` (UUID) for a token.
// Only your own NFTCollection mints into `nfts`, so token_id alone is enough.
export async function getNftId(
  supabase: SupabaseClient,
  tokenId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("nfts")
    .select("id")
    .eq("token_id", tokenId)
    .single();

  if (error) {
    console.error(`getNftId: no nft found for token #${tokenId}:`, error.message);
    return null;
  }
  return data.id;
}