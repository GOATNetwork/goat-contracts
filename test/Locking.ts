import { ethers } from "hardhat";
import { expect } from "chai";
import { Executors, hash160, trimPubKeyPrefix } from "./constant";
import {
    loadFixture,
    impersonateAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Locking } from "../typechain-types";

describe("Locking", async () => {
    async function fixture() {
        const [owner, payer, ...others] = await ethers.getSigners();
        const factory = await ethers.getContractFactory("Locking");

        const goatFactory = await ethers.getContractFactory("GoatToken");
        const goat = await goatFactory.deploy(owner);

        const locking: Locking = await factory.deploy(owner, goat, 1000n);
        await goat.grantRole(await goat.MINTER_ROLE(), locking);

        await impersonateAccount(Executors.locking);
        await payer.sendTransaction({ // gas fee
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

        await expect(locking.addToken(ethers.ZeroAddress, 1, 1, 0)).revertedWith(
            "token exists",
        );
        await expect(
            locking.connect(others[0]).addToken(testToken, 1, 1, 0),
        ).revertedWithCustomError(locking, "OwnableUnauthorizedAccount");
        await expect(locking.addToken(testToken2, 1, 1, 0)).revertedWith(
            "invalid decimals",
        );
        await expect(locking.addToken(testToken, 0, 0, 1000)).revertedWith(
            "invalid weight",
        );

        await expect(await locking.addToken(testToken, 1, 0, 1000))
            .emit(locking, "UpdateTokenWeight")
            .withArgs(testToken, 1)
            .emit(locking, "UpdateTokenLimit")
            .withArgs(testToken, 0)
            .emit(locking, "SetThreshold")
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
        await expect(locking.setTokenWeight(others[0], 1)).revertedWith(
            "token not found",
        );
        await expect(locking.setTokenWeight(ethers.ZeroAddress, 1e6)).revertedWith(
            "invalid weight",
        );

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
        await expect(locking.setTokenLimit(others[0], 1)).revertedWith(
            "token not found",
        );
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
        await expect(locking.setThreshold(others[0], 1)).revertedWith(
            "token not found",
        );
        await expect(locking.setThreshold(testToken, 0)).revertedWith(
            "no changes",
        );
        await expect(await locking.setThreshold(testToken, 100))
            .emit(locking, "SetThreshold")
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
            .emit(locking, "SetThreshold")
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
            .emit(locking, "SetThreshold")
            .withArgs(testToken2, 12);

        threshold = await locking.creationThreshold();
        expect(threshold.length).eq(2);
        expect(threshold[1].token).eq(testToken2);
        expect(threshold[1].amount).eq(12);

        await expect(await locking.setThreshold(testToken, 0))
            .emit(locking, "SetThreshold")
            .withArgs(testToken, 0);

        threshold = await locking.creationThreshold();
        expect(threshold.length).eq(1);
        expect(threshold[0].token).eq(testToken2);
        expect(threshold[0].amount).eq(12);
    });

    it("get address by pubkey", async () => {
        const { locking } = await loadFixture(fixture);
        const wallet = ethers.Wallet.createRandom(ethers.provider);
        const consAddress = ethers.getAddress(hash160(trimPubKeyPrefix(wallet.publicKey)));
        const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
        const res = await locking.getAddressByPubkey([uncompressed.subarray(0, 32), uncompressed.subarray(32)])
        expect(res[0], consAddress)
        expect(res[1], wallet.address)
    })


    it("create", async () => {
        const { locking, owner, testToken } = await loadFixture(fixture);

        const wallet = ethers.Wallet.createRandom(ethers.provider);
        const consAddress = ethers.getAddress(hash160(trimPubKeyPrefix(wallet.publicKey)));
        const network = await ethers.provider.getNetwork();
        const sigmsg = ethers.solidityPackedKeccak256(
            ["uint256", "address", "address"],
            [network.chainId, consAddress, await owner.getAddress()],
        );

        const sig = wallet.signingKey.sign(sigmsg)
        const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
        const pubkey: any = [uncompressed.subarray(0, 32), uncompressed.subarray(32)]

        await expect(locking.create(
            pubkey,
            sig.r,
            sig.s,
            sig.v,
            { value: 1000n }),
        ).revertedWith("not started");

        await locking.setThreshold(ethers.ZeroAddress, 1000)
        await locking.addToken(testToken, 1, 0, 1000);
        await testToken.approve(locking, ethers.MaxUint256);

        await expect(locking.create(
            pubkey,
            sig.r,
            sig.s,
            sig.v
        ),
        ).revertedWith("invalid msg.value");

        await expect(await locking.create(
            pubkey,
            sig.r,
            sig.s,
            sig.v,
            { value: 1000n }),
        ).emit(locking, "Create").withArgs(consAddress, owner, pubkey)

        await expect(locking.create(
            pubkey,
            sig.r,
            sig.s,
            sig.v
        ),
        ).revertedWith("duplicated");
    });

    it("lock, unlock, claim", async () => {
        const { locking, owner, others, testToken, executor, goat } = await loadFixture(fixture);
        const wallet = ethers.Wallet.createRandom(ethers.provider);
        const validator = ethers.getAddress(hash160(trimPubKeyPrefix(wallet.publicKey)));
        const network = await ethers.provider.getNetwork();
        const sigmsg = ethers.solidityPackedKeccak256(
            ["uint256", "address", "address"],
            [network.chainId, validator, await owner.getAddress()],
        );

        const sig = wallet.signingKey.sign(sigmsg)
        const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
        const pubkey: any = [uncompressed.subarray(0, 32), uncompressed.subarray(32)]

        await locking.setThreshold(ethers.ZeroAddress, 1000)
        await locking.addToken(testToken, 1, 0, 100);
        await testToken.approve(locking, ethers.MaxUint256);

        await locking.create(pubkey, sig.r, sig.s, sig.v, { value: 1000n })
        await expect(await ethers.provider.getBalance(locking)).eq(1000)
        await expect(await testToken.balanceOf(locking)).eq(100)

        await expect(locking.lock(others[1], [])).revertedWith("validator not found")
        await expect(locking.connect(others[0]).lock(validator, [])).revertedWith("not validator owner")
        await expect(locking.lock(validator, [])).revertedWith("no tokens to lock")
        await expect(locking.lock(validator, [{ token: others[1], amount: 1n }])).revertedWith("not lockable token")
        await expect(locking.lock(validator, [{ token: ethers.ZeroAddress, amount: 1n }, { token: ethers.ZeroAddress, amount: 1n }], { value: 1n })).revertedWith("invalid msg.value")
        await testToken.approve(locking, 0n);
        await expect(locking.lock(validator, [{ token: testToken, amount: 1n }], { value: 1n })).revertedWithCustomError(testToken, "ERC20InsufficientAllowance").withArgs(locking, 0, 1n)
        await testToken.approve(locking, ethers.MaxUint256);
        await locking.setTokenLimit(testToken, 100);
        await expect(locking.lock(validator, [{ token: testToken, amount: 1n }], { value: 1n })).revertedWith("lock amount exceed")
        await locking.setTokenLimit(testToken, 0);
        await expect(locking.lock(validator, [{ token: testToken, amount: 1n }], { value: 1n })).revertedWith("msg.value more than locked")

        await expect(await locking.lock(validator,
            [{ token: ethers.ZeroAddress, amount: 1n }, { token: testToken, amount: 1n }], { value: 1n }))
            .emit(locking, "Lock").withArgs(validator, ethers.ZeroAddress, 1)
            .emit(locking, "Lock").withArgs(validator, testToken, 1)

        await expect(await ethers.provider.getBalance(locking)).eq(1000 + 1)
        await expect(await testToken.balanceOf(locking)).eq(100 + 1)

        await expect(locking.unlock(others[1], owner, [])).revertedWith("validator not found")
        await expect(locking.connect(others[0]).unlock(validator, owner, [])).revertedWith("not validator owner")
        await expect(locking.unlock(validator, owner, [])).revertedWith("no tokens to unlock")
        await expect(locking.unlock(validator, ethers.ZeroAddress, [{ token: ethers.ZeroAddress, amount: 1n }])).revertedWith("invalid recipient")

        await expect(locking.unlock(validator, owner, [{ token: ethers.ZeroAddress, amount: 0n }])).revertedWith("invalid amount")
        await expect(await locking.unlock(validator, owner,
            [{ token: ethers.ZeroAddress, amount: 1n }, { token: testToken, amount: 1n }]))
            .emit(locking, "Unlock").withArgs(0, validator, owner, ethers.ZeroAddress, 1n)
            .emit(locking, "Unlock").withArgs(1, validator, owner, testToken, 1n)

        await expect(locking.completeUnlock(0, owner, ethers.ZeroAddress, 1)).revertedWithCustomError(locking, "AccessDenied")
        await expect(await locking.connect(executor).completeUnlock(0, owner, ethers.ZeroAddress, 1))
            .emit(locking, "CompleteUnlock").withArgs(0, 1)

        await expect(await locking.connect(executor).completeUnlock(1, owner, testToken, 1))
            .emit(locking, "CompleteUnlock").withArgs(1, 1)
        await expect(await testToken.balanceOf(locking)).eq(100)

        await expect(locking.claim(others[1], owner)).revertedWith("validator not found")
        await expect(locking.connect(others[0]).claim(validator, owner)).revertedWith("not validator owner")
        await expect(locking.claim(validator, ethers.ZeroAddress)).revertedWith("invalid recipient")

        await expect(await locking.claim(validator, owner)).emit(locking, "Claim").withArgs(2, validator, owner)
        await expect(locking.distributeReward(2, owner, 1, 1)).revertedWithCustomError(locking, "AccessDenied")

        expect(await locking.remainReward()).eq(1000)
        await expect(await locking.connect(executor).distributeReward(2, owner, 1000, 0))
            .emit(locking, "DistributeReward").withArgs(2, goat, 1000)
            .emit(locking, "DistributeReward").withArgs(2, ethers.ZeroAddress, 0)
            .emit(goat, "Transfer").withArgs(ethers.ZeroAddress, owner, 1000)

        await expect(await goat.balanceOf(locking)).eq(0)
        expect(await locking.remainReward()).eq(0)

        await expect(await locking.claim(validator, owner)).emit(locking, "Claim").withArgs(3, validator, owner)
        await expect(await locking.connect(executor).distributeReward(3, owner, 0, 1000))
            .emit(locking, "DistributeReward").withArgs(3, ethers.ZeroAddress, 1000)
            .emit(locking, "DistributeReward").withArgs(3, goat, 0)
    })
});
