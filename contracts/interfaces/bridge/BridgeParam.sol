// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

interface IBridgeParam {
    event DepositTaxUpdated(uint16 rate, uint64 max);
    event WithdrawalTaxUpdated(uint16 rate, uint64 max);
    event RateLimitUpdated(uint16);

    struct Param {
        uint16 rateLimit;
        uint16 depositTaxBP;
        uint64 maxDepositTax;
        uint16 withdrawalTaxBP;
        uint64 maxWithdrawalTax;
        uint16 _res1;
        uint64 _res2;
    }

    error TaxTooHigh();

    error MalformedTax();

    function setDepositTax(uint16 bp, uint64 max) external;

    function setWithdrawalTax(uint16 bp, uint64 max) external;

    function setRateLimit(uint16 sec) external;
}
