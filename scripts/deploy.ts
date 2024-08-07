import { ethers, artifacts } from "hardhat";
import { Bridge } from "../typechain-types";
import * as fs from 'fs';

async function main() {
	const btcAddressVerifier = "0x00000000000000000000000000000000C0dec000";
	const btcAddress = "bc1qmvs208we3jg7hgczhlh7e9ufw034kfm2vwsvge";
	const block100 = {
		prevBlock:
		"0x5b91046f23af72766172aa28929d1124f23595ab81da63d1849a4e77704a30cd",
		merkleRoot:
		"0x3ac8290dbcdf2e3fa9c76dffb2fa053561cd9975fedcf5eb61d597daeaca8e8c",
		version: "0x20000000",
		bits: "0x207fffff",
		nonce: "0x01",
		timestmap: "0x66ab9df4",
	};

	const bridgeFactory = await ethers.getContractFactory("Bridge");

	const bridge = await bridgeFactory.deploy(100, block100);

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


