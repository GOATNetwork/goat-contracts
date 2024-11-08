import fs from "fs/promises";
import { task, types } from "hardhat/config";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { loadAnvilState } from "../common/anvil";
import { PredployedAddress, sortTokenAddress } from "../common/constants";
import { print, readJson, trim0xPrefix } from "../common/utils";

import { deploy as DeployBitcoin } from "./deploy/Bitcoin";
import { deploy as DeployBridge } from "./deploy/Bridge";
import { deploy as DeployGoatDAO } from "./deploy/GoatDAO";
import { deploy as DeployGoatFoundation } from "./deploy/GoatFoundation";
import { deploy as DeployGoatToken } from "./deploy/GoatToken";
import { deploy as DeployLocking } from "./deploy/Locking";
import { deploy as DeployLockingTokenFactory } from "./deploy/LockingTokenFactory";
import { deploy as DeployRelayer } from "./deploy/Relayer";
import { deploy as DeployWrappedBitcoin } from "./deploy/WrappedBitcoin";
import { Param as GenesisParam } from "./deploy/param";

import GenesisTemplate from "./template.json";

interface IGenesis {
  config: IChainConfig;
  alloc: IAccount;
  timestamp: string;
}

interface IChainConfig {
  chainId: number;
}

interface IAccount {
  [account: string]: IAccountState;
}

interface IAccountState {
  balance?: string;
  nonce?: string;
  code?: string;
  storage?: { [slot: string]: string };
}

const $ = promisify(exec);

task("create:genesis")
  .addParam("rpc", "rpc endpoint", "http://localhost:8545")
  .addParam("name", "network name", "regtest")
  .addParam("param", "param file path", "")
  .addParam("force", "force to rewrite", false, types.boolean)
  .addParam("debug", "debug log", false, types.boolean)
  .addOptionalParam("faucet", "faucet address", undefined, types.string)
  .addOptionalParam("amount", "faucet amount in Ether", undefined, types.float)
  .setAction(async (args, hre) => {
    const debugMode = args["debug"];
    const networkName = args["name"];
    const outputFile = `./genesis/${networkName}.json`;
    const paramFilePath =
      args["param"] || `./genesis/${networkName}-config.json`;

    try {
      await fs.access(outputFile, fs.constants.R_OK);
      if (!args["force"]) {
        return console.log("genesis has created");
      }
      console.warn("force to recreate genesis for " + networkName);
    } catch {
      console.log("generating genesis");
    }

    console.log(process.cwd());
    try {
      const tsFilePath = `./genesis/${networkName}.ts`;
      console.log("try to compile ts config", tsFilePath);
      await fs.access(`${tsFilePath}`);
      await $(`npx ts-node ${tsFilePath}`);
      console.log("compile config successed");
    } catch (err) {
      console.log("skip to compile ts config due to", err);
    }

    const params = await readJson<GenesisParam>(paramFilePath);
    const goatToken = await DeployGoatToken(hre, params.GoatToken);
    const goatDao = await DeployGoatDAO(hre, params.GoatDAO);
    const goatFoundation = await DeployGoatFoundation(
      hre,
      params.GoatFoundation,
    );
    const btcBlock = await DeployBitcoin(hre, params.Bitcoin);
    const wgbtc = await DeployWrappedBitcoin(hre, params.WrappedBitcoin);
    const bridge = await DeployBridge(hre, params.Bridge);
    const relayer = await DeployRelayer(hre, params.Relayer);
    const locking = await DeployLocking(hre, params.Locking);
    const lockingTokenFactory = await DeployLockingTokenFactory(hre, {});

    const genesis: IGenesis = GenesisTemplate;
    genesis.timestamp = "0x" + Math.floor(Date.now() / 1000).toString(16);

    const { chainId } = await hre.ethers.provider.getNetwork();
    console.log("Use chainId", chainId);
    genesis.config.chainId = Number(chainId);

    if (args["faucet"] && args["amount"]) {
      const facuet = args["faucet"];
      if (!hre.ethers.isAddress(facuet)) {
        throw new Error("invalid address: " + facuet);
      }
      const amount = hre.ethers.parseEther(String(args["amount"]));
      console.log("!!!!!!!!!!!");
      console.warn(
        "Adding faucet address",
        facuet,
        hre.ethers.formatEther(amount),
      );
      console.log("!!!!!!!!!!!");
      genesis.alloc[trim0xPrefix(facuet)] = {
        balance: "0x" + amount.toString(16),
        nonce: "0x0",
      };
    }

    const dump = loadAnvilState(
      await hre.ethers.provider.send("anvil_dumpState"),
    );

    const gcStates: IAccount = {};
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
          gcStates[trim0xPrefix(PredployedAddress.goatToken)] = stv;
          break;
        case goatFoundation.toLowerCase():
          console.log("Add genesis state for goat foundation from", address);
          gcStates[trim0xPrefix(PredployedAddress.goatFoundation)] = stv;
          break;
        case btcBlock.toLowerCase():
          console.log("Add genesis state for bitcoin from", address);
          gcStates[trim0xPrefix(PredployedAddress.btcBlock)] = stv;
          break;
        case wgbtc.toLowerCase():
          console.log("Add genesis state for wgbtc from", address);
          gcStates[trim0xPrefix(PredployedAddress.wgbtc)] = stv;
          break;
        case bridge.toLowerCase():
          console.log("Add genesis state for bridge from", address);
          gcStates[trim0xPrefix(PredployedAddress.bridge)] = stv;
          break;
        case relayer.toLowerCase():
          console.log("Add genesis state for relayer from", address);
          gcStates[trim0xPrefix(PredployedAddress.relayer)] = stv;
          break;
        case locking.toLowerCase():
          console.log("Add genesis state for locking from", address);
          if (params.Locking.gas) {
            console.log("!!!!!!!!!!!");
            console.warn(
              "Sending gas revenue to regtest Locking contract",
              params.Locking.gas,
            );
            console.log("!!!!!!!!!!!");
            stv.balance =
              "0x" +
              (BigInt(stv.balance) + BigInt(params.Locking.gas)).toString(16);
          }
          gcStates[trim0xPrefix(PredployedAddress.locking)] = stv;
          break;
        case goatDao.toLowerCase():
          console.log("Add genesis state for goat dao from", address);
          gcStates[trim0xPrefix(PredployedAddress.goatDao)] = stv;
          break;
        case lockingTokenFactory.toLowerCase():
          console.log("Add genesis state for locking token factory", address);
          gcStates[trim0xPrefix(PredployedAddress.lockingTokenFactory)] = stv;
          break;
      }
    }

    const gcKeys = Object.keys(gcStates);
    if (gcKeys.length != 9) {
      throw new Error("Inconsistent deployment count");
    }

    const ordered = gcKeys.sort(sortTokenAddress).reduce((obj, key) => {
      obj[key] = gcStates[key];
      return obj;
    }, {} as IAccount);

    genesis.alloc = Object.assign({}, genesis.alloc, ordered);
    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(genesis, null, 2));
    const { stdout } = await $(
      `go run ./genesis/main.go -config ${paramFilePath} -genesis ${outputFile}`,
    );
    console.log(stdout);
  });
