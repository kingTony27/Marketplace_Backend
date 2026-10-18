import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTCollectionModule", (m) => {
  const name = m.getParameter("name", "Marketplace NFTs");
  const symbol = m.getParameter("symbol", "MNFT");

  const nftCollection = m.contract("NFTCollection", [name, symbol]);

  return { nftCollection };
});