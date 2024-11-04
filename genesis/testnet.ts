import { Param } from "../task/deploy/param";
import { writeFileSync } from "fs";

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
    withdrawalTaxBP: 2,
    maxWithdrawalTax: "2000000000000000",
    minWithdrawalInWei: "100000000000000",
    deposits: [],
  },
  Bitcoin: {
    height: 3191651,
    network: "testnet3",
    hash: "000000000ebcb157e154584adb14244f4b9d6f7ab6ad6236caa7690b4f485e0a",
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
    Bridge: {
      minDepositInSat: 1e4,
      confirmationNumber: 32,
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
