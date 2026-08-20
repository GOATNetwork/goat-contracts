import { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEther } from "viem";

import { Executors } from "../common/constants.js";

describe("Bitcoin", async () => {
  const { viem, networkHelpers } = await network.create();
  const blockHash100 =
    "0x5b91046f23af72766172aa28929d1124f23595ab81da63d1849a4e77704a30cd";
  const blockHash101 =
    "0x393cc15d9c3860e02fc55b2e5a49e1c3e68ef829213f39e3fecd1dc2b0d75267";
  const networkName = "mainnet";

  async function fixture() {
    const [, payer, ...others] = await viem.getWalletClients();
    const bitcoin = await viem.deployContract("Bitcoin", [
      100n,
      blockHash100,
      networkName,
    ]);
    await networkHelpers.impersonateAccount(Executors.relayer);
    await payer.sendTransaction({
      to: Executors.relayer,
      value: parseEther("10"),
    });
    return {
      others,
      bitcoin,
      relayer: await viem.getWalletClient(Executors.relayer),
    };
  }

  it("init", async () => {
    const { bitcoin } = await networkHelpers.loadFixture(fixture);
    assert.equal(await bitcoin.read.startHeight(), 100n);
    assert.equal(await bitcoin.read.latestHeight(), 100n);
    assert.equal(await bitcoin.read.blockHash([100n]), blockHash100);
  });

  it("networkName", async () => {
    const { bitcoin } = await networkHelpers.loadFixture(fixture);
    assert.equal(await bitcoin.read.networkName(), networkName);
  });

  it("newBlockHash", async () => {
    const { bitcoin, relayer } = await networkHelpers.loadFixture(fixture);
    await viem.assertions.revertWithCustomError(
      bitcoin.write.newBlockHash([blockHash101]),
      bitcoin,
      "AccessDenied",
    );
    await viem.assertions.emitWithArgs(
      bitcoin.write.newBlockHash([blockHash101], {
        account: relayer.account,
      }),
      bitcoin,
      "NewBlockHash",
      [101n],
    );
    assert.equal(await bitcoin.read.startHeight(), 100n);
    assert.equal(await bitcoin.read.latestHeight(), 101n);
    assert.equal(await bitcoin.read.blockHash([101n]), blockHash101);
  });
});
