import { ethers, artifacts } from "hardhat";
import { expect } from "chai";

import {
  loadFixture,
  setCode,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Bridge } from "../typechain-types";

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

describe("Bridge", async () => {
  async function fixture() {
    const [owner, ...others] = await ethers.getSigners();

    const bridgeFactory = await ethers.getContractFactory("Bridge");

    const bridge: Bridge = await bridgeFactory.deploy(100, block100);

    const [valid, invlid] = await Promise.all([
      artifacts.readArtifact("ValidAddrMock"),
      artifacts.readArtifact("InvalidAddrMock"),
    ]);

    return {
      owner,
      others,
      bridge,
      precompiled: {
        valid: valid.deployedBytecode,
        invalid: invlid.deployedBytecode,
      },
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
    setCode(btcAddressVerifier, precompiled.valid);
    expect(await bridge.isAddrValid("mock1")).to.be.true;

    setCode(btcAddressVerifier, precompiled.invalid);
    expect(await bridge.isAddrValid("mock2")).to.be.false;
  });

  it("deposit", async () => {
    const tx1 = {
      id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
      txout: 1n,
      amount: 1,
      tax: 0n,
    };

    const { bridge, owner } = await loadFixture(fixture);

    expect(await bridge.deposit(tx1.id, tx1.txout, owner, tx1.amount))
      .with.emit("Bridge", "Deposit")
      .withArgs(owner.address, tx1.amount, tx1.id, tx1.txout, tx1.tax);

    await expect(
      bridge.deposit(tx1.id, tx1.txout + 5n, owner, 0n),
      "zero value",
    ).to.be.revertedWithoutReason();

    await expect(
      bridge.deposit(tx1.id, tx1.txout, owner, 1n),
      "duplicated",
    ).to.be.revertedWithoutReason();

    const tx2 = {
      id: "0x5bfcf34049a525e394870e11f79cc8d33bc9588940c7c909b13ab1339b3daa31",
      txout: 1n,
      amount: 100n,
      tax: 1n,
    };

    await bridge.setDepositFee(100 /* 1% */, 10);

    expect(
      await bridge.deposit(tx2.id, tx2.txout, owner, tx2.amount),
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
