// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

library PreDeployedAddresses {
    address internal constant WrappedBitcoin =
        0xbC10000000000000000000000000000000000000;

    address internal constant GoatDAO =
        0xBC10000000000000000000000000000000000Da0;

    address internal constant GoatToken =
        0xbC10000000000000000000000000000000000001;

    address payable internal constant GoatFoundation =
        payable(0xBc10000000000000000000000000000000000002);

    address internal constant Bridge =
        0xBC10000000000000000000000000000000000003;

    address internal constant Staking =
        0xbC10000000000000000000000000000000000004;
}
