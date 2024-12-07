import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Executors, SATOSHI } from "../../common/constants";
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
    const txid = Buffer.from(deposit.txid, "hex").reverse();
    const amount = SATOSHI * BigInt(deposit.satoshi);
    await contract
      .connect(relayer)
      .deposit(txid, deposit.txout, deposit.address, amount, 0);
    await signer.sendTransaction({ to: deposit.address, value: amount });
  }

  if (
    param.depositTaxBP !== undefined &&
    param.maxDepositTaxInSat !== undefined
  ) {
    console.log(
      "Set bridge deposit tax",
      "bp",
      param.depositTaxBP,
      "max",
      param.maxDepositTaxInSat,
    );
    await contract.setDepositTax(
      BigInt(param.depositTaxBP),
      BigInt(param.maxDepositTaxInSat) * SATOSHI,
    );
  }

  if (
    param.withdrawalTaxBP !== undefined &&
    param.maxWithdrawalTaxInSat !== undefined
  ) {
    console.log(
      "Set bridge withdrawal tax",
      "bp",
      param.withdrawalTaxBP,
      "max",
      param.maxWithdrawalTaxInSat,
    );
    await contract.setWithdrawalTax(
      BigInt(param.withdrawalTaxBP),
      BigInt(param.maxWithdrawalTaxInSat) * SATOSHI,
    );
  }

  if (param.minWithdrawalInSat) {
    console.log(
      "Set bridge min withdrawal value",
      "value",
      param.minWithdrawalInSat,
    );
    const value = BigInt(param.minWithdrawalInSat) * SATOSHI;
    await contract.setMinWithdrawal(value);
  }

  if (param.minDepositInSat) {
    console.log("Set bridge min deposit value", "value", param.minDepositInSat);
    const value = BigInt(param.minDepositInSat) * SATOSHI;
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
