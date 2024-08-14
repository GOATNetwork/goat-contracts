import { task, types } from "hardhat/config";
import GenesisModule from "../ignition/modules/Genesis";
import { PredployedAddress } from "../test/constant";
import fs from "fs/promises";
import { JsonrpcClient, print } from "./jsonrpc";

interface IAccountState {
  balance: string;
  nonce: string;
  code: string;
  storage: { [slot: string]: string };
}

task("create:genesis")
  .addParam("rpc", "rpc endpoint", "http://localhost:8545")
  .addParam("name", "network name", "regtest")
  .addParam("force", "force to rewrite", false, types.boolean)
  .setAction(async (args, hre) => {
    const outputFile = `./ignition/genesis/${args["name"]}.json`;

    try {
      await fs.access(outputFile, fs.constants.R_OK);
      if (!args["force"]) {
        console.log("genesis has created");
        return;
      }
    } catch {}

    const [signer] = await hre.ethers.getSigners();

    const jsonrpc = new JsonrpcClient(args["rpc"]);
    const [coinbase] = await jsonrpc.call<string[]>("eth_accounts");

    {
      console.log("Adding fee from coinbase");
      const txid = await jsonrpc.call<string>("eth_sendTransaction", {
        from: coinbase,
        to: signer.address,
        value: "0x" + (BigInt(1e18) * 1000n).toString(16),
      });

      // todo: `hre.ethers.provider.waitForTransaction(txid, 1)` can't work
      while (!(await hre.ethers.provider.getTransactionReceipt(txid))) {
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    await fs
      .rmdir(`./ignition/deployments/${args["name"]}`, { recursive: true })
      .catch(() => {});

    console.log("Deploying");
    const param = await fs.readFile(`./ignition/${args["name"]}.json`, "utf-8");
    const deployments = await hre.ignition.deploy(GenesisModule, {
      parameters: JSON.parse(param.toString()),
      deploymentId: args["name"],
    });

    const [goatToken, goatFoundation, btcBlock, wgbtc, bridge] =
      await Promise.all([
        deployments.goatToken.getAddress(),
        deployments.goatFoundation.getAddress(),
        deployments.btcBlock.getAddress(),
        deployments.wgbtc.getAddress(),
        deployments.bridge.getAddress(),
      ]);

    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("Getting state");
    const dump: { accounts: { [address: string]: IAccountState } } =
      await hre.ethers.provider.send("debug_dumpBlock", [
        "0x" + blockNumber.toString(16),
      ]);

    const genesis: { [address: string]: IAccountState } = {};

    for (let [address, state] of Object.entries(dump.accounts)) {
      switch (address.toLowerCase()) {
        case goatToken.toLowerCase():
          genesis[PredployedAddress.goatToken] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case goatFoundation.toLowerCase():
          genesis[PredployedAddress.goatFoundation] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case btcBlock.toLowerCase():
          genesis[PredployedAddress.btcBlock] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case wgbtc.toLowerCase():
          genesis[PredployedAddress.wgbtc] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
        case bridge.toLowerCase():
          genesis[PredployedAddress.bridge] = {
            balance: state.balance,
            nonce: state.nonce,
            code: state.code,
            storage: state.storage,
          };
          break;
      }
    }
    console.log("Writing genesis");
    await fs.writeFile(outputFile, JSON.stringify(genesis));
  });
