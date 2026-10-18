import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarketplaceModule", (m) => {

  const feeRecipient = m.getParameter("feeRecipient", m.getAccount(0)); //account that deploys contract is default fee recipient
  const feeBps = m.getParameter("feeBps", 500n); // 500 bps = 5%
  const featuredFeeBps = m.getParameter("featuredFeeBps", 1000n); // 1000 bps = 10%

  // keeping this here so i can deploy both together
  const name = m.getParameter("name", "Marketplace NFTs");
  const symbol = m.getParameter("symbol", "MNFT");
  const nftCollection = m.contract("NFTCollection",  [name, symbol]);

  const marketplace = m.contract("Marketplace", [feeRecipient, feeBps, featuredFeeBps, nftCollection]);

  return { nftCollection, marketplace };
});