import { Relayer } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { RelayerParam } from "./param";
import { hash160, sha256, trim0xPrefix } from "../../common/utils";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: RelayerParam) => {
    console.log("Deploy relayer");
    const factory = await hre.ethers.getContractFactory("Relayer")

    const [signer] = await hre.ethers.getSigners();
    const contract: Relayer = await factory.deploy(signer)

    for (const voter of param.voters) {
        if ('address' in voter && voter.address && voter.voteKeyHash) {
            console.log("Add relayer from pubkey hash", voter)
            await contract.addVoter(voter.address, voter.voteKeyHash)
        } else if ('txKey' in voter && voter.txKey && voter.voteKey) {
            const txKey = Buffer.from(trim0xPrefix(voter.txKey), "hex")
            if (txKey.length != 33) {
                throw new Error("invalid voter tx key length")
            }
            if (txKey[0] !== 2 && txKey[0] !== 3) {
                throw new Error("invalid voter tx key prefix")
            }
            const address = hre.ethers.getAddress(hash160(txKey))
            const blsKey = Buffer.from(trim0xPrefix(voter.voteKey), "hex");
            if (blsKey.length != 96) {
                throw new Error("invalid bls key length")
            }
            const voteKeyHash = "0x" + sha256(blsKey)
            console.log("Add relayer from pubkey", { address, voteKeyHash })
            await contract.addVoter(address, voteKeyHash)
        } else {
            throw new Error("No valid voter config")
        }
    }

    console.log("Transfer back relayer owner to", param.owner)
    await contract.transferOwnership(param.owner)
    return contract.getAddress()
}
