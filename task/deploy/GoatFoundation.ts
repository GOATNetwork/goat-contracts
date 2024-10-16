import { GoatFoundation } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { GoatFoundationParam } from "./param";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: GoatFoundationParam) => {
    console.log("Deploy goat foundation with", param);

    const factory = await hre.ethers.getContractFactory("GoatFoundation")
    const contract: GoatFoundation = await factory.deploy(param.owner)
    return contract.getAddress()
}
