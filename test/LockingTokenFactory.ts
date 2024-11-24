import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LockingTokenWrapper } from "../typechain-types";

describe("LockingWrapper", async () => {
  async function fixture() {
    const [owner, ...others] = await ethers.getSigners();
    const dpFactory = await ethers.getContractFactory("LockingTokenFactory");
    const factory = await dpFactory.deploy();

    const tokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await tokenFactory.deploy();
    const testToken2 = await tokenFactory.deploy();
    await testToken2.setDecimal(8);

    return {
      owner,
      others,
      factory,
      testToken,
      testToken2,
    };
  }

  it("wrap", async () => {
    const { factory, testToken, owner, testToken2 } =
      await loadFixture(fixture);

    await expect(factory.wrap(testToken)).to.be.rejectedWith(
      "invalid decimals",
    );

    const testToken2Address = await testToken2.getAddress();
    const wpFactory = await ethers.getContractFactory("LockingTokenWrapper");
    const wrappedAddress = ethers.getCreate2Address(
      await factory.getAddress(),
      ethers.ZeroHash,
      ethers.keccak256(
        wpFactory.bytecode + testToken2Address.slice(2).padStart(64, "00"),
      ),
    );

    await expect(await factory.wrap(testToken2))
      .to.emit(factory, "Created")
      .withArgs(testToken2, wrappedAddress);

    // can't be create it again
    await expect(factory.wrap(testToken2)).to.be.reverted;

    const wrapped: LockingTokenWrapper = await ethers.getContractAt(
      "LockingTokenWrapper",
      wrappedAddress,
    );

    await expect(await wrapped.name()).to.eq("Test Stub Standard Wrapper");
    await expect(await wrapped.symbol()).to.eq("TESTSW");
    await expect(await wrapped.underlying()).to.eq(testToken2);
    await expect(await wrapped.exchangeRate()).to.eq(1e10);

    await expect(wrapped.deposit(0)).revertedWithCustomError(
      wrapped,
      "InvalidValue",
    );

    await expect(wrapped.deposit(1))
      .revertedWithCustomError(wrapped, "ERC20InsufficientAllowance")
      .withArgs(wrapped, 0, 1);

    await testToken2.approve(wrapped, ethers.MaxUint256);

    await expect(await wrapped.deposit(1))
      .emit(testToken2, "Transfer")
      .withArgs(owner, wrapped, 1)
      .emit(wrapped, "Transfer")
      .withArgs(ethers.ZeroAddress, owner, 1e10);

    await expect(wrapped.withdraw(1)).revertedWithCustomError(
      wrapped,
      "InvalidValue",
    );

    await expect(await wrapped.withdraw(1e10))
      .emit(testToken2, "Transfer")
      .withArgs(wrapped, owner, 1)
      .emit(wrapped, "Transfer")
      .withArgs(owner, ethers.ZeroAddress, 1e10);
  });
});
