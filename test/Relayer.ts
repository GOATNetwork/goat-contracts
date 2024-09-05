import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

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

        const address = "0x398da22c497ccf618eca730927dca25cba6a01b9";
        const pubkey =
            "0x0feb19a673a7e27e1abb4f7487311b41397d00563ef898d2e23985c709f8b0b5";
        const threshold = 1;
        await expect(
            relayer.connect(others[0]).addVoter(address, pubkey, threshold),
        )
            .revertedWithCustomError(relayer, "OwnableUnauthorizedAccount")
            .withArgs(others[0]);

        expect(await relayer.addVoter(address, pubkey, threshold))
            .emit(relayer, "AddedVoter")
            .withArgs(address, pubkey, threshold);

        expect(await relayer.voters(address)).to.be.true;
        expect(await relayer.total()).eq(1);

        const address2 = "0xeb541758dbfc6fac468e8ed7915409a5c303b63a";
        const pubkey2 =
            "0x4912aec9112c22cad28948267ad8c4db4bed2e1b37f00904f194c525163a6e5d";

        await expect(relayer.addVoter(address2, pubkey, threshold)).revertedWith(
            "duplicated key",
        );
        await expect(relayer.addVoter(address, pubkey2, threshold)).revertedWith(
            "duplicated voter",
        );

        expect(await relayer.addVoter(address2, pubkey2, threshold))
            .emit(relayer, "AddedVoter")
            .withArgs(address2, pubkey2, threshold);
        expect(await relayer.voters(address2)).to.be.true;
        expect(await relayer.total()).eq(2);

        await expect(relayer.connect(others[0]).removeVoter(address, threshold))
            .revertedWithCustomError(relayer, "OwnableUnauthorizedAccount")
            .withArgs(others[0]);

        expect(await relayer.removeVoter(address2, threshold))
            .emit(relayer, "RemoveVoter")
            .withArgs(address2, threshold);
        expect(await relayer.voters(address2)).to.be.false;

        await expect(relayer.removeVoter(address2, threshold)).revertedWith(
            "voter not found",
        );
        await expect(relayer.removeVoter(address, threshold)).revertedWith(
            "too few voters",
        );
    });

    it("setThreshold", async () => {
        const { relayer, others } = await loadFixture(fixture);
        const threshold = 1;
        await expect(relayer.connect(others[0]).setThreshold(threshold))
            .revertedWithCustomError(relayer, "OwnableUnauthorizedAccount")
            .withArgs(others[0]);

        await expect(relayer.setThreshold(threshold)).revertedWith(
            "invalid threshold",
        );
    });
});
