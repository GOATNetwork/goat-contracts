import { HardhatRuntimeEnvironment } from "hardhat/types";
import { PredployedAddress } from "../../common/constants";
import { GoatDAO } from "../../typechain-types";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: any) => {
  console.log("Deploy goat DAO");
  const factory = await hre.ethers.getContractFactory("GoatDAO");
  const contract: GoatDAO = await factory.deploy(PredployedAddress.goatToken);
  return contract.getAddress();
};
