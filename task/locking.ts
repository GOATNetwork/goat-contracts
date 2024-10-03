import { parseEther, formatEther } from "ethers";
import { task, types } from "hardhat/config";
import * as path from "path";
import * as fs from 'fs';
import { HardhatRuntimeEnvironment } from "hardhat/types";

// 0xba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4
async function checkSignature(publicKey: string, hre: HardhatRuntimeEnvironment) {
  const { ethers } = hre;
  const [_, validator] = await ethers.getSigners();

  // Public key for the validator (secp256k1 uncompressed key)
  const pubkeyX = `0x${publicKey.slice(4, 68)}`;
  const pubkeyY = `0x${publicKey.slice(68)}`;

  const pubkey: [string, string] = [pubkeyX, pubkeyY];

  console.log("Public key X:", pubkeyX);
  console.log("Public key Y:", pubkeyY);

  // Calculate validator address from public key (use keccak256 like in the contract for EthAddress)
  const ethAddress = ethers.getAddress(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32"], pubkey)).slice(26));
  console.log("Calculated EthAddress (Validator Address):", ethAddress);
  console.log("Validator address:", validator.address);

  // Calculate Cosmos address (ConsAddress) from public key (use sha256 and ripemd160)
  const prefix = (parseInt(pubkeyY.slice(-1), 16) % 2 === 0) ? '0x02' : '0x03';
  const compressedPubKey = ethers.concat([prefix, pubkeyX]);
  const sha256Hash = ethers.sha256(compressedPubKey);
  const consAddress = ethers.ripemd160(ethers.getBytes(sha256Hash));  // Last 20 bytes for Cosmos address
  console.log("Calculated ConsAddress (Cosmos Address):", consAddress);

  // Create the message hash (same as the Solidity code)
  const chainId = await hre.network.config.chainId;
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address"],
    [chainId, ethAddress, validator.address]
  );

  console.log("Message Hash:", messageHash);

  // Sign the message
  const signature = await validator.signMessage(ethers.getBytes(messageHash));
  const { v, r, s } = ethers.Signature.from(signature);

  console.log("Signature: v =", v, "r =", r, "s =", s);

  // Recover the address from the signature
  // Note: We need to hash the message with the Ethereum Signed Message prefix
  const prefixedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash));
  const recoveredAddress = ethers.recoverAddress(prefixedMessageHash, signature);

  console.log("Recovered Address:", recoveredAddress);

  // Compare the recovered address with the validator's address
  if (recoveredAddress.toLowerCase() === validator.address.toLowerCase()) {
    console.log("Signature is valid, addresses match.");
  } else {
    console.log("Signature mismatch, addresses do not match.");
    throw new Error("Signature mismatch, addresses do not match.");
  }

  return { pubkey, r, s, v };
}

function getLockingAddress(network: string) {
  const networkName = network === 'localhost' ? 'testnet' : network;
  const testnetConfigPath = path.join(__dirname, `../subgraph/${networkName}.json`);
  const testnetConfig = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
  return testnetConfig.LockingInfo.Locking;
}

// Initialize Locking contract and set token thresholds
task("init-locking", "Initialize Locking contract and set token thresholds")
  .addParam("ethThreshold", "Threshold amount for ETH", "1", types.string)
  .addParam("goatThreshold", "Threshold amount for GOAT token", "10", types.string)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Checking Locking contract initialization...");

    const goatToken = await locking.goatToken();
    console.log("GOAT Token address:", goatToken);

    const ethTokenInfo = await locking.tokens(ethers.ZeroAddress);
    console.log("ETH Token info:", ethTokenInfo);

    const goatTokenInfo = await locking.tokens(goatToken);
    console.log("GOAT Token info:", goatTokenInfo);

    console.log("Locking contract initialization checked.");

    // Set thresholds
    console.log("Setting ETH threshold...");
    const ethTx = await locking.setThreshold(ethers.ZeroAddress, ethers.parseEther(taskArgs.ethThreshold));
    await ethTx.wait();
    console.log(`ETH threshold set to ${taskArgs.ethThreshold} ETH`);

    console.log("Setting GOAT token threshold...");
    const goatTx = await locking.setThreshold(goatToken, ethers.parseEther(taskArgs.goatThreshold));
    await goatTx.wait();
    console.log(`GOAT token threshold set to ${taskArgs.goatThreshold} GOAT`);

    // Set weights
    console.log("Setting ETH weight...");
    const ethWeightTx = await locking.setTokenWeight(ethers.ZeroAddress, 12000);
    await ethWeightTx.wait();
    console.log(`ETH weight set to 12000`);

    console.log("Setting GOAT token weight...");
    const goatWeightTx = await locking.setTokenWeight(goatToken, 1);
    console.log(`GOAT weight set to 1`);
    await goatWeightTx.wait();

    // Check updated thresholds
    const updatedEthTokenInfo = await locking.tokens(ethers.ZeroAddress);
    const updatedGoatTokenInfo = await locking.tokens(goatToken);
    console.log("Updated ETH Token info:", updatedEthTokenInfo);
    console.log("Updated GOAT Token info:", updatedGoatTokenInfo);
  });

// Create validator and lock GOAT tokens
task("create-validator", "Create a new validator")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const [_, validator] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // [1]
    const wallet = new ethers.Wallet(privateKey, ethers.provider);

    const publicKey = wallet.signingKey.publicKey;
    // const pubkeyX = `0x${publicKey.slice(4, 68)}`;
    // const pubkeyY = `0x${publicKey.slice(68)}`;

    // const publicKey = "0xba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4"; // [1]


    const { pubkey, r, s, v } = await checkSignature(publicKey, hre);

    // before approve transfer GOAT Token, get GoatToken contract address
    const goatToken = await locking.goatToken();
    const goatAmount = ethers.parseEther("10"); // lock 10 GOAT token
    const goatContract = await ethers.getContractAt("IERC20", goatToken);

    // step 1: user approve contract to transfer GOAT Token
    console.log("Approving GOAT tokens...");
    const approveTx = await goatContract.approve(lockingAddress, goatAmount);
    await approveTx.wait();
    console.log("Approved GOAT tokens.");

    // step 2: call create function, pass ETH
    console.log("Creating validator...");
    const createTx = await locking.create(
      pubkey as [string, string],
      r,
      s,
      v,
      { value: ethers.parseEther("1") } // send 1 ETH
    );
    await createTx.wait();
    console.log(`Validator created: ${validator.address}`);

    // step 3: call lock function to lock GOAT token
    console.log("Locking GOAT tokens...");
    const lockTx = await locking.lock(validator.address, [{
      token: goatToken,
      amount: goatAmount
    }]);
    await lockTx.wait();
    console.log(`Locked 10 GOAT tokens for validator ${validator.address}`);
  });


// Lock tokens
task("lock-tokens", "Lock tokens for a validator")
  .addParam("validator", "Validator's address")
  .addParam("token", "Token address (use 0x0 for ETH)")
  .addParam("amount", "Amount to lock")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    const values = [{
      token: taskArgs.token,
      amount: parseEther(taskArgs.amount)
    }];

    console.log("Locking tokens...");
    const tx = await locking.lock(taskArgs.validator, values, {
      value: taskArgs.token === ethers.ZeroAddress ? parseEther(taskArgs.amount) : 0
    });
    await tx.wait();

    console.log(`Locked ${taskArgs.amount} tokens for validator ${taskArgs.validator}`);
  });

// Unlock tokens
task("unlock-tokens", "Unlock tokens for a validator")
  .addParam("validator", "Validator's address")
  .addParam("recipient", "Recipient's address")
  .addParam("token", "Token address (use 0x0 for ETH)")
  .addParam("amount", "Amount to unlock")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    const values = [{
      token: taskArgs.token,
      amount: parseEther(taskArgs.amount)
    }];

    console.log("Unlocking tokens...");
    const tx = await locking.unlock(taskArgs.validator, taskArgs.recipient, values);
    await tx.wait();

    console.log(`Unlocked ${taskArgs.amount} tokens for validator ${taskArgs.validator}`);
  });

// Claim rewards
task("claim-rewards", "Claim rewards for a validator")
  .addParam("validator", "Validator's address")
  .addParam("recipient", "Recipient's address for rewards")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Claiming rewards...");
    const tx = await locking.claim(taskArgs.validator, taskArgs.recipient);
    await tx.wait();

    console.log(`Claimed rewards for validator ${taskArgs.validator}`);
  });

// Add new token
task("add-token", "Add a new token to the Locking contract")
  .addParam("token", "Token address")
  .addParam("weight", "Token weight")
  .addParam("limit", "Token limit (0 for no limit)")
  .addParam("threshold", "Creation threshold (0 to not add to threshold list)")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Adding new token...");
    const tx = await locking.addToken(taskArgs.token, taskArgs.weight, parseEther(taskArgs.limit), parseEther(taskArgs.threshold));
    await tx.wait();

    console.log(`Added new token: ${taskArgs.token}`);
  });

// Update token weight
task("update-token-weight", "Update token weight")
  .addParam("token", "Token address")
  .addParam("weight", "New token weight")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Updating token weight...");
    const tx = await locking.setTokenWeight(taskArgs.token, taskArgs.weight);
    await tx.wait();

    console.log(`Updated weight for token ${taskArgs.token} to ${taskArgs.weight}`);
  });

// Update token limit
task("update-token-limit", "Update token limit")
  .addParam("token", "Token address")
  .addParam("limit", "New token limit (0 for no limit)")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Updating token limit...");
    const tx = await locking.setTokenLimit(taskArgs.token, parseEther(taskArgs.limit));
    await tx.wait();

    console.log(`Updated limit for token ${taskArgs.token} to ${taskArgs.limit}`);
  });

// Update creation threshold
task("update-threshold", "Update creation threshold for a token")
  .addParam("token", "Token address")
  .addParam("amount", "New threshold amount (0 to remove from threshold list)")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Updating creation threshold...");
    const tx = await locking.setThreshold(taskArgs.token, parseEther(taskArgs.amount));
    await tx.wait();

    console.log(`Updated creation threshold for token ${taskArgs.token} to ${taskArgs.amount}`);
  });

task("locking-info", "Get detailed information about the Locking contract")
  .setAction(async (_, hre) => {
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await hre.ethers.getContractAt("Locking", lockingAddress);

    const goatToken = await locking.goatToken();
    const ethToken = hre.ethers.ZeroAddress;
    const remainReward = await locking.remainReward();
    const claimable = await locking.claimable();

    console.log("Locking Contract Information:");
    console.log(`Address: ${lockingAddress}`);
    console.log(`GOAT Token: ${goatToken}`);
    console.log(`Remaining Reward: ${formatEther(remainReward)} GOAT`);
    console.log(`Claimable: ${claimable}`);

    const goatTokens = await locking.tokens(goatToken)
    const ethTokens = await locking.tokens(ethToken);
    console.log("\nGoat Tokens:", goatToken, goatTokens.weight, goatTokens.limit, goatTokens.threshold);
    console.log("\nETH Tokens:", ethToken, ethTokens.weight, ethTokens.limit, ethTokens.threshold);

  });

task("locking-validator-info", "Get information about a specific validator")
  .addParam("validator", "The validator's address")
  .setAction(async (taskArgs, hre) => {
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await hre.ethers.getContractAt("Locking", lockingAddress);

    const owner = await locking.owners(taskArgs.validator);

    console.log(`Validator Information for ${taskArgs.validator}:`);
    console.log(`Owner: ${owner}`);

    // You might want to add more information here, such as locked tokens
  });

task("locking-token-info", "Get information about a specific token")
  .addParam("token", "The token's address")
  .setAction(async (taskArgs, hre) => {
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await hre.ethers.getContractAt("Locking", lockingAddress);

    const tokenInfo = await locking.tokens(taskArgs.token);
    const totalLocking = await locking.totalLocking(taskArgs.token);

    console.log(`Token Information for ${taskArgs.token}:`);
    console.log(`Exists: ${tokenInfo.exist}`);
    console.log(`Weight: ${tokenInfo.weight}`);
    console.log(`Limit: ${formatEther(tokenInfo.limit)}`);
    console.log(`Threshold: ${formatEther(tokenInfo.threshold)}`);
    console.log(`Total Locking: ${formatEther(totalLocking)}`);
  });

task("locking-validator-tokens", "Get token locking information for a validator")
  .addParam("validator", "The validator's address")
  .setAction(async (taskArgs, hre) => {
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await hre.ethers.getContractAt("Locking", lockingAddress);

    const tokens = await locking.creationThreshold();
    console.log(`Token Locking Information for Validator ${taskArgs.validator}:`);

    for (const token of tokens) {
      const amount = await locking.locking(taskArgs.validator, token.token);
      console.log(`Token ${token.token}:`);
      console.log(`  Locked Amount: ${formatEther(amount)}`);
    }
  });

task("locking-creation-threshold", "Get the current creation threshold")
  .setAction(async (_, hre) => {
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await hre.ethers.getContractAt("Locking", lockingAddress);

    const threshold = await locking.creationThreshold();

    console.log("Creation Threshold:", threshold);
    for (const t of threshold) {
      console.log(`Token ${t.token}: ${formatEther(t.amount)}`);
    }
  });

  task("print-accounts", "Prints all hardhat accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    accounts.forEach((account, index) => {
      console.log(`Account ${index + 1}: ${account.address}`);
    });
  });
