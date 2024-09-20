import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

import { mockEvent } from "./scripts/mock_event";
import * as path from "path";
import * as fs from 'fs';
import { exec } from "child_process";
import { promisify } from "util";
import { parseDataEmbedScript } from "btc-script-factory/lib/covenantV1/bridge.script";

import "./task/genesis";
import "./task/bitcoin";

const execAsync = promisify(exec);

task("mock-event", "A sample task with params")
  .addPositionalParam("action")
  .setAction(async (taskArgs, hre) => {
    console.log(taskArgs);
    await mockEvent(taskArgs.action, hre);
  });

// npx hardhat init-params --network localhost
task("init-params", "Initialize contract parameters using GoatFoundation account")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [_, goatFoundation] = await ethers.getSigners();

    const testnetConfigPath = path.join(__dirname, `./subgraph/${hre.network.name}.json`);
    const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
    const contractAddress = testnetConfig.Bridge;

    const bridge = await ethers.getContractAt("Bridge", contractAddress, goatFoundation);

    console.log("Setting rate limit...");
    await (await bridge.setRateLimit(1)).wait();
    console.log("Setting withdrawal tax...");
    await (await bridge.setWithdrawalTax(20, 1000000)).wait();
    console.log("Setting deposit tax...");
    await (await bridge.setDepositTax(50, 2000000)).wait();

    console.log("All parameters have been set successfully!");
  });


// Helper function to fetch transaction details from a Bitcoin node
async function fetchBtcTransaction(txid: string) {
  const command = `curl --user 111111:111111 --data-binary '{"jsonrpc": "1.0", "id":"curltest", "method": "getrawtransaction", "params": ["${txid}", true]}' -H 'content-type: text/plain;' http://ec2-3-15-141-150.us-east-2.compute.amazonaws.com:18443`;
  console.log(command);
  try {
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Failed to fetch BTC transaction:", error);
    throw error;
  }
}

// npx hardhat deposit --network localhost --txid <txid>
task("deposit", "Deposits funds to a specified address")
.addParam("txid", "The transaction ID of the BTC transaction")
.setAction(async ({ txid }, hre) => {
  console.log("Fetching BTC transaction details...");
  const { result: btcTransaction } = await fetchBtcTransaction(txid);

  const depositVout = btcTransaction.vout[0];
  const embedVout = btcTransaction.vout[1];

  const txout = depositVout.n;
  const amount = BigInt(depositVout.value * 1e18); // Convert BTC to ETH gwei
  const scriptHex = embedVout.scriptPubKey.hex;

  const { evmAddress } = parseDataEmbedScript(Buffer.from(scriptHex, 'hex'));
  const target = `0x${evmAddress.toString("hex")}`;

  const ethers = hre.ethers;
  const abiPath = path.join(__dirname, './artifacts/contracts/bridge/Bridge.sol/Bridge.json');
  const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const testnetConfigPath = path.join(__dirname, `./subgraph/${hre.network.name}.json`);
  const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
  const contractAddress = testnetConfig.Bridge;

  const [relayer] = await ethers.getSigners();

  const bridge = new ethers.Contract(
    contractAddress,
    abi,
    relayer
  );

  console.log(`Depositing to address: ${target}`);
  try {
    const txResponse = await bridge.deposit(
      `0x${txid}`, // Ensure the txid is a string formatted as bytes32
      txout,
      target,
      amount
    );
    await txResponse.wait();
    console.log("Deposit successful");
  } catch (error) {
    console.error("Deposit failed:", error);
  }
});

// npx hardhat paid --network localhost --txid <txid> --wid <wid>
// Observe the withdraw transaction and then initiate a BTC transaction to complete the payment
task("paid", "Mark a transaction as paid")
.addParam("txid", "The transaction ID of the BTC transaction")
.addParam("wid", "The withdraw ID of the withdraw transaction")
.setAction(async ({ txid, wid }, hre) => {
  console.log("Fetching BTC transaction details...");
  const { result: btcTransaction } = await fetchBtcTransaction(txid);

  const paidVout = btcTransaction.vout[0];

  const txout = paidVout.n;
  const amount = BigInt(paidVout.value * 1e18);

  const ethers = hre.ethers;
  const abiPath = path.join(__dirname, './artifacts/contracts/bridge/Bridge.sol/Bridge.json');
  const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const testnetConfigPath = path.join(__dirname, `./subgraph/${hre.network.name}.json`);
  const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
  const contractAddress = testnetConfig.Bridge;

  const [relayer] = await ethers.getSigners();

  const bridge = new ethers.Contract(
    contractAddress,
    abi,
    relayer
  );

  const { withdrawalTaxBP, maxWithdrawalTax } = await bridge.param();

  // Calculate the tax amount
  const taxRate = BigInt(withdrawalTaxBP);
  const maxTax = BigInt(maxWithdrawalTax);

  // Apply the maximum tax limit
  const taxAmount = (amount * taxRate) / BigInt(10000);

  const actualTax = taxAmount > maxTax ? maxTax : taxAmount;

  // Calculate the received amount
  const received = amount - actualTax;

  console.log(`Paid with wid: ${wid}`);
  try {
    const txResponse = await bridge.paid(
      wid,
      `0x${txid}`,
      txout,
      received
    );
    await txResponse.wait();
    console.log("Paid successful");
  } catch (error) {
    console.error("Paid failed:", error);
  }
});

// npx hardhat cancel --network localhost --wid <wid>
task("cancel", "Cancel a transaction")
  .addParam("wid", "The withdraw ID of the withdraw transaction")
  .setAction(async ({ wid }, hre) => {
    const ethers = hre.ethers;
    const abiPath = path.join(__dirname, './artifacts/contracts/bridge/Bridge.sol/Bridge.json');
    const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const testnetConfigPath = path.join(__dirname, `./subgraph/${hre.network.name}.json`);
    const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
    const contractAddress = testnetConfig.Bridge;

    const [relayer] = await ethers.getSigners();

    const bridge = new ethers.Contract(
      contractAddress,
      abi,
      relayer
    );

    console.log(`Cancel transaction with wid: ${wid}`);
    try {
      const txResponse = await bridge.cancel2(wid);
      await txResponse.wait();
      console.log("Cancel successful");
    } catch (error) {
      console.error("Cancel failed:", error);
    }
  });

// npx hardhat refund --network localhost --wid <wid>
task("refund", "Refund a transaction")
  .addParam("wid", "The withdraw ID of the withdraw transaction")
  .setAction(async ({ wid }, hre) => {
    const ethers = hre.ethers;
    const abiPath = path.join(__dirname, './artifacts/contracts/bridge/Bridge.sol/Bridge.json');
    const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const testnetConfigPath = path.join(__dirname, `./subgraph/${hre.network.name}.json`);
    const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
    const contractAddress = testnetConfig.Bridge;

    const [owner] = await ethers.getSigners();

    const bridge = new ethers.Contract(
      contractAddress,
      abi,
      owner
    );

    console.log(`Refund transaction with wid: ${wid}`);
    try {
      const txResponse = await bridge.refund(wid);
      await txResponse.wait();
      console.log("Refund successful");
    } catch (error) {
      console.error("Refund failed:", error);
    }
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
    genesis: {
      url: "http://localhost:8545",
        accounts: {
        // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        mnemonic: "test test test test test test test test test test test junk",
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 3456,
      accounts: [
        "0x0fdce9a033c223590e32ffb24e48d8c66bef942464f7e593925c5317fff0d71e", // replayer and owner
        // "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // replayer and owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // GoatFoundation 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
      ],
    },
    devnet: {
      url: "http://3.15.141.150:8545",
      chainId: 2345,
      accounts: [
        '0x0fdce9a033c223590e32ffb24e48d8c66bef942464f7e593925c5317fff0d71e',  // replayer and owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'   // GoatFoundation 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
      ]
    }
  },
  gasReporter: {
    enabled: true,
  },
  ignition: {
    requiredConfirmations: 1,
  },
};

export default config;
