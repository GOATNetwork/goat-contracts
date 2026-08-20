import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { bytesToHex } from "viem";

import type { BitcoinParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: BitcoinParam,
) => {
  if (param.hash.startsWith("0x")) {
    throw new Error("block hash has 0x prefix");
  }
  console.log("Deploy bitcoin with", param);
  const blockHash = bytesToHex(Buffer.from(param.hash, "hex").reverse());
  const { viem } = await hre.network.getOrCreate();
  const contract = await viem.deployContract("Bitcoin", [
    BigInt(param.height),
    blockHash,
    param.network,
  ]);
  return contract.address;
};
