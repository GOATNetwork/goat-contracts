import { HardhatRuntimeEnvironment } from "hardhat/types";
import { PredployedAddress } from "../../common/constants";
import { hash160, trimPubKeyPrefix } from "../../common/utils";
import { Locking } from "../../typechain-types";
import { LockingParam } from "./param";

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

  console.log("Deploying Locking contract");
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
    if (threshold < 0n) {
      throw new Error(`threshold ${item.threshold} can't be negative`);
    }
    const token = item.address.toLowerCase();
    if (token === hre.ethers.ZeroAddress) {
      if (threshold === 0n) {
        throw new Error("native token should have threshold value");
      }
    } else {
      if (threshold != 0n) {
        throw new Error(`erc20 ${token} can't have threshold value in genesis`);
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

  for (const config of param.validators) {
    console.log("Add validator", config);
    if (!hre.ethers.isAddress(config.owner)) {
      throw new Error(`owner ${config.owner} is not address`);
    }

    const balance = await hre.ethers.provider.getBalance(config.owner);
    if (param.strict) {
      if (balance != native.threshold) {
        throw new Error(
          `Deposit value for genesis validator owner ${config.owner} is not equal to threshold ${native.threshold}, got ${balance}`,
        );
      }
    } else {
      console.log(
        "WARN: Add deposit value for genesis validator owner",
        config.owner,
      );
      await signer.sendTransaction({
        to: config.owner,
        value: native.threshold,
      });
    }

    // send gas
    await signer.sendTransaction({ to: config.owner, value: BigInt(1e18) });
    const owner = await hre.ethers.getImpersonatedSigner(config.owner);
    const uncompressed = trimPubKeyPrefix(
      hre.ethers.SigningKey.computePublicKey(config.pubkey, false),
    );
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];
    const sig = hre.ethers.Signature.from(config.signature);
    const validatorPubkey = trimPubKeyPrefix(
      hre.ethers.SigningKey.computePublicKey(config.pubkey, true),
    );
    const validatorAddress = hre.ethers.getAddress(hash160(validatorPubkey));
    if (validatorAddress.toLowerCase() !== config.validator.toLowerCase()) {
      throw new Error(
        `Validator address mismatched: want ${config.validator} bug got ${validatorAddress}`,
      );
    }
    await locking.approve(validatorAddress);
    await locking
      .connect(owner)
      .create(pubkey, sig.r, sig.s, sig.v, { value: native.threshold });
  }

  for (const validator of param.allowList) {
    console.log("Add address", validator, "to allow list");
    if (!hre.ethers.isAddress(validator)) {
      throw new Error(`${validator} is not valid address`);
    }
    await locking.approve(validator);
  }

  if (param.claimable) {
    console.log("Set claimable");
    await locking.claimable();
  }

  console.log("Transfer back owner", param.owner);
  await locking.transferOwnership(param.owner);
  return locking.getAddress();
};
