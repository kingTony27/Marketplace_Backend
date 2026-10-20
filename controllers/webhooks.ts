// src/controllers/alchemyWebhook.ts

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
    console.error("[webhook] ALCHEMY_SIGNING_KEY is not set");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  if (!process.env.MARKETPLACE_CONTRACT_ADDRESS || !process.env.NFT_CONTRACT_ADDRESS) {
    console.error("[webhook] contract address env missing", {
      MARKETPLACE_CONTRACT_ADDRESS: Boolean(process.env.MARKETPLACE_CONTRACT_ADDRESS),
      NFT_CONTRACT_ADDRESS: Boolean(process.env.NFT_CONTRACT_ADDRESS),
    });
  }
  if (!Buffer.isBuffer(req.body)) {
    // express.json() ran before this route and already parsed the body
    console.error("[webhook] Raw body missing: mount this route BEFORE express.json()", {
      bodyType: typeof req.body,
    });
    return res.status(500).json({ error: "Server misconfigured" });
  }

  // 1. The RAW body (a Buffer, because the route uses express.raw)
  const raw = req.body.toString("utf8");

  // 2. Auth: is this really from Alchemy?
  const signature = req.header("x-alchemy-signature");
  if (!signature) {
    console.error("[webhook] Rejected: x-alchemy-signature header missing");
    return res.status(401).json({ error: "Invalid signature" });
  }
  let signatureOk = false;
  try {
    signatureOk = isValidSignature(raw, signature, SIGNING_KEY);
  } catch (err) {
    console.error("[webhook] Signature check threw:", err);
  }
  if (!signatureOk) {
    console.error("[webhook] Rejected: signature does not match (check ALCHEMY_SIGNING_KEY)");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 3. Parse
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error("[webhook] Invalid JSON body:", err, { preview: raw.slice(0, 200) });
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // 4. Find the block in the payload (the shape comes from YOUR GraphQL query)
  const block = payload?.event?.data?.block;
  if (!block) {
    console.error("[webhook] Unexpected payload shape, no event.data.block", {
      keys: Object.keys(payload ?? {}),
      eventKeys: Object.keys(payload?.event ?? {}),
    });
    return res.status(400).json({ error: "Unexpected payload" });
  }
  const logs: any[] = block.logs ?? [];
  console.log(`[webhook] Received block ${block.number} with ${logs.length} log(s)`);

  try {
    const blockNumber = Number(block.number);
    const blockTime = new Date(Number(block.timestamp) * 1000).toISOString();
    if (Number.isNaN(blockNumber) || blockTime === "Invalid Date") {
      throw new Error(`Bad block fields: number=${block.number} timestamp=${block.timestamp}`);
    }

    // 5. In order, one at a time. Listed must finish before ItemSold.
    const ordered = [...logs].sort((a, b) => Number(a.index) - Number(b.index));

    for (const log of ordered) {
      const address = String(log.account?.address).toLowerCase();
      const txHash = log.transaction?.hash;
      const where = { txHash, logIndex: log.index, address };

      const iface = interfaces.get(address);
      if (!iface) {
        console.warn("[webhook] Skipping log from unknown contract", where);
        continue; // not one of our contracts
      }

      let parsed: ethers.LogDescription | null;
      try {
        parsed = iface.parseLog({ topics: log.topics, data: log.data });
      } catch (err) {
        console.error("[webhook] parseLog threw", where, err);
        continue;
      }
      if (!parsed) {
        console.warn("[webhook] Skipping log, event not in ABI (stale ABI?)", {
          ...where,
          topic0: log.topics?.[0],
        });
        continue; // event not in the ABI
      }

      if (!txHash) {
        throw new Error(`Log ${log.index} has no transaction hash`);
      }

      console.log("[webhook] Handling event:", parsed.name, where);
      try {
        await handleEvent(parsed.name, parsed.args, {
          txHash,
          logIndex: Number(log.index),
          blockNumber,
          blockTime,
        });
      } catch (err) {
        // Add context, then rethrow so the outer catch returns 500 and Alchemy retries
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`handleEvent(${parsed.name}) failed for tx ${txHash} log ${log.index}: ${reason}`);
      }
    }

    // 6. Done
    console.log(`[webhook] Block ${block.number} processed OK`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // 500 = "I failed", so Alchemy retries
    console.error("[webhook] Processing failed:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
}