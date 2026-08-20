import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import {
  bytesToHex,
  decodeEventLog,
  formatEther,
  parseEther,
  type Hash,
} from "viem";

import { PredployedAddress } from "../common/constants.js";

async function logTransaction(
  hre: HardhatRuntimeEnvironment,
  hash: Hash,
): Promise<void> {
  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  console.log("waiting for txid", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("success", receipt.status === "success");
  console.log("cost", formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
  const firstLog = receipt.logs[0];
  if (receipt.status === "success" && firstLog !== undefined) {
    console.log(
      decodeEventLog({
        abi: bridge.abi,
        data: firstLog.data,
        topics: firstLog.topics,
        strict: false,
      }),
    );
  }
}

interface BridgeDepositedArguments {
  txid?: string;
  txout: bigint;
}

export async function bridgeDepositedAction(
  args: BridgeDepositedArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (args.txid === undefined || args.txid.startsWith("0x")) {
    throw new Error("Not a valid txid (0x prefix is not allowed)");
  }
  const txid = bytesToHex(Buffer.from(args.txid, "hex").reverse());
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  console.log(
    "is deposited",
    await bridge.read.isDeposited([txid, Number(args.txout)]),
  );
}

interface BridgeWithdrawArguments {
  address?: string;
  price: bigint;
  value: number;
}

export async function bridgeWithdrawAction(
  args: BridgeWithdrawArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (args.address === undefined) {
    throw new Error("missing receiver address");
  }
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  const hash = await bridge.write.withdraw([args.address, Number(args.price)], {
    value: parseEther(String(args.value)),
  });
  await logTransaction(hre, hash);
}

interface BridgeRbfArguments {
  id: bigint;
  price: bigint;
}

export async function bridgeRbfAction(
  args: BridgeRbfArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  await logTransaction(
    hre,
    await bridge.write.replaceByFee([args.id, Number(args.price)]),
  );
}

interface BridgeIdArguments {
  id: bigint;
}

export async function bridgeCancelAction(
  args: BridgeIdArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  await logTransaction(hre, await bridge.write.cancel1([args.id]));
}

export async function bridgeRefundAction(
  args: BridgeIdArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  await logTransaction(hre, await bridge.write.refund([args.id]));
}

export async function bridgeStatusAction(
  args: BridgeIdArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.getOrCreate();
  const bridge = await viem.getContractAt("Bridge", PredployedAddress.bridge);
  const [sender, maxTxPrice, status, amount, tax, updatedAt] =
    await bridge.read.withdrawals([args.id]);
  console.log("sender", sender);
  console.log("amount", formatEther(amount));
  console.log("tax", formatEther(tax));
  console.log("tx price", maxTxPrice);
  const statuses: Record<number, string> = {
    1: "Pending",
    2: "Canceling",
    3: "Canceled",
    4: "Refunded",
    5: "Paid",
  };
  console.log("status", statuses[status] ?? status);
  console.log("updatedAt", new Date(Number(updatedAt) * 1e3).toLocaleString());
}
