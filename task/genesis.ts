import fs from "fs/promises";
import { task, types } from "hardhat/config";

import { PredployedAddress } from "../common/constants";
import { print, readJson, trim0xPrefix } from "../common/utils";
import { loadAnvilState } from "../common/anvil";

import { deploy as DeployGoatToken } from "./deploy/GoatToken";
import { deploy as DeployGoatDAO } from "./deploy/GoatDAO";
import { deploy as DeployLocking } from "./deploy/Locking";
import { deploy as DeployGoatFoundation } from "./deploy/GoatFoundation";
import { deploy as DeployBitcoin } from "./deploy/Bitcoin";
import { deploy as DeployWrappedBitcoin } from "./deploy/WrappedBitcoin";
import { deploy as DeployBridge } from "./deploy/Bridge";
import { deploy as DeployRelayer } from "./deploy/Relayer";
import { Param as GenesisParam } from "./deploy/param";

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
  .addParam("param", "param file path", "./genesis/config.json")
  .addParam("chainId", "chain id", 48815, types.int)
  .addParam("force", "force to rewrite", false, types.boolean)
  .addParam("debug", "debug log", false, types.boolean)
  .addOptionalParam("faucet", "faucet address", undefined, types.string)
  .addOptionalParam("amount", "faucet amount in Ether", undefined, types.float)
  .setAction(async (args, hre) => {
    const debugMode = args["debug"];
    const networkName = args["name"];
    const outputFile = `./genesis/${networkName}.json`;

    try {
      await fs.access(outputFile, fs.constants.R_OK);
      if (!args["force"]) {
        return console.log("genesis has created");
      }
    } catch { }

    const params = await readJson<GenesisParam>(args["param"]);
    const goatToken = await DeployGoatToken(hre, params.GoatToken);
    const goatDao = await DeployGoatDAO(hre, params.GoatDAO);
    const goatFoundation = await DeployGoatFoundation(hre, params.GoatFoundation);
    const btcBlock = await DeployBitcoin(hre, params.Bitcoin);
    const wgbtc = await DeployWrappedBitcoin(hre, params.WrappedBitcoin);
    const bridge = await DeployBridge(hre, params.Bridge);
    const relayer = await DeployRelayer(hre, params.Relayer);
    const locking = await DeployLocking(hre, params.Locking);

    const genesis: IGenesis = GenesisTemplate;
    genesis.timestamp = "0x" + Math.floor(Date.now() / 1000).toString(16);

    if (args["chainId"]) {
      genesis.config.chainId = args["chainId"];
    }

    if (args["faucet"] && args["amount"]) {
      const facuet = args["faucet"];
      if (!hre.ethers.isAddress(facuet)) {
        throw new Error("invalid address: " + facuet);
      }
      const amount = hre.ethers.parseEther(String(args["amount"]));
      console.log("!!!!!!!!!!!")
      console.warn(
        "Adding faucet address",
        facuet,
        hre.ethers.formatEther(amount),
      );
      console.log("!!!!!!!!!!!")
      genesis.alloc[trim0xPrefix(facuet)] = {
        balance: "0x" + amount.toString(16),
        nonce: "0x0",
      };
    }

    let count = 0;
    const dump = loadAnvilState(
      await hre.ethers.provider.send("anvil_dumpState"),
    );
    for (const [address, state] of Object.entries(dump.accounts)) {
      const stv = {
        balance: state.balance,
        nonce: "0x" + state.nonce.toString(16),
        code: state.code,
        storage: state.storage,
      };

      if (debugMode) {
        console.log("state of", address);
        print(state);
      }

      switch (address.toLowerCase()) {
        case goatToken.toLowerCase():
          console.log("Add genesis state for goat token from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.goatToken)] = stv;
          count++;
          break;
        case goatFoundation.toLowerCase():
          console.log("Add genesis state for goat foundation from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.goatFoundation)] = stv;
          count++;
          break;
        case btcBlock.toLowerCase():
          console.log("Add genesis state for bitcoin from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.btcBlock)] = stv;
          count++;
          break;
        case wgbtc.toLowerCase():
          console.log("Add genesis state for wgbtc from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.wgbtc)] = stv;
          count++;
          break;
        case bridge.toLowerCase():
          console.log("Add genesis state for bridge from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.bridge)] = stv;
          count++;
          break;
        case relayer.toLowerCase():
          console.log("Add genesis state for relayer from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.relayer)] = stv;
          count++;
          break;
        case locking.toLowerCase():
          console.log("Add genesis state for locking from", address);
          if (params.Locking.gas) {
            console.log("!!!!!!!!!!!")
            console.warn("Sending gas revenue to regtest Locking contract", params.Locking.gas)
            console.log("!!!!!!!!!!!")
            stv.balance = "0x" + (BigInt(stv.balance) + BigInt(params.Locking.gas)).toString(16)
          }
          genesis.alloc[trim0xPrefix(PredployedAddress.locking)] = stv;
          count++;
          break;
        case goatDao.toLowerCase():
          console.log("Add genesis state for goat dao from", address);
          genesis.alloc[trim0xPrefix(PredployedAddress.goatDao)] = stv;
          count++;
          break;
      }
    }

    if (count != 8) {
      throw new Error("Inconsistent deployment count");
    }

    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(genesis, null, 2));
  });
