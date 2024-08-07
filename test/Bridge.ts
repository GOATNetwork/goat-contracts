import { ethers, artifacts } from "hardhat";
import { expect } from "chai";
import { Executors, PrecompiledAddress, PredployedAddress } from "./constant";
import {
  loadFixture,
  setCode,
  impersonateAccount,
  time as timeHelper,
  setNextBlockBaseFeePerGas,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Bridge } from "../typechain-types";

describe("Bridge", async () => {
  const btcAddressVerifier = PrecompiledAddress.addrVerifier;
  const addr1 = "bc1qmvs208we3jg7hgczhlh7e9ufw034kfm2vwsvge";
  const addr2 = "tb1q23j89ml57f6tuascjflw6qevwh5pmcpzrlqwxx";

  const relayer = Executors.relayer;
  const goatFoundation = PredployedAddress.goatFoundation;

  async function fixture() {
    const [owner, payer, ...others] = await ethers.getSigners();

    const bridgeFactory = await ethers.getContractFactory("Bridge");

    const bridge: Bridge = await bridgeFactory.deploy();

    const mock = await artifacts.readArtifact("AddressMock");
    await setCode(btcAddressVerifier, mock.deployedBytecode);

    await impersonateAccount(relayer);
    await impersonateAccount(goatFoundation);

    await payer.sendTransaction({
      to: relayer,
      value: ethers.parseEther("10"),
    });

    await payer.sendTransaction({
      to: goatFoundation,
      value: ethers.parseEther("10"),
    });

    return {
      owner,
      others,
      bridge,
      precompiled: mock.deployedBytecode,
      relayer: await ethers.getSigner(relayer),
      goatFoundation: await ethers.getSigner(goatFoundation),
    };
  }

  describe("network", async () => {
    it("config", async () => {
      const { bridge, precompiled } = await loadFixture(fixture);
      expect(await bridge.bech32HRP()).eq("bc", "bech32HRP");
      expect(await bridge.networkName()).eq("mainnet", "networkName");
      const { pubKeyHashAddrID, scriptHashAddrID } =
        await bridge.base58Prefix();
      expect(pubKeyHashAddrID).eq("0x00");
      expect(scriptHashAddrID).eq("0x05");

      // check mocks
      expect(await bridge.isAddrValid(addr1)).to.be.true;
      expect(await bridge.isAddrValid(addr2)).to.be.false;
    });
  });

  describe("deposit", async () => {
    const tx1 = {
      id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
      txout: 1n,
      amount: BigInt(1e18),
      tax: 0n,
    };

    it("invalid", async () => {
      const { bridge, owner, relayer } = await loadFixture(fixture);

      await expect(
        bridge.deposit(tx1.id, tx1.txout, owner, tx1.amount),
        "deposit by non-relayer",
      ).revertedWithCustomError(bridge, "AccessDenied");

      await expect(
        bridge.connect(relayer).deposit(tx1.id, tx1.txout, owner, 100n),
        "invalid amount",
      ).to.be.revertedWith("invalid amount");

      await expect(
        bridge.connect(relayer).deposit(tx1.id, tx1.txout, owner, 0),
        "invalid amount",
      ).to.be.revertedWith("invalid amount");
    });

    it("no tax", async () => {
      const { bridge, owner, relayer } = await loadFixture(fixture);

      expect(
        await bridge
          .connect(relayer)
          .deposit(tx1.id, tx1.txout, owner, tx1.amount),
        "deposit by relayer",
      )
        .with.emit("Bridge", "Deposit")
        .withArgs(owner.address, tx1.amount, tx1.id, tx1.txout, tx1.tax);

      expect(await bridge.isDeposited(tx1.id, tx1.txout), "tx1 is deposited").to
        .be.true;

      await expect(
        bridge.connect(relayer).deposit(tx1.id, tx1.txout, owner, BigInt(1e18)),
        "duplicated",
      ).to.be.revertedWith("duplicated");
    });

    it("1bp tax", async () => {
      const tx2 = {
        id: "0x5bfcf34049a525e394870e11f79cc8d33bc9588940c7c909b13ab1339b3daa31",
        txout: 1n,
        amount: BigInt(1e18),
        tax: 10n,
      };

      const { bridge, owner, relayer, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setDepositTax(1, 10);

      expect(
        await bridge.isDeposited(tx2.id, tx2.txout),
        "tx2 is not deposited",
      ).to.be.false;

      expect(
        await bridge
          .connect(relayer)
          .deposit(tx2.id, tx2.txout, owner, tx2.amount),
        "deposit with tax",
      )
        .with.emit("Bridge", "Deposit")
        .withArgs(
          owner.address,
          tx2.amount - tx2.tax,
          tx2.id,
          tx2.txout,
          tx2.tax,
        );
    });
  });

  describe("withdraw", async () => {
    it("invalid", async () => {
      const { bridge, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setWithdrawalTax(0, 0);

      const amount = BigInt(1e10);
      const txPrice = 1n;

      await expect(
        bridge.withdraw(addr2, txPrice, { value: amount }),
      ).revertedWith("invalid address");

      await expect(bridge.withdraw(addr1, 0, { value: amount })).revertedWith(
        "invalid tx price",
      );

      await expect(bridge.withdraw(addr1, 1, { value: amount })).revertedWith(
        "unaffordable",
      );
    });

    it("default tax", async () => {
      const { bridge, owner, precompiled, relayer } =
        await loadFixture(fixture);

      const param = await bridge.param();
      expect(param.withdrawalTaxBP).eq(20n);
      expect(param.maxWithdrawalTax).eq((BigInt(1e18) * 20n) / BigInt(1e4));
      expect(param.rateLimit).eq(300);

      const wid = 0n;
      const amount = BigInt(1e18);
      const txPrice = 1n;

      const tax = (amount * param.withdrawalTaxBP) / BigInt(1e4);

      expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(wid, owner.address, amount - tax, txPrice, addr1);

      // pending
      {
        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.sender).eq(owner.address);
        expect(withdrawal.amount).eq(amount - tax);
        expect(withdrawal.tax).eq(tax);
        expect(withdrawal.maxTxPrice).eq(txPrice);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
        expect(withdrawal.reciever).eq(addr1);
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
        await timeHelper.increase(param.rateLimit + 1n);

        const newTxPrice = txPrice + 1n;
        expect(await bridge.replaceByFee(wid, txPrice + 1n))
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
        expect(await bridge.connect(relayer).paid(wid, txid, txout, paid))
          .emit(bridge, "Paid")
          .withArgs(wid, txid, txout, paid)
          .and.emit(bridge, "Settlement")
          .withArgs(amount, tax);

        const withdrawal = await bridge.withdrawals(wid);
        expect(withdrawal.updatedAt).eq(await timeHelper.latest());
        expect(withdrawal.status).eq(5);

        const receipt = await bridge.receipts(wid);

        expect(receipt.txid).eq(txid);
        expect(receipt.txout).eq(txout);
        expect(receipt.received).eq(paid);
      }
    });

    it("no tax", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setWithdrawalTax(0, 0);

      const amount = BigInt(1e18);
      const txPrice = 1n;
      expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount, txPrice, addr1);

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount);
      expect(withdrawal.tax).eq(0n);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(await timeHelper.latest());
      expect(withdrawal.reciever).eq(addr1);
      expect(withdrawal.status).eq(1);
    });

    it("no tax but dust", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setWithdrawalTax(0, 0);

      const dust = 100n;
      const amount = BigInt(1e18) + dust;
      const txPrice = 1n;
      expect(await bridge.withdraw(addr1, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount - dust, txPrice, addr1);

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount - dust);
      expect(withdrawal.tax).eq(dust);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(await timeHelper.latest());
      expect(withdrawal.reciever).eq(addr1);
      expect(withdrawal.status).eq(1);
    });

    it("cancel", async () => {
      const { bridge, owner, others, precompiled, relayer, goatFoundation } =
        await loadFixture(fixture);

      const param = await bridge.param();

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
          "RateLimitExceeded",
        );

        await expect(bridge.cancel2(wid)).revertedWithCustomError(
          bridge,
          "AccessDenied",
        );
      }

      {
        await timeHelper.increase(param.rateLimit + 1n);

        expect(await bridge.cancel1(wid))
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

        expect(await bridge.connect(relayer).cancel2(wid))
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
        await expect(bridge.refund(wid, { gasPrice: 0 }))
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
  });
});
