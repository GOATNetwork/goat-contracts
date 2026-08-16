import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import {
  formatEther,
  getAddress,
  getContract,
  parseAbi,
  zeroAddress,
} from "viem";

import { PredployedAddress } from "../common/constants.js";
import {
  parseValidatorPublicKey,
  parseValidatorSignature,
} from "../common/utils.js";

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

interface LockingCreateArguments {
  validator?: string;
  owner?: string;
  pubkey?: string;
  signature?: string;
}

export async function lockingCreateAction(
  args: LockingCreateArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (
    args.validator === undefined ||
    args.owner === undefined ||
    args.pubkey === undefined ||
    args.signature === undefined
  ) {
    throw new Error("validator, owner, pubkey and signature are required");
  }

  const validator = getAddress(args.validator);
  const ownerAddress = getAddress(args.owner);
  const { coordinates, validatorAddress } = parseValidatorPublicKey(
    args.pubkey,
  );
  const signature = parseValidatorSignature(args.signature);
  if (validatorAddress.toLowerCase() !== validator.toLowerCase()) {
    throw new Error(
      `Validator address mismatched: want ${validator} but got ${validatorAddress}`,
    );
  }

  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  if (signer.account.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`owner ${ownerAddress} is not current wallet owner`);
  }
  const publicClient = await viem.getPublicClient();
  const contract = await viem.getContractAt(
    "Locking",
    PredployedAddress.locking,
  );

  let approved = await contract.read.approvals([validator]);
  if (!approved) {
    approved = await contract.read.approvals([zeroAddress]);
    if (!approved) {
      throw new Error("validator not approved");
    }
  }

  console.log("I'm sure that my node is fully synced");
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(
      "Do you want to continue? (Only 'yes' will be accepted to approve) ",
    );
    if (answer !== "yes") {
      console.log("Okay, I will exit");
      return;
    }
  } finally {
    prompt.close();
  }

  const threshold = await contract.read.creationThreshold();
  let native = 0n;
  for (const { token, amount } of threshold) {
    if (token === zeroAddress) {
      native = amount;
      const balance = await publicClient.getBalance({
        address: signer.account.address,
      });
      if (balance < amount) {
        throw new Error(
          `not enough btc balance: min ${formatEther(amount)} have ${formatEther(balance)}`,
        );
      }
    } else {
      const erc20 = getContract({
        address: token,
        abi: erc20Abi,
        client: { public: publicClient, wallet: signer },
      });
      const symbol = await erc20.read.symbol();
      const balance = await erc20.read.balanceOf([signer.account.address]);
      if (balance < amount) {
        throw new Error(
          `not enough ${symbol} balance: min ${formatEther(amount)} have ${formatEther(balance)}`,
        );
      }
      const allowance = await erc20.read.allowance([
        signer.account.address,
        PredployedAddress.relayer,
      ]);
      if (allowance < amount) {
        console.log(`approve ${symbol} token to relayer`);
        const hash = await erc20.write.approve([
          PredployedAddress.relayer,
          amount,
        ]);
        await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 2,
        });
      }
    }
  }

  console.log("create validator");
  const hash = await contract.write.create(
    [coordinates, signature.r, signature.s, signature.v],
    { value: native },
  );
  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  console.log(`done: ${hash}`);
}
