// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

interface IBridge {
    event NewBitcoinBlock(uint128 indexed height);

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

    event DepositTaxUpdated(uint16 rate, uint64 max);
    event WithdrawalTaxUpdated(uint16 rate, uint64 max);
    event RateLimitUpdated(uint16);

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

    error TaxTooHigh();

    error MalformedTax();

    struct BlockHeader {
        bytes32 prevBlock;
        bytes32 merkleRoot;
        uint32 version;
        uint32 bits;
        uint32 nonce;
        uint32 timestmap;
    }

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

    struct Param {
        uint16 rateLimit;
        uint16 depositTaxBP;
        uint64 maxDepositTax;
        uint16 withdrawalTaxBP;
        uint64 maxWithdrawalTax;
        uint16 _res1;
        uint64 _res2;
    }

    struct HeaderRange {
        uint128 start;
        uint128 latest;
    }

    function bech32HRP() external view returns (string memory);

    function networkName() external view returns (string memory);

    function isAddrValid(string calldata addr) external view returns (bool);

    function isDeposited(
        bytes32 txid,
        uint32 txout
    ) external view returns (bool);

    function newBitcoinBlock(BlockHeader calldata header) external;

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

    function setDepositTax(uint16 bp, uint64 max) external;

    function setWithdrawalTax(uint16 bp, uint64 max) external;

    // function setTaxPayee(address) external;

    function setRateLimit(uint16 sec) external;

    function takeTax() external returns (uint256);
}
