import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockERC20Module", (m) => {
  const name = m.getParameter("name", "TestUSDC");
  const symbol = m.getParameter("symbol", "TUSDC");

  const mockERC20 = m.contract("MockERC20", [name, symbol, 1.0]);

  return { mockERC20 };
});