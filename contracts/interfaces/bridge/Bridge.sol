// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

interface IBridge {
    event Deposit(
        address indexed target,
        bytes32 txHash,
        uint32 txout,
        uint256 amount,
        uint256 tax
    );

    event Withdraw(
        uint256 indexed id,
        address indexed from,
        uint256 amount,
        uint256 tax,
        uint16 maxTxPrice,
        string receiver
    );

    event Canceling(uint256 indexed id);

    event Canceled(uint256 indexed id);

    event Refund(uint256 indexed id);

    event RBF(uint256 indexed id, uint16 maxTxPrice);

    event Paid(uint256 indexed id, bytes32 txHash, uint32 txout, uint256 value);

    enum WithdrawalStatus {
        Invalid,
        Pending,
        Canceling,
        Canceled,
        Refunded,
        Paid
    }

    error InvalidAddress();

    struct Withdrawal {
        address sender;
        uint16 maxTxPrice;
        WithdrawalStatus status;
        uint256 amount; // msg.value - tax
        uint256 tax; // tax for goat foundation
        uint256 updatedAt;
    }

    function isDeposited(
        bytes32 txHash,
        uint32 txout
    ) external view returns (bool);

    function deposit(
        bytes32 txHash,
        uint32 txout,
        address target,
        uint256 amount,
        uint256 tax
    ) external;

    function withdraw(
        string calldata receiver,
        uint16 maxTxPrice
    ) external payable;

    function replaceByFee(uint256 id, uint16 maxTxPrice) external;

    function cancel1(uint256 id) external;

    function refund(uint256 id) external;

    function cancel2(uint256 id) external;

    function paid(
        uint256 id,
        bytes32 txHash,
        uint32 txout,
        uint256 received
    ) external;
}
