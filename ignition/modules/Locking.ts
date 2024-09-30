import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { PredployedAddress } from "../../test/constant";

export default buildModule("Locking", (m) => {
    const locking = m.contract("Locking", [
        m.getParameter("locking.owner"),
        PredployedAddress.goatToken,
        m.getParameter("locking.totalReward"),
    ])

    // todo create validator
    return { locking };
});
