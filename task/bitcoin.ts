import { task, types } from "hardhat/config";
import { print, JsonrpcClient } from "./jsonrpc";

task("btc:getblockhash")
  .addParam("rpc", "rpc endpoint", "http://localhost:8332")
  .addParam("height", "block height", undefined, types.int)
  .addOptionalParam("littleEndian", "", false, types.boolean)
  .addOptionalParam("user", "", "test")
  .addOptionalParam("pass", "", "test")
  .setAction(async (args, _) => {
    const client = new JsonrpcClient(args["rpc"], args["user"], args["pass"]);

    const hash = await client.call<string>(
      "getblockhash",
      Number(args["height"]),
    );
    if (args["littleEndian"]) {
      return console.log(
        "0x" + Buffer.from(hash, "hex").reverse().toString("hex"),
      );
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
