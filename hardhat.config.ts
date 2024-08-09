import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

import { mockEvent } from "./scripts/mock_event";

task("mock-event", "A sample task with params")
  .addPositionalParam("action")
  .setAction(async (taskArgs) => {
    console.log(taskArgs);
    await mockEvent(taskArgs.action);
  });


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
