import { parseEther, formatEther, SigningKey } from "ethers";
import { task, types } from "hardhat/config";
import * as path from "path";
import * as fs from 'fs';
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Executors, hash160, trimPubKeyPrefix } from "../test/constant";

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
  .addParam("privateKey", "Validator's private key") // 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d private key, 0xc4841b8f5e6f10a38dc5e672e183ffd9be0cd12f cosAddress
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner, _] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    const privateKey = taskArgs.privateKey; // validator private key cosAddress
    const wallet = new ethers.Wallet(privateKey);

    const compressed = SigningKey.computePublicKey(wallet.signingKey.publicKey);

    const validator = ethers.getAddress(
      hash160(trimPubKeyPrefix(compressed)),
    );
    console.log("Validator address:", validator);

    const uncompressed = trimPubKeyPrefix(wallet.signingKey.publicKey);
    const pubkey: [string, string] = [
      ethers.hexlify(uncompressed.subarray(0, 32)),
      ethers.hexlify(uncompressed.subarray(32))
    ];

    console.log("Validator ConsAddress:", validator);
    console.log("Public key X:", pubkey[0]);
    console.log("Public key Y:", pubkey[1]);

    const network = await ethers.provider.getNetwork();
    const sigmsg = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [network.chainId, validator, await owner.getAddress()]
    );

    const sig = wallet.signingKey.sign(sigmsg);

    const goatToken = await locking.goatToken();
    const goatAmount = ethers.parseEther("10");
    const goatContract = await ethers.getContractAt("IERC20", goatToken);

    // step 1: approve GOAT Token
    console.log("Approving GOAT tokens...");
    const approveTx = await goatContract.approve(lockingAddress, goatAmount);
    await approveTx.wait();
    console.log("Approved GOAT tokens.");

    // step 2: call create function, pass ETH
    console.log("Creating validator...");
    const createTx = await locking.create(
      pubkey,
      sig.r,
      sig.s,
      sig.v,
      { value: ethers.parseEther("1") } // send 1 ETH
    );
    await createTx.wait();
    console.log(`Validator created: ${validator}`);

    // check validator owner
    const validatorOwner = await locking.owners(validator);
    console.log("Validator owner:", validatorOwner);
    if (validatorOwner === owner.address) {
      console.log("Validator creation successful!");
    } else {
      console.log("Validator creation failed!");
    }
  });


// Lock token
task("lock-token", "Lock tokens for a validator")
  .addParam("validator", "Validator's address")
  .addParam("token", "Token address (use 0x0 for ETH)")
  .addParam("amount", "Amount to lock")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();
    // Fetch the locking contract
    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    // Parse the amount from the provided argument
    const amount = ethers.parseEther(taskArgs.amount);

    // Create values array for the lock operation
    const values = [{
      token: taskArgs.token,
      amount
    }];

    // Check if locking an ERC20 token or ETH
    if (taskArgs.token !== ethers.ZeroAddress) {
      // ERC20 Token: Ensure approval and balance
      const tokenContract = await ethers.getContractAt("IERC20", taskArgs.token);

      // Check sender's token balance
      const balance = await tokenContract.balanceOf(await owner.getAddress());
      console.log(`Sender's token balance: ${ethers.formatEther(balance)} tokens`);

      // Ensure the sender has enough tokens to lock
      if (balance < amount) {
        throw new Error("Insufficient token balance to lock");
      }

      // Approve the locking contract to transfer tokens
      console.log("Approving the locking contract to transfer tokens...");
      const approveTx = await tokenContract.approve(lockingAddress, amount);
      await approveTx.wait();
      console.log(`Approved ${ethers.formatEther(amount)} tokens for locking contract`);
    }

    // Log the locking process
    console.log("Locking tokens...");

    try {
      // Lock the tokens or ETH
      const tx = await locking.lock(taskArgs.validator, values, {
        value: taskArgs.token === ethers.ZeroAddress ? amount : 0, // ETH if token is 0x0
        gasLimit: 1000000 // Set a high gas limit to avoid out-of-gas errors
      });
      await tx.wait();

      // Log success message
      console.log(`Locked ${ethers.formatEther(amount)} tokens for validator: ${taskArgs.validator}`);
      console.log(`Token: ${taskArgs.token === ethers.ZeroAddress ? 'ETH' : taskArgs.token}`);
    } catch (error) {
      console.error("Error occurred during locking:", error);
    }
  });



// Unlock tokens
task("unlock-tokens", "Unlock tokens for a validator")
  .addParam("validator", "Validator's address")
  .addParam("recipient", "Recipient's address")
  .addParam("tokens", "Comma-separated list of token addresses")
  .addParam("amounts", "Comma-separated list of amounts to unlock")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    // Parse the input tokens and amounts
    const tokens = taskArgs.tokens.split(',');
    const amounts = taskArgs.amounts.split(',').map(ethers.parseEther);

    // Ensure the number of tokens matches the number of amounts
    if (tokens.length !== amounts.length) {
      throw new Error("The number of token addresses and amounts must match");
    }

    // Construct values array for the unlock operation
    const values = tokens.map((token: string, index: number) => ({
      token,
      amount: amounts[index]
    }));

    console.log("Unlocking tokens...");

    // Send transaction to unlock tokens
    const tx = await locking.unlock(taskArgs.validator, taskArgs.recipient, values);
    await tx.wait();

    // Log details of the unlock operation
    console.log(`Unlock request submitted for validator: ${taskArgs.validator}`);
    console.log(`Recipient: ${taskArgs.recipient}`);
    values.forEach(({ token, amount }: { token: string, amount: bigint }) => {
      console.log(`Token ${token}: Unlocking amount ${ethers.formatEther(amount)}`);
    });
  });


// Complete unlock
task("complete-unlock", "Complete the unlock operation")
  .addParam("id", "Request ID", undefined, types.string)
  .addParam("recipient", "Recipient's address")
  .addParam("token", "Token address (use 0x0 for native token)")
  .addParam("amount", "Amount to unlock", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Completing unlock...");

    // Parse the amount to unlock
    const amount = ethers.parseEther(taskArgs.amount);

    // Execute completeUnlock transaction
    const tx = await locking.completeUnlock(
      taskArgs.id,
      taskArgs.recipient,
      taskArgs.token,
      amount
    );

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    // Log details of the completed unlock operation
    console.log(`Unlock completed for request ID: ${taskArgs.id}`);
    console.log(`  Amount: ${ethers.formatEther(amount)} ${taskArgs.token === ethers.ZeroAddress ? 'ETH' : 'tokens'}`);
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

task("grant-rewards", "Grant GOAT tokens to the reward pool")
  .addParam("amount", "Amount of GOAT tokens to grant", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);
    const goatToken = await locking.goatToken();
    const goatContract = await ethers.getContractAt("IERC20", goatToken);

    const amount = ethers.parseEther(taskArgs.amount);

    console.log("Approving GOAT tokens...");
    await goatContract.approve(lockingAddress, amount);

    console.log(`Granting ${taskArgs.amount} GOAT tokens to the reward pool...`);
    const tx = await locking.grant(amount);
    await tx.wait();

    console.log("Grant successful!");
  });

task("open-claim", "Open the claim for rewards")
  .setAction(async (_, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log("Opening claim...");
    const tx = await locking.openClaim();
    await tx.wait();

    console.log("Claim opened successfully!");
  });

task("claim-rewards", "Claim rewards for a validator")
  .addParam("validator", "The validator's address")
  .addParam("recipient", "The recipient's address for the rewards")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    console.log(`Claiming rewards for validator ${taskArgs.validator}...`);
    const tx = await locking.claim(taskArgs.validator, taskArgs.recipient);
    await tx.wait();

    console.log("Claim submitted successfully!");
  });

  task("distribute-reward", "Distribute rewards to a recipient")
  .addParam("id", "The request ID", undefined, types.string)
  .addParam("recipient", "The recipient's address")
  .addParam("goat", "Amount of GOAT tokens to distribute", undefined, types.string)
  .addOptionalParam("gasReward", "Amount of gas reward to distribute", "0", types.string)
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const [owner] = await ethers.getSigners();

    const lockingAddress = getLockingAddress(hre.network.name);
    const locking = await ethers.getContractAt("Locking", lockingAddress);

    // Fetch the remaining GOAT tokens and format them for comparison
    const remainReward = await locking.remainReward();
    console.log(`Remaining GOAT tokens in contract: ${ethers.formatEther(remainReward)} GOAT`);

    const goatToDistribute = ethers.parseEther(taskArgs.goat);
    console.log(`Requested GOAT to distribute: ${ethers.formatEther(goatToDistribute)} GOAT`);

    // Ensure remaining rewards are sufficient, log actual and requested values
    if (goatToDistribute > remainReward) {
      console.log(`Insufficient GOAT tokens! Available: ${ethers.formatEther(remainReward)}, Requested: ${ethers.formatEther(goatToDistribute)}`);
      return;
    }

    // Fetch the contract's balance in native tokens (e.g., ETH)
    const contractBalance = await ethers.provider.getBalance(lockingAddress);
    console.log(`Contract ETH balance: ${ethers.formatEther(contractBalance)} ETH`);

    const gasReward = ethers.parseEther(taskArgs.gasReward);
    console.log(`Requested gas reward: ${ethers.formatEther(gasReward)} ETH`);

    // Ensure contract has enough ETH for gas reward, log actual and requested values
    if (gasReward > contractBalance) {
      console.log(`Insufficient ETH for gas reward! Available: ${ethers.formatEther(contractBalance)}, Requested: ${ethers.formatEther(gasReward)}`);
      return;
    }

    // Distribute the rewards
    console.log(`Distributing ${ethers.formatEther(goatToDistribute)} GOAT and ${ethers.formatEther(gasReward)} ETH to ${taskArgs.recipient}...`);
    const tx = await locking.distributeReward(
      taskArgs.id,
      taskArgs.recipient,
      goatToDistribute,
      gasReward
    );
    await tx.wait();

    console.log("Rewards distributed successfully!");
  });

