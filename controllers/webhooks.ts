// Put this at: src/controllers/alchemyWebhook.ts  (adjust the import paths to your project)

import type { Request, Response } from "express";
import { ethers } from "ethers";
import "dotenv/config";
import { isValidSignature } from "../middleware/verifyWebhooks.js";
import { handleEvent } from "../handlers/handlers.js";
import MarketplaceArtifact from "../artifacts/contracts/Marketplace.sol/Marketplace.json" with { type: "json" };
import NFTArtifact from "../artifacts/contracts/NFT.sol/NFTCollection.json" with { type: "json" };

const SIGNING_KEY = process.env.ALCHEMY_SIGNING_KEY ?? "";

// Pick the right ABI by which contract sent the log
const interfaces = new Map<string, ethers.Interface>([
  [(process.env.MARKETPLACE_CONTRACT_ADDRESS ?? "").toLowerCase(), new ethers.Interface(MarketplaceArtifact.abi)],
  [(process.env.NFT_CONTRACT_ADDRESS ?? "").toLowerCase(), new ethers.Interface(NFTArtifact.abi)],
]);

export async function alchemyWebhook(req: Request, res: Response) {
  // 0. Our own setup problems, not the caller's fault
  if (!SIGNING_KEY) {
    console.error("ALCHEMY_SIGNING_KEY is not set");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  if (!Buffer.isBuffer(req.body)) {
    // express.json() ran before this route and already parsed the body
    console.error("Raw body missing: mount this route BEFORE express.json()");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  // 1. The RAW body (a Buffer, because the route uses express.raw)
  const raw = req.body.toString("utf8");

  // 2. Auth: is this really from Alchemy?
  const signature = req.header("x-alchemy-signature");
  if (!signature || !isValidSignature(raw, signature, SIGNING_KEY)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 3. Parse
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // 4. Find the block in the payload (the shape comes from YOUR GraphQL query)
  const block = payload?.event?.data?.block;
  if (!block) {
    return res.status(400).json({ error: "Unexpected payload" });
  }
  const logs: any[] = block.logs ?? [];

  try {
    const blockNumber = Number(block.number);
    const blockTime = new Date(Number(block.timestamp) * 1000).toISOString();

    // 5. In order, one at a time. Listed must finish before ItemSold.
    const ordered = [...logs].sort((a, b) => Number(a.index) - Number(b.index));

    for (const log of ordered) {
      const iface = interfaces.get(String(log.account?.address).toLowerCase());
      if (!iface) continue; // not one of our contracts

      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) continue; // event not in the ABI

      await handleEvent(parsed.name, parsed.args, {
        txHash: log.transaction.hash,
        logIndex: Number(log.index),
        blockNumber,
        blockTime,
      });
    }

    // 6. Done
    return res.status(200).json({ ok: true });
  } catch (err) {
    // 500 = "I failed", so Alchemy retries
    console.error("Webhook processing failed:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
}