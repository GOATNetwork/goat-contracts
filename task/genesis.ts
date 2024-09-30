import fs from "fs/promises";
import { task, types } from "hardhat/config";

import { PredployedAddress } from "../test/constant";
import { print, trim0xPrefix } from "./utils";
import { IAnvilState, loadAnvilState } from "./anvil";
import GenesisTemplate from "./template.json";

import GenesisModule from "../ignition/modules/Genesis";
import GoatTokenModule from "../ignition/modules/GoatToken";
import LockingModule from "../ignition/modules/Locking";

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
  .addParam("debug", "debug log", false, types.boolean)
  .addOptionalParam("faucet", "faucet address", undefined, types.string)
  .addOptionalParam("amount", "faucet amount in Ether", undefined, types.float)
  .setAction(async (args, hre) => {
    const debugMode = args["debug"]
    const networkName = args["name"];
    const outputFile = `./ignition/genesis/${networkName}.json`;

    try {
      await fs.access(outputFile, fs.constants.R_OK);
      if (!args["force"]) {
        return console.log("genesis has created");
      }
    } catch { }

    await fs.rm(`./ignition/deployments`, { recursive: true }).catch(() => { });

    const paramFile = await fs.readFile(`./ignition/${networkName}.json`, "utf-8");
    const parameters = (() => {
      const data = JSON.parse(paramFile.toString())
      let blockHash: string = data["Genesis"]["btc.hash"]
      if (blockHash.startsWith("0x")) {
        blockHash = blockHash.slice(2)
      }
      // convert it to little endian
      data["Genesis"]["btc.hash"] = "0x" + Buffer.from(blockHash, "hex").reverse().toString("hex")
      data["Genesis"]["locking.totalReward"] = BigInt(data["Genesis"]["locking.totalReward"])
      console.log("Deloying with", data)
      return data
    })()

    console.log("Deploy goat token");
    const goatTokenDeployment = await hre.ignition.deploy(GoatTokenModule, { parameters })
    let dump: IAnvilState = loadAnvilState(await hre.ethers.provider.send("anvil_dumpState"))
    const goatToken = await goatTokenDeployment.goatToken.getAddress()
    for (const [address, state] of Object.entries(dump.accounts)) {
      if (address.toLowerCase() === goatToken.toLowerCase()) {
        console.log("Initialize state for canonical goat token");
        await hre.ethers.provider.send("anvil_setCode", [PredployedAddress.goatToken, state.code])
        for (const [slot, data] of Object.entries(state.storage)) {
          await hre.ethers.provider.send("anvil_setStorageAt", [PredployedAddress.goatToken, slot, data])
        }
        break
      }
    }

    console.log("Deploy other contracts...");
    const deployments = await hre.ignition.deploy(GenesisModule, { parameters });
    const [goatFoundation, btcBlock, wgbtc, bridge, relayer] =
      await Promise.all([
        deployments.goatFoundation.getAddress(),
        deployments.btcBlock.getAddress(),
        deployments.wgbtc.getAddress(),
        deployments.bridge.getAddress(),
        deployments.relayer.getAddress(),
      ]);

    const lockingDeployment = await hre.ignition.deploy(LockingModule, { parameters });
    const locking = await lockingDeployment.locking.getAddress();

    const genesis: IGenesis = GenesisTemplate;
    genesis.timestamp = "0x" + Math.floor((Date.now() / 1000)).toString(16)

    if (args["chainId"]) {
      genesis.config.chainId = args["chainId"];
    }

    if (args["faucet"] && args["amount"]) {
      const facuet = args["faucet"]
      if (!hre.ethers.isAddress(facuet)) {
        throw new Error("invalid address: " + facuet)
      }
      const amount = hre.ethers.parseEther(String(args["amount"]));
      console.log("Adding faucet address", facuet, hre.ethers.formatEther(amount))
      genesis.alloc[trim0xPrefix(facuet)] = {
        balance: "0x" + amount.toString(16),
        nonce: "0x0",
      }
    }

    let count = 0;
    dump = loadAnvilState(await hre.ethers.provider.send("anvil_dumpState"))
    for (const [address, state] of Object.entries(dump.accounts)) {
      const stv = {
        balance: state.balance,
        nonce: "0x" + state.nonce.toString(16),
        code: state.code,
        storage: state.storage,
      }

      if (debugMode) {
        console.log("state of", address)
        print(state)
      }

      switch (address.toLowerCase()) {
        case goatToken.toLowerCase():
          console.log("Add genesis state for goat token from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.goatToken)] = stv;
          count++
          break;
        case goatFoundation.toLowerCase():
          console.log("Add genesis state for goat foundation from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.goatFoundation)] = stv;
          count++
          break;
        case btcBlock.toLowerCase():
          console.log("Add genesis state for bitcoin from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.btcBlock)] = stv;
          count++
          break;
        case wgbtc.toLowerCase():
          console.log("Add genesis state for wrapped goat bitcoin from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.wgbtc)] = stv;
          count++
          break;
        case bridge.toLowerCase():
          console.log("Add genesis state for bridge from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.bridge)] = stv;
          count++
          break;
        case relayer.toLowerCase():
          console.log("Add genesis state for relayer from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.relayer)] = stv;
          count++
          break;
        case locking.toLowerCase():
          console.log("Add genesis state for locking from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.locking)] = stv;
          count++
          break;
      }
    }

    if (count != 7) {
      throw new Error("Inconsistent deployment count")
    }

    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(genesis));
  });
