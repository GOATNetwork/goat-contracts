// import { ethers } from "hardhat";
import { ethers } from "ethers";

async function main() {
  // const [signer] = await ethers.getSigners();

  // const publicKey = await signer._signingKey().publicKey;

  // const publicKey = "0x478d568faa8d46b64fecdfee189d6ce5ee93d929c74305c41d3e048102e90f7d59d693dfdbc263350130da564b934198ab20f759b08d016af7b1be68c7a572e8";

  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  const wallet = new ethers.Wallet(privateKey);

  const publicKey = wallet.signingKey.publicKey;

  const pubkeyX = publicKey.slice(4, 68);
  const pubkeyY = publicKey.slice(68);

  console.log("Public Key X:", pubkeyX);
  console.log("Public Key Y:", pubkeyY);

  console.log(`[0x${pubkeyX}, 0x${pubkeyY}]`);



}

main();
