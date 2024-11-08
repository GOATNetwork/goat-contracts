import { writeFileSync } from "fs";
import { Param } from "../task/deploy/param";

const param: Param = {
  GoatToken: {
    owner: "TODO",
    transfers: [
      {
        to: "0xbC10000000000000000000000000000000000004",
        value: "200000000ether",
      },
    ],
  },
  GoatFoundation: {
    owner: "TODO",
  },
  GoatDAO: {},
  Bridge: {
    owner: "TODO",
    depositPrefixMagic: "TODO",
    withdrawalTaxBP: 2,
    maxWithdrawalTaxInSat: "200000",
    minWithdrawalInSat: "10000",
    maxDepositTaxInSat: "0",
    minDepositInSat: "100000",
    depositTaxBP: 0,
    confirmationNumber: 1,
    deposits: [],
  },
  Bitcoin: {
    height: 3191651,
    network: "testnet3",
    hash: "TODO",
  },
  WrappedBitcoin: {},
  Relayer: {
    owner: "TODO",
    voters: [],
  },
  Locking: {
    strict: true,
    owner: "TODO",
    tokens: [
      {
        address: "0x0000000000000000000000000000000000000000",
        weight: 12000,
        limit: "800000000000000000000",
        threshold: "10000000000000000000",
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
      unlockDuration: "168h",
    },
  },
};

writeFileSync(
  "./genesis/testnet-config.json",
  JSON.stringify(param, null, "  "),
);
