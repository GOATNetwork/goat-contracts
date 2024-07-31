// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBridge {
    event NewBitcoinBlock(uint128 indexed height);

    event Deposit(
        address indexed target,
        uint256 indexed amount,
        bytes32 txid,
        uint32 txout
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
        uint256 received
    );

    enum WithdrawalStatus {
        Invalid,
        Pending,
        Canceling,
        Canceled,
        Refunded,
        Paid
    }

    struct BlockHeader {
        bytes32 blockHash;
        bytes32 prevBlockHash;
        bytes32 merkleRoot;
        uint32 version;
        uint32 bits;
        uint32 nonce;
        uint32 timestmap;
    }

    struct Withdrawal {
        address sender;
        uint256 amount; // msg.value - daoFee
        uint256 maxTxPrice;
        uint256 updatedAt;
        string reciever;
        WithdrawalStatus status;
    }

    // the paid receipt
    struct Receipt {
        bytes32 txid;
        uint32 txout;
        uint256 paid;
    }

    // todo: use uint64/uint32 instead
    struct Param {
        uint256 minTxPrice;
        uint256 minWithdrawal;
        uint256 theDAOFeeRate;
        uint256 throttleInSecond;
    }

    struct HeaderRange {
        uint128 start;
        uint128 latest;
    }

    error AccessDenied();
    error Forbidden();
    error Throttled();
}
