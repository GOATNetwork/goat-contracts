// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Burner} from "../library/utils/Burner.sol";
import {BaseAccess} from "../library/utils/BaseAccess.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IBridge} from "../interfaces/bridge/Bridge.sol";
import {IBridgeParam} from "../interfaces/bridge/BridgeParam.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Bridge is Ownable, BaseAccess, IBridge, IBridgeParam, IERC165 {
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

    // It is only for testing
    constructor(address owner) Ownable(owner) {
        param = Param({
            rateLimit: 300,
            depositTaxBP: 0,
            maxDepositTax: 0,
            withdrawalTaxBP: 20,
            maxWithdrawalTax: 2_000_000 gwei, // 0.002 btc
            _res1: 0,
            minWithdrawal: 1e5 // 0.001 btc
        });
    }

    /**
     * deposit adds balance to the target address
     * goat performs the adding outside EVM to prevent any errors
     * @param _txid the txid(LE)
     * @param _txout the txout
     * @param _target the depoist address
     * @param _amount the deposit amount
     */
    function deposit(
        bytes32 _txid,
        uint32 _txout,
        address _target,
        uint256 _amount
    ) external override OnlyRelayer returns (uint256 tax) {
        bytes32 depositHash = keccak256(abi.encodePacked(_txid, _txout));
        require(!deposits[depositHash], "duplicated");

        require(_amount > 0 && _amount % SATOSHI == 0, "invalid amount");

        Param memory p = param;
        if (p.depositTaxBP > 0) {
            tax = (_amount * p.depositTaxBP) / MAX_BASE_POINT;
            if (tax > p.maxDepositTax) {
                tax = p.maxDepositTax;
            }
            _amount -= tax;
        }

        deposits[depositHash] = true;
        emit Deposit(_target, _amount, _txid, _txout, tax);

        // Add balance to the _target and pay the tax to GF in the runtime
        return tax;
    }

    /**
     * isDeposited checks if the deposit is succeed
     * @param _txid the txid(LE)
     * @param _txout the txout index
     */
    function isDeposited(
        bytes32 _txid,
        uint32 _txout
    ) external view override returns (bool) {
        bytes32 depositHash = keccak256(abi.encodePacked(_txid, _txout));
        return deposits[depositHash];
    }

    /**
     * withdraw initializes a new withdrawal request by a user
     * @param _receiver the address to withdraw
     * @param _maxTxPrice the max allowed tx price in sat/vbyte
     */
    function withdraw(
        string calldata _receiver,
        uint16 _maxTxPrice
    ) external payable override {
        bytes memory addrBytes = bytes(_receiver);
        if (addrBytes.length < 34 || addrBytes.length > 90) {
            revert InvalidAddress();
        }

        uint256 amount = msg.value;
        uint256 tax = 0;

        Param memory p = param;
        require(amount >= p.minWithdrawal * SATOSHI, "amount too low");

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

        require(_maxTxPrice > 0, "invalid tx price");
        require(amount > _maxTxPrice * BASE_TX_SIZE * SATOSHI, "unaffordable");

        uint256 id = withdrawals.length;
        withdrawals.push(
            Withdrawal({
                sender: msg.sender,
                amount: amount,
                tax: tax,
                maxTxPrice: _maxTxPrice,
                updatedAt: block.timestamp,
                status: WithdrawalStatus.Pending
            })
        );

        emit Withdraw(id, msg.sender, amount, tax, _maxTxPrice, _receiver);
    }

    /**
     * replaceByFee updates the withdrawal tx price
     * @param _wid the withdrawal id
     * @param _maxTxPrice the new max tx price
     */
    function replaceByFee(uint256 _wid, uint16 _maxTxPrice) external override {
        Withdrawal storage withdrawal = withdrawals[_wid];

        if (withdrawal.status != WithdrawalStatus.Pending) {
            revert Forbidden();
        }

        if (withdrawal.sender != msg.sender) {
            revert AccessDenied();
        }

        if (block.timestamp - withdrawal.updatedAt < param.rateLimit) {
            revert RateLimitExceeded();
        }

        require(
            _maxTxPrice > withdrawal.maxTxPrice,
            "the new tx price should be larger than before"
        );

        require(
            withdrawal.amount > _maxTxPrice * BASE_TX_SIZE * SATOSHI,
            "unaffordable"
        );

        withdrawal.maxTxPrice = _maxTxPrice;
        withdrawal.updatedAt = block.timestamp;

        emit RBF(_wid, _maxTxPrice);
    }

    /**
     * cancel1 cancels the withdrawal by origin user
     * @param _wid the withdrawal id
     */
    function cancel1(uint256 _wid) external {
        Withdrawal storage withdrawal = withdrawals[_wid];

        if (withdrawal.status != WithdrawalStatus.Pending) {
            revert Forbidden();
        }

        if (withdrawal.sender != msg.sender) {
            revert AccessDenied();
        }

        if (block.timestamp - withdrawal.updatedAt < param.rateLimit) {
            revert RateLimitExceeded();
        }

        withdrawal.updatedAt = block.timestamp;
        withdrawal.status = WithdrawalStatus.Canceling;
        emit Canceling(_wid);
    }

    /**
     * cancel2 apporves the cancellation request by relayer
     * relayer can pay the withdrawal to disregard the cancellation request
     * relayer can reject a pending withdrawal as well
     * @param _wid the withdrwal id
     */
    function cancel2(uint256 _wid) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[_wid];
        WithdrawalStatus status = withdrawal.status;
        require(
            status == WithdrawalStatus.Pending ||
                status == WithdrawalStatus.Canceling
        );
        withdrawal.status = WithdrawalStatus.Canceled;
        withdrawal.updatedAt = block.timestamp;
        emit Canceled(_wid);
    }

    /**
     * refund refunds the amount of the canceled withdrawal to the origin user
     * @param _wid the withdrwal id
     */
    function refund(uint256 _wid) external {
        Withdrawal storage withdrawal = withdrawals[_wid];

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
        emit Refund(_wid);
    }

    /**
     * paid finalizes the withdrawal request and burns the withdrawal amount from network
     * It aslo transfers the tax to GF address if the tax is enabled
     * @param _wid withdrawal id
     * @param _txid the withdrawal txid(little endian)
     * @param _txout the tx output index
     * @param _received the actual paid amount
     */
    function paid(
        uint256 _wid,
        bytes32 _txid,
        uint32 _txout,
        uint256 _received
    ) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[_wid];

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

        emit Paid(_wid, _txid, _txout, _received);
    }

    function setDepositTax(
        uint16 _bp,
        uint64 _max
    ) external override onlyOwner {
        if (_bp > MAX_BASE_POINT) {
            revert TaxTooHigh();
        }

        if (_max > 1 ether) {
            revert TaxTooHigh();
        }

        if (_bp > 0 && _max == 0) {
            revert MalformedTax();
        }

        param.depositTaxBP = _bp;
        param.maxDepositTax = _max;
        emit DepositTaxUpdated(_bp, _max);
    }

    function setWithdrawalTax(
        uint16 _bp,
        uint64 _max
    ) external override onlyOwner {
        if (_bp > MAX_BASE_POINT) {
            revert TaxTooHigh();
        }

        if (_max > 1 ether) {
            revert TaxTooHigh();
        }

        if (_bp > 0 && _max == 0) {
            revert MalformedTax();
        }

        param.withdrawalTaxBP = _bp;
        param.maxWithdrawalTax = _max;
        emit WithdrawalTaxUpdated(_bp, _max);
    }

    function setRateLimit(uint16 _sec) external override onlyOwner {
        require(_sec > 0, "invalid throttle setting");
        param.rateLimit = _sec;
        emit RateLimitUpdated(_sec);
    }

    function setMinWithdrawal(uint64 _amount) external override onlyOwner {
        require(_amount > 0, "invalid amount");
        param.minWithdrawal = _amount;
        emit MinWithdrawalUpdated(_amount);
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
