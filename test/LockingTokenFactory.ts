import hre, { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeDeployData,
  getAddress,
  getCreate2Address,
  keccak256,
  maxUint256,
  zeroAddress,
  zeroHash,
} from "viem";

describe("LockingWrapper", async () => {
  const { viem, networkHelpers } = await network.create();

  async function fixture() {
    const [owner] = await viem.getWalletClients();
    const factory = await viem.deployContract("LockingTokenFactory");
    const testToken = await viem.deployContract("TestToken");
    const testToken2 = await viem.deployContract("TestToken");
    await testToken2.write.setDecimal([8]);
    return { owner, factory, testToken, testToken2 };
  }

  it("wrap", async () => {
    const { factory, testToken, owner, testToken2 } =
      await networkHelpers.loadFixture(fixture);

    await viem.assertions.revertWith(
      factory.write.wrap([testToken.address]),
      "invalid decimals",
    );

    const artifact = await hre.artifacts.readArtifact("LockingTokenWrapper");
    const initCode = encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [testToken2.address],
    });
    const wrappedAddress = getCreate2Address({
      from: factory.address,
      salt: zeroHash,
      bytecodeHash: keccak256(initCode),
    });

    await viem.assertions.emitWithArgs(
      factory.write.wrap([testToken2.address]),
      factory,
      "Created",
      [testToken2.address, wrappedAddress],
    );
    await viem.assertions.revert(factory.write.wrap([testToken2.address]));

    const wrapped = await viem.getContractAt(
      "LockingTokenWrapper",
      wrappedAddress,
    );
    assert.equal(await wrapped.read.name(), "Test Stub Standard Wrapper");
    assert.equal(await wrapped.read.symbol(), "TESTSW");
    assert.equal(
      getAddress(await wrapped.read.underlying()),
      getAddress(testToken2.address),
    );
    assert.equal(await wrapped.read.exchangeRate(), 10n ** 10n);

    await viem.assertions.revertWithCustomError(
      wrapped.write.deposit([0n]),
      wrapped,
      "InvalidValue",
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      wrapped.write.deposit([1n]),
      wrapped,
      "ERC20InsufficientAllowance",
      [wrapped.address, 0n, 1n],
    );

    await testToken2.write.approve([wrapped.address, maxUint256]);
    await viem.assertions.emitWithArgs(
      wrapped.write.deposit([1n]),
      wrapped,
      "Transfer",
      [zeroAddress, owner.account.address, 10n ** 10n],
    );

    await viem.assertions.revertWithCustomError(
      wrapped.write.withdraw([1n]),
      wrapped,
      "InvalidValue",
    );
    await viem.assertions.emitWithArgs(
      wrapped.write.withdraw([10n ** 10n]),
      wrapped,
      "Transfer",
      [owner.account.address, zeroAddress, 10n ** 10n],
    );
  });
});
