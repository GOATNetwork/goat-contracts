import { task } from "hardhat/config";
import "./bridge";
import "./btcrpc";
import "./genesis";
import "./relayer";

task("decode-error", "decode error message")
  .addParam("error", "the encoded error data")
  .setAction(async (args, hre) => {
    for (const item of [
      "Bitcoin",
      "Bridge",
      "GoatToken",
      "GoatFoundation",
      "Relayer",
      "GoatDAO",
      "Locking",
    ]) {
      const artifact = await hre.artifacts.readArtifact(item);
      const dedec = new hre.ethers.Interface(artifact.abi);
      const result = dedec.parseError(args["error"]);
      if (result) {
        return console.log(result);
      }
    }
  });
