import { writeFileSync } from "fs";
import { Param } from "../task/deploy/param";

const param: Param = {
  GoatToken: {
    owner: "0x15Bc198AAEA57Cf23BfE9c076F574895C9cd8091",
    transfers: [
      {
        to: "0xbC10000000000000000000000000000000000004",
        value: "200000000ether",
      },
    ],
  },
  GoatFoundation: {
    owner: "0x360268e8C47b01Ea615bBD8b682Ee69608304603",
  },
  GoatDAO: {},
  Bridge: {
    owner: "0x1d13bb7a0Ed6a050e72dfE021fd639E0aeaB27c3",
    depositPrefixMagic: "R1RWMQ==",
    withdrawalTaxBP: 2,
    maxWithdrawalTaxInSat: "200000",
    minWithdrawalInSat: "50000",
    maxDepositTaxInSat: "0",
    minDepositInSat: "50000",
    depositTaxBP: 0,
    confirmationNumber: 20,
    deposits: [],
  },
  Bitcoin: {
    height: 3433647,
    network: "testnet3",
    hash: "00000000014489a2c9ac3cd957d248d705f7ebd95453ef68a5624cdabd79b8ef",
  },
  WrappedBitcoin: {},
  Relayer: {
    owner: "TODO",
    voters: [],
  },
  Locking: {
    strict: true,
    owner: "0x5E87b3D603818159C71dBB840d68662e9cE19321",
    tokens: [
      {
        address: "0x0000000000000000000000000000000000000000",
        weight: 12000,
        limit: "800000000000000000000",
        threshold: "2000000000000000000",
      },
    ],
    validators: [],
    allowList: [],
  },
  Consensus: {
    Relayer: {
      tssPubkey: "TODO",
      acceptProposerTimeout: "1m",
    },
    Locking: {
      exitDuration: "504h",
      unlockDuration: "72h",
    },
  },
};

writeFileSync(
  "./genesis/testnet-config.json",
  JSON.stringify(param, null, "  "),
);
