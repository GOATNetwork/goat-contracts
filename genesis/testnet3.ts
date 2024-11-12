import { writeFileSync } from "fs";
import { PredployedAddress } from "../common/constants";
import { Param } from "../task/deploy/param";
import { BitcoinToken, dayToHours, toSatoshi, toWei } from "./utils";

const param: Param = {
  GoatToken: {
    owner: "0x15Bc198AAEA57Cf23BfE9c076F574895C9cd8091",
    transfers: [
      {
        to: PredployedAddress.locking,
        value: toWei(200000000),
      },
    ],
  },
  GoatFoundation: {
    owner: "0x360268e8C47b01Ea615bBD8b682Ee69608304603",
  },
  GoatDAO: {},
  Bridge: {
    owner: "0x1d13bb7a0Ed6a050e72dfE021fd639E0aeaB27c3",
    depositPrefixMagic: "GT3V",
    withdrawalTaxBP: 2,
    maxWithdrawalTaxInSat: toSatoshi(0.002),
    minWithdrawalInSat: toSatoshi(0.0005),
    maxDepositTaxInSat: 0,
    minDepositInSat: toSatoshi(0.0005),
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
        address: BitcoinToken,
        weight: 12000,
        limit: toWei(800),
        threshold: toWei(2),
      },
    ],
    validators: [
      // MetisDAO
      {
        owner: "0x25877253d48d0386fe5655522a1b04425220ebf7",
        pubkey:
          "0xf867f98687ab2b1a4ccfc40b80652433301dba238ac868fbbd08f88a102ef773a09a14b7450a3f16dc4b827b10e10b8f6fa835fa3c537fa9f1980cfdffa08b99",
        signature:
          "0x05464971536f352c3e4782f022708138989fb5387457c3d2b4f0cbeb7deda6c05e2584bffb2915010b4b04ac65744467228f55d106eb5596c67e9adfe15640b700",
        validator: "0x1f1678de2c9985afbc3672506ba3f51d6f112fe6",
      },
      // ZKM
      {
        owner: "0x4f42539e37f7ec121007d2f0e43866985f8534b0",
        pubkey:
          "0xc4667b68abe1640bdbbb33ba71ba0f2d04af641ecda65fd05fe1a1db3f995769187a90be4addd19fb8b070c4b0e4a60d62c687ce7c8745e07590805bea08af93",
        signature:
          "0x7c230140285c2e7f1f4496287c95998232094fbae7ab07acb578cbea9f5da22d5a0df5f243e042c76ac05fcc89cbab48567a0e757eee26c557b3189f6aee36de01",
        validator: "0x70cce9b7fb446d4ccf793c8cbc12dbef99a10f83",
      },
      // GoatNetwork
      {
        owner: "0x7d9fb1017422e8a31fe0010c31650c9932fac1a1",
        pubkey:
          "0xeb92b2c84aface2581908a18d7276d6858201a8c98e8eb483634d0cb7d5dcbb40227639aa37dd7b90ccad4320ef32e4beac7fc045307a856aac1ad3437351de5",
        signature:
          "0x63cb88f727147ebdf87b19891022970a30819e90493f6e5b4780552e0f1a60343bb1ce2fe54a1596faac4a310edad588b0613f141bcbeb4bbad952d268b5a10801",
        validator: "0xfa398080fafddd6c770de7fce4e0dc7effbb6bce",
      },
    ],
    allowList: [],
  },
  Consensus: {
    Relayer: {
      tssPubkey:
        "037e3b7ed8ae975ce618c7c278213e03f761d412d320c24aa184cb5d3223d2f6fd",
      acceptProposerTimeout: "1m",
    },
    Locking: {
      exitDuration: dayToHours(21),
      unlockDuration: dayToHours(3),
    },
  },
};

writeFileSync(
  "./genesis/testnet3-config.json",
  JSON.stringify(param, null, "  "),
);
