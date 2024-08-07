import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";


const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
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
  	localhost: {
		url: "http://127.0.0.1:8546"
	}
  },
  gasReporter: {
    enabled: true,
  },
};

export default config;
