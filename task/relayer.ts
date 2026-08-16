import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  decodeEventLog,
  formatEther,
  getAddress,
  isHex,
  type Hash,
} from "viem";

import { PredployedAddress } from "../common/constants.js";
import { hash160, sha256, trim0xPrefix } from "../common/utils.js";

async function logTransaction(
  hre: HardhatRuntimeEnvironment,
  hash: Hash,
): Promise<void> {
  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();
  const relayer = await viem.getContractAt(
    "Relayer",
    PredployedAddress.relayer,
  );
  console.log("waiting for txid", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("success", receipt.status === "success");
  console.log("cost", formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
  const firstLog = receipt.logs[0];
  if (receipt.status === "success" && firstLog !== undefined) {
    console.log(
      decodeEventLog({
        abi: relayer.abi,
        data: firstLog.data,
        topics: firstLog.topics,
        strict: false,
      }),
    );
  }
}

interface RelayerAddArguments {
  address?: string;
  vkHash?: string;
  txKey?: string;
  voteKey?: string;
}

export async function relayerAddAction(
  args: RelayerAddArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.getOrCreate();
  const relayer = await viem.getContractAt(
    "Relayer",
    PredployedAddress.relayer,
  );

  let hash: Hash;
  if (args.address !== undefined && args.vkHash !== undefined) {
    if (!isHex(args.vkHash) || args.vkHash.length !== 66) {
      throw new Error("vk-hash must be a 32-byte hex value");
    }
    hash = await relayer.write.addVoter([
      getAddress(args.address),
      args.vkHash,
    ]);
  } else if (args.txKey !== undefined && args.voteKey !== undefined) {
    const txKey = Buffer.from(trim0xPrefix(args.txKey), "hex");
    if (txKey.length !== 33) {
      throw new Error("invalid voter tx key length");
    }
    if (txKey[0] !== 2 && txKey[0] !== 3) {
      throw new Error("invalid voter tx key prefix");
    }
    const address = getAddress(hash160(txKey));
    const blsKey = Buffer.from(trim0xPrefix(args.voteKey), "hex");
    if (blsKey.length !== 96) {
      throw new Error("invalid bls key length");
    }
    const voteKeyHash = sha256(blsKey);
    console.log("Add relayer from pubkey", { address, voteKeyHash });
    hash = await relayer.write.addVoter([address, voteKeyHash]);
  } else {
    throw new Error("No valid voter param");
  }

  await logTransaction(hre, hash);
}

interface RelayerRemoveArguments {
  address?: string;
}

export async function relayerRemoveAction(
  args: RelayerRemoveArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (args.address === undefined) {
    throw new Error("missing voter address");
  }
  const { viem } = await hre.network.getOrCreate();
  const relayer = await viem.getContractAt(
    "Relayer",
    PredployedAddress.relayer,
  );
  await logTransaction(
    hre,
    await relayer.write.removeVoter([getAddress(args.address)]),
  );
}
