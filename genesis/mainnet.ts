import { writeFileSync } from "fs";
import { PredployedAddress } from "../common/constants";
import { Param } from "../task/deploy/param";
import { BitcoinToken, dayToHours, toSatoshi, toWei } from "./utils";

// anvil --auto-impersonate --chain-id=2345
// npx hardhat create:genesis --force true --network genesis --name mainnet

const param: Param = {
  GoatToken: {
    owner: "0x0d3483F7dE0C401b930A046BA69F6ed75fACaAFc",
    transfers: [
      {
        to: PredployedAddress.locking,
        value: toWei(200_000_000),
      },
    ],
  },
  GoatFoundation: {
    owner: "0x1a3E8c63e9490271a9e97d48239FE0A3b68BbDF6",
  },
  GoatDAO: {},
  Bridge: {
    owner: "0x853F96ed28E776AFD7c56Fbe19B04E94febFDbE1",
    depositPrefixMagic: "GOAT",
    withdrawalTaxBP: 10,
    maxWithdrawalTaxInSat: 0,
    minWithdrawalInSat: toSatoshi(0.0005),
    confirmationNumber: 6,
    depositTaxBP: 0,
    maxDepositTaxInSat: 0,
    minDepositInSat: toSatoshi(0.0005),
    deposits: [
      // MetisDAO
      {
        txid: "4f2c354ae68ba630336a4c348c76a9651fc0c58290d15242f685505d3c4a9eae",
        txout: 0,
        address: "0x09ccd1cb6be49c131c0dd636c95b4e4f5bc549ad",
        satoshi: toSatoshi(0.5),
      },
      // ZKM
      {
        txid: "7cc3becd4495a672721799f1faa5077b5086be9ff94c26083fd14aedf6282edd",
        txout: 0,
        address: "0xa3ae64125631f56b1b96b113a79545f4684e67bb",
        satoshi: toSatoshi(0.5),
      },
      // GOAT Network
      {
        txid: "a757cebb2164a91ebea573240ff687def2345e80219b2c84e3929e829735ebfa",
        txout: 0,
        address: "0x32444c83c841146a92ad936cdd93b93b9898f6b9",
        satoshi: toSatoshi(0.5),
      },
    ],
  },
  Bitcoin: {
    height: 875430,
    network: "mainnet",
    hash: "0000000000000000000152889d426c654c617e5dc40f0951aa8fcd9e2d68364b",
  },
  WrappedBitcoin: {},
  Relayer: {
    owner: "0xe37325B734bD2b6fb5C6B52A7f4e64924cE5eE59",
    voters: [
      // ZKM
      {
        address: "0xbcf4be45dfcfb1c6736657e1536f7e20c152291d",
        txKey:
          "029c129bb14bd56fbed3a3c9d9420c90c7adc9dd5dd80b6ff806c1559a3b3ce3ff",
        voteKey:
          "a4ef5650f9a629fcbd9934d1a97a80581d4ca1f7a5c2a5837fa8f4443b1b01e2831ba6412afe9140cdfa841d8b1a11cc0f856cd5572c5bb85a9e8cd992f71b5d0756c5daf95a539aab74890a73ad9f85872c4d8f51e91a624e86a89c885850f5",
      },
      // Goat Network
      {
        address: "0xef63e79998b5b5141d002221e1fece5f4fe739e0",
        txKey:
          "03d311170f921377587f2363c48765c98a3d59c893a1113c244b237521a747b64c",
        voteKey:
          "938bb6567ce67fede6d5534dd5338d30144a5d39cbf2576fc088ff70314d382afc793d92f53b63503c19928d9e7f2325019ed1dfbd2a93173fbf3cb49160e5751d7b5109ac61913ec8c01c9612669500b7d9dbcfaa1a1b03eecaeea43dc07740",
      },
      // Metis
      {
        address: "0xab0c6ea5b5afa1da8bfa890a891a95bc62d9b3db",
        txKey:
          "0238fb83fe05fab241c0babb3384909544165946d39c5affc7bb69988d1e71295f",
        voteKey:
          "8b8f23759c360874de718f32f09bba6a2885229e9742ee6e89581376c27b86d17750e5ea34613903be1ead4d90682381010c69bd0f024e17e3a7a7e7c60a688f26b7dccde25052109a2105dd952d540f0431690064c1b9bb43cfdbde05a47801",
      },
    ],
  },
  Locking: {
    strict: true,
    owner: "0xf1B4ea97BEbB568A945345fed882f3D3219B3E44",
    tokens: [
      {
        address: BitcoinToken,
        weight: 500_000,
        limit: toWei(300),
        threshold: toWei(0.5),
      },
    ],
    validators: [
      // Metis Foundation
      {
        owner: "0x09ccd1cb6be49c131c0dd636c95b4e4f5bc549ad",
        pubkey:
          "0x9030dc50e99989026ac762131fc9efb03c4ac3ab65cd8201ab025a4f3b6c82b02cb8001723228cf944a7416553b710c9748f48650a717603758799de8dac3a88",
        signature:
          "0xe1404f0612e7ef13e27ff9161648137333e72e7088ab5015383dd2b9a8dcfc281ad5bf7fc2c17a94ed4b03f3e09c66598f30dd41597e0bc2c3dcb262c1291e6a00",
        validator: "0x762e41e7dd3e0708b6a39f1dec870cd89932ecdc",
      },
      // ZKM
      {
        owner: "0xa3ae64125631f56b1b96b113a79545f4684e67bb",
        pubkey:
          "0x7884e3b1702ab2c6eaa014d19df08a0fa290d6eefa14534c3c52a17a5f04040e5ac72a39fdc932f284aab0a21677df3820d9af904e608f191d6fd745994c27d1",
        signature:
          "0x8926a8980165f476df319c0495edeae7e5a425e6b9d21a10245f5e68a588abe8673e8fdf0282612c2c0b204ca84710076ac37616e4e01875e821639cb4d4be7000",
        validator: "0x57e4aa9111e3899547d51d8f1510878f4a1fe2d6",
      },
      // GOAT Network
      {
        owner: "0x32444c83c841146a92ad936cdd93b93b9898f6b9",
        pubkey:
          "0xd8ef2fcd6eb3c9c1afdbaadd387417f945047139410b5ebef2c69d2f9acfddbb4215e9f5323e221c4cb45728ae3623c0d8ca51af33c1550d4511ca5dfba0d8e9",
        signature:
          "0x6c03b38137361f09e3cecc3981ef47eafd8e63d83159924a989a9c3087fb05d144b5179a56897d1dd6a23ea5b06b9a6664212befc3639ab4f392106d8027f81b01",
        validator: "0xa075e25ad183e70abd35639d8a9df57889a9d733",
      },
    ],
    allowList: [],
  },
  Consensus: {
    Relayer: {
      tssPubkey:
        "03ce99e6a250a720251c05a021019f894cf639f653d51e9b05e3cfc04c88ee9b5d",
      acceptProposerTimeout: "1m",
    },
    Locking: {
      exitDuration: dayToHours(21),
      unlockDuration: dayToHours(3),
      downtimeJailDuration: "10800s",
      maxValidators: 20,
      signedBlocksWindow: 1200,
      maxMissedPerWindow: 200,
      slashFractionDoubleSign: 0.05,
      slashFractionDowntime: 0.01,
      halvingInterval: 42048000,
      initialBlockReward: "2378234400000000000",
    },
  },
  // re-genesis (deposit - withdrawal)
  Balances: {
    "0x738fe7d89c172239bf456d387ad2c60a79087917": {
      balance: "2000000000000000",
    },
    "0x71a376962aa4a1245325857499324da8ede63c2d": {
      balance: "46828780000000000",
      nonce: 2,
    },
    "0x2a1087740badcff415faa0b6379f12fa7628d397": {
      balance: "6000000000000000",
    },
    "0x5bb093d8870727b51e1746af83984291f41e8a4b": {
      balance: "42000000000000000",
    },
    "0xbb3da31029cd22bcec9615322c43663741b510fd": {
      balance: "5000000000000000",
    },
  },
};

writeFileSync(
  `./genesis/${param.Bitcoin.network}-config.json`,
  JSON.stringify(param, null, 2),
);
