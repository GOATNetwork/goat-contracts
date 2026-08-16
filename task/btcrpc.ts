import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import { JsonrpcClient } from "../common/jsonrpc.js";
import { print } from "../common/utils.js";

interface BitcoinRpcArguments {
  rpc: string;
  user: string;
  pass: string;
}

interface BitcoinBlockHashArguments extends BitcoinRpcArguments {
  height: number;
}

export async function btcGetBlockHashAction(
  args: BitcoinBlockHashArguments,
  _hre: HardhatRuntimeEnvironment,
) {
  const client = new JsonrpcClient(args.rpc, args.user, args.pass);
  console.log(await client.call<string>("getblockhash", args.height));
}

interface BitcoinBlockArguments extends BitcoinRpcArguments {
  hash?: string;
  height: number;
  resultVerbosity: number;
}

export async function btcGetBlockAction(
  args: BitcoinBlockArguments,
  _hre: HardhatRuntimeEnvironment,
) {
  const client = new JsonrpcClient(args.rpc, args.user, args.pass);
  let block = args.hash;
  if (block === undefined) {
    if (args.height === 0) {
      throw new Error("invalid block number");
    }
    block = await client.call<string>("getblockhash", args.height);
  }
  print(await client.call("getblock", block, args.resultVerbosity));
}
