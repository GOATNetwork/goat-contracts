import { Executors } from "../test/constant";

const ethers = require("ethers");
//import { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";
import yargs from "yargs/yargs";

const initBridge = async (hre: any): Promise<{ bridge : ethers.Contract, signer : ethers.Wallet }> => {
	console.log(hre.network);
	let key = hre.network.config.accounts[0];

	let wallet = new ethers.SigningKey(key);

	const [signer] = await hre.ethers.getSigners();
	console.log("compressedPublicKey", wallet.compressedPublicKey, signer.address);

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

const makeDeposit = async (hre: any) => {
	let {bridge, signer} = await initBridge(hre);
	const tx1 = {
		id: "0xd825c1ec7b47a63f9e0fdc1379bd0ec9284468d7ce12d183b05718bd1b4e27ee",
		txout: BigInt(Math.floor(Math.random() * 2 ** 32)),
		amount: BigInt(2e18),
		tax: 0n,
	};
	const tx = await bridge.deposit(tx1.id, tx1.txout, signer, tx1.amount)
	console.log(tx);
}

const makeWithdrawal = async (hre: any) => {
	let {bridge, signer} = await initBridge(hre);
	const addr2 = "bc1qmvs208we3jg7hgczhlh7e9ufw034kfm2vwsvge";
	const amount = BigInt(1e18);
	const txPrice = 1n;
	const tx = await bridge.withdraw(addr2, txPrice, { value: amount });
	console.log(tx);
}

const makePay = async (hre: any) => {
	let {bridge, signer} = await initBridge(hre);
	const txid =
          "0xf52fe3ace5eff20c3d2edd6559bd160f2f91f7db297d39a9ce15e836bda75e7b";
	const txout = 0n;
	const txfee = 1000n;

	const amount = BigInt(1e18);
	const tax = 0n;//(amount * 20n) / BigInt(1e4);

	const paid = amount - tax - txfee;
	const wid = 0;

	const tx = await bridge.paid(wid, txid, txout, paid);
	console.log(tx);
}

const cancel1 = async (hre: any) => {
  const { bridge } = await initBridge(hre);

  const tx = await bridge.cancel1(0);
  console.log(tx);
}

const cancel2 = async (hre: any) => {
  const { bridge } = await initBridge(hre);

  const relayer = Executors.relayer;
  const relayerSigner = await ethers.getSigner(relayer)

  const tx = await bridge.connect(relayerSigner).cancel2(0);
  console.log(tx);
}

const replaceByFee = async (hre: any) => {
  const { bridge } = await initBridge(hre);

  const tx = await bridge.replaceByFee(0, 1n);
  console.log(tx);
}

export const mockEvent = async (action: string, hre: any) => {
	switch (action) {
		case "deposit": {
			//statements;
			await makeDeposit(hre);
			break;
		}
		case "withdraw": {
			//statements;
			await makeWithdrawal(hre);
			break;
		}

		case "pay": {
			await makePay(hre);
			//statements;
			break;
		}

    case "cancel1": {
      await cancel1(hre);
      break;
    }

    case "cancel2": {
      await cancel2(hre);
      break;
    }

    case "replace": {
      await replaceByFee(hre);
      break;
    }



    default: {
			//statements;
			break;
		}
	}
}
