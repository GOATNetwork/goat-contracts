import { WrappedGoatBitcoin } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { inspect } from "node:util";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: any) => {
    console.log("Deploy WrappedBitcoin with", inspect(param));
    const factory = await hre.ethers.getContractFactory("WrappedGoatBitcoin")
    const contract: WrappedGoatBitcoin = await factory.deploy()
    return contract.getAddress()
}