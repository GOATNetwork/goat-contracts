// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {Burner} from "../library/utils/Burner.sol";
import {RelayerGuard} from "../relayer/RelayerGuard.sol";
import {RateLimiter} from "../library/utils/RateLimiter.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";

import {IBridge} from "../interfaces/bridge/Bridge.sol";
import {IBridgeParam} from "../interfaces/bridge/BridgeParam.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Bridge is
    Ownable,
    RelayerGuard,
    RateLimiter,
    IBridge,
    IBridgeParam,
    IERC165
{
    using Address for address payable;

    DepositParam public depositParam;
    WithdrawParam public withdrawParam;

    mapping(bytes32 txh => bool yes) internal deposits;

    Withdrawal[] public withdrawals;

    // 1 satoshi = 10 gwei
    uint256 public constant SATOSHI = 10 gwei;

    // the current dust value is 546, we use a slightly larger value here
    uint256 public constant DUST = 1e3 * SATOSHI;

    // 4 p2wsh/p2pkh input + 1 p2tr/p2wsh output + 1 change output
    uint256 public constant BASE_TX_SIZE = 300 * SATOSHI;

    uint256 public constant WITHDRAWAL_UPDATED_DURATION = 5 minutes;

    // the max tax base points
    uint256 internal constant MAX_BASE_POINT = 1e4;

    // It is only for testing
    constructor(
        address owner,
        bytes4 prefix
    ) Ownable(owner) RateLimiter(32, false) {
        depositParam = DepositParam({
            prefix: prefix,
            min: 100_000 gwei, // 0.0001 btc
            taxRate: 0,
            maxTax: 0,
            confirmations: 6
        });

        withdrawParam = WithdrawParam({
            maxTax: 2_000_000 gwei, // 0.002 btc
            taxRate: 20,
            min: 1_000_000 gwei // 0.001 btc
        });
    }

    /**
     * deposit adds balance to the target address
     * goat performs the adding outside EVM to prevent any errors
     * @param txHash the txHash(LE)
     * @param txout the txout
     * @param target the depoist address
     * @param amount the deposit amount without the tax
     * @param tax the deposit tax
     */
    function deposit(
        bytes32 txHash,
        uint32 txout,
        address target,
        uint256 amount,
        uint256 tax
    ) external override OnlyRelayer {
        bytes32 depositHash = keccak256(abi.encodePacked(txHash, txout));
        require(!deposits[depositHash], "duplicated");
        deposits[depositHash] = true;

        emit Deposit(target, txHash, txout, amount, tax);
        // Add balance to the target and pay the tax to GF in the runtime
    }

    /**
     * isDeposited checks if the deposit is succeed
     * @param txHash the txHash(LE)
     * @param txout the txout index
     */
    function isDeposited(
        bytes32 txHash,
        uint32 txout
    ) external view override returns (bool) {
        bytes32 depositHash = keccak256(abi.encodePacked(txHash, txout));
        return deposits[depositHash];
    }

    /**
     * withdraw initializes a new withdrawal request by a user
     * @param receiver the address to withdraw
     * @param maxTxPrice the max allowed tx price in sat/vbyte
     *
     * consensus layer has a complete validation for the receiver address
     * if it's invalid, the consensus layer will send back `cancel2` tx to reject it
     */
    function withdraw(
        string calldata receiver,
        uint16 maxTxPrice
    ) external payable override RateLimiting {
        uint256 addrLength = bytes(receiver).length;
        require(addrLength > 33 && addrLength < 91, "invalid address");

        uint256 amount = msg.value;
        uint256 tax = 0;

        WithdrawParam memory p = withdrawParam;
        require(amount >= p.min, "amount too low");

        if (p.taxRate > 0) {
            tax = (amount * p.taxRate) / MAX_BASE_POINT;
            if (tax > p.maxTax) {
                tax = p.maxTax;
            }
            amount -= tax;
        }

        // dust as tax
        uint256 dust = amount % SATOSHI;
        if (dust > 0) {
            tax += dust;
            amount -= dust;
        }

        require(maxTxPrice > 0, "invalid tx price");
        require(amount > DUST + maxTxPrice * BASE_TX_SIZE, "unaffordable");

        uint256 id = withdrawals.length;
        withdrawals.push(
            Withdrawal({
                sender: msg.sender,
                amount: amount,
                tax: tax,
                maxTxPrice: maxTxPrice,
                updatedAt: block.timestamp,
                status: WithdrawalStatus.Pending
            })
        );

        emit Withdraw(id, msg.sender, amount, tax, maxTxPrice, receiver);
    }

    /**
     * replaceByFee updates the withdrawal tx price
     * @param wid the withdrawal id
     * @param maxTxPrice the new max tx price
     */
    function replaceByFee(
        uint256 wid,
        uint16 maxTxPrice
    ) external override RateLimiting {
        Withdrawal storage withdrawal = withdrawals[wid];

        if (withdrawal.status != WithdrawalStatus.Pending) {
            revert Forbidden();
        }

        if (withdrawal.sender != msg.sender) {
            revert AccessDenied();
        }

        if (
            block.timestamp - withdrawal.updatedAt < WITHDRAWAL_UPDATED_DURATION
        ) {
            revert RequestTooFrequent();
        }

        require(maxTxPrice > withdrawal.maxTxPrice, "invalid tx price");
        require(
            withdrawal.amount > DUST + maxTxPrice * BASE_TX_SIZE,
            "unaffordable"
        );

        withdrawal.maxTxPrice = maxTxPrice;
        withdrawal.updatedAt = block.timestamp;

        emit RBF(wid, maxTxPrice);
    }

    /**
     * cancel1 cancels the withdrawal by origin user
     * @param wid the withdrawal id
     */
    function cancel1(uint256 wid) external RateLimiting {
        Withdrawal storage withdrawal = withdrawals[wid];

        if (withdrawal.status != WithdrawalStatus.Pending) {
            revert Forbidden();
        }

        if (withdrawal.sender != msg.sender) {
            revert AccessDenied();
        }

        if (
            block.timestamp - withdrawal.updatedAt < WITHDRAWAL_UPDATED_DURATION
        ) {
            revert RequestTooFrequent();
        }

        withdrawal.updatedAt = block.timestamp;
        withdrawal.status = WithdrawalStatus.Canceling;
        emit Canceling(wid);
    }

    /**
     * cancel2 apporves the cancellation request by relayer
     * relayer can pay the withdrawal to disregard the cancellation request
     * relayer can reject a pending withdrawal as well
     * @param wid the withdrwal id
     */
    function cancel2(uint256 wid) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[wid];
        WithdrawalStatus status = withdrawal.status;
        require(
            status == WithdrawalStatus.Pending ||
                status == WithdrawalStatus.Canceling
        );
        withdrawal.status = WithdrawalStatus.Canceled;
        withdrawal.updatedAt = block.timestamp;
        emit Canceled(wid);
    }

    /**
     * refund refunds the amount of the canceled withdrawal to the origin user
     * @param wid the withdrwal id
     */
    function refund(uint256 wid) external {
        Withdrawal storage withdrawal = withdrawals[wid];

        if (withdrawal.status != WithdrawalStatus.Canceled) {
            revert Forbidden();
        }
        withdrawal.status = WithdrawalStatus.Refunded;

        address payable owner = payable(withdrawal.sender);
        if (owner != msg.sender) {
            revert AccessDenied();
        }
        withdrawal.updatedAt = block.timestamp;

        // refund to the owner
        owner.sendValue(withdrawal.amount + withdrawal.tax);
        emit Refund(wid);
    }

    /**
     * paid finalizes the withdrawal request and burns the withdrawal amount from network
     * It aslo transfers the tax to GF address if the tax is enabled
     * @param wid withdrawal id
     * @param txHash the withdrawal txHash(LE)
     * @param txout the tx output index
     * @param received the actual paid amount
     */
    function paid(
        uint256 wid,
        bytes32 txHash,
        uint32 txout,
        uint256 received
    ) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[wid];

        WithdrawalStatus status = withdrawal.status;
        require(
            status == WithdrawalStatus.Pending ||
                status == WithdrawalStatus.Canceling
        );

        withdrawal.status = WithdrawalStatus.Paid;
        withdrawal.updatedAt = block.timestamp;

        // send the tax to GF
        uint256 tax = withdrawal.tax;
        if (tax > 0) {
            PreDeployedAddresses.GoatFoundation.sendValue(tax);
        }

        // Burn the withdrawal amount from network
        new Burner{value: withdrawal.amount, salt: bytes32(0x0)}();

        emit Paid(wid, txHash, txout, received);
    }

    modifier checkTax(uint16 bp, uint64 max) {
        if (bp > 0) {
            require(max < 1e18 && max > 0 && max % SATOSHI == 0, InvalidTax());
            require(bp < MAX_BASE_POINT, InvalidTax());
        } else {
            require(max == 0, InvalidTax());
        }
        _;
    }

    /**
     * setWithdrawalTax updates current withdrawal tax config
     * @param bp the basic point for the withdrawal tax rate
     * @param max the max tax in wei
     */
    function setWithdrawalTax(
        uint16 bp,
        uint64 max
    ) external override onlyOwner checkTax(bp, max) {
        withdrawParam.taxRate = bp;
        withdrawParam.maxTax = max;
        emit WithdrawalTaxUpdated(bp, max);
    }

    /**
     * setDepositTax updates current deposit tax config
     * @param bp the basic point for the deposit tax rate
     * @param max the max tax in wei
     */
    function setDepositTax(
        uint16 bp,
        uint64 max
    ) external override onlyOwner checkTax(bp, max) {
        depositParam.taxRate = bp;
        depositParam.maxTax = max;
        emit DepositTaxUpdated(bp, max);
    }

    modifier checkThreshold(uint64 amount) {
        require(
            amount < 1e18 && amount >= 1e14 && amount % SATOSHI == 0,
            InvalidThreshold()
        );
        _;
    }

    /**
     * setMinWithdrawal updates current min withdrawal amount
     * @param amount the amount in wei, the amount should be in range [0.0001 btc, 1btc)
     */
    function setMinWithdrawal(
        uint64 amount
    ) external override onlyOwner checkThreshold(amount) {
        withdrawParam.min = amount;
        emit MinWithdrawalUpdated(amount);
    }

    /**
     * setMinDeposit updates the min deposit
     * @param amount the amount in wei, the amount should be in range [0.0001 btc, 1btc)
     */
    function setMinDeposit(
        uint64 amount
    ) external override onlyOwner checkThreshold(amount) {
        depositParam.min = amount;
        emit MinDepositUpdated(amount);
    }

    /**
     * setConfirmationNumber updates current confirmation number
     * @param number the confirmation number, using 6 for mainnet and 20 for testnet
     */
    function setConfirmationNumber(uint16 number) external override onlyOwner {
        require(number > 0, "number too low");
        depositParam.confirmations = number;
        emit ConfirmationNumberUpdated(number);
    }

    function supportsInterface(
        bytes4 id
    ) external view virtual override returns (bool) {
        return
            id == type(IERC165).interfaceId ||
            id == type(IBridge).interfaceId ||
            id == type(IBridgeParam).interfaceId;
    }
}
