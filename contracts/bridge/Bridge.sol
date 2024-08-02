// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Network} from "../library/constants/Network.sol";
import {PreCompiledAddresses} from "../library/constants/Precompiled.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";
import {SysOwners} from "../library/constants/SysOwners.sol";
import {Burner} from "../library/utils/Burner.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IBridge} from "../interfaces/Bridge.sol";
import {IGoatFoundation} from "../interfaces/GoatFoundation.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract Bridge is IBridge {
    using Address for address payable;

    // the network config
    bytes32 internal network;

    Param public param;

    uint256 public unpaidTax;

    mapping(bytes32 txh => bool yes) internal deposits;

    Withdrawal[] public withdrawals;

    // the withdrawal receipts
    mapping(uint256 id => Receipt receipt) public receipts;

    HeaderRange public headerRange;
    mapping(uint256 height => BlockHeader header) public btcBlockHeader;

    modifier OnlyGoatFoundation() {
        if (msg.sender != PreDeployedAddresses.GoatFoundation) {
            revert AccessDenied();
        }
        _;
    }

    modifier OnlyRelayer() {
        if (msg.sender != SysOwners.Relayer) {
            revert AccessDenied();
        }
        _;
    }

    // 1 satoshi = 10 gwei
    uint256 internal constant satWei = 10 gwei;

    // 2 p2wsh input + 1 p2tr/p2wsh output + 1 change output + padding
    uint256 internal constant baseTxSize = 300;

    // the max tax base points
    uint256 internal constant maxBasePoints = 1e4;

    // It is only for testing
    constructor(uint128 _height, BlockHeader memory _header) {
        headerRange = HeaderRange(_height, _height);
        btcBlockHeader[_height] = _header;
        network = Network.Mainnet;
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

    function bech32HRP() public view returns (string memory) {
        uint8 hrpLen = uint8(network[2]);
        bytes memory hrp = new bytes(hrpLen);
        for (uint8 i = 0; i < hrpLen; i++) {
            hrp[i] = network[i + 3];
        }
        return string(hrp);
    }

    function networkName() public view returns (string memory) {
        uint8 start = uint8(3) + uint8(network[2]);
        uint8 nameLen = uint8(network[start]);
        bytes memory name = new bytes(nameLen);
        for (uint8 i = 0; i < nameLen; i++) {
            name[i] = network[i + start + 1];
        }
        return string(name);
    }

    function isAddrValid(string calldata _addr) public view returns (bool) {
        uint8 hrpLen = uint8(network[2]);
        bytes memory hrp = new bytes(hrpLen);
        for (uint8 i = 0; i < hrpLen; i++) {
            hrp[i] = network[i + 3];
        }

        (bool success, bytes memory data) = PreCompiledAddresses
            .BtcAddrVerifierV0
            .staticcall(
                abi.encodePacked(network[0], network[1], hrpLen, hrp, _addr)
            );

        if (success && data.length > 0) {
            return data[0] == 0x01;
        }
        return false;
    }

    function newBitcoinBlock(BlockHeader calldata header) external OnlyRelayer {
        uint128 height = ++headerRange.latest;
        btcBlockHeader[height] = header;
        emit NewBitcoinBlock(height);
    }

    // deposit adds balance to the target address
    // goat performs the adding outside EVM to prevent any errors
    function deposit(
        bytes32 _txid,
        uint32 _txout,
        address _target,
        uint256 _amount
    ) external override OnlyRelayer {
        bytes32 depositHash = keccak256(abi.encodePacked(_txid, _txout));
        require(_amount > 0 && !deposits[depositHash]);

        uint256 tax = 0;
        if (param.depositTaxBP > 0) {
            tax = (_amount * param.depositTaxBP) / maxBasePoints;
            if (tax > param.maxDepositTax) {
                tax = param.maxDepositTax;
            }
            unpaidTax += tax;
            _amount -= tax;
        }

        deposits[depositHash] = true;
        emit Deposit(_target, _amount, _txid, _txout, tax);
        // Add balance to the _target in the runtime
    }

    function isDeposited(
        bytes32 _txid,
        uint32 _txout
    ) external view override returns (bool) {
        bytes32 depositHash = keccak256(abi.encodePacked(_txid, _txout));
        return deposits[depositHash];
    }

    // withdraw initializes a new withdrawal request by a user
    // the _maxTxPrice is the max allowed tx price in sat/vbyte
    function withdraw(
        string calldata _reciever,
        uint16 _maxTxPrice
    ) external payable override {
        uint256 amount = msg.value;
        uint256 tax = 0;

        if (param.withdrawalTaxBP > 0) {
            tax = (amount * param.withdrawalTaxBP) / maxBasePoints;
            if (tax > param.maxWithdrawalTax) {
                tax = param.maxWithdrawalTax;
            }
            amount -= tax;
        }

        // dust as tax
        uint256 dust = amount % satWei;
        if (dust > 0) {
            tax += dust;
            amount -= dust;
        }

        require(isAddrValid(_reciever), "invalid address");
        require(_maxTxPrice > 0, "invalid tx price");
        require(amount > _maxTxPrice * baseTxSize * satWei, "unaffordable");

        uint256 id = withdrawals.length;
        withdrawals.push(
            Withdrawal({
                sender: msg.sender,
                amount: amount,
                tax: tax,
                maxTxPrice: _maxTxPrice,
                updatedAt: block.timestamp,
                reciever: _reciever,
                status: WithdrawalStatus.Pending
            })
        );

        emit Withdraw(id, msg.sender, amount, _maxTxPrice, _reciever);
    }

    // replaceByFee updates the max tx price to speed-up the withdrawal
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

        if (withdrawal.updatedAt - block.timestamp > param.rateLimit) {
            revert RateLimitExceeded();
        }

        require(
            withdrawal.maxTxPrice > _maxTxPrice,
            "the new tx price should be larger than before"
        );

        require(
            withdrawal.amount > _maxTxPrice * baseTxSize * satWei,
            "unaffordable"
        );

        withdrawal.maxTxPrice = _maxTxPrice;
        withdrawal.updatedAt = block.timestamp;

        emit RBF(_wid, _maxTxPrice);
    }

    // cancel1 cancels the withdrawal by origin user
    function cancel1(uint256 _wid) external {
        Withdrawal storage withdrawal = withdrawals[_wid];

        if (withdrawal.status != WithdrawalStatus.Pending) {
            revert Forbidden();
        }

        if (withdrawal.sender != msg.sender) {
            revert AccessDenied();
        }

        if (withdrawal.updatedAt - block.timestamp > param.rateLimit) {
            revert RateLimitExceeded();
        }

        withdrawal.updatedAt = block.timestamp;
        withdrawal.status = WithdrawalStatus.Canceling;
        emit Canceling(_wid);
    }

    // cancel2 apporves the cancellation request by relayer
    // the cancellation won't be approved if the withdrawal is paid
    function cancel2(uint256 _wid) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[_wid];
        require(withdrawal.status == WithdrawalStatus.Canceling);
        withdrawal.status = WithdrawalStatus.Canceled;
        withdrawal.updatedAt = block.timestamp;
        emit Canceled(_wid);
    }

    // refund refunds the amount in the canceled withdrawal to the origin user
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

    // paid finalizes the withdrawal request and burns the withdrawal amount from network
    function paid(
        uint256 _wid,
        bytes32 _txid,
        uint32 _txout,
        uint256 _paid
    ) external OnlyRelayer {
        Withdrawal storage withdrawal = withdrawals[_wid];

        require(
            withdrawal.status == WithdrawalStatus.Pending ||
                withdrawal.status == WithdrawalStatus.Canceling
        );

        receipts[_wid] = Receipt(_txid, _txout, _paid);
        withdrawal.status = WithdrawalStatus.Paid;
        withdrawal.updatedAt = block.timestamp;

        // send the tax to goat foundation
        uint256 tax = withdrawal.tax;
        if (tax > 0) {
            unpaidTax += tax;
        }

        // Burn the withdrawal value from the network
        new Burner{value: withdrawal.amount, salt: bytes32(0x00)}();
        emit Paid(_wid, _txid, _txout, _paid, tax);
    }

    function setDepositFee(
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

    function setWithdrawalFee(
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

    function takeTax() external OnlyGoatFoundation returns (uint256) {
        uint256 unpaied = unpaidTax;
        if (unpaied == 0) {
            return unpaied;
        }

        unpaidTax = 0;
        PreDeployedAddresses.GoatFoundation.sendValue(unpaied);
        return unpaied;
    }

    function supportsInterface(
        bytes4 id
    ) external view virtual override returns (bool) {
        return
            id == type(IERC165).interfaceId || id == type(IBridge).interfaceId;
    }
}
