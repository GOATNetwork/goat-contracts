import { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress } from "viem";

describe("Relayer", async () => {
  const { viem, networkHelpers } = await network.create();

  async function fixture() {
    const [owner, ...others] = await viem.getWalletClients();
    const relayer = await viem.deployContract("Relayer", [
      owner.account.address,
    ]);
    return { owner, others, relayer };
  }

  it("voter", async () => {
    const { relayer, others } = await networkHelpers.loadFixture(fixture);
    const address = getAddress("0x398da22c497ccf618eca730927dca25cba6a01b9");
    const pubkey =
      "0x0feb19a673a7e27e1abb4f7487311b41397d00563ef898d2e23985c709f8b0b5";

    await viem.assertions.revertWithCustomErrorWithArgs(
      relayer.write.addVoter([address, pubkey], {
        account: others[0].account,
      }),
      relayer,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.emitWithArgs(
      relayer.write.addVoter([address, pubkey]),
      relayer,
      "AddedVoter",
      [address, pubkey],
    );
    assert.equal(await relayer.read.voters([address]), true);
    assert.equal(await relayer.read.total(), 1n);

    const address2 = getAddress("0xeb541758dbfc6fac468e8ed7915409a5c303b63a");
    const pubkey2 =
      "0x4912aec9112c22cad28948267ad8c4db4bed2e1b37f00904f194c525163a6e5d";
    await viem.assertions.revertWith(
      relayer.write.addVoter([address2, pubkey]),
      "duplicated key",
    );
    await viem.assertions.revertWith(
      relayer.write.addVoter([address, pubkey2]),
      "duplicated voter",
    );
    await viem.assertions.emitWithArgs(
      relayer.write.addVoter([address2, pubkey2]),
      relayer,
      "AddedVoter",
      [address2, pubkey2],
    );
    assert.equal(await relayer.read.voters([address2]), true);
    assert.equal(await relayer.read.total(), 2n);

    await viem.assertions.revertWithCustomErrorWithArgs(
      relayer.write.removeVoter([address], { account: others[0].account }),
      relayer,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.emitWithArgs(
      relayer.write.removeVoter([address2]),
      relayer,
      "RemovedVoter",
      [address2],
    );
    assert.equal(await relayer.read.voters([address2]), false);
    assert.equal(await relayer.read.deletes([address2]), true);
    assert.equal(await relayer.read.total(), 1n);

    await viem.assertions.revertWith(
      relayer.write.removeVoter([address2]),
      "voter not found",
    );
    await viem.assertions.revertWith(
      relayer.write.removeVoter([address]),
      "too few voters",
    );
    const pubkey3 =
      "0x56cbf59902b656153f3596b281cdbb818a3b9d9814a7deff61ee2560e4553ecd";
    await viem.assertions.revertWith(
      relayer.write.addVoter([address2, pubkey3]),
      "deleted voter",
    );
  });
});
