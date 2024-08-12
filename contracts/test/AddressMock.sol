// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AddressMock {
    string internal constant mock =
        "bc1qmvs208we3jg7hgczhlh7e9ufw034kfm2vwsvge";

    fallback() external {
        require(msg.data.length > 5);
        require(bytes5(msg.data[:5]) == bytes5(0x0005026263));

        // mock base fee
        _gas(30_000);

        // mock base58check
        if (sha256(msg.data[5:]) == sha256(abi.encodePacked(mock))) {
            _yes();
        } else {
            _no();
        }
    }

    function _yes() internal pure {
        assembly {
            mstore(0, 0x01)
            return(31, 1)
        }
    }

    function _no() internal pure {
        assembly {
            mstore(0, 0x00)
            return(31, 1)
        }
    }

    function _gas(uint256 _amount) internal view {
        uint256 i = 0;
        uint256 initialGas = gasleft();
        while (initialGas - gasleft() < _amount) {
            ++i;
        }
    }
}
