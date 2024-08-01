// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ValidAddrMock {
    fallback() external {
        assembly {
            mstore(0, 0x01)
            return(31, 1)
        }
    }
}

contract InvalidAddrMock {
    fallback() external {
        assembly {
            mstore(0, 0x00)
            return(31, 1)
        }
    }
}
