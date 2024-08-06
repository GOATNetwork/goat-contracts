// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

interface IBridge {
    event Deposit(
        address indexed target,
        uint256 indexed amount,
        bytes32 txid,
        uint32 txout,
        uint256 tax
    );

    event Withdraw(
        uint256 indexed id,
        address indexed from,
        uint256 amount,
        uint256 maxTxPrice,
        string reciever
    );

    event Canceling(uint256 indexed id);

    event Canceled(uint256 indexed id);

    event Refund(uint256 indexed id);

    event RBF(uint256 indexed id, uint256 maxTxPrice);

    event Paid(
        uint256 indexed id,
        bytes32 txid,
        uint32 txout,
        uint256 received,
        uint256 tax
    );

    enum WithdrawalStatus {
        Invalid,
        Pending,
        Canceling,
        Canceled,
        Refunded,
        Paid
    }

    error AccessDenied();
    error Forbidden();
    error RateLimitExceeded();

    struct Withdrawal {
        address sender;
        uint256 amount; // msg.value - tax
        uint256 tax; // tax for goat foundation
        uint256 maxTxPrice;
        uint256 updatedAt;
        string reciever;
        WithdrawalStatus status;
    }

    // the payment receipt
    struct Receipt {
        bytes32 txid;
        uint32 txout;
        uint256 paid;
    }

    function isDeposited(
        bytes32 txid,
        uint32 txout
    ) external view returns (bool);

    function deposit(
        bytes32 txid,
        uint32 txout,
        address target,
        uint256 amount
    ) external;

    function withdraw(
        string calldata reciever,
        uint16 maxTxPrice
    ) external payable;

    function replaceByFee(uint256 id, uint16 maxTxPrice) external payable;

    function cancel1(uint256 id) external;

    function refund(uint256 id) external;

    function cancel2(uint256 id) external;

    function paid(
        uint256 id,
        bytes32 txid,
        uint32 txout,
        uint256 paid
    ) external;
}
