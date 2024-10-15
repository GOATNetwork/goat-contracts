// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Burner} from "../library/utils/Burner.sol";
import {BaseAccess} from "../library/utils/BaseAccess.sol";
import {RateLimiter} from "../library/utils/RateLimiter.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IBridge} from "../interfaces/bridge/Bridge.sol";
import {IBridgeParam} from "../interfaces/bridge/BridgeParam.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Bridge is
    Ownable,
    BaseAccess,
    RateLimiter,
    IBridge,
    IBridgeParam,
    IERC165
{
    using Address for address payable;

    Param public param;

    mapping(bytes32 txh => bool yes) internal deposits;

    Withdrawal[] public withdrawals;

    // 1 satoshi = 10 gwei
    uint256 internal constant SATOSHI = 10 gwei;

    // 2 p2wsh input + 1 p2tr/p2wsh output + 1 change output
    uint256 internal constant BASE_TX_SIZE = 300;

    // the max tax base points
    uint256 internal constant MAX_BASE_POINT = 1e4;

    uint256 internal constant WITHDRAWAL_UPDATED_DURATION = 5 minutes;

    // It is only for testing
    constructor(address owner) Ownable(owner) RateLimiter(32, false) {
        param = Param({
            depositTaxBP: 0,
            maxDepositTax: 0,
            withdrawalTaxBP: 20,
            maxWithdrawalTax: 2_000_000 gwei, // 0.002 btc
            minWithdrawal: 1_000_000 gwei // 0.001 btc
        });
    }

    /**
     * deposit adds balance to the target address
     * goat performs the adding outside EVM to prevent any errors
     * @param txid the txid(LE)
     * @param txout the txout
     * @param target the depoist address
     * @param amount the deposit amount
     */
    function deposit(
        bytes32 txid,
        uint32 txout,
        address target,
        uint256 amount
    ) external override OnlyRelayer returns (uint256 tax) {
        bytes32 depositHash = keccak256(abi.encodePacked(txid, txout));
        require(!deposits[depositHash], "duplicated");

        require(amount > 0 && amount % SATOSHI == 0, "invalid amount");

        Param memory p = param;
        if (p.depositTaxBP > 0) {
            tax = (amount * p.depositTaxBP) / MAX_BASE_POINT;
            if (tax > p.maxDepositTax) {
                tax = p.maxDepositTax;
            }
            amount -= tax;
        }

        deposits[depositHash] = true;
        emit Deposit(target, amount, txid, txout, tax);

        // Add balance to the target and pay the tax to GF in the runtime
        return tax;
    }

    /**
     * isDeposited checks if the deposit is succeed
     * @param txid the txid(LE)
     * @param txout the txout index
     */
    function isDeposited(
        bytes32 txid,
        uint32 txout
    ) external view override returns (bool) {
        bytes32 depositHash = keccak256(abi.encodePacked(txid, txout));
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
        bytes memory addrBytes = bytes(receiver);
        if (addrBytes.length < 34 || addrBytes.length > 90) {
            revert InvalidAddress();
        }

        uint256 amount = msg.value;
        uint256 tax = 0;

        Param memory p = param;
        require(amount >= p.minWithdrawal, "amount too low");

        if (p.withdrawalTaxBP > 0) {
            tax = (amount * p.withdrawalTaxBP) / MAX_BASE_POINT;
            if (tax > p.maxWithdrawalTax) {
                tax = p.maxWithdrawalTax;
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
        require(amount > maxTxPrice * BASE_TX_SIZE * SATOSHI, "unaffordable");

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

        require(
            maxTxPrice > withdrawal.maxTxPrice,
            "the new tx price should be larger than before"
        );

        require(
            withdrawal.amount > maxTxPrice * BASE_TX_SIZE * SATOSHI,
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
     * @param txid the withdrawal txid(little endian)
     * @param txout the tx output index
     * @param received the actual paid amount
     */
    function paid(
        uint256 wid,
        bytes32 txid,
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

        emit Paid(wid, txid, txout, received);
    }

    /**
     * setDepositTax updates current deposit tax config
     * @param bp the basic point for the deposit tax rate
     * @param max the max tax in wei
     */
    function setDepositTax(uint16 bp, uint64 max) external override onlyOwner {
        if (bp > MAX_BASE_POINT) {
            revert TaxTooHigh();
        }

        if (max > 1 ether) {
            revert TaxTooHigh();
        }

        if (bp > 0 && max == 0) {
            revert MalformedTax();
        }

        param.depositTaxBP = bp;
        param.maxDepositTax = max;
        emit DepositTaxUpdated(bp, max);
    }

    /**
     * setWithdrawalTax updates current withdrawal tax config
     * @param bp the basic point for the withdrawal tax rate
     * @param max the max tax in wei
     */
    function setWithdrawalTax(
        uint16 bp,
        uint64 max
    ) external override onlyOwner {
        if (bp > MAX_BASE_POINT) {
            revert TaxTooHigh();
        }

        if (max > 1 ether) {
            revert TaxTooHigh();
        }

        if (bp > 0 && max == 0) {
            revert MalformedTax();
        }

        param.withdrawalTaxBP = bp;
        param.maxWithdrawalTax = max;
        emit WithdrawalTaxUpdated(bp, max);
    }

    /**
     * setMinWithdrawal updates current min withdrawal amount
     * @param amount the amount in wei, the amount should be in range [0.001 btc, 1btc]
     */
    function setMinWithdrawal(uint64 amount) external override onlyOwner {
        require(amount >= 1e14 && amount <= 1 ether, "invalid amount");
        param.minWithdrawal = amount;
        emit MinWithdrawalUpdated(amount);
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
