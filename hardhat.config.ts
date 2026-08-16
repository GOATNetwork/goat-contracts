import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

import { projectTasks } from "./task/index.js";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  tasks: projectTasks,
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
      evmVersion: "cancun",
      metadata: {
        bytecodeHash: "none",
        useLiteralContent: true,
      },
    },
  },
  paths: {
    tests: {
      nodejs: "./test",
    },
  },
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "generic",
      hardfork: "cancun",
    },
    genesis: {
      type: "http",
      chainType: "generic",
      url: configVariable("GENESIS_RPC_URL", {
        default: "http://localhost:8545",
      }),
      accounts: "remote",
    },
    testnet3: {
      type: "http",
      chainType: "generic",
      url: "https://rpc.testnet3.goat.network",
      accounts: [],
    },
    goat: {
      type: "http",
      chainType: "generic",
      url: "https://rpc.goat.network",
      accounts: [],
    },
  },
  verify: {
    etherscan: {
      apiKey: "placeholder",
    },
    sourcify: {
      enabled: false,
    },
  },
  chainDescriptors: {
    48816: {
      name: "GOAT Testnet3",
      blockExplorers: {
        etherscan: {
          name: "GOAT Testnet3 Explorer",
          apiUrl: "https://explorer.testnet3.goat.network/api",
          url: "https://explorer.testnet3.goat.network",
        },
      },
    },
    2345: {
      name: "GOAT Network",
      blockExplorers: {
        etherscan: {
          name: "GOAT Explorer",
          apiUrl: "https://explorer.goat.network/api",
          url: "https://explorer.goat.network",
        },
      },
    },
  },
  test: {
    solidity: {
      fuzz: {
        runs: 4,
      },
      invariant: {
        runs: 4,
        depth: 4,
        failOnRevert: true,
      },
    },
  },
});
