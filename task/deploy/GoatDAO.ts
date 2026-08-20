import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { PredployedAddress } from "../../common/constants.js";
import type { EmptyParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  _param: EmptyParam,
) => {
  console.log("Deploy goat DAO");
  const { viem } = await hre.network.getOrCreate();
  const contract = await viem.deployContract("GoatDAO", [
    PredployedAddress.goatToken,
  ]);
  return contract.address;
};
