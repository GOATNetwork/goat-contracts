import { HardhatRuntimeEnvironment } from "hardhat/types";
import { loadAnvilState } from "../../common/anvil";
import { PredployedAddress } from "../../common/constants";
import { GoatToken } from "../../typechain-types";
import { GoatTokenParam } from "./param";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: GoatTokenParam,
) => {
  console.log("Deploy goat token");

  const [signer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("GoatToken");

  const goatToken: GoatToken = await factory.deploy(signer);

  for (const item of param.transfers) {
    let amount = 0n;
    if (typeof item.value === "string" && item.value.endsWith("ether")) {
      amount = hre.ethers.parseEther(item.value.slice(0, -5));
    } else {
      amount = BigInt(item.value);
    }
    console.log(
      "transfer token to",
      item.to,
      "amount",
      hre.ethers.formatEther(amount),
    );
    await goatToken.transfer(item.to, amount);
  }

  const balance = await goatToken.balanceOf(signer);
  if (balance > 0n) {
    console.log(
      "Transfer remain goat tokens to owner",
      param.owner,
      hre.ethers.formatEther(balance),
    );
    await goatToken.transfer(param.owner, balance);
  }

  const dump = loadAnvilState(
    await hre.ethers.provider.send("anvil_dumpState"),
  );
  const goatTokenAddress = await goatToken.getAddress();
  console.log("Apply state to canonical address", PredployedAddress.goatToken);
  let init = false;
  for (const [address, state] of Object.entries(dump.accounts)) {
    if (address.toLowerCase() === goatTokenAddress.toLowerCase()) {
      console.log("Initialize state for canonical goat token");
      await hre.ethers.provider.send("anvil_setCode", [
        PredployedAddress.goatToken,
        state.code,
      ]);
      for (const [slot, data] of Object.entries(state.storage)) {
        await hre.ethers.provider.send("anvil_setStorageAt", [
          PredployedAddress.goatToken,
          slot,
          data,
        ]);
      }
      init = true;
      break;
    }
  }
  if (!init) {
    throw new Error("canonical goat token is not initialized");
  }
  return goatTokenAddress;
};
