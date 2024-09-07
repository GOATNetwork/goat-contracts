import { ethers, artifacts } from "hardhat";
import { Bridge } from "../typechain-types";
import * as fs from 'fs';

async function main() {
	const bridgeFactory = await ethers.getContractFactory("Bridge");

	const bridge = await bridgeFactory.deploy();

	let tx = await bridge.waitForDeployment();

	console.log(tx)
	const blockNumber = await ethers.provider.getBlockNumber();
	console.log(
    		`deployed to ${await bridge.getAddress()}, blockNumber: ${blockNumber}`
  	);

  let testjson = {
		"Bridge": await bridge.getAddress(),
		"blockNumber": blockNumber,
	}
	fs.writeFileSync('./subgraph/testnet.json', JSON.stringify(testjson),  {
 		flag: "w"
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(-1);
	})


