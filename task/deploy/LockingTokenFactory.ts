import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import type { EmptyParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: EmptyParam,
) => {
  console.log("Deploy LockingTokenFactory contact", param);
  const { viem } = await hre.network.getOrCreate();
  const contract = await viem.deployContract("LockingTokenFactory");
  return contract.address;
};
