import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("GoatFoundation", async () => {
  const receiver = ethers.getAddress(
    "0xdeadbeafdeadbeafdeadbeafdeadbeafdeadbeaf",
  );

  async function fixture() {
    const [owner, ...others] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("GoatFoundation");
    const goatfdn = await factory.deploy(owner);

    const tokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await tokenFactory.deploy();

    return {
      owner,
      others,
      goatfdn,
      testToken,
    };
  }

  it("transfer", async () => {
    const { owner, goatfdn, others } = await loadFixture(fixture);
    const grant = ethers.parseEther("10");
    await expect(await owner.sendTransaction({ to: goatfdn, value: grant }))
      .emit(goatfdn, "Donate")
      .withArgs(owner, grant);

    const amount = 1n;
    await expect(
      goatfdn.connect(others[0]).transfer(others[0], amount),
    ).revertedWithCustomError(goatfdn, "OwnableUnauthorizedAccount");
    await expect(await goatfdn.transfer(receiver, amount))
      .emit(goatfdn, "Transfer")
      .withArgs(receiver, amount);
    expect(await ethers.provider.getBalance(receiver)).eq(amount);
  });

  it("transfer token", async () => {
    const { goatfdn, others, testToken } = await loadFixture(fixture);

    const amount = 1n;
    await testToken.mint(goatfdn, amount);

    await expect(
      goatfdn.connect(others[0]).transferERC20(testToken, receiver, amount),
    ).revertedWithCustomError(goatfdn, "OwnableUnauthorizedAccount");

    await expect(await goatfdn.transferERC20(testToken, receiver, amount))
      .emit(testToken, "Transfer")
      .withArgs(goatfdn, receiver, amount);
    expect(await testToken.balanceOf(receiver)).eq(amount);
  });

  it("invoke", async () => {
    const { owner, goatfdn, others, testToken } = await loadFixture(fixture);

    const number = 100n;
    const calldata = testToken.interface.encodeFunctionData("setNumber", [
      number,
    ]);

    await expect(goatfdn.invoke(owner, calldata, 0)).revertedWith("!owner");

    await expect(
      goatfdn.connect(others[0]).invoke(testToken, calldata, 0),
    ).revertedWithCustomError(goatfdn, "OwnableUnauthorizedAccount");

    await expect(goatfdn.invoke(others[0], calldata, 0))
      .revertedWithCustomError(goatfdn, "AddressEmptyCode")
      .withArgs(others[0]);

    const amount = 1n;

    await goatfdn.invoke(testToken, calldata, amount, { value: amount });

    await owner.sendTransaction({ to: goatfdn, value: amount });
    await goatfdn.invoke(testToken, calldata, amount);

    expect(await testToken.num()).eq(number);

    expect(await ethers.provider.getBalance(goatfdn)).eq(0n);
    expect(await ethers.provider.getBalance(testToken)).eq(amount * 2n);
  });
});
