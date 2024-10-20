import { Param } from "../task/deploy/param";
import { writeFileSync } from "fs";

const param: Param = {
    GoatToken: {
        owner: "0xEFe7594939a64fF3Bd660d97B78186fBeF4450cF",
        transfers: [
            {
                to: "0x6864d13610261fDE9C05d246a6d44A11D973192B",
                value: "750000000ether",
            },
            {
                to: "0xe3FFD1a84511E09979c5eFB8a7EB611c1fa2C7F1",
                value: "50000000ether",
            },
            {
                to: "0xbC10000000000000000000000000000000000004",
                value: "200000000ether",
            },
        ],
    },
    GoatFoundation: {
        owner: "0xEFe7594939a64fF3Bd660d97B78186fBeF4450cF",
    },
    GoatDAO: {},
    Bridge: {
        owner: "0xEFe7594939a64fF3Bd660d97B78186fBeF4450cF",
        withdrawalTaxBP: 2,
        maxWithdrawalTax: "2000000000000000",
        minWithdrawalInWei: "100000000000000",
        deposits: [
            {
                txid: "b380ce2c8da1d8c0d395a7ec26f15b1a893496c61e3a91d04cd0591f407a112e",
                txout: 0,
                address: "0xb0898635d250e1eb51Efa908001bdbA4f62df736",
                satoshi: 1000000000,
            },
            {
                txid: "525b9c691e12166e1782fc0c1168e6062b8502b13f512d297c9368082f9ed63a",
                txout: 0,
                address: "0x4beA43b6C60bB87751333beE6Ce60aF347D461e9",
                satoshi: 1000000000,
            },
            {
                txid: "95f92ae85504c61f453e649a4ddb3dbb658c4940bfca9d1d0e25f0a588d6fa4a",
                txout: 0,
                address: "0xEcB6Be2Ee6C2BAD774dD793f4f97eAbA4BD0168b",
                satoshi: 1000000000,
            },
            {
                txid: "9756f6e763a0eb2527ca24e8e5d8679ce49d290e93b3d590c243ee450352e733",
                txout: 0,
                address: "0xcF0932ea0dd7163083C7B1ac467580a2BE519177",
                satoshi: 1000000000,
            },
        ],
    },
    Bitcoin: {
        height: 3191651,
        network: "testnet3",
        hash: "000000000ebcb157e154584adb14244f4b9d6f7ab6ad6236caa7690b4f485e0a",
    },
    WrappedBitcoin: {},
    Relayer: {
        owner: "0xEFe7594939a64fF3Bd660d97B78186fBeF4450cF",
        voters: [
            {
                txKey:
                    "030a7a9270d0b0b842f6563864b194fd2a23b0fa151e99fc58986b52973bb0f2b9",
                voteKey:
                    "910d87780becce6919df9d6fb0ffb3ac0384e9a3f6f6abd66f68fbee85c06ac759710af5c64bdd442aa0824cca0e373819f1ada5fc42f9559aac771a22d8c0a52a59130c041998840e6ba06421cf4fbd803fec52383e1af85006522809b3c84c",
            },
            {
                txKey:
                    "02251a6367629214b5be558a42e1b210f5a69b011d78345aa82ecbbf464b701bbb",
                voteKey:
                    "96c12bba313c632cc6d06ddedf93ce9e1ce146d9a84261a27cc533e904ffc2a0359754fcb5ba6fe9bdcf96df756db7e21413ecb9139f6acc820cebb70df6b393991d89e6ae322affe387f301b955f4122909c3db03729c65c47d79d9f87b2af1",
            },
            {
                txKey:
                    "025ee5677020f6dca9abc9ab1b69892b94b71864ced4d9799e95aa5223f445d275",
                voteKey:
                    "b9bfbd4314a9cac9be779c587dcf7dd95709fe98452b323af76dd87ca822c0e553255b924bbcc31a81dc962ed79f5f3b12b8c6641d3f22d1b7cf8742db896e49b514c3edd15d9cc77401f9de59c86a41e5222b29da98462600ad106f86610cdf",
            },
        ],
    },
    Locking: {
        strict: true,
        owner: "0xEFe7594939a64fF3Bd660d97B78186fBeF4450cF",
        tokens: [
            {
                address: "0x0000000000000000000000000000000000000000",
                weight: 12000,
                limit: "800000000000000000000",
                threshold: "10000000000000000000",
            },
            {
                address: "0xbC10000000000000000000000000000000000001",
                weight: 1,
                limit: "0",
                threshold: "0",
            },
        ],
        validators: [
            {
                owner: "0xb0898635d250e1eb51Efa908001bdbA4f62df736",
                pubkey:
                    "0x03ae8f902b83846fa5ccbdf8aa3eb18d54fe1b91e07e34ff7937049278df800766",
                signature:
                    "0x2adad5ae0a0fa73f0aa975675afacd2c7f5152ed928138db672d42232a8f606d102f55c9480b67b24a1bb82d4876c2465dba6fdec669b7a539233027ecd611511b",
            },
            {
                owner: "0x4beA43b6C60bB87751333beE6Ce60aF347D461e9",
                pubkey:
                    "0x03ccf6e9a84b2c998b3a3923c0ceb979cf183ccb8339a1c6b4b93abbec2ff0ed6e",
                signature:
                    "0x0e3a33a61cc4b4acfa659682a52710241d464d983131497ffbae3351fd442bad2f72e6027a087c4185ca4630aa597a21664734d068dbccfbbe3efca5a578a4191b",
            },
            {
                owner: "0xEcB6Be2Ee6C2BAD774dD793f4f97eAbA4BD0168b",
                pubkey:
                    "0x03a47434c5f1565c5cd9ee5352d15332b3bccf9bdeb8bdfe15e4f336534a6785f3",
                signature:
                    "0x834c2308adb4350d6df17ff73cb35ae51c37ced5add8a0fb0eedca4ccd8e247e0f165677526e0e75f97106df150bba366673f1a37c917d4c098a7c539227abdc1b",
            },
            {
                owner: "0xcF0932ea0dd7163083C7B1ac467580a2BE519177",
                pubkey:
                    "0x03cc383cfcf8a4aeec851cfe3c6716b5746d336ae0c4cffef22854a185ceecbe57",
                signature:
                    "0xc5706d76c873bff9e64d898023d3e0952644127a736fc76dac742a6299f8aa5a0e2a7d753f165cb61233b398f4767b7c88a12bfcb2dbedf50e60c5bf051d489d1c",
            },
        ],
    },
    Consensus: {
        Relayer: {
            tssPubkey:
                "028cd0837d94143eb194fd625ec0edab6debfca18f7f059f97187d17955fefd1b0",
            acceptProposerTimeout: "1m",
        },
        Bridge: {
            minDepositInSat: 1e4,
        },
        Locking: {
            exitDuration: "3600s",
            unlockDuration: "1800s"
        },
    },
};

writeFileSync("./genesis/testnet-config.json", JSON.stringify(param, null, "  "));
