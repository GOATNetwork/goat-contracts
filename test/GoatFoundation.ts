import { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeFunctionData, getAddress, parseEther } from "viem";

describe("GoatFoundation", async () => {
  const { viem, networkHelpers } = await network.create();
  const receiver = getAddress("0xdeadbeafdeadbeafdeadbeafdeadbeafdeadbeaf");

  async function fixture() {
    const [owner, ...others] = await viem.getWalletClients();
    const goatFoundation = await viem.deployContract("GoatFoundation", [
      owner.account.address,
    ]);
    const testToken = await viem.deployContract("TestToken");
    return { owner, others, goatFoundation, testToken };
  }

  it("transfer", async () => {
    const { owner, goatFoundation, others } =
      await networkHelpers.loadFixture(fixture);
    const grant = parseEther("10");
    await viem.assertions.emitWithArgs(
      owner.sendTransaction({ to: goatFoundation.address, value: grant }),
      goatFoundation,
      "Donate",
      [owner.account.address, grant],
    );

    const amount = 1n;
    await viem.assertions.revertWithCustomError(
      goatFoundation.write.transfer([others[0].account.address, amount], {
        account: others[0].account,
      }),
      goatFoundation,
      "OwnableUnauthorizedAccount",
    );
    await viem.assertions.emitWithArgs(
      goatFoundation.write.transfer([receiver, amount]),
      goatFoundation,
      "Transfer",
      [receiver, amount],
    );
    const publicClient = await viem.getPublicClient();
    assert.equal(await publicClient.getBalance({ address: receiver }), amount);
  });

  it("transfer token", async () => {
    const { goatFoundation, others, testToken } =
      await networkHelpers.loadFixture(fixture);
    const amount = 1n;
    await testToken.write.mint([goatFoundation.address, amount]);

    await viem.assertions.revertWithCustomError(
      goatFoundation.write.transferERC20(
        [testToken.address, receiver, amount],
        { account: others[0].account },
      ),
      goatFoundation,
      "OwnableUnauthorizedAccount",
    );
    await viem.assertions.emitWithArgs(
      goatFoundation.write.transferERC20([testToken.address, receiver, amount]),
      testToken,
      "Transfer",
      [goatFoundation.address, receiver, amount],
    );
    assert.equal(await testToken.read.balanceOf([receiver]), amount);
  });

  it("invoke", async () => {
    const { owner, goatFoundation, others, testToken } =
      await networkHelpers.loadFixture(fixture);
    const number = 100n;
    const calldata = encodeFunctionData({
      abi: testToken.abi,
      functionName: "setNumber",
      args: [number],
    });

    await viem.assertions.revertWith(
      goatFoundation.write.invoke([owner.account.address, calldata, 0n]),
      "!owner",
    );
    await viem.assertions.revertWithCustomError(
      goatFoundation.write.invoke([testToken.address, calldata, 0n], {
        account: others[0].account,
      }),
      goatFoundation,
      "OwnableUnauthorizedAccount",
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      goatFoundation.write.invoke([others[0].account.address, calldata, 0n]),
      goatFoundation,
      "AddressEmptyCode",
      [others[0].account.address],
    );

    const amount = 1n;
    await goatFoundation.write.invoke([testToken.address, calldata, amount], {
      value: amount,
    });
    await owner.sendTransaction({ to: goatFoundation.address, value: amount });
    await goatFoundation.write.invoke([testToken.address, calldata, amount]);

    assert.equal(await testToken.read.num(), number);
    const publicClient = await viem.getPublicClient();
    assert.equal(
      await publicClient.getBalance({ address: goatFoundation.address }),
      0n,
    );
    assert.equal(
      await publicClient.getBalance({ address: testToken.address }),
      amount * 2n,
    );
  });
});
