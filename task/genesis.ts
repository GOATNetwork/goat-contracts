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

    console.log("Deploying");
    const param = await fs.readFile(`./ignition/${networkName}.json`, "utf-8");
    const deployments = await hre.ignition.deploy(GenesisModule, {
      parameters: JSON.parse(param.toString()),
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

    if (args["chainId"]) {
      geneis.config.chainId = args["chainId"];
    }

    for (let [address, state] of Object.entries(dump.accounts)) {
      switch (address.toLowerCase()) {
        case goatToken.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.goatToken)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case goatFoundation.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.goatFoundation)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case btcBlock.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.btcBlock)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case wgbtc.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.wgbtc)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case bridge.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.bridge)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case relayer.toLowerCase():
          geneis.alloc[trim0xPrefix(PredployedAddress.relayer)] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
      }
    }

    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(geneis));
  });
