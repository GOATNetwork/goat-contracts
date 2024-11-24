import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { RateLimiterTest } from "../typechain-types";

describe("RateLimiter", async () => {
  async function fixture() {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RateLimiterTest");
    const rateLimiter: RateLimiterTest = await factory.deploy();
    return {
      owner,
      rateLimiter,
    };
  }

  it("pass", async () => {
    const { rateLimiter } = await loadFixture(fixture);
    await rateLimiter.pass1();
    await rateLimiter.pass2();
    await rateLimiter.pass3();
    await rateLimiter.pass4();
    await rateLimiter.pass5();
    await rateLimiter.pass6();
    await rateLimiter.pass7();
  });

  it("fail", async () => {
    const { rateLimiter } = await loadFixture(fixture);
    await expect(rateLimiter.fail1()).revertedWithCustomError(
      rateLimiter,
      "TooManyRequest",
    );
    await expect(rateLimiter.fail2()).revertedWithCustomError(
      rateLimiter,
      "RateLimitExceeded",
    );
    await expect(rateLimiter.fail3()).revertedWithCustomError(
      rateLimiter,
      "TooManyRequest",
    );
    await expect(rateLimiter.fail4()).revertedWithCustomError(
      rateLimiter,
      "RateLimitExceeded",
    );
  });
});
