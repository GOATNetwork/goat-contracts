// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBridgeParam {
    event DepositTaxUpdated(uint16 rate, uint64 max);
    event WithdrawalTaxUpdated(uint16 rate, uint64 max);
    event RateLimitUpdated(uint16);
    event MinWithdrawalUpdated(uint64);

    struct Param {
        uint16 depositTaxBP;
        uint64 maxDepositTax;
        uint16 withdrawalTaxBP;
        uint64 maxWithdrawalTax;
        uint64 minWithdrawal;
    }

    error TaxTooHigh();

    error MalformedTax();

    function setDepositTax(uint16 bp, uint64 max) external;

    function setWithdrawalTax(uint16 bp, uint64 max) external;

    function setMinWithdrawal(uint64 amount) external;
}
