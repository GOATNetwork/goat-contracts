import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { parseEther } from "viem";

import { loadAnvilState } from "../common/anvil.js";
import { PredployedAddress, sortTokenAddress } from "../common/constants.js";
import { readJson, trim0xPrefix } from "../common/utils.js";

import { deploy as deployBitcoin } from "./deploy/Bitcoin.js";
import { deploy as deployBridge } from "./deploy/Bridge.js";
import { deploy as deployGoatDAO } from "./deploy/GoatDAO.js";
import { deploy as deployGoatFoundation } from "./deploy/GoatFoundation.js";
import { deploy as deployGoatToken } from "./deploy/GoatToken.js";
import { deploy as deployLocking } from "./deploy/Locking.js";
import { deploy as deployLockingTokenFactory } from "./deploy/LockingTokenFactory.js";
import { deploy as deployRelayer } from "./deploy/Relayer.js";
import { deploy as deployWrappedBitcoin } from "./deploy/WrappedBitcoin.js";
import type { Param as GenesisParam } from "./deploy/param.js";

import GenesisTemplate from "./template.json" with { type: "json" };

interface Genesis {
  config: { chainId: number };
  alloc: GenesisAccounts;
  timestamp: string;
}

interface GenesisAccounts {
  [account: string]: GenesisAccountState;
}

interface GenesisAccountState {
  balance?: string;
  nonce?: string;
  code?: string;
  storage?: { [slot: string]: string };
}

interface CreateGenesisArguments {
  name: string;
  force: boolean;
  param?: string;
  gensrv: string;
}

export async function createGenesisAction(
  args: CreateGenesisArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const networkName = args.name;
  if (networkName.length === 0) {
    throw new Error("empty network name");
  }

  const outputFile = `./genesis/${networkName}.json`;
  try {
    await fs.access(outputFile, constants.R_OK);
    if (!args.force) {
      console.log("genesis has created");
      return;
    }
    console.warn("force to recreate genesis for " + networkName);
  } catch {
    console.log("generating genesis");
  }

  if (args.param === undefined) {
    const configModule = new URL(
      `../genesis/${networkName}.js`,
      import.meta.url,
    );
    console.log("try to compile ts config", configModule.pathname);
    try {
      await import(configModule.href);
      console.log("compile config succeeded");
    } catch (error) {
      console.log("skip compiling ts config due to", error);
    }
  }

  try {
    await fetch(args.gensrv).then((response) => response.text());
  } catch (error) {
    throw new Error("genesis server is not available: " + error);
  }

  const paramFilePath = args.param ?? `./genesis/${networkName}-config.json`;
  const params = await readJson<GenesisParam>(paramFilePath);

  const goatToken = await deployGoatToken(hre, params.GoatToken);
  const goatDao = await deployGoatDAO(hre, params.GoatDAO);
  const goatFoundation = await deployGoatFoundation(hre, params.GoatFoundation);
  const btcBlock = await deployBitcoin(hre, params.Bitcoin);
  const wgbtc = await deployWrappedBitcoin(hre, params.WrappedBitcoin);
  const bridge = await deployBridge(hre, params.Bridge);
  const relayer = await deployRelayer(hre, params.Relayer);
  const locking = await deployLocking(hre, params.Locking);
  const lockingTokenFactory = await deployLockingTokenFactory(hre, {});

  const genesis = structuredClone(GenesisTemplate) as Genesis;
  genesis.timestamp = "0x" + Math.floor(Date.now() / 1000).toString(16);

  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const chainId = await publicClient.getChainId();
  console.log("Use chainId", chainId);
  genesis.config.chainId = chainId;

  const dump = loadAnvilState(await testClient.dumpState());
  const genesisContractStates: GenesisAccounts = {};
  for (const [address, state] of Object.entries(dump.accounts)) {
    const accountState: GenesisAccountState = {
      balance: state.balance,
      nonce: "0x" + state.nonce.toString(16),
      code: state.code,
      storage: state.storage,
    };

    switch (address.toLowerCase()) {
      case goatToken.toLowerCase():
        console.log("Add genesis state for goat token from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.goatToken)] =
          accountState;
        break;
      case goatFoundation.toLowerCase():
        console.log("Add genesis state for goat foundation from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.goatFoundation)] =
          accountState;
        break;
      case btcBlock.toLowerCase():
        console.log("Add genesis state for bitcoin from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.btcBlock)] =
          accountState;
        break;
      case wgbtc.toLowerCase():
        console.log("Add genesis state for wgbtc from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.wgbtc)] =
          accountState;
        break;
      case bridge.toLowerCase():
        console.log("Add genesis state for bridge from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.bridge)] =
          accountState;
        break;
      case relayer.toLowerCase():
        console.log("Add genesis state for relayer from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.relayer)] =
          accountState;
        break;
      case locking.toLowerCase():
        console.log("Add genesis state for Locking from", address);
        if (params.Locking.gas !== undefined) {
          console.warn(
            "Sending gas revenue to Locking contract",
            params.Locking.gas,
          );
          accountState.balance =
            "0x" +
            (
              BigInt(accountState.balance ?? 0) + BigInt(params.Locking.gas)
            ).toString(16);
        }
        genesisContractStates[trim0xPrefix(PredployedAddress.locking)] =
          accountState;
        break;
      case goatDao.toLowerCase():
        console.log("Add genesis state for goat dao from", address);
        genesisContractStates[trim0xPrefix(PredployedAddress.goatDao)] =
          accountState;
        break;
      case lockingTokenFactory.toLowerCase():
        console.log("Add genesis state for locking token factory", address);
        genesisContractStates[
          trim0xPrefix(PredployedAddress.lockingTokenFactory)
        ] = accountState;
        break;
    }
  }

  const contractStateKeys = Object.keys(genesisContractStates);
  if (contractStateKeys.length !== 9) {
    throw new Error("Inconsistent deployment count");
  }
  const orderedContractStates = contractStateKeys
    .sort(sortTokenAddress)
    .reduce<GenesisAccounts>((states, key) => {
      states[key] = genesisContractStates[key];
      return states;
    }, {});

  const balances = Object.entries(
    params.Balances ?? {},
  ).reduce<GenesisAccounts>((states, [address, { balance, nonce }]) => {
    console.log(
      "Add genesis balance to",
      address,
      "balance",
      balance,
      "nonce",
      nonce,
    );
    const amount =
      typeof balance === "string" && balance.endsWith("ether")
        ? parseEther(balance.slice(0, -5))
        : BigInt(balance);
    states[trim0xPrefix(address.toLowerCase())] = {
      balance: "0x" + amount.toString(16),
      nonce: "0x" + (nonce ?? 0).toString(16),
    };
    return states;
  }, {});

  genesis.alloc = Object.assign(balances, genesis.alloc, orderedContractStates);

  const genesisResponse = await fetch(`${args.gensrv}/genesis`, {
    method: "POST",
    body: JSON.stringify(genesis),
    headers: { "Content-Type": "application/json" },
  });
  if (!genesisResponse.ok) {
    throw new Error("genesis server error: " + (await genesisResponse.text()));
  }
  const consensusGenesis = await genesisResponse.json();
  if (
    consensusGenesis === null ||
    typeof consensusGenesis !== "object" ||
    Array.isArray(consensusGenesis)
  ) {
    throw new Error("genesis server returned an invalid consensus genesis");
  }
  params.Consensus.Goat = consensusGenesis as Record<string, unknown>;

  console.log("Writing genesis", outputFile);
  await fs.writeFile(outputFile, JSON.stringify(genesis, null, 2));
  console.log("Updating parameter file", paramFilePath);
  await fs.writeFile(paramFilePath, JSON.stringify(params, null, 2));
}
