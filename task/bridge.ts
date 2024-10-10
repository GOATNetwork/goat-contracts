import { task, types } from "hardhat/config";
import { PredployedAddress } from "../common/constants";

task("bridge:deposited")
    .setDescription("get if deposit is done by txid and txout")
    .addParam("txid", "the btc txid")
    .addParam("txout", "the tx output index", undefined, types.bigint)
    .setAction(async (args, hre) => {
        let txid: string = args["txid"];
        if (txid.startsWith("0x")) {
            throw new Error("Not a valid txid(0x prefix is not allowed)");
        }
        txid = "0x" + Buffer.from(txid, "hex").reverse().toString("hex");
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        console.log("is deposited", await bridge.isDeposited(txid, args["txout"]));
    });

task("bridge:withdraw")
    .setDescription("send withdraw tx")
    .addParam("address", "the receiver address")
    .addParam("price", "the max tx price", undefined, types.bigint)
    .addParam("value", "the btc value to withdraw", undefined, types.float)
    .setAction(async (args, hre) => {
        const value = hre.ethers.parseEther(String(args["value"]));
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        const tx = await bridge.withdraw(args["address"], args["price"], {
            value,
        });
        console.log("waiting for txid", tx.hash);
        const receipt = await tx.wait(1);
        console.log("success", receipt?.status === 1);
        console.log("cost", hre.ethers.formatEther(receipt!.fee));
        if (receipt!.status == 1) {
            console.log(bridge.interface.parseLog(receipt!.logs[0]));
        }
    });

task("bridge:rbf")
    .setDescription("send replaceByFee tx")
    .addParam("id", "the withdrawal id", undefined, types.bigint)
    .addParam("price", "the new tx price", undefined, types.bigint)
    .setAction(async (args, hre) => {
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        const tx = await bridge.replaceByFee(args["id"], args["price"]);
        console.log("waiting for txid", tx.hash);
        const receipt = await tx.wait(1);
        console.log("success", receipt?.status === 1);
        console.log("cost", hre.ethers.formatEther(receipt!.fee));
        if (receipt!.status == 1) {
            console.log(bridge.interface.parseLog(receipt!.logs[0]));
        }
    });

task("bridge:cancel")
    .setDescription("send cancel1 tx")
    .addParam("id", "the withdrawal id", undefined, types.bigint)
    .setAction(async (args, hre) => {
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        const tx = await bridge.cancel1(args["id"]);
        console.log("waiting for txid", tx.hash);
        const receipt = await tx.wait(1);
        console.log("success", receipt?.status === 1);
        console.log("cost", hre.ethers.formatEther(receipt!.fee));
        if (receipt!.status == 1) {
            console.log(bridge.interface.parseLog(receipt!.logs[0]));
        }
    });

task("bridge:refund")
    .setDescription("send refund tx")
    .addParam("id", "the withdrawal id", undefined, types.bigint)
    .setAction(async (args, hre) => {
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        const tx = await bridge.refund(args["id"]);
        console.log("waiting for txid", tx.hash);
        const receipt = await tx.wait(1);
        console.log("success", receipt!.status === 1);
        console.log("cost", hre.ethers.formatEther(receipt!.fee));
        if (receipt!.status == 1) {
            console.log(bridge.interface.parseLog(receipt!.logs[0]));
        }
    });

task("bridge:status")
    .setDescription("get withdrawal status by id")
    .addParam("id", "the withdrawal id", undefined, types.bigint)
    .setAction(async (args, hre) => {
        const bridge = await hre.ethers.getContractAt(
            "Bridge",
            PredployedAddress.bridge,
        );
        const wd = await bridge.withdrawals(args["id"]);
        console.log("amount", hre.ethers.formatEther(wd.amount));
        console.log("tax", hre.ethers.formatEther(wd.tax));
        console.log("tx price", wd.maxTxPrice);
        switch (wd.status) {
            case 1n:
                return console.log("status", "Pending");
            case 2n:
                return console.log("status", "Canceling");
            case 3n:
                return console.log("status", "Canceled");
            case 4n:
                return console.log("status", "Refunded");
            case 5n:
                return console.log("status", "Paid");
        }
    });
