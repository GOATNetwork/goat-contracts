import { Bridge } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { BridgeParam } from "./param";
import { Executors } from "../../common/constants";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: BridgeParam) => {
    console.log("Deploy bridge");
    const factory = await hre.ethers.getContractFactory("Bridge")

    const [signer] = await hre.ethers.getSigners();
    const contract: Bridge = await factory.deploy(signer)
    // validator should deposit first
    const relayer = await hre.ethers.getImpersonatedSigner(Executors.relayer)
    await signer.sendTransaction({ to: Executors.relayer, value: BigInt(1e18) })
    for (const deposit of param.deposits) {
        console.log("Add deposit", deposit)
        if (deposit.txid.startsWith("0x")) {
            throw new Error(`txid has 0x prefix`)
        }
        if (!Number.isInteger(deposit.satoshi)) {
            throw new Error(`amount is not integer`)
        }
        const txid = Buffer.from(deposit.txid, "hex").reverse()
        const amount = BigInt(1e10) * BigInt(deposit.satoshi);
        await contract.connect(relayer).deposit(txid, deposit.txout, deposit.address, amount)
        await signer.sendTransaction({ to: deposit.address, value: amount })
    }

    if (param.depositTaxBP && param.maxDepositTaxInWei) {
        console.log("Set bridge deposit tax", "bp", param.depositTaxBP, "max", param.maxDepositTaxInWei)
        await contract.setDepositTax(BigInt(param.depositTaxBP), BigInt(param.maxDepositTaxInWei))
    }

    if (param.withdrawalTaxBP && param.maxWithdrawalTax) {
        console.log("Set bridge withdrawal tax", "bp", param.withdrawalTaxBP, "max", param.maxWithdrawalTax)
        await contract.setWithdrawalTax(BigInt(param.withdrawalTaxBP), BigInt(param.maxWithdrawalTax))
    }

    if (param.minWithdrawalInWei) {
        console.log("Set bridge min withdrawal value", "value", param.minWithdrawalInWei)
        await contract.setMinWithdrawal(BigInt(param.minWithdrawalInWei))
    }

    console.log("Transfer back bridge owner", param.owner)
    await contract.transferOwnership(param.owner)
    return contract.getAddress()
}
