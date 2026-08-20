import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { bytesToHex, getAddress } from "viem";

import { Executors, SATOSHI } from "../../common/constants.js";
import type { BridgeParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: BridgeParam,
) => {
  console.log("Deploy bridge");
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const prefixBytes = Buffer.from(param.depositPrefixMagic);
  if (prefixBytes.length !== 4) {
    throw new Error("Invalid deposit prefix magic length");
  }
  const prefix = bytesToHex(prefixBytes);
  const contract = await viem.deployContract("Bridge", [
    signer.account.address,
    prefix,
  ]);

  const testClient = await viem.getTestClient();
  await testClient.impersonateAccount({ address: Executors.relayer });
  const relayer = await viem.getWalletClient(Executors.relayer);
  await signer.sendTransaction({ to: Executors.relayer, value: 10n ** 18n });

  for (const deposit of param.deposits) {
    console.log("Add deposit", deposit);
    if (deposit.txid.startsWith("0x")) {
      throw new Error("txid has 0x prefix");
    }
    const txid = bytesToHex(Buffer.from(deposit.txid, "hex").reverse());
    const amount = SATOSHI * BigInt(deposit.satoshi);
    await contract.write.deposit(
      [txid, deposit.txout, getAddress(deposit.address), amount, 0n],
      { account: relayer.account },
    );
    await signer.sendTransaction({
      to: getAddress(deposit.address),
      value: amount,
    });
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
    await contract.write.setDepositTax([
      Number(param.depositTaxBP),
      BigInt(param.maxDepositTaxInSat) * SATOSHI,
    ]);
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
    await contract.write.setWithdrawalTax([
      Number(param.withdrawalTaxBP),
      BigInt(param.maxWithdrawalTaxInSat) * SATOSHI,
    ]);
  }

  if (param.minWithdrawalInSat) {
    console.log(
      "Set bridge min withdrawal value",
      "value",
      param.minWithdrawalInSat,
    );
    await contract.write.setMinWithdrawal([
      BigInt(param.minWithdrawalInSat) * SATOSHI,
    ]);
  }

  if (param.minDepositInSat) {
    console.log("Set bridge min deposit value", "value", param.minDepositInSat);
    await contract.write.setMinDeposit([
      BigInt(param.minDepositInSat) * SATOSHI,
    ]);
  }

  if (param.confirmationNumber) {
    console.log("Set confirmation number", "value", param.confirmationNumber);
    await contract.write.setConfirmationNumber([param.confirmationNumber]);
  }

  console.log("Transfer back bridge owner", param.owner);
  await contract.write.transferOwnership([getAddress(param.owner)]);
  return contract.address;
};
