import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { getAddress } from "viem";

import type { GoatFoundationParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: GoatFoundationParam,
) => {
  console.log("Deploy goat foundation with", param);
  const { viem } = await hre.network.getOrCreate();
  const contract = await viem.deployContract("GoatFoundation", [
    getAddress(param.owner),
  ]);
  return contract.address;
};
