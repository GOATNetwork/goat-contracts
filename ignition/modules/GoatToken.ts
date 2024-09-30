import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("GoatToken", (m) => {
    const goatToken = m.contract("GoatToken", [m.getParameter("owner")]);
    return { goatToken };
});
