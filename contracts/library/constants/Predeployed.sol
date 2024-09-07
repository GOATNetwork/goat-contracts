// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PreDeployedAddresses {
    address internal constant WrappedBitcoin =
        0xbC10000000000000000000000000000000000000;

    address internal constant GoatDAO =
        0xBC10000000000000000000000000000000000Da0;

    address internal constant GoatToken =
        0xbC10000000000000000000000000000000000001;

    address payable internal constant GoatFoundation =
        payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);

    address internal constant Bridge =
        0xBC10000000000000000000000000000000000003;

    address internal constant Locking =
        0xbC10000000000000000000000000000000000004;

    address internal constant BitcoinBlocks =
        0xbc10000000000000000000000000000000000005;
}
