import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { decodeErrorResult, isHex } from "viem";

interface DecodeErrorArguments {
  error?: string;
}

export async function decodeErrorAction(
  args: DecodeErrorArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (args.error === undefined || !isHex(args.error)) {
    throw new Error("invalid encoded error data");
  }
  for (const contractName of [
    "Bitcoin",
    "Bridge",
    "GoatToken",
    "GoatFoundation",
    "Relayer",
    "GoatDAO",
    "Locking",
  ]) {
    const artifact = await hre.artifacts.readArtifact(contractName);
    try {
      console.log(decodeErrorResult({ abi: artifact.abi, data: args.error }));
      return;
    } catch {
      // Try the next contract ABI.
    }
  }
  throw new Error("unable to decode error data with project ABIs");
}
