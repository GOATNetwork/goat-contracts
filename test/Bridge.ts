import { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bytesToHex, getAddress, parseEther } from "viem";

import { Executors, PredployedAddress } from "../common/constants.js";

const maxBasisPoints = 10_000n;

describe("Bridge", async () => {
  const { viem, networkHelpers } = await network.create();
  const address1 =
    "bc1qen5kv3c0epd9yfqvu2q059qsjpwu9hdjywx2v9p5p9l8msxn88fs9y5kx6";
  const invalidAddress = "invalid";
  const prefix = bytesToHex(Buffer.from("GTV0"));

  async function fixture() {
    const [owner, payer, ...others] = await viem.getWalletClients();
    const bridge = await viem.deployContract("Bridge", [
      owner.account.address,
      prefix,
    ]);
    await networkHelpers.impersonateAccount(Executors.relayer);
    await payer.sendTransaction({
      to: Executors.relayer,
      value: parseEther("10"),
    });
    return {
      owner,
      others,
      bridge,
      relayer: await viem.getWalletClient(Executors.relayer),
    };
  }

  describe("deposit", async () => {
    const deposit = {
      id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
      txout: 1,
      amount: 10n ** 18n,
      tax: 0n,
    } as const;

    it("default", async () => {
      const { bridge, owner } = await networkHelpers.loadFixture(fixture);
      const [actualPrefix] = await bridge.read.depositParam();
      assert.equal(actualPrefix, prefix);
      assert.equal(
        getAddress(await bridge.read.owner()),
        getAddress(owner.account.address),
      );
      assert.equal(await bridge.read.REQUEST_PER_BLOCK(), 32n);
    });

    it("setConfirmationNumber", async () => {
      const { bridge, others } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomErrorWithArgs(
        bridge.write.setConfirmationNumber([1], {
          account: others[0].account,
        }),
        bridge,
        "OwnableUnauthorizedAccount",
        [others[0].account.address],
      );
      await viem.assertions.revertWith(
        bridge.write.setConfirmationNumber([0]),
        "number too low",
      );
      await viem.assertions.emitWithArgs(
        bridge.write.setConfirmationNumber([1]),
        bridge,
        "ConfirmationNumberUpdated",
        [1],
      );
      const [, , , , confirmations] = await bridge.read.depositParam();
      assert.equal(confirmations, 1);
    });

    it("setMinDeposit", async () => {
      const { bridge, others } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomErrorWithArgs(
        bridge.write.setMinDeposit([1n], { account: others[0].account }),
        bridge,
        "OwnableUnauthorizedAccount",
        [others[0].account.address],
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setMinDeposit([0n]),
        bridge,
        "InvalidThreshold",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setMinDeposit([10n ** 10n + 1n]),
        bridge,
        "InvalidThreshold",
      );
      const minimum = 10n ** 15n;
      await viem.assertions.emitWithArgs(
        bridge.write.setMinDeposit([minimum]),
        bridge,
        "MinDepositUpdated",
        [minimum],
      );
      const [, actualMinimum] = await bridge.read.depositParam();
      assert.equal(actualMinimum, minimum);
    });

    it("setDepositTax", async () => {
      const { bridge, others } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomErrorWithArgs(
        bridge.write.setDepositTax([1, 1n], { account: others[0].account }),
        bridge,
        "OwnableUnauthorizedAccount",
        [others[0].account.address],
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setDepositTax([101, 1n]),
        bridge,
        "InvalidTax",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setDepositTax([1, 10n ** 10n + 1n]),
        bridge,
        "InvalidTax",
      );
      const basisPoints = 2;
      const maximum = 10n ** 13n;
      await viem.assertions.emitWithArgs(
        bridge.write.setDepositTax([basisPoints, maximum]),
        bridge,
        "DepositTaxUpdated",
        [basisPoints, maximum],
      );
      const [, , actualBasisPoints, actualMaximum] =
        await bridge.read.depositParam();
      assert.equal(actualBasisPoints, basisPoints);
      assert.equal(actualMaximum, maximum);
    });

    it("invalid", async () => {
      const { bridge, owner } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomError(
        bridge.write.deposit([
          deposit.id,
          deposit.txout,
          owner.account.address,
          deposit.amount,
          0n,
        ]),
        bridge,
        "AccessDenied",
      );
    });

    it("no tax", async () => {
      const { bridge, owner, relayer } =
        await networkHelpers.loadFixture(fixture);
      await viem.assertions.emitWithArgs(
        bridge.write.deposit(
          [
            deposit.id,
            deposit.txout,
            owner.account.address,
            deposit.amount,
            deposit.tax,
          ],
          { account: relayer.account },
        ),
        bridge,
        "Deposit",
        [
          owner.account.address,
          deposit.id,
          deposit.txout,
          deposit.amount,
          deposit.tax,
        ],
      );
      assert.equal(
        await bridge.read.isDeposited([deposit.id, deposit.txout]),
        true,
      );
      await viem.assertions.revertWith(
        bridge.write.deposit(
          [deposit.id, deposit.txout, owner.account.address, 10n ** 18n, 0n],
          { account: relayer.account },
        ),
        "duplicated",
      );
    });
  });

  describe("withdraw", async () => {
    it("invalid", async () => {
      const { bridge } = await networkHelpers.loadFixture(fixture);
      await bridge.write.setWithdrawalTax([0, 0n]);
      const amount = 10n ** 15n;
      await viem.assertions.revertWith(
        bridge.write.withdraw([invalidAddress, 1], { value: amount }),
        "invalid address",
      );
      await viem.assertions.revertWith(
        bridge.write.withdraw([address1, 1], { value: 1n }),
        "amount too low",
      );
      await viem.assertions.revertWith(
        bridge.write.withdraw([address1, 0], { value: amount }),
        "invalid tx price",
      );
      await viem.assertions.revertWith(
        bridge.write.withdraw([address1, 400], { value: amount }),
        "unaffordable",
      );
    });

    it("tax without limit", async () => {
      const { owner, bridge } = await networkHelpers.loadFixture(fixture);
      const amount = 10n ** 18n;
      const taxRate = 20;
      await bridge.write.setWithdrawalTax([taxRate, 0n]);
      const tax = (amount * BigInt(taxRate)) / maxBasisPoints;
      await viem.assertions.emitWithArgs(
        bridge.write.withdraw([address1, 1], { value: amount }),
        bridge,
        "Withdraw",
        [0n, owner.account.address, amount - tax, tax, 1, address1],
      );
    });

    it("default tax", async () => {
      const { bridge, owner, relayer } =
        await networkHelpers.loadFixture(fixture);
      const [, taxRate, maximumTax] = await bridge.read.withdrawParam();
      assert.equal(taxRate, 20);
      assert.equal(maximumTax, 10n ** 9n * 2_000_000n);

      const withdrawalId = 0n;
      const amount = 5n * 10n ** 19n;
      const transactionPrice = 1;
      let tax = (amount * BigInt(taxRate)) / maxBasisPoints;
      if (tax > maximumTax) tax = maximumTax;

      await viem.assertions.emitWithArgs(
        bridge.write.withdraw([address1, transactionPrice], { value: amount }),
        bridge,
        "Withdraw",
        [
          withdrawalId,
          owner.account.address,
          amount - tax,
          tax,
          transactionPrice,
          address1,
        ],
      );

      const publicClient = await viem.getPublicClient();
      {
        const [sender, maxTxPrice, status, actualAmount, actualTax, updatedAt] =
          await bridge.read.withdrawals([withdrawalId]);
        assert.equal(getAddress(sender), getAddress(owner.account.address));
        assert.equal(actualAmount, amount - tax);
        assert.equal(actualTax, tax);
        assert.equal(maxTxPrice, transactionPrice);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
        assert.equal(status, 1);
        assert.equal(actualAmount + actualTax, amount);
        assert.equal(
          await publicClient.getBalance({ address: bridge.address }),
          amount,
        );
      }

      await networkHelpers.time.increase(301);
      const newTransactionPrice = transactionPrice + 1;
      await viem.assertions.emitWithArgs(
        bridge.write.replaceByFee([withdrawalId, newTransactionPrice]),
        bridge,
        "RBF",
        [withdrawalId, newTransactionPrice],
      );
      {
        const [, maxTxPrice, status, , , updatedAt] =
          await bridge.read.withdrawals([withdrawalId]);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
        assert.equal(maxTxPrice, newTransactionPrice);
        assert.equal(status, 1);
      }

      const transactionId =
        "0xf52fe3ace5eff20c3d2edd6559bd160f2f91f7db297d39a9ce15e836bda75e7b";
      const fee = 1000n;
      const paid = amount - tax - fee;
      await viem.assertions.emitWithArgs(
        bridge.write.paid([withdrawalId, transactionId, 0, paid], {
          account: relayer.account,
        }),
        bridge,
        "Paid",
        [withdrawalId, transactionId, 0, paid],
      );
      {
        const [, , status, , , updatedAt] = await bridge.read.withdrawals([
          withdrawalId,
        ]);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
        assert.equal(status, 5);
        assert.equal(
          await publicClient.getBalance({ address: bridge.address }),
          0n,
        );
        assert.equal(
          await publicClient.getBalance({
            address: PredployedAddress.goatFoundation,
          }),
          tax,
        );
      }
    });

    it("no tax", async () => {
      const { bridge, owner } = await networkHelpers.loadFixture(fixture);
      await bridge.write.setWithdrawalTax([0, 0n]);
      const amount = 10n ** 18n;
      await viem.assertions.emitWithArgs(
        bridge.write.withdraw([address1, 1], { value: amount }),
        bridge,
        "Withdraw",
        [0n, owner.account.address, amount, 0n, 1, address1],
      );
      const [sender, maxTxPrice, status, actualAmount, tax, updatedAt] =
        await bridge.read.withdrawals([0n]);
      assert.equal(getAddress(sender), getAddress(owner.account.address));
      assert.equal(actualAmount, amount);
      assert.equal(tax, 0n);
      assert.equal(maxTxPrice, 1);
      assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
      assert.equal(status, 1);
    });

    it("no tax but dust", async () => {
      const { bridge, owner } = await networkHelpers.loadFixture(fixture);
      await bridge.write.setWithdrawalTax([0, 0n]);
      const dust = 100n;
      const amount = 10n ** 18n + dust;
      await viem.assertions.emitWithArgs(
        bridge.write.withdraw([address1, 1], { value: amount }),
        bridge,
        "Withdraw",
        [0n, owner.account.address, amount - dust, dust, 1, address1],
      );
      const [sender, maxTxPrice, status, actualAmount, tax, updatedAt] =
        await bridge.read.withdrawals([0n]);
      assert.equal(getAddress(sender), getAddress(owner.account.address));
      assert.equal(actualAmount, amount - dust);
      assert.equal(tax, dust);
      assert.equal(maxTxPrice, 1);
      assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
      assert.equal(status, 1);
    });

    it("cancel", async () => {
      const { bridge, owner, others, relayer } =
        await networkHelpers.loadFixture(fixture);
      const amount = 10n ** 18n;
      const withdrawalId = 0n;
      await bridge.write.withdraw([address1, 1], { value: amount });

      await viem.assertions.revertWithCustomError(
        bridge.write.cancel1([withdrawalId], { account: others[0].account }),
        bridge,
        "AccessDenied",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.cancel1([withdrawalId]),
        bridge,
        "RequestTooFrequent",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.cancel2([withdrawalId]),
        bridge,
        "AccessDenied",
      );

      await networkHelpers.time.increase(301);
      await viem.assertions.emitWithArgs(
        bridge.write.cancel1([withdrawalId]),
        bridge,
        "Canceling",
        [withdrawalId],
      );
      {
        const [, , status, , , updatedAt] = await bridge.read.withdrawals([
          withdrawalId,
        ]);
        assert.equal(status, 2);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
      }

      await viem.assertions.revertWithCustomError(
        bridge.write.cancel1([withdrawalId]),
        bridge,
        "Forbidden",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.refund([withdrawalId]),
        bridge,
        "Forbidden",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.cancel2([withdrawalId]),
        bridge,
        "AccessDenied",
      );
      await viem.assertions.emitWithArgs(
        bridge.write.cancel2([withdrawalId], { account: relayer.account }),
        bridge,
        "Canceled",
        [withdrawalId],
      );
      {
        const [, , status, , , updatedAt] = await bridge.read.withdrawals([
          withdrawalId,
        ]);
        assert.equal(status, 3);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
      }
      await viem.assertions.revert(
        bridge.write.cancel2([withdrawalId], { account: relayer.account }),
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.refund([withdrawalId], { account: others[0].account }),
        bridge,
        "AccessDenied",
      );

      const publicClient = await viem.getPublicClient();
      const bridgeBalanceBefore = await publicClient.getBalance({
        address: bridge.address,
      });
      const ownerBalanceBefore = await publicClient.getBalance({
        address: owner.account.address,
      });
      await networkHelpers.setNextBlockBaseFeePerGas(0n);
      await viem.assertions.emitWithArgs(
        bridge.write.refund([withdrawalId], { gasPrice: 0n }),
        bridge,
        "Refund",
        [withdrawalId],
      );
      const bridgeBalanceAfter = await publicClient.getBalance({
        address: bridge.address,
      });
      const ownerBalanceAfter = await publicClient.getBalance({
        address: owner.account.address,
      });
      assert.equal(bridgeBalanceBefore - bridgeBalanceAfter, amount);
      assert.equal(ownerBalanceAfter - ownerBalanceBefore, amount);
      {
        const [, , status, , , updatedAt] = await bridge.read.withdrawals([
          withdrawalId,
        ]);
        assert.equal(status, 4);
        assert.equal(updatedAt, BigInt(await networkHelpers.time.latest()));
      }
      await viem.assertions.revertWithCustomError(
        bridge.write.refund([withdrawalId]),
        bridge,
        "Forbidden",
      );
    });

    it("setMinWithdrawal", async () => {
      const { bridge, others } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomErrorWithArgs(
        bridge.write.setMinWithdrawal([1n], { account: others[0].account }),
        bridge,
        "OwnableUnauthorizedAccount",
        [others[0].account.address],
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setMinWithdrawal([0n]),
        bridge,
        "InvalidThreshold",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setMinWithdrawal([10n ** 10n + 1n]),
        bridge,
        "InvalidThreshold",
      );
      const minimum = 10n ** 15n;
      await viem.assertions.emitWithArgs(
        bridge.write.setMinWithdrawal([minimum]),
        bridge,
        "MinWithdrawalUpdated",
        [minimum],
      );
      const [actualMinimum] = await bridge.read.withdrawParam();
      assert.equal(actualMinimum, minimum);
    });

    it("setWithdrawalTax", async () => {
      const { bridge, others } = await networkHelpers.loadFixture(fixture);
      await viem.assertions.revertWithCustomErrorWithArgs(
        bridge.write.setWithdrawalTax([1, 1n], {
          account: others[0].account,
        }),
        bridge,
        "OwnableUnauthorizedAccount",
        [others[0].account.address],
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setWithdrawalTax([101, 1n]),
        bridge,
        "InvalidTax",
      );
      await viem.assertions.revertWithCustomError(
        bridge.write.setWithdrawalTax([1, 10n ** 10n + 1n]),
        bridge,
        "InvalidTax",
      );
      const basisPoints = 2;
      const maximum = 10n ** 13n;
      await viem.assertions.emitWithArgs(
        bridge.write.setWithdrawalTax([basisPoints, maximum]),
        bridge,
        "WithdrawalTaxUpdated",
        [basisPoints, maximum],
      );
      const [, actualBasisPoints, actualMaximum] =
        await bridge.read.withdrawParam();
      assert.equal(actualBasisPoints, basisPoints);
      assert.equal(actualMaximum, maximum);
    });
  });
});
