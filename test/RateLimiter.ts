import { network } from "hardhat";
import { describe, it } from "node:test";

describe("RateLimiter", async () => {
  const { viem, networkHelpers } = await network.create();

  async function fixture() {
    return { rateLimiter: await viem.deployContract("RateLimiterTest") };
  }

  it("pass", async () => {
    const { rateLimiter } = await networkHelpers.loadFixture(fixture);
    await rateLimiter.write.pass1();
    await rateLimiter.write.pass2();
    await rateLimiter.write.pass3();
    await rateLimiter.write.pass4();
    await rateLimiter.write.pass5();
    await rateLimiter.write.pass6();
    await rateLimiter.write.pass7();
  });

  it("fail", async () => {
    const { rateLimiter } = await networkHelpers.loadFixture(fixture);
    await viem.assertions.revertWithCustomError(
      rateLimiter.write.fail1(),
      rateLimiter,
      "TooManyRequest",
    );
    await viem.assertions.revertWithCustomError(
      rateLimiter.write.fail2(),
      rateLimiter,
      "RateLimitExceeded",
    );
    await viem.assertions.revertWithCustomError(
      rateLimiter.write.fail3(),
      rateLimiter,
      "TooManyRequest",
    );
    await viem.assertions.revertWithCustomError(
      rateLimiter.write.fail4(),
      rateLimiter,
      "RateLimitExceeded",
    );
  });
});
