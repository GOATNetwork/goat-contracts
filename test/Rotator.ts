import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// The consensus layer only honours Rotate logs from one address, and it learns
// that address as a compile time constant. It is reached with CREATE2 through
// the deterministic deployer that GOAT has in genesis, so the address depends
// on the initcode hash and therefore on the compiler settings. Pin all three:
// if a settings change moves the address, this fails instead of silently
// stranding every rotation.
const DETERMINISTIC_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const SALT = ethers.id("goat.rotator.v1");
const EXPECTED_ADDRESS = "0x1C394F4B6F43c5318b3adC903fc1AE854eE77910";
const EXPECTED_INITCODE_HASH =
  "0xb72b44aac04188c3eeb6ed100d53017182993234462f2b17552041a68f5f5533";

const LOCKING = "0xbC10000000000000000000000000000000000004";

describe("Rotator", async () => {
  async function fixture() {
    const [owner, other] = await ethers.getSigners();

    // stand in for the Locking predeploy, which only has to answer owners()
    const lockingCode = (
      await ethers.getContractFactory("LockingOwnersMock")
    ).bytecode;
    await ethers.provider.send("hardhat_setCode", [LOCKING, "0x"]);
    const mock = await (
      await ethers.getContractFactory("LockingOwnersMock")
    ).deploy();
    const deployed = await ethers.provider.getCode(await mock.getAddress());
    await ethers.provider.send("hardhat_setCode", [LOCKING, deployed]);
    const locking = await ethers.getContractAt("LockingOwnersMock", LOCKING);

    const rotator = await (
      await ethers.getContractFactory("Rotator")
    ).deploy();

    return { owner, other, locking, rotator, lockingCode };
  }

  it("has the address the consensus layer expects", async () => {
    const factory = await ethers.getContractFactory("Rotator");
    const initCodeHash = ethers.keccak256(factory.bytecode);
    expect(initCodeHash).to.equal(EXPECTED_INITCODE_HASH);
    expect(
      ethers.getCreate2Address(DETERMINISTIC_DEPLOYER, SALT, initCodeHash),
    ).to.equal(EXPECTED_ADDRESS);
  });

  it("emits Rotate with no indexed parameter", async () => {
    const { owner, locking, rotator } = await loadFixture(fixture);
    const validator = "0x00000000000000000000000000000000000000aa";
    await locking.setOwner(validator, owner.address);

    const pubkey = "0x" + "ab".repeat(1952);
    const proof = "0x" + "cd".repeat(3309);
    const tx = await rotator.rotate(validator, 1, pubkey, proof);
    const receipt = await tx.wait();

    const log = receipt!.logs[0];
    expect(log.address).to.equal(await rotator.getAddress());
    // the consensus layer drops any log that does not carry exactly one topic
    expect(log.topics.length).to.equal(1);
    expect(log.topics[0]).to.equal(
      ethers.id("Rotate(address,uint8,bytes,bytes)"),
    );
  });

  it("rejects anyone but the validator owner", async () => {
    const { owner, other, locking, rotator } = await loadFixture(fixture);
    const validator = "0x00000000000000000000000000000000000000aa";
    await locking.setOwner(validator, owner.address);

    await expect(
      rotator.connect(other).rotate(validator, 1, "0x00", "0x00"),
    ).to.be.revertedWithCustomError(rotator, "NotValidatorOwner");

    // an unknown validator has the zero owner, which no sender can be
    await expect(
      rotator.rotate("0x00000000000000000000000000000000000000bb", 1, "0x00", "0x00"),
    ).to.be.revertedWithCustomError(rotator, "NotValidatorOwner");
  });

  it("rejects an empty pubkey or proof", async () => {
    const { owner, locking, rotator } = await loadFixture(fixture);
    const validator = "0x00000000000000000000000000000000000000aa";
    await locking.setOwner(validator, owner.address);

    await expect(
      rotator.rotate(validator, 1, "0x", "0x00"),
    ).to.be.revertedWithCustomError(rotator, "InvalidPubkey");
    await expect(
      rotator.rotate(validator, 1, "0x00", "0x"),
    ).to.be.revertedWithCustomError(rotator, "InvalidProof");
  });
});
