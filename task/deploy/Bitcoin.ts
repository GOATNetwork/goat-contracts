import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Bitcoin } from "../../typechain-types";
import { BitcoinParam } from "./param";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: BitcoinParam,
) => {
  if (param.hash.startsWith("0x")) {
    throw new Error("block hash has 0x prefix");
  }
  console.log("Deploy bitcoin with", param);
  const blockHash = Buffer.from(param.hash, "hex").reverse();
  const factory = await hre.ethers.getContractFactory("Bitcoin");
  const contrat: Bitcoin = await factory.deploy(
    param.height,
    blockHash,
    param.network,
  );
  return contrat.getAddress();
};
