import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { getAddress } from "viem";

import { hash160, sha256, trim0xPrefix } from "../../common/utils.js";
import type { RelayerParam } from "./param.js";

export const deploy = async (
  hre: HardhatRuntimeEnvironment,
  param: RelayerParam,
) => {
  console.log("Deploy relayer");
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const contract = await viem.deployContract("Relayer", [
    signer.account.address,
  ]);

  for (const voter of param.voters) {
    const txKey = Buffer.from(trim0xPrefix(voter.txKey), "hex");
    if (txKey.length !== 33) {
      throw new Error("invalid voter tx key length");
    }
    if (txKey[0] !== 2 && txKey[0] !== 3) {
      throw new Error("invalid voter tx key prefix");
    }
    const address = getAddress(hash160(txKey));
    if (address.toLowerCase() !== voter.address.toLowerCase()) {
      throw new Error(
        `Voter address mismatched: want ${voter.address} but got ${address}`,
      );
    }
    const blsKey = Buffer.from(trim0xPrefix(voter.voteKey), "hex");
    if (blsKey.length !== 96) {
      throw new Error("invalid bls key length");
    }
    const voteKeyHash = sha256(blsKey);
    console.log("Add relayer from pubkey", { address, voteKeyHash });
    await contract.write.addVoter([address, voteKeyHash]);
  }

  console.log("Transfer back relayer owner to", param.owner);
  await contract.write.transferOwnership([getAddress(param.owner)]);
  return contract.address;
};
