import { Relayer } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { RelayerParam } from "./param";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: RelayerParam) => {
    console.log("Deploy relayer");
    const factory = await hre.ethers.getContractFactory("Relayer")

    const [signer] = await hre.ethers.getSigners();
    const contract: Relayer = await factory.deploy(signer)

    for (const voter of param.voters) {
        console.log("Add relayer", voter)
        await contract.addVoter(voter.address, voter.blsKey)
    }

    console.log("Transfer back relayer owner", param.owner)
    await contract.transferOwnership(param.owner)
    return contract.getAddress()
}
