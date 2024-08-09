const ethers = require("ethers");
import { task } from "hardhat/config";
import yargs from "yargs/yargs";

const initBridge = async (): {bridge: ethers.Contract, signer: ethers.Wallet} => {
	const provider = new ethers.JsonRpcProvider(
		"http://127.0.0.1:8546"
	);
	const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
	const ABI = require("../artifacts/contracts/bridge/Bridge.sol/Bridge.json").abi;
	const config = require("../subgraph/testnet.json");

	console.log(config);
	const bridge = new ethers.Contract(
		config.Bridge,
		ABI,
		signer
	);

	return {bridge, signer};

}

const makeDeposit = async () => {
	let {bridge, signer} = await initBridge();
	const tx1 = {
		id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
		txout: BigInt(Math.floor(Math.random() * 2 ** 32)),
		amount: BigInt(2e18),
		tax: 0n,
	};
	const tx = await bridge.deposit(tx1.id, tx1.txout, signer, tx1.amount)
	console.log(tx);
}

const makeWithdrawal = async () => {
	let {bridge, signer} = await initBridge();
	const addr2 = "tb1q23j89ml57f6tuascjflw6qevwh5pmcpzrlqwxx";
	const amount = BigInt(1e18);
	const txPrice = 1n;
	const tx = await bridge.withdraw(addr2, txPrice, { value: amount });
	console.log(tx);
}

const makePay = async () => {
	let {bridge, signer} = await initBridge();
	const txid =
          "0xf52fe3ace5eff20c3d2edd6559bd160f2f91f7db297d39a9ce15e836bda75e7b";
    const txout = 0n;
    const txfee = 1000n;

	const amount = BigInt(1e18);
	const tax = (amount * 20n) / BigInt(1e4);

	const paid = amount - tax - txfee;
	const addr2 = "tb1q23j89ml57f6tuascjflw6qevwh5pmcpzrlqwxx";
	const wid = 0;

	const tx = await bridge.paid(wid, txid, txout, paid);
	console.log(tx);
}

export const mockEvent = async (action: string) => {
	switch (action) {
		case "deposit": {
			//statements; 
			await makeDeposit();
			break;
		}
		case "withdraw": {
			//statements; 
			await makeWithdrawal();
			break;
		}

		case "pay": {
			await makePay();
			//statements; 
			break;
		}

		default: {
			//statements; 
			break;
		}
	}
}
