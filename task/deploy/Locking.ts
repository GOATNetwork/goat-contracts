import { Locking } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { LockingParam } from "./param";
import { PredployedAddress } from "../../common/constants";
import { hash160, trimPubKeyPrefix } from "../../common/utils";

export const deploy = async (
    hre: HardhatRuntimeEnvironment,
    param: LockingParam,
) => {
    console.log("Deploy Locking contact");

    const factory = await hre.ethers.getContractFactory("Locking");

    const [signer] = await hre.ethers.getSigners();

    const goatToken = await hre.ethers.getContractAt(
        "GoatToken",
        PredployedAddress.goatToken,
    );
    const reward = await goatToken.balanceOf(PredployedAddress.locking);

    console.log("Initial reward", reward);
    const locking: Locking = await factory.deploy(
        signer,
        PredployedAddress.goatToken,
        reward,
    );

    if (param.tokens.length == 0) {
        throw new Error("no token config");
    }

    for (const item of param.tokens) {
        console.log("Adding token", item.address);
        const threshold = BigInt(item.threshold);
        const token = item.address.toLowerCase()
        if (token === hre.ethers.ZeroAddress) {
            if (threshold === 0n) {
                throw new Error("native token should have threshold value")
            }
        } else if (token != PredployedAddress.goatToken.toLowerCase()) {
            if (threshold != 0n) {
                throw new Error(`non goat erc20 ${token} has threshold value`)
            }
        }

        await locking.addToken(
            item.address,
            BigInt(item.weight),
            BigInt(item.limit),
            BigInt(item.threshold),
        );
    }

    const native = await locking.tokens(hre.ethers.ZeroAddress);
    if (!native.exist) {
        throw new Error("no native token config");
    }

    const goat = await locking.tokens(PredployedAddress.goatToken)
    const network = await hre.ethers.provider.getNetwork();

    for (const config of param.validators) {
        console.log("Add validator", config);
        if (!hre.ethers.isAddress(config.owner)) {
            throw new Error(`owner ${config.owner} is not address`);
        }

        const balance = await hre.ethers.provider.getBalance(config.owner);
        if (balance < native.threshold) {
            if (param.strict) {
                throw new Error(
                    `No deposit for genesis validator owner` + config.owner,
                );
            } else {
                await signer.sendTransaction({ to: config.owner, value: native.threshold });
            }
        }

        // send gas
        await signer.sendTransaction({ to: config.owner, value: BigInt(1e18) });
        const owner = await hre.ethers.getImpersonatedSigner(config.owner);
        if (goat.exist && goat.threshold > 0n) {
            const tokenBalance = await goatToken.balanceOf(config.owner)
            if (tokenBalance < goat.threshold) {
                throw new Error(
                    `No enough goat balance for genesis validator owner` + config.owner,
                );
            }
            await goatToken.connect(owner).approve(locking, hre.ethers.MaxUint256)
        }

        if ("prvkey" in config && config.prvkey) {
            const key = new hre.ethers.SigningKey(config.prvkey);
            const validator = hre.ethers.getAddress(
                hash160(trimPubKeyPrefix(key.compressedPublicKey)),
            );
            const sig = key.sign(
                hre.ethers.solidityPackedKeccak256(
                    ["uint256", "address", "address"],
                    [network.chainId, validator, config.owner],
                ),
            );
            const uncompressed = trimPubKeyPrefix(key.publicKey);
            const pubkey: any = [
                uncompressed.subarray(0, 32),
                uncompressed.subarray(32),
            ];
            await locking
                .connect(owner)
                .create(pubkey, sig.r, sig.s, sig.v, { value: native.threshold });
        } else if ("pubkey" in config && config.pubkey && config.signature) {
            const uncompressed = trimPubKeyPrefix(
                hre.ethers.SigningKey.computePublicKey(config.pubkey, false),
            );
            const pubkey: any = [
                uncompressed.subarray(0, 32),
                uncompressed.subarray(32),
            ];
            const sig = hre.ethers.Signature.from(config.signature);
            await locking
                .connect(owner)
                .create(pubkey, sig.r, sig.s, sig.v, { value: native.threshold });
        } else {
            throw new Error("No valid signature found");
        }
    }

    console.log("Transfer back owner", param.owner);
    await locking.transferOwnership(param.owner);
    return locking.getAddress();
};
