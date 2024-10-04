import { ethers, network } from "hardhat";
import * as fs from 'fs';

async function main() {
  // Get the deployer account (the first account in the list of signers)
  const [deployer] = await ethers.getSigners();

  console.log("Deploying new token with the account:", deployer.address);

  // Deploy the new ERC20 token (using GoatToken contract)
  const OtherToken = await ethers.getContractFactory("GoatToken");
  const otherToken = await OtherToken.deploy(deployer.address);
  await otherToken.waitForDeployment();  // Wait for deployment to complete

  console.log("New Token deployed to:", await otherToken.getAddress());

  // Determine network name, adjust for localhost if necessary
  const networkName = network.name === 'localhost' ? 'testnet' : network.name;

  // Load the deployment data from the contract addresses file
  const filePath = `./subgraph/${networkName}.json`;
  const existingData = fs.readFileSync(filePath, {
    encoding: 'utf-8',
  });
  const deploymentInfo = JSON.parse(existingData);  // Parse the existing JSON data

  // Retrieve the Locking contract address from the JSON data
  const lockingAddress = deploymentInfo.LockingInfo.Locking;
  const locking = await ethers.getContractAt("Locking", lockingAddress);

  // Get the owner of the Locking contract
  const owner = await locking.owner();
  console.log("Locking contract owner:", owner);

  // Parameters for adding a new token to the Locking contract
  const tokenWeight = 1;  // The weight of the new token
  const tokenLimit = ethers.parseEther("1000000");  // Maximum amount of tokens that can be locked
  const creationThreshold = ethers.parseEther("10");  // Threshold for validator creation

  // Call the addToken function to add the new token to the Locking contract
  const tx = await locking.addToken(
    await otherToken.getAddress(),  // Address of the new token
    tokenWeight,
    tokenLimit,
    creationThreshold
  );
  await tx.wait();  // Wait for the transaction to be confirmed

  console.log(`Added new token ${await otherToken.getAddress()} to Locking contract`);

  // Update the OtherTokens array by adding the new token's address
  if (!deploymentInfo.OtherTokens) {
    deploymentInfo.OtherTokens = [];  // Ensure OtherTokens array exists
  }

  // Push the new token address into the OtherTokens array
  deploymentInfo.OtherTokens.push(await otherToken.getAddress());

  // Write the updated deployment information back to the JSON file
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2), {
    flag: 'w',  // Overwrite the existing file
  });

  console.log("Updated deployment information with the new token.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
