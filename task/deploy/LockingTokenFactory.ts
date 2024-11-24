import { HardhatRuntimeEnvironment } from "hardhat/types";
import { LockingTokenFactory } from "../../typechain-types";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: any) => {
  console.log("Deploy LockingTokenFactory contact", param);

  const factory = await hre.ethers.getContractFactory("LockingTokenFactory");
  const lockingTokenFactory: LockingTokenFactory = await factory.deploy();
  return lockingTokenFactory.getAddress();
};
