import { ethers } from "hardhat";
import { expect } from "chai";
import { Executors } from "../common/constants";
import {
  loadFixture,
  impersonateAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Bitcoin } from "../typechain-types";

describe("Bitcoin", async () => {
  const blockHash100 =
    "0x5b91046f23af72766172aa28929d1124f23595ab81da63d1849a4e77704a30cd";

  const blockHash101 =
    "0x393cc15d9c3860e02fc55b2e5a49e1c3e68ef829213f39e3fecd1dc2b0d75267";

  const networkName = "mainnet";

  const relayer = Executors.relayer;

  async function fixture() {
    const [owner, payer, ...others] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("Bitcoin");

    const bitcoin: Bitcoin = await factory.deploy(
      100,
      blockHash100,
      networkName,
    );

    await impersonateAccount(relayer);

    await payer.sendTransaction({
      to: relayer,
      value: ethers.parseEther("10"),
    });

    return {
      owner,
      others,
      bitcoin,
      relayer: await ethers.getSigner(relayer),
    };
  }

  it("init", async () => {
    const { bitcoin } = await loadFixture(fixture);
    expect(await bitcoin.startHeight()).eq(100);
    expect(await bitcoin.latestHeight()).eq(100);
    expect(await bitcoin.blockHash(100)).eq(blockHash100);
  });

  it("networkName", async () => {
    const { bitcoin } = await loadFixture(fixture);
    expect(await bitcoin.networkName()).eq(networkName);
  });

  it("newBlockHash", async () => {
    const { bitcoin, relayer } = await loadFixture(fixture);

    await expect(bitcoin.newBlockHash(blockHash101)).revertedWithCustomError(
      bitcoin,
      "AccessDenied",
    );

    expect(await bitcoin.connect(relayer).newBlockHash(blockHash101))
      .emit(bitcoin, "NewBlockHash")
      .withArgs(blockHash101);

    expect(await bitcoin.startHeight()).eq(100);
    expect(await bitcoin.latestHeight()).eq(101);
    expect(await bitcoin.blockHash(101)).eq(blockHash101);
  });
});
