import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Relayer", async () => {
  async function fixture() {
    const [owner, ...others] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("Relayer");

    const relayer = await factory.deploy(owner);
    return {
      owner,
      others,
      relayer,
    };
  }

  it("voter", async () => {
    const { relayer, others } = await loadFixture(fixture);

    const address = ethers.getAddress(
      "0x398da22c497ccf618eca730927dca25cba6a01b9",
    );
    const pubkey =
      "0x0feb19a673a7e27e1abb4f7487311b41397d00563ef898d2e23985c709f8b0b5";

    await expect(relayer.connect(others[0]).addVoter(address, pubkey))
      .revertedWithCustomError(relayer, "OwnableUnauthorizedAccount")
      .withArgs(others[0]);

    await expect(await relayer.addVoter(address, pubkey))
      .emit(relayer, "AddedVoter")
      .withArgs(address, pubkey);

    expect(await relayer.voters(address)).to.be.true;
    expect(await relayer.total()).eq(1);

    const address2 = ethers.getAddress(
      "0xeb541758dbfc6fac468e8ed7915409a5c303b63a",
    );
    const pubkey2 =
      "0x4912aec9112c22cad28948267ad8c4db4bed2e1b37f00904f194c525163a6e5d";

    await expect(relayer.addVoter(address2, pubkey)).revertedWith(
      "duplicated key",
    );
    await expect(relayer.addVoter(address, pubkey2)).revertedWith(
      "duplicated voter",
    );

    await expect(await relayer.addVoter(address2, pubkey2))
      .emit(relayer, "AddedVoter")
      .withArgs(address2, pubkey2);
    expect(await relayer.voters(address2)).to.be.true;
    expect(await relayer.total()).eq(2);

    await expect(relayer.connect(others[0]).removeVoter(address))
      .revertedWithCustomError(relayer, "OwnableUnauthorizedAccount")
      .withArgs(others[0]);

    await expect(await relayer.removeVoter(address2))
      .emit(relayer, "RemovedVoter")
      .withArgs(address2);
    expect(await relayer.voters(address2)).to.be.false;
    expect(await relayer.deletes(address2)).to.be.true;
    expect(await relayer.total()).eq(1);

    await expect(relayer.removeVoter(address2)).revertedWith("voter not found");
    await expect(relayer.removeVoter(address)).revertedWith("too few voters");

    const pubkey3 =
      "0x56cbf59902b656153f3596b281cdbb818a3b9d9814a7deff61ee2560e4553ecd";
    await expect(relayer.addVoter(address2, pubkey3)).revertedWith(
      "deleted voter",
    );
  });
});
