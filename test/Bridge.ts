import {
  impersonateAccount,
  loadFixture,
  setNextBlockBaseFeePerGas,
  time as timeHelper,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Executors, PredployedAddress } from "../common/constants";
import { Bridge } from "../typechain-types";

describe("Bridge", async () => {
  const addr1 =
    "bc1qen5kv3c0epd9yfqvu2q059qsjpwu9hdjywx2v9p5p9l8msxn88fs9y5kx6";
  const addr2 = "invalid";

  const prefix = Buffer.from("GTV0");

  const relayer = Executors.relayer;

  async function fixture() {
    const [owner, payer, ...others] = await ethers.getSigners();

    const bridgeFactory = await ethers.getContractFactory("Bridge");

    const bridge: Bridge = await bridgeFactory.deploy(owner, prefix);

    await impersonateAccount(relayer);

    await payer.sendTransaction({
      to: relayer,
      value: ethers.parseEther("10"),
    });

    return {
      owner,
      others,
      bridge,
      relayer: await ethers.getSigner(relayer),
    };
  }

  describe("deposit", async () => {
    const tx1 = {
      id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
      txout: 1n,
      amount: BigInt(1e18),
      tax: 0n,
    };

    it("default", async () => {
      const { bridge, owner } = await loadFixture(fixture);
      const param = await bridge.depositParam();
      await expect(param.prefix).eq("0x" + prefix.toString("hex"));
      await expect(await bridge.owner()).eq(owner);
      await expect(await bridge.REQUEST_PER_BLOCK()).eq(32);
    });

    it("setConfirmationNumber", async () => {
      const { bridge, others } = await loadFixture(fixture);
      await expect(bridge.connect(others[0]).setConfirmationNumber(1))
        .revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
        .withArgs(others[0]);
      await expect(bridge.setConfirmationNumber(0)).revertedWith(
        "number too low",
      );
      await expect(bridge.setConfirmationNumber(1))
        .emit(bridge, "ConfirmationNumberUpdated")
        .withArgs(1);
      const param = await bridge.depositParam();
      expect(param.confirmations).eq(1);
    });

    it("setMinDeposit", async () => {
      const { bridge, others } = await loadFixture(fixture);
      await expect(bridge.connect(others[0]).setMinDeposit(1))
        .revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
        .withArgs(others[0]);
      await expect(bridge.setMinDeposit(0)).revertedWithCustomError(
        bridge,
        "InvalidThreshold",
      );
      await expect(bridge.setMinDeposit(1e10 + 1)).revertedWithCustomError(
        bridge,
        "InvalidThreshold",
      );
      const min = BigInt(1e15);
      await expect(bridge.setMinDeposit(min))
        .emit(bridge, "MinDepositUpdated")
        .withArgs(min);
      const param = await bridge.depositParam();
      expect(param.min).eq(min);
    });

    it("setDepositTax", async () => {
      const { bridge, others } = await loadFixture(fixture);
      await expect(bridge.connect(others[0]).setDepositTax(1, 1))
        .revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
        .withArgs(others[0]);
      await expect(bridge.setDepositTax(0, 1)).revertedWithCustomError(
        bridge,
        "InvalidTax",
      );
      await expect(bridge.setDepositTax(1, 0)).revertedWithCustomError(
        bridge,
        "InvalidTax",
      );
      await expect(bridge.setDepositTax(1, 1e10 + 1)).revertedWithCustomError(
        bridge,
        "InvalidTax",
      );
      const bp = 2n;
      const max = BigInt(1e13);
      await expect(bridge.setDepositTax(bp, max))
        .emit(bridge, "DepositTaxUpdated")
        .withArgs(bp, max);
      const param = await bridge.depositParam();
      expect(param.taxRate).eq(bp);
      expect(param.maxTax).eq(max);
    });

    it("invalid", async () => {
      const { bridge, owner } = await loadFixture(fixture);
      await expect(
        bridge.deposit(tx1.id, tx1.txout, owner, tx1.amount, 0),
        "deposit by non-relayer",
      ).revertedWithCustomError(bridge, "AccessDenied");
    });

    it("no tax", async () => {
      const { bridge, owner, relayer } = await loadFixture(fixture);

      await expect(
        await bridge
          .connect(relayer)
          .deposit(tx1.id, tx1.txout, owner, tx1.amount, tx1.tax),
      )
        .emit(bridge, "Deposit")
        .withArgs(owner.address, tx1.id, tx1.txout, tx1.amount, tx1.tax);

      await expect(await bridge.isDeposited(tx1.id, tx1.txout)).to.be.true;

      await expect(
        bridge
          .connect(relayer)
          .deposit(tx1.id, tx1.txout, owner, BigInt(1e18), 0n),
      ).to.be.revertedWith("duplicated");
    });
  });

  describe("withdraw", async () => {
    it("invalid", async () => {
      const { bridge } = await loadFixture(fixture);

      await setNextBlockBaseFeePerGas(0);
      await bridge.setWithdrawalTax(0, 0, { gasPrice: 0 });

      const amount = BigInt(1e10 * 1e5);
      const txPrice = 1n;

      await expect(
        bridge.withdraw(addr2, txPrice, { value: amount }),
      ).revertedWith("invalid address");

      await expect(bridge.withdraw(addr1, 1, { value: 1n })).revertedWith(
        "amount too low",
      );

      await expect(bridge.withdraw(addr1, 0, { value: amount })).revertedWith(
        "invalid tx price",
      );

      await expect(bridge.withdraw(addr1, 400, { value: amount })).revertedWith(
        "unaffordable",
      );
    });

    it("default tax", async () => {
      const { bridge, owner, relayer } = await loadFixture(fixture);

      const param = await bridge.withdrawParam();
      expect(param.taxRate).eq(20n);
      expect(param.maxTax).eq((BigInt(1e18) * 20n) / BigInt(1e4));

      const wid = 0n;
      const amount = BigInt(1e18);
      const txPrice = 1n;

      const tax = (amount * param.taxRate) / BigInt(1e4);

      await expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(wid, owner.address, amount - tax, tax, txPrice, addr1);

      // pending
      {
        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.sender).eq(owner.address);
        expect(withdrawal.amount).eq(amount - tax);
        expect(withdrawal.tax).eq(tax);
        expect(withdrawal.maxTxPrice).eq(txPrice);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
        expect(withdrawal.status).eq(1);
        expect(withdrawal.amount + withdrawal.tax, "actual + tax = amount").eq(
          amount,
        );

        expect(
          await ethers.provider.getBalance(await bridge.getAddress()),
          "bridge balance",
        ).eq(amount);
      }

      // rbf
      {
        await timeHelper.increase(300n + 1n);

        const newTxPrice = txPrice + 1n;
        await expect(await bridge.replaceByFee(wid, txPrice + 1n))
          .emit(bridge, "RBF")
          .withArgs(wid, newTxPrice);

        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
        expect(withdrawal.maxTxPrice).eq(newTxPrice);
        expect(withdrawal.status).eq(1);
      }

      // paid
      {
        const txid =
          "0xf52fe3ace5eff20c3d2edd6559bd160f2f91f7db297d39a9ce15e836bda75e7b";
        const txout = 0n;
        const txfee = 1000n;

        const paid = amount - tax - txfee;
        await expect(await bridge.connect(relayer).paid(wid, txid, txout, paid))
          .emit(bridge, "Paid")
          .withArgs(wid, txid, txout, paid);

        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
        expect(withdrawal.status).eq(5);

        expect(
          await ethers.provider.getBalance(await bridge.getAddress()),
          "bridge balance",
        ).eq(0);

        expect(
          await ethers.provider.getBalance(PredployedAddress.goatFoundation),
          "gf balance",
        ).eq(tax);
      }
    });

    it("no tax", async () => {
      const { bridge, owner } = await loadFixture(fixture);

      await setNextBlockBaseFeePerGas(0);
      await bridge.setWithdrawalTax(0, 0, { gasPrice: 0 });

      const amount = BigInt(1e18);
      const txPrice = 1n;
      await expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount, 0, txPrice, addr1);

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount);
      expect(withdrawal.tax).eq(0n);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(await timeHelper.latest());
      expect(withdrawal.status).eq(1);
    });

    it("no tax but dust", async () => {
      const { bridge, owner } = await loadFixture(fixture);

      await setNextBlockBaseFeePerGas(0);
      await bridge.setWithdrawalTax(0, 0, { gasPrice: 0 });

      const dust = 100n;
      const amount = BigInt(1e18) + dust;
      const txPrice = 1n;
      await expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount - dust, dust, txPrice, addr1);

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount - dust);
      expect(withdrawal.tax).eq(dust);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(await timeHelper.latest());
      expect(withdrawal.status).eq(1);
    });

    it("cancel", async () => {
      const { bridge, owner, others, relayer } = await loadFixture(fixture);

      const amount = BigInt(1e18);
      const txPrice = 1n;
      const wid = 0n;
      await bridge.withdraw(addr1, txPrice, { value: amount });

      // invalid
      {
        await expect(
          bridge.connect(others[0]).cancel1(wid),
        ).revertedWithCustomError(bridge, "AccessDenied");

        await expect(bridge.cancel1(wid)).revertedWithCustomError(
          bridge,
          "RequestTooFrequent",
        );

        await expect(bridge.cancel2(wid)).revertedWithCustomError(
          bridge,
          "AccessDenied",
        );
      }

      {
        await timeHelper.increase(300n + 1n);

        await expect(await bridge.cancel1(wid))
          .emit(bridge, "Canceling")
          .withArgs(wid);

        const withdrawal = await bridge.withdrawals(wid);

        expect(withdrawal.status).eq(2);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
      }

      // refund
      {
        await expect(bridge.cancel1(wid)).revertedWithCustomError(
          bridge,
          "Forbidden",
        );

        await expect(bridge.refund(wid)).revertedWithCustomError(
          bridge,
          "Forbidden",
        );
      }

      // cancel2
      {
        await expect(bridge.cancel2(wid)).revertedWithCustomError(
          bridge,
          "AccessDenied",
        );

        await expect(await bridge.connect(relayer).cancel2(wid))
          .emit(bridge, "Canceled")
          .withArgs(wid);

        const withdrawal = await bridge.withdrawals(wid);

        expect(withdrawal.status).eq(3);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());

        await expect(
          bridge.connect(relayer).cancel2(wid),
        ).revertedWithoutReason();
      }

      // refund
      {
        await expect(
          bridge.connect(others[0]).refund(wid),
        ).revertedWithCustomError(bridge, "AccessDenied");

        const bb1 = await ethers.provider.getBalance(bridge);
        const ob1 = await ethers.provider.getBalance(owner);
        await setNextBlockBaseFeePerGas(0);
        await expect(await bridge.refund(wid, { gasPrice: 0 }))
          .emit(bridge, "Refund")
          .withArgs(wid);
        const bb2 = await ethers.provider.getBalance(bridge);
        const ob2 = await ethers.provider.getBalance(owner);
        expect(bb1 - bb2, "refund include tax").eq(amount);
        expect(ob2 - ob1, "refund include tax").eq(amount);

        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.status).eq(4);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());

        await expect(bridge.refund(wid)).revertedWithCustomError(
          bridge,
          "Forbidden",
        );
      }
    });

    it("setMinWithdrawal", async () => {
      const { bridge, others } = await loadFixture(fixture);
      await expect(bridge.connect(others[0]).setMinWithdrawal(1))
        .revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
        .withArgs(others[0]);
      await expect(bridge.setMinWithdrawal(0)).revertedWithCustomError(
        bridge,
        "InvalidThreshold",
      );
      await expect(bridge.setMinWithdrawal(1e10 + 1)).revertedWithCustomError(
        bridge,
        "InvalidThreshold",
      );
      const min = BigInt(1e15);
      await expect(await bridge.setMinWithdrawal(min))
        .emit(bridge, "MinWithdrawalUpdated")
        .withArgs(min);
      const param = await bridge.withdrawParam();
      expect(param.min).eq(min);
    });

    it("setWithdrawalTax", async () => {
      const { bridge, others } = await loadFixture(fixture);
      await expect(bridge.connect(others[0]).setWithdrawalTax(1, 1))
        .revertedWithCustomError(bridge, "OwnableUnauthorizedAccount")
        .withArgs(others[0]);
      await expect(bridge.setWithdrawalTax(0, 1)).revertedWithCustomError(
        bridge,
        "InvalidTax",
      );
      await expect(bridge.setWithdrawalTax(1, 0)).revertedWithCustomError(
        bridge,
        "InvalidTax",
      );
      await expect(
        bridge.setWithdrawalTax(1, 1e10 + 1),
      ).revertedWithCustomError(bridge, "InvalidTax");
      const bp = 2n;
      const max = BigInt(1e13);
      await expect(await bridge.setWithdrawalTax(bp, max))
        .emit(bridge, "WithdrawalTaxUpdated")
        .withArgs(bp, max);
      const param = await bridge.withdrawParam();
      expect(param.taxRate).eq(bp);
      expect(param.maxTax).eq(max);
    });
  });
});
