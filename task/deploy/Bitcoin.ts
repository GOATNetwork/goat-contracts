import { Bitcoin } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { BitcoinParam } from "./param";
import { inspect } from "node:util";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: BitcoinParam) => {
    if (param.hash.startsWith("0x")) {
        param.hash = param.hash.slice(2)
    }
    param.hash = "0x" + Buffer.from(param.hash, "hex").reverse().toString("hex")
    console.log("Deploy bitcoin with", inspect(param));
    const factory = await hre.ethers.getContractFactory("Bitcoin")
    const contrat: Bitcoin = await factory.deploy(param.height, param.hash, param.network)
    return contrat.getAddress()
}
