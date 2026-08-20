import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { formatEther, getAddress, isHex, parseEther } from "viem";

import { loadAnvilState } from "../../common/anvil.js";
import { PredployedAddress } from "../../common/constants.js";
import type { GoatTokenParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: GoatTokenParam,
) => {
  console.log("Deploy goat token");
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const goatToken = await viem.deployContract("GoatToken", [
    signer.account.address,
  ]);

  for (const item of param.transfers) {
    const amount =
      typeof item.value === "string" && item.value.endsWith("ether")
        ? parseEther(item.value.slice(0, -5))
        : BigInt(item.value);
    console.log("transfer token to", item.to, "amount", formatEther(amount));
    await goatToken.write.transfer([getAddress(item.to), amount]);
  }

  const balance = await goatToken.read.balanceOf([signer.account.address]);
  if (balance > 0n) {
    console.log(
      "Transfer remain goat tokens to owner",
      param.owner,
      formatEther(balance),
    );
    await goatToken.write.transfer([getAddress(param.owner), balance]);
  }

  const testClient = await viem.getTestClient();
  const dump = loadAnvilState(await testClient.dumpState());
  console.log("Apply state to canonical address", PredployedAddress.goatToken);
  let initialized = false;
  for (const [address, state] of Object.entries(dump.accounts)) {
    if (address.toLowerCase() === goatToken.address.toLowerCase()) {
      console.log("Initialize state for canonical goat token");
      await testClient.setCode({
        address: PredployedAddress.goatToken,
        bytecode: state.code,
      });
      for (const [slot, value] of Object.entries(state.storage)) {
        if (!isHex(slot)) {
          throw new Error(`invalid storage slot ${slot}`);
        }
        await testClient.setStorageAt({
          address: PredployedAddress.goatToken,
          index: slot,
          value,
        });
      }
      initialized = true;
      break;
    }
  }
  if (!initialized) {
    throw new Error("canonical goat token is not initialized");
  }
  return goatToken.address;
};
