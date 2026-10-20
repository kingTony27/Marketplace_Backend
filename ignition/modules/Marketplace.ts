import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import "dotenv/config";
const NFT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;
if (!NFT_ADDRESS) {
  throw new Error("NFT_CONTRACT_ADDRESS is not set in .env");
}

export default buildModule("MarketplaceModule", (m) => {

  const feeRecipient = m.getParameter("feeRecipient", m.getAccount(0)); //account that deploys contract is default fee recipient
  const feeBps = m.getParameter("feeBps", 500n); // 500 bps = 5%
  const featuredFeeBps = m.getParameter("featuredFeeBps", 1000n); // 1000 bps = 10%

  // already deployed NFTCollection contract, so we can just get its address and pass it to Marketplace constructor
  const nftCollection = m.contractAt("NFTCollection", NFT_ADDRESS);

  const marketplace = m.contract("Marketplace", [feeRecipient, feeBps, featuredFeeBps, nftCollection]);

  return { nftCollection, marketplace };
});