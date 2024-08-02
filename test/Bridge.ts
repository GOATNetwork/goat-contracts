import { ethers, artifacts } from "hardhat";
import { expect } from "chai";

import {
  loadFixture,
  setCode,
  impersonateAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Bridge } from "../typechain-types";

describe("Bridge", async () => {
  const btcAddressVerifier = "0x00000000000000000000000000000000C0dec000";

  const block100 = {
    prevBlock:
      "0x5b91046f23af72766172aa28929d1124f23595ab81da63d1849a4e77704a30cd",
    merkleRoot:
      "0x3ac8290dbcdf2e3fa9c76dffb2fa053561cd9975fedcf5eb61d597daeaca8e8c",
    version: "0x20000000",
    bits: "0x207fffff",
    nonce: "0x01",
    timestmap: "0x66ab9df4",
  };

  async function fixture() {
    const [owner, payer, ...others] = await ethers.getSigners();

    const bridgeFactory = await ethers.getContractFactory("Bridge");

    const bridge: Bridge = await bridgeFactory.deploy(100, block100);

    const [valid, invlid] = await Promise.all([
      artifacts.readArtifact("ValidAddrMock"),
      artifacts.readArtifact("InvalidAddrMock"),
    ]);

    const relayer = "0xBc10000000000000000000000000000000001000";
    const goatFoundation = "0xBc10000000000000000000000000000000000002";

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
      precompiled: {
        valid: valid.deployedBytecode,
        invalid: invlid.deployedBytecode,
      },
      relayer: await ethers.getSigner(relayer),
      goatFoundation: await ethers.getSigner(goatFoundation),
    };
  }

  it("network", async () => {
    const { bridge, precompiled } = await loadFixture(fixture);
    expect(await bridge.bech32HRP()).eq("bc", "bech32HRP");
    expect(await bridge.networkName()).eq("mainnet", "networkName");
    const { pubKeyHashAddrID, scriptHashAddrID } = await bridge.base58Prefix();
    expect(pubKeyHashAddrID).eq("0x00");
    expect(scriptHashAddrID).eq("0x05");

    // check mocks
    await setCode(btcAddressVerifier, precompiled.valid);
    expect(await bridge.isAddrValid("mock1")).to.be.true;

    await setCode(btcAddressVerifier, precompiled.invalid);
    expect(await bridge.isAddrValid("mock2")).to.be.false;
  });

  describe("bitcoin", async () => {
    it("init", async () => {
      const { bridge } = await loadFixture(fixture);

      const { start, latest } = await bridge.headerRange();
      expect(start).eq(100);
      expect(latest).eq(100);
      const header = await bridge.btcBlockHeader(100);

      expect(header.prevBlock).eq(block100.prevBlock);
      expect(header.merkleRoot).eq(block100.merkleRoot);
      expect(header.bits).eq(block100.bits);
      expect(header.nonce).eq(block100.nonce);
      expect(header.timestmap).eq(block100.timestmap);
    });

    it("push", async () => {
      const block101 = {
        prevBlock:
          "0x37f5a9ab6e6a6c64f956bf07054957bf8bb49cb7a2130f7e31dc30aa7f23dcd7",
        merkleRoot:
          "0xa979ca22cadc1fb7593ecc8dd194e863e45ef48ac35cffa900887a336f477e84",
        version: "0x20000000",
        bits: "0x207fffff",
        nonce: "0x03",
        timestmap: "0x66ab9dcd",
      };

      const { bridge, relayer } = await loadFixture(fixture);

      await expect(
        bridge.newBitcoinBlock(block101),
        "push block header by non-relayer",
      ).revertedWithCustomError(bridge, "AccessDenied");

      expect(
        await bridge.connect(relayer).newBitcoinBlock(block101),
        "push block header by relayer",
      )
        .with.emit("Bridge", "NewBitcoinBlock")
        .withArgs(101n);

      const { start, latest } = await bridge.headerRange();
      expect(start).eq(100);
      expect(latest).eq(101);

      const header = await bridge.btcBlockHeader(101);

      expect(header.prevBlock).eq(block101.prevBlock);
      expect(header.merkleRoot).eq(block101.merkleRoot);
      expect(header.bits).eq(block101.bits);
      expect(header.nonce).eq(block101.nonce);
      expect(header.timestmap).eq(block101.timestmap);
    });
  });

  describe("deposit", async () => {
    const tx1 = {
      id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
      txout: 1n,
      amount: 1,
      tax: 0n,
    };

    const tx2 = {
      id: "0x5bfcf34049a525e394870e11f79cc8d33bc9588940c7c909b13ab1339b3daa31",
      txout: 1n,
      amount: 100n,
      tax: 1n,
    };

    it("invalid", async () => {
      const { bridge, owner, relayer } = await loadFixture(fixture);

      await expect(
        bridge.deposit(tx1.id, tx1.txout, owner, tx1.amount),
        "deposit by non-relayer",
      ).revertedWithCustomError(bridge, "AccessDenied");

      await expect(
        bridge.connect(relayer).deposit(tx1.id, tx1.txout + 5n, owner, 0n),
        "zero value",
      ).to.be.revertedWithoutReason();
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
        bridge.connect(relayer).deposit(tx1.id, tx1.txout, owner, 1n),
        "duplicated",
      ).to.be.revertedWithoutReason();

      expect(await bridge.unpaidTax(), "unpaid tax").eq(0);
    });

    it("1% tax", async () => {
      const { bridge, owner, relayer, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setDepositFee(100 /* 1% */, 10);

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

      expect(await bridge.unpaidTax(), "unpaid tax").eq(tx2.tax);
    });
  });

  describe("withdraw", async () => {
    const addr = "bc1qmvs208we3jg7hgczhlh7e9ufw034kfm2vwsvge";

    it("invalid", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await bridge.connect(goatFoundation).setWithdrawalFee(0, 0);

      const amount = BigInt(1e10);
      const txPrice = 1n;

      await setCode(btcAddressVerifier, precompiled.invalid);

      await expect(
        bridge.withdraw(addr, txPrice, { value: amount }),
      ).revertedWith("invalid address");

      await setCode(btcAddressVerifier, precompiled.valid);

      await expect(bridge.withdraw(addr, 0, { value: amount })).revertedWith(
        "invalid tx price",
      );

      await expect(bridge.withdraw(addr, 1, { value: amount })).revertedWith(
        "unaffordable",
      );
    });

    it("default tax", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await setCode(btcAddressVerifier, precompiled.valid);

      const param = await bridge.param();
      expect(param.withdrawalTaxBP).eq(20n);
      expect(param.maxWithdrawalTax).eq((BigInt(1e18) * 20n) / BigInt(1e4));

      const wid = 0n;
      const amount = BigInt(1e18);
      const txPrice = 1n;

      const tax = (amount * param.withdrawalTaxBP) / BigInt(1e4);

      expect(await bridge.withdraw(addr, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(wid, owner.address, amount - tax, txPrice, addr);

      const block = await ethers.provider.getBlock("latest");

      const withdrawal = await bridge.withdrawals(wid);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount - tax);
      expect(withdrawal.tax).eq(tax);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(block!.timestamp);
      expect(withdrawal.reciever).eq(addr);
      expect(withdrawal.status).eq(1);
    });

    it("no tax", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await setCode(btcAddressVerifier, precompiled.valid);
      await bridge.connect(goatFoundation).setWithdrawalFee(0, 0);

      const amount = BigInt(1e18);
      const txPrice = 1n;
      expect(await bridge.withdraw(addr, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount, txPrice, addr);

      const block = await ethers.provider.getBlock("latest");

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount);
      expect(withdrawal.tax).eq(0n);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(block!.timestamp);
      expect(withdrawal.reciever).eq(addr);
      expect(withdrawal.status).eq(1);
    });

    it("no tax but dust", async () => {
      const { bridge, owner, precompiled, goatFoundation } =
        await loadFixture(fixture);

      await setCode(btcAddressVerifier, precompiled.valid);
      await bridge.connect(goatFoundation).setWithdrawalFee(0, 0);

      const dust = 100n;
      const amount = BigInt(1e18) + dust;
      const txPrice = 1n;
      expect(await bridge.withdraw(addr, txPrice, { value: amount }))
        .emit(bridge, "Withdraw")
        .withArgs(0n, owner.address, amount - dust, txPrice, addr);

      const block = await ethers.provider.getBlock("latest");

      const withdrawal = await bridge.withdrawals(0n);
      expect(withdrawal.sender).eq(owner.address);
      expect(withdrawal.amount).eq(amount - dust);
      expect(withdrawal.tax).eq(dust);
      expect(withdrawal.maxTxPrice).eq(txPrice);
      expect(withdrawal.updatedAt).eq(block!.timestamp);
      expect(withdrawal.reciever).eq(addr);
      expect(withdrawal.status).eq(1);
    });
  });
});
