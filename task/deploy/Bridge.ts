import { Bridge } from "../../typechain-types";
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { BridgeParam } from "./param";

export const deploy = async (hre: HardhatRuntimeEnvironment, param: BridgeParam) => {
    console.log("Deploy bridge");
    const factory = await hre.ethers.getContractFactory("Bridge")

    const [signer] = await hre.ethers.getSigners();
    const contract: Bridge = await factory.deploy(signer)
    if (param.depositTaxBP && param.maxDepositTax) {
        console.log("Set bridge deposit tax", "bp", param.depositTaxBP, "max", param.maxDepositTax)
        await contract.setDepositTax(BigInt(param.depositTaxBP), BigInt(param.maxDepositTax))
    }

    if (param.withdrawalTaxBP && param.maxWithdrawalTax) {
        console.log("Set bridge withdrawal tax", "bp", param.withdrawalTaxBP, "max", param.maxWithdrawalTax)
        await contract.setWithdrawalTax(BigInt(param.withdrawalTaxBP), BigInt(param.maxWithdrawalTax))
    }

    if (param.minWithdrawal) {
        console.log("Set bridge min withdrawal value", "value", param.minWithdrawal)
        await contract.setMinWithdrawal(BigInt(param.minWithdrawal))
    }

    console.log("Transfer back bridge owner", param.owner)
    await contract.transferOwnership(param.owner)
    return contract.getAddress()
}
