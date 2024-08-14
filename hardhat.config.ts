import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

import { mockEvent } from "./scripts/mock_event";

task("mock-event", "A sample task with params")
  .addPositionalParam("action")
  .setAction(async (taskArgs, hre) => {
    console.log(taskArgs);
    await mockEvent(taskArgs.action, hre);
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
		url: "http://127.0.0.1:8545",
		chainId: 3456,
		accounts: ["0x0fdce9a033c223590e32ffb24e48d8c66bef942464f7e593925c5317fff0d71e"]
	}
  },
  gasReporter: {
    enabled: true,
  },
};

export default config;
