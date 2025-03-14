import { task } from "hardhat/config";
import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import { PredployedAddress } from "../common/constants";
import { hash160, trimPubKeyPrefix } from "../common/utils";

task("locking:create")
  .setDescription("Create a new validator")
  .addParam("validator", "the validator address")
  .addParam("owner", "the validator owner")
  .addParam(
    "pubkey",
    "the validator pubkey in hex format, which is used to prove the ownership",
  )
  .addParam("signature", "the signature for proving the validator's ownership")
  .setAction(async (args, hre) => {
    if (!hre.ethers.isAddress(args.validator)) {
      throw new Error(`validator ${args.validator} is not address`);
    }

    // parse the pubkey
    const uncompressed = trimPubKeyPrefix(
      hre.ethers.SigningKey.computePublicKey(args.pubkey, false),
    );
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];

    // parse the signature
    const sig = hre.ethers.Signature.from(args.signature);
    const validatorPubkey = trimPubKeyPrefix(
      hre.ethers.SigningKey.computePublicKey(args.pubkey, true),
    );
    const validatorAddress = hre.ethers.getAddress(hash160(validatorPubkey));
    if (validatorAddress.toLowerCase() !== args.validator.toLowerCase()) {
      throw new Error(
        `Validator address mismatched: want ${args.validator} bug got ${validatorAddress}`,
      );
    }

    const [signer] = await hre.ethers.getSigners();
    if (signer.address.toLowerCase() !== args.owner.toLowerCase()) {
      throw new Error(`owner ${args.owner} is not current wallet owner`);
    }

    const contract = await hre.ethers.getContractAt(
      "Locking",
      PredployedAddress.locking,
    );

    // check if the validator is approved
    let approved = await contract.approvals(args.validator);
    if (!approved) {
      // if the zero address is approved
      // it means you don't require the approval to create a validator
      approved = await contract.approvals(hre.ethers.ZeroAddress);
      if (!approved) {
        throw new Error("validator not approved");
      }
    }

    console.log("I'm sure that my node is fully synced");
    const prompt = readline.createInterface({ input: stdin, output: stdout });
    const answer = await prompt.question(
      "Do you want to continue? (Only 'yes' will be accepted to approve) ",
    );
    if (answer !== "yes") {
      console.log("Okay, I will exit");
      return;
    }

    // check if you have enough balance to create a validator
    const threshold = await contract.creationThreshold();
    let native = 0n;
    for (const { token, amount } of threshold) {
      // the zero address represents the native token(btc)
      if (token === hre.ethers.ZeroAddress) {
        native = amount;
        const balance = await hre.ethers.provider.getBalance(signer.address);
        if (balance < amount) {
          throw new Error(
            `not enough btc balance: min ${hre.ethers.formatEther(amount)} have ${hre.ethers.formatEther(balance)}`,
          );
        }
      } else {
        const erc20 = await hre.ethers.getContractAt("ERC20", token);
        const symbol = await erc20.symbol();
        const balance = await erc20.balanceOf(signer.address);
        if (balance < amount) {
          throw new Error(
            `not enough ${symbol} balance: min ${hre.ethers.formatEther(amount)} have ${hre.ethers.formatEther(balance)}`,
          );
        }
        // approve the contract to transfer the token
        const allowance = await erc20.allowance(
          signer.address,
          PredployedAddress.relayer,
        );
        if (allowance < amount) {
          console.log(`approve ${symbol} token to relayer`);
          const tx = await erc20.approve(
            PredployedAddress.relayer,
            allowance - amount,
          );
          await tx.wait(2);
        }
      }
    }

    // create the validator
    console.log(`create validator`);
    const tx = await contract.create(pubkey, sig.r, sig.s, sig.v, {
      value: native,
    });
    await tx.wait(2);
    console.log(`done: ${tx.hash}`);
  });
