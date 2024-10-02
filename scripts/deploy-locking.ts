import { ethers, network } from "hardhat";
import * as fs from 'fs';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const GoatToken = await ethers.getContractFactory("GoatToken");
  const goatToken = await GoatToken.deploy(deployer.address);
  await goatToken.waitForDeployment();

  console.log("GoatToken deployed to:", await goatToken.getAddress());

  const owner = deployer.address;

  const Locking = await ethers.getContractFactory("Locking");
  const locking = await Locking.deploy(
    owner,  // set owner
    goatToken.getAddress(),  // GOAT token
    ethers.parseEther("1000")  // initial total reward
  );
  await locking.waitForDeployment();

  console.log("Locking contract deployed to:", await locking.getAddress());
  console.log("Locking contract owner:", await locking.owner());

  const networkName = network.name === 'localhost' ? 'testnet' : network.name;

  const deploymentInfo = {
    GoatToken: await goatToken.getAddress(),
    Locking: await locking.getAddress(),
    LockingOwner: owner,
    network: networkName,
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  const existingData = fs.readFileSync(`./subgraph/${networkName}.json`, {
    encoding: 'utf-8',
  });

  const existingDataObj = JSON.parse(existingData);
  existingDataObj.LockingInfo = deploymentInfo;

  fs.writeFileSync(`./subgraph/${networkName}.json`, JSON.stringify(existingDataObj),  {
 		flag: "w"
	});
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
