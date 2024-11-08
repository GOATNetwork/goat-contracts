import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Executors } from "../../common/constants";
import { Bridge } from "../../typechain-types";
import { BridgeParam } from "./param";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: BridgeParam,
) => {
  console.log("Deploy bridge");
  const factory = await hre.ethers.getContractFactory("Bridge");

  const [signer] = await hre.ethers.getSigners();
  const prefix = Buffer.from(param.depositPrefixMagic);
  if (prefix.length != 4) {
    throw new Error("Invalid deposit prefix magic length");
  }

  const contract: Bridge = await factory.deploy(signer, prefix);
  // validator should deposit first
  const relayer = await hre.ethers.getImpersonatedSigner(Executors.relayer);
  await signer.sendTransaction({ to: Executors.relayer, value: BigInt(1e18) });
  for (const deposit of param.deposits) {
    console.log("Add deposit", deposit);
    if (deposit.txid.startsWith("0x")) {
      throw new Error(`txid has 0x prefix`);
    }
    if (!Number.isInteger(deposit.satoshi)) {
      throw new Error(`amount is not integer`);
    }
    const txid = Buffer.from(deposit.txid, "hex").reverse();
    const amount = BigInt(1e10) * BigInt(deposit.satoshi);
    await contract
      .connect(relayer)
      .deposit(txid, deposit.txout, deposit.address, amount, 0);
    await signer.sendTransaction({ to: deposit.address, value: amount });
  }

  if (param.depositTaxBP && param.maxDepositTaxInSat) {
    console.log(
      "Set bridge deposit tax",
      "bp",
      param.depositTaxBP,
      "max",
      param.maxDepositTaxInSat,
    );
    await contract.setDepositTax(
      BigInt(param.depositTaxBP),
      BigInt(param.maxDepositTaxInSat) * BigInt(1e10),
    );
  }

  if (param.withdrawalTaxBP && param.maxWithdrawalTaxInSat) {
    console.log(
      "Set bridge withdrawal tax",
      "bp",
      param.withdrawalTaxBP,
      "max",
      param.maxWithdrawalTaxInSat,
    );
    await contract.setWithdrawalTax(
      BigInt(param.withdrawalTaxBP),
      BigInt(param.maxWithdrawalTaxInSat) * BigInt(1e10),
    );
  }

  if (param.minWithdrawalInSat) {
    console.log(
      "Set bridge min withdrawal value",
      "value",
      param.minWithdrawalInSat,
    );
    const value = BigInt(param.minWithdrawalInSat) * BigInt(1e10);
    await contract.setMinWithdrawal(value);
  }

  if (param.minDepositInSat) {
    console.log("Set bridge min deposit value", "value", param.minDepositInSat);
    const value = BigInt(param.minDepositInSat) * BigInt(1e10);
    await contract.setMinDeposit(value);
  }

  if (param.confirmationNumber) {
    console.log("Set confirmation number", "value", param.confirmationNumber);
    await contract.setConfirmationNumber(BigInt(param.confirmationNumber));
  }

  console.log("Transfer back bridge owner", param.owner);
  await contract.transferOwnership(param.owner);
  return contract.getAddress();
};
