// SPDX-License-Identifier: Apache 2.0
pragma solidity =0.8.28;

library PreDeployedAddresses {
    address internal constant WrappedGoatBitcoin =
        0xbC10000000000000000000000000000000000000;

    address internal constant GoatDAO =
        0xBC10000000000000000000000000000000000Da0;

    address internal constant GoatToken =
        0xbC10000000000000000000000000000000000001;

    address payable internal constant GoatFoundation =
        payable(0xBc10000000000000000000000000000000000002);

    address internal constant Bridge =
        0xBC10000000000000000000000000000000000003;

    address internal constant Locking =
        0xbC10000000000000000000000000000000000004;

    address internal constant BitcoinBlocks =
        0xbc10000000000000000000000000000000000005;

    address internal constant Relayer =
        0xBC10000000000000000000000000000000000006;

    address internal constant LockingTokenFactory =
        0xBc10000000000000000000000000000000000007;
}
