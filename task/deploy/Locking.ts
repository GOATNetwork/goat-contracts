import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { getAddress, zeroAddress } from "viem";

import { PredployedAddress } from "../../common/constants.js";
import {
  parseValidatorPublicKey,
  parseValidatorSignature,
} from "../../common/utils.js";
import type { LockingParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: LockingParam,
) => {
  console.log("Deploy Locking contract");
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();

  const goatToken = await viem.getContractAt(
    "GoatToken",
    PredployedAddress.goatToken,
  );
  const reward = await goatToken.read.balanceOf([PredployedAddress.locking]);
  console.log("Initial reward", reward);

  const locking = await viem.deployContract("Locking", [
    signer.account.address,
    PredployedAddress.goatToken,
    reward,
  ]);

  if (param.tokens.length === 0) {
    throw new Error("no token config");
  }

  for (const item of param.tokens) {
    console.log("Adding token", item.address);
    const threshold = BigInt(item.threshold);
    if (threshold < 0n) {
      throw new Error(`threshold ${item.threshold} can't be negative`);
    }
    const token = getAddress(item.address);
    if (token === zeroAddress) {
      if (threshold === 0n) {
        throw new Error("native token should have threshold value");
      }
    } else if (threshold !== 0n) {
      throw new Error(`erc20 ${token} can't have threshold value in genesis`);
    }

    await locking.write.addToken([
      token,
      BigInt(item.weight),
      BigInt(item.limit),
      threshold,
    ]);
  }

  const [nativeExists, , , nativeThreshold] = await locking.read.tokens([
    zeroAddress,
  ]);
  if (!nativeExists) {
    throw new Error("no native token config");
  }

  for (const config of param.validators) {
    console.log("Add validator", config);
    const ownerAddress = getAddress(config.owner);
    const balance = await publicClient.getBalance({ address: ownerAddress });
    if (param.strict) {
      if (balance !== nativeThreshold) {
        throw new Error(
          `Deposit value for genesis validator owner ${config.owner} is not equal to threshold ${nativeThreshold}, got ${balance}`,
        );
      }
    } else {
      console.log(
        "WARN: Add deposit value for genesis validator owner",
        config.owner,
      );
      await signer.sendTransaction({
        to: ownerAddress,
        value: nativeThreshold,
      });
    }

    await signer.sendTransaction({ to: ownerAddress, value: 10n ** 18n });
    await testClient.impersonateAccount({ address: ownerAddress });
    const owner = await viem.getWalletClient(ownerAddress);
    const { coordinates, validatorAddress } = parseValidatorPublicKey(
      config.pubkey,
    );
    const signature = parseValidatorSignature(config.signature);
    if (validatorAddress.toLowerCase() !== config.validator.toLowerCase()) {
      throw new Error(
        `Validator address mismatched: want ${config.validator} but got ${validatorAddress}`,
      );
    }
    await locking.write.approve([validatorAddress]);
    await locking.write.create(
      [coordinates, signature.r, signature.s, signature.v],
      { account: owner.account, value: nativeThreshold },
    );
  }

  for (const validator of param.allowList) {
    console.log("Add address", validator, "to allow list");
    await locking.write.approve([getAddress(validator)]);
  }

  if (param.claimable) {
    console.log("Open claim");
    await locking.write.openClaim();
  }

  console.log("Transfer back owner", param.owner);
  await locking.write.transferOwnership([getAddress(param.owner)]);
  return locking.address;
};
