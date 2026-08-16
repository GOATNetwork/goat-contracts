import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { inspect } from "node:util";

import type { EmptyParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: EmptyParam,
) => {
  console.log("Deploy WrappedBitcoin with", inspect(param));
  const { viem } = await hre.network.getOrCreate();
  const contract = await viem.deployContract("WrappedGoatBitcoin");
  return contract.address;
};
