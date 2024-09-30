import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Genesis", (m) => {
  const goatFoundation = m.contract("GoatFoundation", [
    m.getParameter("goat.owner"),
  ]);

  const btcBlock = m.contract("Bitcoin", [
    m.getParameter("btc.height"),
    m.getParameter("btc.hash"),
    m.getParameter("btc.network"),
  ]);

  const wgbtc = m.contract("WrappedGoatBitcoin");
  const bridge = m.contract("Bridge", [m.getParameter("bridge.owner")]);

  const relayer = m.contract("Relayer", [m.getParameter("relayer.owner")]);

  return {
    goatFoundation,
    btcBlock,
    wgbtc,
    bridge,
    relayer,
  };
});
