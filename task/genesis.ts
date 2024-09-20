import fs from "fs/promises";
import { task, types } from "hardhat/config";

import { PredployedAddress } from "../test/constant";
import { JsonrpcClient } from "./jsonrpc";
import { trim0xPrefix } from "./utils";

import GenesisModule from "../ignition/modules/Genesis";
import GenesisTemplate from "./template.json";

interface IGenesis {
  config: IChainConfig;
  alloc: { [account: string]: IAccountState };
  timestamp: string;
}

interface IChainConfig {
  chainId: number;
}

interface IAccountState {
  balance?: string;
  nonce?: string;
  code?: string;
  storage?: { [slot: string]: string };
}

task("create:genesis")
  .addParam("rpc", "rpc endpoint", "http://localhost:8545")
  .addParam("name", "network name", "regtest")
  .addParam("chainId", "chain id", 48815, types.int)
  .addParam("force", "force to rewrite", false, types.boolean)
  .addOptionalParam("faucet", "faucet address", undefined, types.string)
  .addOptionalParam("amount", "faucet amount in Ether", undefined, types.float)
  .setAction(async (args, hre) => {
    const networkName = args["name"];
    const outputFile = `./ignition//genesis/${networkName}.json`;

    try {
      await fs.access(outputFile, fs.constants.R_OK);
      if (!args["force"]) {
        return console.log("genesis has created");
      }
    } catch { }

    console.log("Adding fee from coinbase");
    {
      // the eth_sendTransaction and eth_accounts are hijacked by hardhat

      const [signer] = await hre.ethers.getSigners();
      const jsonrpc = new JsonrpcClient(args["rpc"]);
      const [coinbase] = await jsonrpc.call<string[]>("eth_accounts");
      const txid = await jsonrpc.call<string>("eth_sendTransaction", {
        from: coinbase,
        to: signer.address,
        value: "0x" + (BigInt(1e18) * 1000n).toString(16),
      });

      // todo: `hre.ethers.provider.waitForTransaction(txid, 1)` can't work
      while (!(await hre.ethers.provider.getTransactionReceipt(txid))) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    await fs
      .rm(`./ignition/deployments/${networkName}`, { recursive: true })
      .catch(() => { });

    const paramFile = await fs.readFile(`./ignition/${networkName}.json`, "utf-8");
    const parameters = (() => {
      const data = JSON.parse(paramFile.toString())
      let blockHash: string = data["Genesis"]["btc.hash"]
      if (blockHash.startsWith("0x")) {
        blockHash = blockHash.slice(2)
      }
      // convert it to little endian
      data["Genesis"]["btc.hash"] = "0x" + Buffer.from(blockHash, "hex").reverse().toString("hex")
      console.log("Deloying with", data)
      return data
    })()

    const deployments = await hre.ignition.deploy(GenesisModule, {
      parameters,
      deploymentId: networkName,
    });

    const [goatToken, goatFoundation, btcBlock, wgbtc, bridge, relayer] =
      await Promise.all([
        deployments.goatToken.getAddress(),
        deployments.goatFoundation.getAddress(),
        deployments.btcBlock.getAddress(),
        deployments.wgbtc.getAddress(),
        deployments.bridge.getAddress(),
        deployments.relayer.getAddress(),
      ]);

    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("Getting state");
    const dump: { accounts: { [address: string]: IAccountState } } =
      await hre.ethers.provider.send("debug_dumpBlock", [
        "0x" + blockNumber.toString(16),
      ]);

    const geneis: IGenesis = GenesisTemplate;
    geneis.timestamp = "0x" + Math.floor((Date.now() / 1000)).toString(16)

    if (args["chainId"]) {
      geneis.config.chainId = args["chainId"];
    }

    if (args["faucet"] && args["amount"]) {
      const facuet = args["faucet"]
      if (!hre.ethers.isAddress(facuet)) {
        throw new Error("invalid address: " + facuet)
      }
      const amount = hre.ethers.parseEther(String(args["amount"]));
      console.log("Adding faucet address", facuet, hre.ethers.formatEther(amount))
      geneis.alloc[trim0xPrefix(facuet)] = {
        balance: "0x" + amount.toString(16),
        nonce: "0x0",
      }
    }

    for (const [address, state] of Object.entries(dump.accounts)) {
      const stv = {
        balance: state.balance,
        nonce: state.nonce,
        code: state.code,
        storage: state.storage,
      }
      switch (address.toLowerCase()) {
        case goatToken.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.goatToken)] = stv;
          break;
        case goatFoundation.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.goatFoundation)] = stv;
          break;
        case btcBlock.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.btcBlock)] = stv;
          break;
        case wgbtc.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.wgbtc)] = stv;
          break;
        case bridge.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.bridge)] = stv;
          break;
        case relayer.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.relayer)] = stv;
          break;
      }
    }

    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(geneis));
  });
