import { writeFileSync } from "fs";
import { PredployedAddress } from "../common/constants";
import { Param } from "../task/deploy/param";
import { BitcoinToken, dayToHours, toSatoshi, toWei } from "./utils";

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
    height: 872861,
    network: "mainnet",
    hash: "00000000000000000000c1958e360f2338fe9ab1fc4a4a25f1cb08e132b9c92e",
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
          "0xeb0881378a4a61f4d27c99460fe4fdf57f9f12423913f037b97f154f481079ada6edaba9d9f219969f5eefdf7af598322f841ad6bb4a1fd85924f32701facb45",
        signature:
          "0x350d5782a5df5af8371b5157c4230fcb16afe2edbf775f2634700216eaa72f0e51d458706feb0639519d6556a9ba2e741bc6a03dbb1a50aa71f024ebcff3ea5201",
        validator: "0x3686e1f6afde4a50eecccc05668d5e413eafa7c8",
      },
      // ZKM
      {
        owner: "0xa3ae64125631f56b1b96b113a79545f4684e67bb",
        pubkey:
          "0x4c68f191b6b377c3bf55c41e4360a553fae4d74c29bf06a09a130f6db9b2b11dc7084d223289e1653e72170b3f1852bfccff26644576f09b36cb9f2309afcf3b",
        signature:
          "0x51b6961fde45241b2eb3cab442d1fe6cd42abbe41304ddad4260a1c60d1ab3530b35c64489bd0059ea6cb5b13062c13bfe26b261c54dc1894683ace6fcd313cb00",
        validator: "0xceec55cccc965b96fba30d7d30efd358956fdaa5",
      },
      // GOAT Network
      {
        owner: "0x32444c83c841146a92ad936cdd93b93b9898f6b9",
        pubkey:
          "0x2ecca59df3cb9762d5536809371c2ab3f0ad33242596daf372b6435dd3bc86eb47d2045c6283328f91d282d9d6e8ea78b01032b8aa7651808157164041fa3c31",
        signature:
          "0x956208d7cb07231596e1b27e83e5f945ce1fae11ea200189dd9835478de4d23c5365529a27eb955a79bd21dc3cea0b8e650efd2ded179aa7503a09e2869f703c00",
        validator: "0x9f0a148b157accfe2b2093aa4a71ee44970b6df7",
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
};

writeFileSync(
  `./genesis/${param.Bitcoin.network}-config.json`,
  JSON.stringify(param, null, "  "),
);
