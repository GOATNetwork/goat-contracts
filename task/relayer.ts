import { task } from "hardhat/config";
import { PredployedAddress } from "../common/constants";
import { hash160, sha256, trim0xPrefix } from "../common/utils";

task("relayer:add")
  .setDescription("send addVoter tx")
  .addOptionalParam(
    "address",
    "the address for the tx key, it should be used with vk-hash param",
  )
  .addOptionalParam(
    "vkHash",
    "the vote key hash, it should be used with address param",
    undefined,
  )
  .addOptionalParam(
    "txKey",
    "the address for the tx key, it should be used with voteKey param",
  )
  .addOptionalParam(
    "voteKey",
    "the address for the tx key, it should be used with txKey param",
  )
  .setAction(async (args, hre) => {
    const relayer = await hre.ethers.getContractAt(
      "Relayer",
      PredployedAddress.relayer,
    );

    let tx;
    if (args["address"] && args["keyHash"]) {
      tx = await relayer.addVoter(args["address"], args["keyHash"]);
    } else if (args["txKey"] && args["voteKey"]) {
      const txKey = Buffer.from(trim0xPrefix(args["txKey"]), "hex");
      if (txKey.length != 33) {
        throw new Error("invalid voter tx key length");
      }
      if (txKey[0] !== 2 && txKey[0] !== 3) {
        throw new Error("invalid voter tx key prefix");
      }
      const address = hre.ethers.getAddress(hash160(txKey));
      const blsKey = Buffer.from(trim0xPrefix(args["voteKey"]), "hex");
      if (blsKey.length != 96) {
        throw new Error("invalid bls key length");
      }
      const voteKeyHash = "0x" + sha256(blsKey);
      console.log("Add relayer from pubkey", { address, voteKeyHash });
      tx = await relayer.addVoter(address, voteKeyHash);
    } else {
      throw new Error("No valid voter param");
    }

    console.log("waiting for txid", tx.hash);
    const receipt = await tx.wait(1);
    console.log("success", receipt?.status === 1);
    console.log("cost", hre.ethers.formatEther(receipt!.fee));
    if (receipt!.status == 1) {
      console.log(relayer.interface.parseLog(receipt!.logs[0]));
    }
  });

task("relayer:remove")
  .setDescription("send removeVoter tx")
  .addParam("address", "the voter address")
  .setAction(async (args, hre) => {
    const relayer = await hre.ethers.getContractAt(
      "Relayer",
      PredployedAddress.relayer,
    );
    const tx = await relayer.removeVoter(args["address"]);
    console.log("waiting for txid", tx.hash);
    const receipt = await tx.wait(1);
    console.log("success", receipt?.status === 1);
    console.log("cost", hre.ethers.formatEther(receipt!.fee));
    if (receipt!.status == 1) {
      console.log(relayer.interface.parseLog(receipt!.logs[0]));
    }
  });
