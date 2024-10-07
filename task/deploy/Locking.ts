import { Locking } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { LockingParam } from "./param";
import { PredployedAddress } from "../../common/constants";
import { hash160, trimPubKeyPrefix } from "../../common/utils";
import { ethers } from "hardhat";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: LockingParam) => {
    console.log("Deploy Locking contact")

    const factory = await hre.ethers.getContractFactory("Locking")

    const [signer] = await hre.ethers.getSigners();

    const goatToken = await hre.ethers.getContractAt("GoatToken", PredployedAddress.goatToken)
    const reward = await goatToken.balanceOf(PredployedAddress.locking)

    console.log("Initial reward", reward);
    const lockiing: Locking = await factory.deploy(signer, PredployedAddress.goatToken, reward)

    if (param.tokens.length == 0) {
        throw new Error("no token config")
    }

    for (const token of param.tokens) {
        console.log("Adding token", token.address)
        await lockiing.addToken(token.address, BigInt(token.weight), BigInt(token.limit), BigInt(token.threshold))
    }

    const native = await lockiing.tokens(hre.ethers.ZeroAddress)
    if (!native.exist) {
        throw new Error("no native token config")
    }

    const network = await hre.ethers.provider.getNetwork();

    for (const config of param.validators) {
        console.log("Add validator", config)
        if (!hre.ethers.isAddress(config.owner)) {
            throw new Error(`owner ${config.owner} is not address`)
        }

        await signer.sendTransaction({ to: config.owner, value: native.threshold + BigInt(1e18) })
        const owner = await hre.ethers.getImpersonatedSigner(config.owner)
        if (config.prvkey) {
            const key = new hre.ethers.SigningKey(config.prvkey)
            const validator = hre.ethers.getAddress(hash160(trimPubKeyPrefix(key.compressedPublicKey)));
            const sig = key.sign(hre.ethers.solidityPackedKeccak256(
                ["uint256", "address", "address"],
                [network.chainId, validator, config.owner],
            ));
            const uncompressed = trimPubKeyPrefix(key.publicKey);
            const pubkey: any = [
                uncompressed.subarray(0, 32),
                uncompressed.subarray(32),
            ];
            await lockiing.connect(owner).create(pubkey, sig.r, sig.s, sig.v, { value: native.threshold });
        } else if (config.pubkey && config.signature) {
            const uncompressed = trimPubKeyPrefix(hre.ethers.SigningKey.computePublicKey(config.pubkey, false));
            const pubkey: any = [
                uncompressed.subarray(0, 32),
                uncompressed.subarray(32),
            ];
            const sig = hre.ethers.Signature.from(config.signature)
            await lockiing.connect(owner).create(pubkey, sig.r, sig.s, sig.v, { value: native.threshold });
        } else {
            throw new Error("No valid signature found")
        }
    }

    console.log("Transfer back owner", param.owner)
    await lockiing.transferOwnership(param.owner)
    return lockiing.getAddress()
}
