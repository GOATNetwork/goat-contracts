import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash160, sha256, trim0xPrefix } from "../../common/utils";
import { Relayer } from "../../typechain-types";
import { RelayerParam } from "./param";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: RelayerParam,
) => {
  console.log("Deploy relayer");
  const factory = await hre.ethers.getContractFactory("Relayer");

  const [signer] = await hre.ethers.getSigners();
  const contract: Relayer = await factory.deploy(signer);

  for (const voter of param.voters) {
    const txKey = Buffer.from(trim0xPrefix(voter.txKey), "hex");
    if (txKey.length != 33) {
      throw new Error("invalid voter tx key length");
    }
    if (txKey[0] !== 2 && txKey[0] !== 3) {
      throw new Error("invalid voter tx key prefix");
    }
    const address = hre.ethers.getAddress(hash160(txKey));
    if (address.toLowerCase() != voter.address.toLowerCase()) {
      throw new Error(
        `Voter address mismatched: want ${voter.address} bug got ${address}`,
      );
    }
    const blsKey = Buffer.from(trim0xPrefix(voter.voteKey), "hex");
    if (blsKey.length != 96) {
      throw new Error("invalid bls key length");
    }
    const voteKeyHash = "0x" + sha256(blsKey);
    console.log("Add relayer from pubkey", { address, voteKeyHash });
    await contract.addVoter(address, voteKeyHash);
  }

  console.log("Transfer back relayer owner to", param.owner);
  await contract.transferOwnership(param.owner);
  return contract.getAddress();
};
