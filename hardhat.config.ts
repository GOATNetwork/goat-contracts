import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

import "./task/genesis";
import "./task/bitcoin";

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
      accounts: {
        // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        mnemonic: "test test test test test test test test test test test junk",
      },
    },
  },
  gasReporter: {
    enabled: process.env.GAS_REPORT === "true",
  },
  ignition: {
    requiredConfirmations: 1,
  },
};

export default config;
