const ethers = require("ethers");

const provider = new ethers.JsonRpcProvider(
	"http://127.0.0.1:8546"
);

const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

const ABI = require("../artifacts/contracts/bridge/Bridge.sol/Bridge.json").abi;
const config = require("../subgraph/testnet.json");

console.log(config);
const Bridge = new ethers.Contract(
	config.Bridge,
	ABI,
	signer
);



const makeDeposit = async () => {
	const tx1 = {
		id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
		txout: BigInt(Math.floor(Math.random() * 2**32)),
		amount: BigInt(1e18),
		tax: 0n,
	};

	const tx = await Bridge.deposit(tx1.id, tx1.txout, signer, tx1.amount)

	console.log(tx);
	//const receipt = await tx.wait()  
	//  console.log(receipt.logs)


}

makeDeposit()
