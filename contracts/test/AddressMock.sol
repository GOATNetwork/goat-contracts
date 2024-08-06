// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

contract ValidAddrMock {
    fallback() external {
        require(bytes5(msg.data[:5]) == bytes5(0x0005026263));
        assembly {
            mstore(0, 0x01)
            return(31, 1)
        }
    }
}

contract InvalidAddrMock {
    fallback() external {
        require(bytes5(msg.data[:5]) == bytes5(0x0005026263));
        assembly {
            mstore(0, 0x00)
            return(31, 1)
        }
    }
}
