// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

interface IBridgeParam {
    event DepositTaxUpdated(uint16 rate, uint64 max);
    event WithdrawalTaxUpdated(uint16 rate, uint64 max);
    event MinWithdrawalUpdated(uint64);
    event MinDepositUpdated(uint64);
    event ConfirmationNumberUpdated(uint16);

    struct DepositParam {
        bytes4 prefix; // the OP_RETURN prefix
        uint64 min; // NB: unit is WEI
        uint16 taxRate;
        uint64 maxTax; // NB: unit is WEI
        uint16 confirmations;
    }

    struct WithdrawParam {
        uint64 min; // NB: unit is WEI
        uint16 taxRate;
        uint64 maxTax; // NB: unit is WEI
    }

    error InvalidThreshold();
    error InvalidTax();

    function setWithdrawalTax(uint16 bp, uint64 max) external;
    function setMinWithdrawal(uint64 amount) external;

    function setDepositTax(uint16 bp, uint64 max) external;
    function setMinDeposit(uint64 amount) external;
    function setConfirmationNumber(uint16 number) external;
}
