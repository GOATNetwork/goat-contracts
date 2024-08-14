import { task, types } from "hardhat/config";
import { print, JsonrpcClient } from "./jsonrpc";

task("btc:getblockhash")
  .addParam("rpc", "rpc endpoint", "http://localhost:8332")
  .addOptionalParam("user", "", "test")
  .addOptionalParam("pass", "", "test")
  .addParam("height", "block height", undefined, types.int)
  .addOptionalParam("canonical", "little endian format", true, types.boolean)
  .setAction(async (args, _) => {
    const client = new JsonrpcClient(args["rpc"], args["user"], args["pass"]);

    let hash = await client.call<string>(
      "getblockhash",
      Number(args["height"]),
    );
    if (args["canonical"]) {
      hash = Buffer.from(hash, "hex").reverse().toString("hex");
    }
    return console.log("0x" + hash);
  });

task("btc:getblock")
  .addParam("rpc", "rpc endpoint", "http://localhost:8332")
  .addOptionalParam("user", "", "test")
  .addOptionalParam("pass", "", "test")
  .addOptionalParam("hash", "")
  .addOptionalParam("height", "", undefined, types.int)
  .addOptionalParam("verbosity", "", 1, types.int)
  .setAction(async (args, _) => {
    const client = new JsonrpcClient(args["rpc"], args["user"], args["pass"]);

    let block = args["hash"];
    if (!block) {
      const number = Number(args["height"]);
      if (!number) {
        throw new Error("invalid block number");
      }
      block = await client.call<string>("getblockhash", number);
    }

    print(await client.call("getblock", block, args["verbosity"]));
  });
