import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Genesis", (m) => {
  const goatToken = m.contract("GoatToken");
  const goatFoundation = m.contract("GoatFoundation", [
    m.getParameter("goat.owner"),
  ]);

  const btcBlock = m.contract("Bitcoin", [
    m.getParameter("btc.height"),
    m.getParameter("btc.hash"),
    m.getParameter("btc.network"),
  ]);

  const wgbtc = m.contract("WrappedGoatBitcoin");
  const bridge = m.contract("Bridge");

  return { goatToken, goatFoundation, btcBlock, wgbtc, bridge };
});
