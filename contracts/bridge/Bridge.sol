// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Network} from "../library/constants/Network.sol";
import {PreCompiledAddresses} from "../library/constants/Precompiled.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";
import {Executor} from "../library/constants/Executor.sol";
import {Burner} from "../library/utils/Burner.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IBridge} from "../interfaces/bridge/Bridge.sol";
import {IBridgeParam} from "../interfaces/bridge/BridgeParam.sol";
import {IBridgeNetwork} from "../interfaces/bridge/BridgeNetwork.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Bridge is IBridge, IBridgeParam, IBridgeNetwork, IERC165 {
    using Address for address payable;

    // the network config
    bytes32 internal immutable network;

    Param public param;

    mapping(bytes32 txh => bool yes) internal deposits;

    Withdrawal[] public withdrawals;

    // the withdrawal receipts
    mapping(uint256 id => Receipt receipt) public receipts;

    modifier OnlyGoatFoundation() {
        if (msg.sender != PreDeployedAddresses.GoatFoundation) {
            revert AccessDenied();
        }
        _;
    }

    modifier OnlyRelayer() {
        if (msg.sender != Executor.Relayer) {
            revert AccessDenied();
        }
        _;
    }

    // 1 satoshi = 10 gwei
    uint256 internal constant satoshi = 10 gwei;

    // 2 p2wsh input + 1 p2tr/p2wsh output + 1 change output
    uint256 internal constant baseTxSize = 300;

    // the max tax base points
    uint256 internal constant maxBasePoints = 1e4;

    // It is only for testing
    constructor(bytes32 _network) {
        network = _network;
        param = Param({
            rateLimit: 300,
            depositTaxBP: 0,
            maxDepositTax: 0,
            withdrawalTaxBP: 20,
            maxWithdrawalTax: 2_000_000 gwei, // 0.002
            _res1: 0,
            _res2: 0
        });
    }

    function base58Prefix()
        public
        view
        returns (bytes1 pubKeyHashAddrID, bytes1 scriptHashAddrID)
    {
        pubKeyHashAddrID = network[0];
        scriptHashAddrID = network[1];
    }

    function bech32HRP() public view override returns (string memory) {
        uint8 hrpLen = uint8(network[2]);
        bytes memory hrp = new bytes(hrpLen);
        for (uint8 i = 0; i < hrpLen; i++) {
            hrp[i] = network[i + 3];
        }
        return string(hrp);
    }

    function networkName() public view override returns (string memory) {
        uint8 start = uint8(3) + uint8(network[2]);
        uint8 nameLen = uint8(network[start]);
        bytes memory name = new bytes(nameLen);
        for (uint8 i = 0; i < nameLen; i++) {
            name[i] = network[i + start + 1];
        }
        return string(name);
    }

    function isAddrValid(
        string calldata _addr
    ) public view override returns (bool) {
        bytes memory addrBytes = bytes(_addr);
        if (addrBytes.length < 34 || addrBytes.length > 90) {
            return false;
        }

        bytes memory config = new bytes(3 + uint8(network[2]));
        for (uint8 i = 0; i < config.length; i++) {
            config[i] = network[i];
        }

        (bool success, bytes memory data) = PreCompiledAddresses
            .BtcAddrVerifierV0
            .staticcall(abi.encodePacked(config, addrBytes));

        if (success && data.length > 0) {
            return data[0] == 0x01;
        }
        return false;
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

        require(_amount > 0 && _amount % satoshi == 0, "invalid amount");

        Param memory p = param;
        if (p.depositTaxBP > 0) {
            tax = (_amount * p.depositTaxBP) / maxBasePoints;
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
        uint256 amount = msg.value;
        uint256 tax = 0;

        Param memory p = param;
        if (p.withdrawalTaxBP > 0) {
            tax = (amount * p.withdrawalTaxBP) / maxBasePoints;
            if (tax > p.maxWithdrawalTax) {
                tax = p.maxWithdrawalTax;
            }
            amount -= tax;
        }

        // dust as tax
        uint256 dust = amount % satoshi;
        if (dust > 0) {
            tax += dust;
            amount -= dust;
        }

        require(isAddrValid(_receiver), "invalid address");
        require(_maxTxPrice > 0, "invalid tx price");
        require(amount > _maxTxPrice * baseTxSize * satoshi, "unaffordable");

        uint256 id = withdrawals.length;
        withdrawals.push(
            Withdrawal({
                sender: msg.sender,
                amount: amount,
                tax: tax,
                maxTxPrice: _maxTxPrice,
                updatedAt: block.timestamp,
                receiver: _receiver,
                status: WithdrawalStatus.Pending
            })
        );

        emit Withdraw(id, msg.sender, amount, tax, _maxTxPrice, _receiver);
    }

    /**
     * replaceByFee updates the withdrawal tx price
     * @param _wid the withdrwal id
     * @param _maxTxPrice the new max tx price
     */
    function replaceByFee(
        uint256 _wid,
        uint16 _maxTxPrice
    ) external payable override {
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
            withdrawal.amount > _maxTxPrice * baseTxSize * satoshi,
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
     * @param _wid withdrawal id
     * @param _txid the withdrawal txid(little endian)
     * @param _txout the tx output index
     * @param _received the actul paid amount
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

        receipts[_wid] = Receipt(_txid, _txout, _received);
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
    ) external override OnlyGoatFoundation {
        if (_bp > maxBasePoints) {
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
    ) external override OnlyGoatFoundation {
        if (_bp > maxBasePoints) {
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

    function setRateLimit(uint16 _sec) external override OnlyGoatFoundation {
        require(_sec > 0, "invalid throttle setting");
        param.rateLimit = _sec;
        emit RateLimitUpdated(_sec);
    }

    function supportsInterface(
        bytes4 id
    ) external view virtual override returns (bool) {
        return
            id == type(IERC165).interfaceId ||
            id == type(IBridge).interfaceId ||
            id == type(IBridgeNetwork).interfaceId ||
            id == type(IBridgeParam).interfaceId;
    }
}
