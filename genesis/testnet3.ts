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
    confirmationNumber: 20,
    depositTaxBP: 0,
    maxDepositTaxInSat: 0,
    minDepositInSat: toSatoshi(0.0005),
    deposits: [
      // MetisDAO
      {
        txid: "f59b33b7f62e7b32ec9a79923ad6e958f8a494f1a7f544ffb07f41880fa9c974",
        txout: 0,
        address: "0x25877253d48d0386fe5655522a1b04425220ebf7",
        satoshi: toSatoshi(2),
      },
      // ZKM
      {
        txid: "d7c68a9919442e9d054f145cf4da42a7e75edb78b53bd5b0df790d79265cc20a",
        txout: 0,
        address: "0x4f42539e37f7ec121007d2f0e43866985f8534b0",
        satoshi: toSatoshi(2),
      },
      // Goat
      {
        txid: "aeb857f055229861f6694db02fb55f4de907594292ced474a2f86e00f237adda",
        txout: 0,
        address: "0x7d9fb1017422e8a31fe0010c31650c9932fac1a1",
        satoshi: toSatoshi(2),
      },
    ],
  },
  Bitcoin: {
    height: 3433647,
    network: "testnet3",
    hash: "00000000014489a2c9ac3cd957d248d705f7ebd95453ef68a5624cdabd79b8ef",
  },
  WrappedBitcoin: {},
  Relayer: {
    owner: "0xF0c9583e7004BdA697666B45b225D59f9cc636B9",
    voters: [
      // ZKM
      {
        address: "0x3ae5b74dddd0c58afaa2cefa8b3ef3f35c2d6bb7",
        txKey:
          "0273f4f0b6f5937e049c7e2127e889552bd73f3162a023badc2e9f1eb9be34d072",
        voteKey:
          "ae7cdeb2d8e7c92f16f57f307cd6785f5bc87456a6d7166e67ce5d6a4910d5dc2af93a7c156f011df20afbbb4e71f9b90c4efeb704d4d7abc75a21daf8b298bf182a0fca536cf41f0e8a8ce1a0e572d6d130ef413157ebad7b1e3f80e5cbe993",
      },
      // Goat
      {
        address: "0xffe89dfe907a8dfdafdb48dffbae86445b02a93e",
        txKey:
          "028e457f6633f1bedb9f0675a97593a1dec5828e03c27e4c3e9465501fb5a63aa9",
        voteKey:
          "9792038c43e00d6c057c9aa82c0b1942849ea9bb68da2ec30bdb6effcec1c631d530a92dcfc3dcf50c8cd7f9bfb020e80c82bf732ca8d55e739df1337db8b499d3c544630139ad5663f0e55750823eb32288ebc2d32a890b6769f7979d2148c5",
      },
      // Metis
      {
        address: "0xac838ac0bea4f04f208c2f5331c7180be38630bf",
        txKey:
          "029b83b66f6003a704bc745de799640ed36feeae15712a4f6f53c2609694dd7edd",
        voteKey:
          "829630516367486cfb9b97b9614caab53e9e526a549dc5bf079867dffe19883ee610a5012f59bb7306daf37cf094e8360b910d24cbd1347cd7d0d4375a335bdb24b77522102873d51838ff7aaeb0eb19a15d30773c114312c61a40d94e2a4515",
      },
    ],
  },
  Locking: {
    strict: true,
    owner: "0x5E87b3D603818159C71dBB840d68662e9cE19321",
    tokens: [
      {
        address: BitcoinToken,
        weight: 120000,
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
      // Goat
      {
        owner: "0x7d9fb1017422e8a31fe0010c31650c9932fac1a1",
        pubkey:
          "0xa4d546d0c3e4a10e88408de3556f396a866c99cc1ce149156fb4e136fe68ac6eb49aa812818de92aa5c2c8998e6fc1be3ac1786f174813edd0ef01cb53ff3712",
        signature:
          "0xc0486f2f529ada675467eefb9530a61535a6f17d90d59f5c9c53bec704d7ee1c1084514b37fcae613aad8dc6e33fba32290a8435001bc4efbb828b19aacbd90401",
        validator: "0x9104a28cdf6a00a546a1c365007ebf017b0645af",
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
