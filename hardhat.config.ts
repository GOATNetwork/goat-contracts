import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import { HardhatUserConfig } from "hardhat/config";
import "./task";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
      metadata: {
        bytecodeHash: "none",
        useLiteralContent: true,
      },
    },
  },
  networks: {
    genesis: {
      url: "http://localhost:8545",
      accounts: "remote",
    },
    testnet3: {
      url: "https://rpc.testnet3.goat.network",
      accounts: [],
    },
  },
  etherscan: {
    apiKey: "placeholder",
    customChains: [
      {
        network: "testnet3",
        chainId: 48816,
        urls: {
          apiURL: "https://explorer.testnet3.goat.network/api",
          browserURL: "https://explorer.testnet3.goat.network",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  gasReporter: {
    enabled: process.env.GAS_REPORT === "true",
  },
};

export default config;
