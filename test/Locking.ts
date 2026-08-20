import { network } from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodePacked,
  getAddress,
  keccak256,
  maxUint256,
  parseEther,
  zeroAddress,
  type Address,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { Executors } from "../common/constants.js";
import {
  parseValidatorPublicKey,
  parseValidatorSignature,
} from "../common/utils.js";

describe("Locking", async () => {
  const { viem, networkHelpers } = await network.create();

  function assertAddressEqual(actual: Address, expected: Address) {
    assert.equal(getAddress(actual), getAddress(expected));
  }

  async function fixture() {
    const [owner, payer, ...others] = await viem.getWalletClients();
    const goat = await viem.deployContract("GoatToken", [
      owner.account.address,
    ]);
    const locking = await viem.deployContract("Locking", [
      owner.account.address,
      goat.address,
      1000n,
    ]);
    await goat.write.transfer([locking.address, 1000n]);
    await locking.write.addToken([zeroAddress, 12_000n, 0n, 0n]);

    await networkHelpers.impersonateAccount(Executors.locking);
    await payer.sendTransaction({
      to: Executors.locking,
      value: parseEther("1"),
    });

    const testToken = await viem.deployContract("TestToken");
    const testToken2 = await viem.deployContract("TestToken");
    await testToken2.write.setDecimal([8]);

    return {
      owner,
      others,
      locking,
      testToken,
      testToken2,
      goat,
      executor: await viem.getWalletClient(Executors.locking),
    };
  }

  async function createValidator(owner: Address) {
    const account = privateKeyToAccount(generatePrivateKey());
    const { coordinates, validatorAddress } = parseValidatorPublicKey(
      account.publicKey,
    );
    const publicClient = await viem.getPublicClient();
    const hash = keccak256(
      encodePacked(
        ["uint256", "address", "address"],
        [BigInt(await publicClient.getChainId()), validatorAddress, owner],
      ),
    );
    const signature = parseValidatorSignature(await account.sign({ hash }));
    return {
      account,
      pubkey: coordinates,
      validator: validatorAddress,
      ...signature,
    };
  }

  it("token", async () => {
    const { locking, others, testToken, testToken2 } =
      await networkHelpers.loadFixture(fixture);

    await viem.assertions.revertWithCustomError(
      locking.write.addToken([zeroAddress, 1n, 1n, 0n]),
      locking,
      "TokenExists",
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.addToken([testToken.address, 1n, 1n, 0n], {
        account: others[0].account,
      }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.addToken([testToken2.address, 1n, 1n, 0n]),
      locking,
      "NotStandardLockingToken",
    );
    await viem.assertions.revertWithCustomError(
      locking.write.addToken([testToken.address, 0n, 0n, 1000n]),
      locking,
      "InvalidTokenWeight",
    );

    await viem.assertions.emitWithArgs(
      locking.write.addToken([testToken.address, 1n, 0n, 1000n]),
      locking,
      "UpdateTokenThreshold",
      [testToken.address, 1000n],
    );

    let token = await locking.read.tokens([testToken.address]);
    assert.equal(token[0], true);
    assert.equal(token[1], 1n);
    assert.equal(token[2], 0n);
    assert.equal(token[3], 1000n);

    let threshold = await locking.read.creationThreshold();
    assert.equal(threshold.length, 1);
    assertAddressEqual(threshold[0].token, testToken.address);
    assert.equal(threshold[0].amount, 1000n);

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setTokenWeight([testToken.address, 1n], {
        account: others[0].account,
      }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setTokenWeight([others[0].account.address, 1n]),
      locking,
      "TokenNotFound",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.setTokenWeight([zeroAddress, 1_000_000n]),
      locking,
      "InvalidTokenWeight",
    );

    await viem.assertions.emitWithArgs(
      locking.write.setTokenWeight([testToken.address, 10n]),
      locking,
      "UpdateTokenWeight",
      [testToken.address, 10n],
    );
    token = await locking.read.tokens([testToken.address]);
    assert.deepEqual(token, [true, 10n, 0n, 1000n]);

    await viem.assertions.emitWithArgs(
      locking.write.setTokenWeight([testToken.address, 0n]),
      locking,
      "UpdateTokenWeight",
      [testToken.address, 0n],
    );
    assert.deepEqual(await locking.read.tokens([testToken.address]), [
      false,
      0n,
      0n,
      0n,
    ]);
    assert.equal((await locking.read.creationThreshold()).length, 0);

    await viem.assertions.emitWithArgs(
      locking.write.addToken([testToken.address, 100n, 100n, 0n]),
      locking,
      "UpdateTokenLimit",
      [testToken.address, 100n],
    );
    assert.deepEqual(await locking.read.tokens([testToken.address]), [
      true,
      100n,
      100n,
      0n,
    ]);

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setTokenLimit([testToken.address, 0n], {
        account: others[0].account,
      }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setTokenLimit([others[0].account.address, 1n]),
      locking,
      "TokenNotFound",
      [others[0].account.address],
    );
    await viem.assertions.emitWithArgs(
      locking.write.setTokenLimit([testToken.address, 0n]),
      locking,
      "UpdateTokenLimit",
      [testToken.address, 0n],
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setThreshold([testToken.address, 0n], {
        account: others[0].account,
      }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.setThreshold([others[0].account.address, 1n]),
      locking,
      "TokenNotFound",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.setThreshold([testToken.address, 0n]),
      locking,
      "NoChanges",
    );
    await viem.assertions.emitWithArgs(
      locking.write.setThreshold([testToken.address, 100n]),
      locking,
      "UpdateTokenThreshold",
      [testToken.address, 100n],
    );
    threshold = await locking.read.creationThreshold();
    assert.equal(threshold.length, 1);
    assertAddressEqual(threshold[0].token, testToken.address);
    assert.equal(threshold[0].amount, 100n);

    await locking.write.setThreshold([testToken.address, 1000n]);
    threshold = await locking.read.creationThreshold();
    assert.equal(threshold[0].amount, 1000n);

    await testToken2.write.setDecimal([18]);
    await viem.assertions.emitWithArgs(
      locking.write.addToken([testToken2.address, 1n, 0n, 12n]),
      locking,
      "UpdateTokenThreshold",
      [testToken2.address, 12n],
    );
    threshold = await locking.read.creationThreshold();
    assert.equal(threshold.length, 2);
    assertAddressEqual(threshold[1].token, testToken2.address);
    assert.equal(threshold[1].amount, 12n);

    await locking.write.setThreshold([testToken.address, 0n]);
    threshold = await locking.read.creationThreshold();
    assert.equal(threshold.length, 1);
    assertAddressEqual(threshold[0].token, testToken2.address);
  });

  it("get address by pubkey", async () => {
    const { locking } = await networkHelpers.loadFixture(fixture);
    const validator = await createValidator(zeroAddress);
    const result = await locking.read.getAddressByPubkey([validator.pubkey]);
    assertAddressEqual(result[0], validator.validator);
    assertAddressEqual(result[1], validator.account.address);
  });

  it("create", async () => {
    const { locking, owner, others, testToken, goat } =
      await networkHelpers.loadFixture(fixture);
    const validator = await createValidator(owner.account.address);

    await viem.assertions.revertWithCustomError(
      locking.write.create(
        [validator.pubkey, validator.r, validator.s, validator.v],
        { value: 1000n },
      ),
      locking,
      "LockingNotStarted",
    );

    await locking.write.setThreshold([zeroAddress, 1000n]);
    await locking.write.addToken([testToken.address, 1n, 0n, 1000n]);
    await testToken.write.approve([locking.address, maxUint256]);

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.create(
        [validator.pubkey, validator.r, validator.s, validator.v],
        { value: 1000n },
      ),
      locking,
      "UnapprovedValidator",
      [validator.validator],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.approve([validator.validator], {
        account: others[0].account,
      }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.emitWithArgs(
      locking.write.approve([validator.validator]),
      locking,
      "Approval",
      [validator.validator],
    );
    assert.equal(await locking.read.approvals([validator.validator]), true);

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.create([
        validator.pubkey,
        validator.r,
        validator.s,
        validator.v,
      ]),
      locking,
      "InvalidMsgValue",
      [1000n],
    );
    await viem.assertions.emitWithArgs(
      locking.write.create(
        [validator.pubkey, validator.r, validator.s, validator.v],
        { value: 1000n },
      ),
      locking,
      "Create",
      [validator.validator, owner.account.address, validator.pubkey],
    );

    const publicClient = await viem.getPublicClient();
    assert.equal(
      await publicClient.getBalance({ address: locking.address }),
      1000n,
    );
    assert.equal(await testToken.read.balanceOf([locking.address]), 1000n);
    assertAddressEqual(
      await locking.read.owners([validator.validator]),
      owner.account.address,
    );
    assert.equal(await locking.read.totalLocking([zeroAddress]), 1000n);
    assert.equal(await locking.read.totalLocking([testToken.address]), 1000n);
    assert.equal(
      await locking.read.locking([validator.validator, testToken.address]),
      1000n,
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.create([
        validator.pubkey,
        validator.r,
        validator.s,
        validator.v,
      ]),
      locking,
      "DuplicateValidator",
      [validator.validator],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.changeValidatorOwner(
        [validator.validator, others[0].account.address],
        { account: others[0].account },
      ),
      locking,
      "NotValidatorOwner",
      [owner.account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.changeValidatorOwner([validator.validator, zeroAddress]),
      locking,
      "InvalidZeroAddress",
    );
    await viem.assertions.emitWithArgs(
      locking.write.changeValidatorOwner([
        validator.validator,
        others[0].account.address,
      ]),
      locking,
      "ChangeValidatorOwner",
      [validator.validator, others[0].account.address],
    );
    assertAddressEqual(
      await locking.read.owners([validator.validator]),
      others[0].account.address,
    );

    await goat.write.approve([locking.address, maxUint256]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.grant([1n], { account: others[0].account }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.grant([0n]),
      locking,
      "InvalidZeroAmount",
    );
    await viem.assertions.emitWithArgs(
      locking.write.grant([100n]),
      locking,
      "Grant",
      [100n],
    );
    assert.equal(await locking.read.remainReward(), 1100n);
  });

  it("lock", async () => {
    const { locking, owner, others, testToken } =
      await networkHelpers.loadFixture(fixture);
    const validator = await createValidator(owner.account.address);
    await locking.write.setThreshold([zeroAddress, 1000n]);
    await locking.write.addToken([testToken.address, 1n, 0n, 100n]);
    await testToken.write.approve([locking.address, maxUint256]);
    await locking.write.approve([zeroAddress]);
    await locking.write.create(
      [validator.pubkey, validator.r, validator.s, validator.v],
      { value: 1000n },
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock([others[1].account.address, []]),
      locking,
      "NotValidatorOwner",
      [zeroAddress],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock([validator.validator, []], {
        account: others[0].account,
      }),
      locking,
      "NotValidatorOwner",
      [owner.account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.lock([validator.validator, []]),
      locking,
      "InvalidTokenListSize",
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock([
        validator.validator,
        [{ token: others[1].account.address, amount: 1n }],
      ]),
      locking,
      "TokenNotFound",
      [others[1].account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock(
        [
          validator.validator,
          [
            { token: zeroAddress, amount: 1n },
            { token: zeroAddress, amount: 1n },
          ],
        ],
        { value: 1n },
      ),
      locking,
      "InvalidMsgValue",
      [1n],
    );

    await testToken.write.approve([locking.address, 0n]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock(
        [validator.validator, [{ token: testToken.address, amount: 1n }]],
        { value: 1n },
      ),
      testToken,
      "ERC20InsufficientAllowance",
      [locking.address, 0n, 1n],
    );
    await testToken.write.approve([locking.address, maxUint256]);
    await locking.write.setTokenLimit([testToken.address, 100n]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock(
        [validator.validator, [{ token: testToken.address, amount: 1n }]],
        { value: 1n },
      ),
      locking,
      "LockAmountExceed",
      [testToken.address, 100n],
    );
    await locking.write.setTokenLimit([testToken.address, 0n]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock(
        [validator.validator, [{ token: testToken.address, amount: 1n }]],
        { value: 1n },
      ),
      locking,
      "InvalidMsgValue",
      [0n],
    );

    await viem.assertions.emitWithArgs(
      locking.write.lock(
        [
          validator.validator,
          [
            { token: zeroAddress, amount: 1n },
            { token: testToken.address, amount: 1n },
          ],
        ],
        { value: 1n },
      ),
      locking,
      "Lock",
      [validator.validator, testToken.address, 1n],
    );

    const publicClient = await viem.getPublicClient();
    assert.equal(
      await publicClient.getBalance({ address: locking.address }),
      1001n,
    );
    assert.equal(await testToken.read.balanceOf([locking.address]), 101n);

    await locking.write.setThreshold([zeroAddress, 2000n]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.lock(
        [validator.validator, [{ token: zeroAddress, amount: 100n }]],
        { value: 100n },
      ),
      locking,
      "BelowThreshold",
      [zeroAddress, 999n],
    );
  });

  it("unlock", async () => {
    const { locking, owner, others, testToken, executor } =
      await networkHelpers.loadFixture(fixture);
    const validator = await createValidator(owner.account.address);
    await locking.write.setThreshold([zeroAddress, 1000n]);
    await locking.write.addToken([testToken.address, 1n, 0n, 100n]);
    await testToken.write.approve([locking.address, maxUint256]);
    await locking.write.approve([zeroAddress]);
    await locking.write.create(
      [validator.pubkey, validator.r, validator.s, validator.v],
      { value: 1000n },
    );
    await locking.write.lock(
      [
        validator.validator,
        [
          { token: zeroAddress, amount: 1n },
          { token: testToken.address, amount: 1n },
        ],
      ],
      { value: 1n },
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.unlock([
        others[1].account.address,
        owner.account.address,
        [],
      ]),
      locking,
      "NotValidatorOwner",
      [zeroAddress],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.unlock([validator.validator, owner.account.address, []], {
        account: others[0].account,
      }),
      locking,
      "NotValidatorOwner",
      [owner.account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.unlock([validator.validator, owner.account.address, []]),
      locking,
      "InvalidTokenListSize",
    );
    await viem.assertions.revertWithCustomError(
      locking.write.unlock([
        validator.validator,
        zeroAddress,
        [{ token: zeroAddress, amount: 1n }],
      ]),
      locking,
      "InvalidZeroAddress",
    );
    await viem.assertions.revertWithCustomError(
      locking.write.unlock([
        validator.validator,
        owner.account.address,
        [{ token: zeroAddress, amount: 0n }],
      ]),
      locking,
      "InvalidZeroAmount",
    );

    await viem.assertions.emitWithArgs(
      locking.write.unlock([
        validator.validator,
        owner.account.address,
        [
          { token: zeroAddress, amount: 1n },
          { token: testToken.address, amount: 1n },
        ],
      ]),
      locking,
      "Unlock",
      [1n, validator.validator, owner.account.address, testToken.address, 1n],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.completeUnlock([
        0n,
        owner.account.address,
        zeroAddress,
        1n,
      ]),
      locking,
      "NotConsensusLayer",
    );
    await viem.assertions.emitWithArgs(
      locking.write.completeUnlock(
        [0n, owner.account.address, zeroAddress, 1n],
        {
          account: executor.account,
        },
      ),
      locking,
      "CompleteUnlock",
      [0n, 1n],
    );
    await viem.assertions.emitWithArgs(
      locking.write.completeUnlock(
        [1n, owner.account.address, testToken.address, 1n],
        { account: executor.account },
      ),
      locking,
      "CompleteUnlock",
      [1n, 1n],
    );
    assert.equal(await testToken.read.balanceOf([locking.address]), 100n);
  });

  it("claim", async () => {
    const { locking, owner, others, testToken, executor, goat } =
      await networkHelpers.loadFixture(fixture);
    const validator = await createValidator(owner.account.address);
    await locking.write.setThreshold([zeroAddress, 1000n]);
    await locking.write.addToken([testToken.address, 1n, 0n, 100n]);
    await testToken.write.approve([locking.address, maxUint256]);
    await locking.write.approve([zeroAddress]);
    await locking.write.create(
      [validator.pubkey, validator.r, validator.s, validator.v],
      { value: 1000n },
    );
    await locking.write.lock(
      [
        validator.validator,
        [
          { token: zeroAddress, amount: 1n },
          { token: testToken.address, amount: 1n },
        ],
      ],
      { value: 1n },
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.claim([others[1].account.address, owner.account.address]),
      locking,
      "NotValidatorOwner",
      [zeroAddress],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.claim([validator.validator, owner.account.address], {
        account: others[0].account,
      }),
      locking,
      "NotValidatorOwner",
      [owner.account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.claim([validator.validator, zeroAddress]),
      locking,
      "InvalidZeroAddress",
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      locking.write.openClaim({ account: others[0].account }),
      locking,
      "OwnableUnauthorizedAccount",
      [others[0].account.address],
    );
    assert.equal(await locking.read.claimable(), false);

    await viem.assertions.emitWithArgs(
      locking.write.claim([validator.validator, owner.account.address]),
      locking,
      "Claim",
      [0n, validator.validator, owner.account.address],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.distributeReward([0n, owner.account.address, 1n, 1n]),
      locking,
      "NotConsensusLayer",
    );

    assert.equal(await locking.read.remainReward(), 1000n);
    await viem.assertions.emitWithArgs(
      locking.write.distributeReward([0n, owner.account.address, 100n, 1000n], {
        account: executor.account,
      }),
      locking,
      "DistributeReward",
      [0n, 100n, 1000n],
    );
    assert.equal(await locking.read.unclaimed([owner.account.address]), 100n);
    assert.equal(await goat.read.balanceOf([locking.address]), 1000n);
    assert.equal(await locking.read.remainReward(), 900n);

    await viem.assertions.revertWithCustomError(
      locking.write.reclaim(),
      locking,
      "ClaimNotOpen",
    );
    await viem.assertions.emit(locking.write.openClaim(), locking, "OpenClaim");
    await viem.assertions.revertWithCustomError(
      locking.write.openClaim(),
      locking,
      "ClaimOpened",
    );
    assert.equal(await locking.read.claimable(), true);

    await viem.assertions.emitWithArgs(
      locking.write.reclaim(),
      goat,
      "Transfer",
      [locking.address, owner.account.address, 100n],
    );
    await viem.assertions.revertWithCustomError(
      locking.write.reclaim(),
      locking,
      "NoUnclaimed",
    );

    await locking.write.claim([validator.validator, owner.account.address]);
    await viem.assertions.emitWithArgs(
      locking.write.distributeReward([1n, owner.account.address, 1000n, 100n], {
        account: executor.account,
      }),
      locking,
      "DistributeReward",
      [1n, 900n, 100n],
    );
  });
});
