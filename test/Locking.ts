import {
  impersonateAccount,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Executors } from "../common/constants";
import { hash160, trimPubKeyPrefix } from "../common/utils";
import { Locking } from "../typechain-types";

describe("Locking", async () => {
  async function fixture() {
    const [owner, payer, ...others] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("Locking");

    const goatFactory = await ethers.getContractFactory("GoatToken");
    const goat = await goatFactory.deploy(owner);

    const locking: Locking = await factory.deploy(owner, goat, 1000n);
    await goat.transfer(locking, 1000n);

    await locking.addToken(ethers.ZeroAddress, 12000, 0, 0);

    await impersonateAccount(Executors.locking);
    await payer.sendTransaction({
      // gas fee
      to: Executors.locking,
      value: ethers.parseEther("1"),
    });

    const tokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await tokenFactory.deploy();
    const testToken2 = await tokenFactory.deploy();
    await testToken2.setDecimal(8);

    return {
      owner,
      others,
      locking,
      testToken,
      testToken2,
      goat,
      executor: await ethers.getSigner(Executors.locking),
    };
  }

  it("token", async () => {
    const { locking, others, testToken, testToken2 } =
      await loadFixture(fixture);

    await expect(
      locking.addToken(ethers.ZeroAddress, 1, 1, 0),
    ).revertedWithCustomError(locking, "TokenExists");
    await expect(
      locking.connect(others[0]).addToken(testToken, 1, 1, 0),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
    await expect(locking.addToken(testToken2, 1, 1, 0)).revertedWithCustomError(
      locking,
      "NotStandardLockingToken",
    );
    await expect(
      locking.addToken(testToken, 0, 0, 1000),
    ).revertedWithCustomError(locking, "InvalidTokenWeight");

    await expect(await locking.addToken(testToken, 1, 0, 1000))
      .emit(locking, "UpdateTokenWeight")
      .withArgs(testToken, 1)
      .emit(locking, "UpdateTokenLimit")
      .withArgs(testToken, 0)
      .emit(locking, "UpdateTokenThreshold")
      .withArgs(testToken, 1000);

    let token = await locking.tokens(testToken);
    expect(token.exist).to.be.true;
    expect(token.weight).eq(1);
    expect(token.limit).eq(0);
    expect(token.threshold).eq(1000);

    let threshold = await locking.creationThreshold();
    expect(threshold.length).eq(1);
    expect(threshold[0].token).eq(testToken);
    expect(threshold[0].amount).eq(1000);

    await expect(
      locking.connect(others[0]).setTokenWeight(testToken, 1),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
    await expect(locking.setTokenWeight(others[0], 1))
      .revertedWithCustomError(locking, "TokenNotFound")
      .withArgs(others[0]);
    await expect(
      locking.setTokenWeight(ethers.ZeroAddress, 1e6),
    ).revertedWithCustomError(locking, "InvalidTokenWeight");

    // set weight to 10
    await expect(await locking.setTokenWeight(testToken, 10))
      .emit(locking, "UpdateTokenWeight")
      .withArgs(testToken, 10);
    token = await locking.tokens(testToken);
    expect(token.exist).to.be.true;
    expect(token.weight).eq(10);
    expect(token.limit).eq(0);
    expect(token.threshold).eq(1000);

    // set weight to 0
    await expect(await locking.setTokenWeight(testToken, 0))
      .emit(locking, "UpdateTokenWeight")
      .withArgs(testToken, 0);
    token = await locking.tokens(testToken);
    expect(token.exist).to.be.false;
    expect(token.weight).eq(0);
    expect(token.limit).eq(0);
    expect(token.threshold).eq(0);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(0);

    await expect(await locking.addToken(testToken, 100, 100, 0))
      .emit(locking, "UpdateTokenWeight")
      .withArgs(testToken, 100)
      .emit(locking, "UpdateTokenLimit")
      .withArgs(testToken, 100);

    token = await locking.tokens(testToken);
    expect(token.exist).to.be.true;
    expect(token.weight).eq(100);
    expect(token.limit).eq(100);
    expect(token.threshold).eq(0);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(0);

    await expect(
      locking.connect(others[0]).setTokenLimit(testToken, 0),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
    await expect(locking.setTokenLimit(others[0], 1))
      .revertedWithCustomError(locking, "TokenNotFound")
      .withArgs(others[0]);
    await expect(await locking.setTokenLimit(testToken, 0))
      .emit(locking, "UpdateTokenLimit")
      .withArgs(testToken, 0);

    token = await locking.tokens(testToken);
    expect(token.exist).to.be.true;
    expect(token.weight).eq(100);
    expect(token.limit).eq(0);
    expect(token.threshold).eq(0);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(0);

    await expect(
      locking.connect(others[0]).setThreshold(testToken, 0),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
    await expect(locking.setThreshold(others[0], 1))
      .revertedWithCustomError(locking, "TokenNotFound")
      .withArgs(others[0]);
    await expect(locking.setThreshold(testToken, 0)).revertedWithCustomError(
      locking,
      "NoChanges",
    );
    await expect(await locking.setThreshold(testToken, 100))
      .emit(locking, "UpdateTokenThreshold")
      .withArgs(testToken, 100);

    token = await locking.tokens(testToken);
    expect(token.exist).to.be.true;
    expect(token.weight).eq(100);
    expect(token.limit).eq(0);
    expect(token.threshold).eq(100);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(1);
    expect(threshold[0].token).eq(testToken);
    expect(threshold[0].amount).eq(100);

    await expect(await locking.setThreshold(testToken, 1000))
      .emit(locking, "UpdateTokenThreshold")
      .withArgs(testToken, 1000);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(1);
    expect(threshold[0].token).eq(testToken);
    expect(threshold[0].amount).eq(1000);

    await testToken2.setDecimal(18);
    await expect(await locking.addToken(testToken2, 1, 0, 12))
      .emit(locking, "UpdateTokenWeight")
      .withArgs(testToken2, 1)
      .emit(locking, "UpdateTokenLimit")
      .withArgs(testToken2, 0)
      .emit(locking, "UpdateTokenThreshold")
      .withArgs(testToken2, 12);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(2);
    expect(threshold[1].token).eq(testToken2);
    expect(threshold[1].amount).eq(12);

    await expect(await locking.setThreshold(testToken, 0))
      .emit(locking, "UpdateTokenThreshold")
      .withArgs(testToken, 0);

    threshold = await locking.creationThreshold();
    expect(threshold.length).eq(1);
    expect(threshold[0].token).eq(testToken2);
    expect(threshold[0].amount).eq(12);
  });

  it("get address by pubkey", async () => {
    const { locking } = await loadFixture(fixture);
    const wallet = ethers.Wallet.createRandom(ethers.provider);
    const consAddress = ethers.getAddress(
      hash160(trimPubKeyPrefix(wallet.publicKey)),
    );
    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const res = await locking.getAddressByPubkey([
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ]);
    expect(res[0], consAddress);
    expect(res[1], wallet.address);
  });

  it("create", async () => {
    const { locking, owner, others, testToken, goat } =
      await loadFixture(fixture);

    const wallet = ethers.Wallet.createRandom(ethers.provider);
    const validator = ethers.getAddress(
      hash160(trimPubKeyPrefix(wallet.publicKey)),
    );
    const network = await ethers.provider.getNetwork();
    const sigmsg = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [network.chainId, validator, await owner.getAddress()],
    );

    const sig = wallet.signingKey.sign(sigmsg);
    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];

    await expect(
      locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n }),
    ).revertedWithCustomError(locking, "LockingNotStarted");

    await locking.setThreshold(ethers.ZeroAddress, 1000);
    await locking.addToken(testToken, 1, 0, 1000);
    await testToken.approve(locking, ethers.MaxUint256);

    await expect(locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n }))
      .revertedWithCustomError(locking, "UnapprovedValidator")
      .withArgs(validator);

    await expect(
      locking.connect(others[0]).approve(validator),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");

    await expect(await locking.approve(validator))
      .emit(locking, "Approval")
      .withArgs(validator);
    await expect(await locking.approvals(validator)).to.be.true;

    await expect(locking.create(pubkey, sig.r, sig.s, sig.v))
      .revertedWithCustomError(locking, "InvalidMsgValue")
      .withArgs(1000n);

    await expect(
      await locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n }),
    )
      .emit(locking, "Create")
      .withArgs(validator, owner, pubkey);

    await expect(await ethers.provider.getBalance(locking)).eq(1000);
    await expect(await testToken.balanceOf(locking)).eq(1000);

    await expect(await locking.owners(validator)).eq(owner);
    await expect(await locking.totalLocking(ethers.ZeroAddress)).eq(1000n);
    await expect(await locking.totalLocking(testToken)).eq(1000n);
    await expect(await locking.locking(validator, testToken)).eq(1000n);
    await expect(await locking.locking(validator, ethers.ZeroAddress)).eq(
      1000n,
    );

    await expect(locking.create(pubkey, sig.r, sig.s, sig.v))
      .revertedWithCustomError(locking, "DuplicateValidator")
      .withArgs(validator);

    await expect(
      locking.connect(others[0]).changeValidatorOwner(validator, others[0]),
    )
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(owner);
    await expect(
      locking.changeValidatorOwner(validator, ethers.ZeroAddress),
    ).revertedWithCustomError(locking, "InvalidZeroAddress");
    await expect(await locking.changeValidatorOwner(validator, others[0]))
      .emit(locking, "ChangeValidatorOwner")
      .withArgs(validator, others[0]);
    await expect(await locking.owners(validator)).eq(others[0]);

    await goat.approve(locking, ethers.MaxUint256);
    await expect(locking.connect(others[0]).grant(1n)).revertedWithCustomError(
      locking,
      "OwnableUnauthorizedAccount",
    );
    await expect(locking.grant(0n)).revertedWithCustomError(
      locking,
      "InvalidZeroAmount",
    );
    await expect(await locking.grant(100n))
      .emit(locking, "Grant")
      .withArgs(100n)
      .emit(goat, "Transfer")
      .withArgs(owner, locking, 100n);

    await expect(await locking.remainReward()).eq(1000n + 100n);
  });

  it("lock", async () => {
    const { locking, owner, others, testToken } = await loadFixture(fixture);
    const wallet = ethers.Wallet.createRandom(ethers.provider);
    const validator = ethers.getAddress(
      hash160(trimPubKeyPrefix(wallet.publicKey)),
    );
    const network = await ethers.provider.getNetwork();
    const sigmsg = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [network.chainId, validator, await owner.getAddress()],
    );

    const sig = wallet.signingKey.sign(sigmsg);
    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];

    await locking.setThreshold(ethers.ZeroAddress, 1000);
    await locking.addToken(testToken, 1, 0, 100);
    await testToken.approve(locking, ethers.MaxUint256);

    await expect(await locking.approve(ethers.ZeroAddress))
      .emit(locking, "Approval")
      .withArgs(ethers.ZeroAddress);
    await expect(await locking.approvals(ethers.ZeroAddress)).to.be.true;

    await locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n });
    await expect(await ethers.provider.getBalance(locking)).eq(1000);
    await expect(await testToken.balanceOf(locking)).eq(100);

    await expect(locking.lock(others[1], []))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(ethers.ZeroAddress);
    await expect(locking.connect(others[0]).lock(validator, []))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(owner);
    await expect(locking.lock(validator, [])).revertedWithCustomError(
      locking,
      "InvalidTokenListSize",
    );
    await expect(locking.lock(validator, [{ token: others[1], amount: 1n }]))
      .revertedWithCustomError(locking, "TokenNotFound")
      .withArgs(others[1]);
    await expect(
      locking.lock(
        validator,
        [
          { token: ethers.ZeroAddress, amount: 1n },
          { token: ethers.ZeroAddress, amount: 1n },
        ],
        { value: 1n },
      ),
    )
      .revertedWithCustomError(locking, "InvalidMsgValue")
      .withArgs(1n);
    await testToken.approve(locking, 0n);
    await expect(
      locking.lock(validator, [{ token: testToken, amount: 1n }], {
        value: 1n,
      }),
    )
      .revertedWithCustomError(testToken, "ERC20InsufficientAllowance")
      .withArgs(locking, 0, 1n);
    await testToken.approve(locking, ethers.MaxUint256);
    await locking.setTokenLimit(testToken, 100);
    await expect(
      locking.lock(validator, [{ token: testToken, amount: 1n }], {
        value: 1n,
      }),
    )
      .revertedWithCustomError(locking, "LockAmountExceed")
      .withArgs(testToken, 100n);
    await locking.setTokenLimit(testToken, 0);
    await expect(
      locking.lock(validator, [{ token: testToken, amount: 1n }], {
        value: 1n,
      }),
    )
      .revertedWithCustomError(locking, "InvalidMsgValue")
      .withArgs(0n);

    await expect(
      await locking.lock(
        validator,
        [
          { token: ethers.ZeroAddress, amount: 1n },
          { token: testToken, amount: 1n },
        ],
        { value: 1n },
      ),
    )
      .emit(locking, "Lock")
      .withArgs(validator, ethers.ZeroAddress, 1)
      .emit(locking, "Lock")
      .withArgs(validator, testToken, 1);

    await expect(await ethers.provider.getBalance(locking)).eq(1000 + 1);
    await expect(await testToken.balanceOf(locking)).eq(100 + 1);

    await locking.setThreshold(ethers.ZeroAddress, 2000);
    await expect(
      locking.lock(validator, [{ token: ethers.ZeroAddress, amount: 100n }], {
        value: 100n,
      }),
    )
      .revertedWithCustomError(locking, "BelowThreshold")
      .withArgs(ethers.ZeroAddress, 999n);
  });

  it("unlock", async () => {
    const { locking, owner, others, testToken, executor } =
      await loadFixture(fixture);
    const wallet = ethers.Wallet.createRandom(ethers.provider);
    const validator = ethers.getAddress(
      hash160(trimPubKeyPrefix(wallet.publicKey)),
    );
    const network = await ethers.provider.getNetwork();
    const sigmsg = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [network.chainId, validator, await owner.getAddress()],
    );

    const sig = wallet.signingKey.sign(sigmsg);
    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];

    await locking.setThreshold(ethers.ZeroAddress, 1000);
    await locking.addToken(testToken, 1, 0, 100);
    await testToken.approve(locking, ethers.MaxUint256);
    await locking.approve(ethers.ZeroAddress);

    await locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n });
    await testToken.approve(locking, ethers.MaxUint256);
    await locking.lock(
      validator,
      [
        { token: ethers.ZeroAddress, amount: 1n },
        { token: testToken, amount: 1n },
      ],
      { value: 1n },
    );

    await expect(locking.unlock(others[1], owner, []))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(ethers.ZeroAddress);
    await expect(locking.connect(others[0]).unlock(validator, owner, []))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(owner);
    await expect(locking.unlock(validator, owner, [])).revertedWithCustomError(
      locking,
      "InvalidTokenListSize",
    );
    await expect(
      locking.unlock(validator, ethers.ZeroAddress, [
        { token: ethers.ZeroAddress, amount: 1n },
      ]),
    ).revertedWithCustomError(locking, "InvalidZeroAddress");

    await expect(
      locking.unlock(validator, owner, [
        { token: ethers.ZeroAddress, amount: 0n },
      ]),
    ).revertedWithCustomError(locking, "InvalidZeroAmount");
    await expect(
      await locking.unlock(validator, owner, [
        { token: ethers.ZeroAddress, amount: 1n },
        { token: testToken, amount: 1n },
      ]),
    )
      .emit(locking, "Unlock")
      .withArgs(0, validator, owner, ethers.ZeroAddress, 1n)
      .emit(locking, "Unlock")
      .withArgs(1, validator, owner, testToken, 1n);

    await expect(
      locking.completeUnlock(0, owner, ethers.ZeroAddress, 1),
    ).revertedWithCustomError(locking, "NotConsensusLayer");
    await expect(
      await locking
        .connect(executor)
        .completeUnlock(0, owner, ethers.ZeroAddress, 1),
    )
      .emit(locking, "CompleteUnlock")
      .withArgs(0, 1);

    await expect(
      locking.connect(executor).completeUnlock(0, owner, ethers.ZeroAddress, 1),
    )
      .revertedWithCustomError(locking, "ConsensusReentrantCall")
      .withArgs(0);

    await expect(
      await locking.connect(executor).completeUnlock(1, owner, testToken, 1),
    )
      .emit(locking, "CompleteUnlock")
      .withArgs(1, 1);
    await expect(await testToken.balanceOf(locking)).eq(100);
  });

  it("claim", async () => {
    const { locking, owner, others, testToken, executor, goat } =
      await loadFixture(fixture);
    const wallet = ethers.Wallet.createRandom(ethers.provider);
    const validator = ethers.getAddress(
      hash160(trimPubKeyPrefix(wallet.publicKey)),
    );
    const network = await ethers.provider.getNetwork();
    const sigmsg = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [network.chainId, validator, await owner.getAddress()],
    );

    const sig = wallet.signingKey.sign(sigmsg);
    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const pubkey: any = [
      uncompressed.subarray(0, 32),
      uncompressed.subarray(32),
    ];

    await locking.setThreshold(ethers.ZeroAddress, 1000);
    await locking.addToken(testToken, 1, 0, 100);
    await testToken.approve(locking, ethers.MaxUint256);
    await locking.approve(ethers.ZeroAddress);

    await locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n });
    await testToken.approve(locking, ethers.MaxUint256);
    await locking.lock(
      validator,
      [
        { token: ethers.ZeroAddress, amount: 1n },
        { token: testToken, amount: 1n },
      ],
      { value: 1n },
    );

    await expect(locking.claim(others[1], owner))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(ethers.ZeroAddress);
    await expect(locking.connect(others[0]).claim(validator, owner))
      .revertedWithCustomError(locking, "NotValidatorOwner")
      .withArgs(owner);
    await expect(
      locking.claim(validator, ethers.ZeroAddress),
    ).revertedWithCustomError(locking, "InvalidZeroAddress");

    await expect(
      locking.connect(others[0]).openClaim(),
    ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
    expect(await locking.claimable()).to.be.false;

    await expect(await locking.claim(validator, owner))
      .emit(locking, "Claim")
      .withArgs(0, validator, owner);

    await expect(
      locking.distributeReward(0, owner, 1, 1),
    ).revertedWithCustomError(locking, "NotConsensusLayer");

    expect(await locking.remainReward()).eq(1000);
    await expect(
      await locking.connect(executor).distributeReward(0, owner, 100, 1000),
    )
      .emit(locking, "DistributeReward")
      .withArgs(0, 100, 1000);

    await expect(
      locking.connect(executor).distributeReward(0, owner, 100, 1000),
    )
      .revertedWithCustomError(locking, "ConsensusReentrantCall")
      .withArgs(0);

    await expect(await locking.unclaimed(owner)).eq(100);
    await expect(await goat.balanceOf(locking)).eq(1000);
    expect(await locking.remainReward()).eq(900);

    await expect(locking.reclaim()).revertedWithCustomError(
      locking,
      "ClaimNotOpen",
    );

    await expect(await locking.openClaim()).emit(locking, "OpenClaim");
    await expect(locking.openClaim()).revertedWithCustomError(
      locking,
      "ClaimOpened",
    );
    expect(await locking.claimable()).to.be.true;

    await expect(await locking.reclaim())
      .emit(goat, "Transfer")
      .withArgs(locking, owner, 100);
    await expect(locking.reclaim()).revertedWithCustomError(
      locking,
      "NoUnclaimed",
    );

    await expect(await locking.claim(validator, owner))
      .emit(locking, "Claim")
      .withArgs(1, validator, owner);

    await expect(
      await locking.connect(executor).distributeReward(1, owner, 1000, 100),
    )
      .emit(locking, "DistributeReward")
      .withArgs(1, 900, 100)
      .emit(goat, "Transfer")
      .withArgs(locking, owner, 900);
  });
});
