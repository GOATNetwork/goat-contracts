// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SysOwners} from "../library/constants/SysOwners.sol";
import {Network} from "../library/constants/Network.sol";
import {PreCompiledAddresses} from "../library/constants/Precompiled.sol";
import {Burner} from "../library/utils/Burner.sol";

import {IBridge} from "../interfaces/bridge.sol";

// todo: add dao fee when we have a complete dao design

contract Bridge is IBridge {
    // the network config
    bytes32 internal network = Network.Mainnet;

    // the relayer address
    address public relayer = SysOwners.Relayer;

    HeaderRange public headerRange;
    mapping(uint256 height => BlockHeader header) public btcBlockHeader;

    mapping(bytes32 prove => bool exists) public deposits;

    mapping(uint256 id => Receipt receipt) public receipts;

    Withdrawal[] public withdrawals;

    Param public param;

    // 1 satoshi = 10 gwei
    uint256 internal constant satWei = 1e10;

    // 1 p2wsh input + 1 p2tr/p2wsh output + 1 change output + padding
    uint256 internal constant avgTxSize = 300;

    modifier OnlyRelayer() {
        require(msg.sender == relayer, AccessDenied());
        _;
    }

    // It is only for testing
    constructor(
        bytes32 _network,
        address _relayer,
        uint128 _height,
        Param memory _param,
        BlockHeader memory _header
    ) {
        network = _network;
        relayer = _relayer;
        headerRange = HeaderRange(_height, _height);
        btcBlockHeader[_height] = _header;
        param = _param;
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
            .BitcoinAddressDecoderV0
            .staticcall(
                abi.encodePacked(network[0], network[1], hrpLen, hrp, _addr)
            );

        if (success && data.length > 0) {
            return data[0] == 0x01;
        }
        return false;
    }

    function newBitcoinblock(BlockHeader calldata header) external OnlyRelayer {
        uint128 height = ++headerRange.latest;
        btcBlockHeader[height] = header;
        emit NewBitcoinBlock(height);
    }

    // deposit adds balance to the target address
    // goat performs the adding outside EVM to prevent the errors
    function deposit(
        bytes32 _txid,
        uint32 _txout,
        address _target,
        uint256 _amount
    ) external OnlyRelayer {
        bytes32 depositHash = keccak256(abi.encodePacked(_txid, _txout));
        require(_amount > 0 && !deposits[depositHash], "deposited");

        deposits[depositHash] = true;

        emit Deposit(_target, _amount, _txid, _txout);

        // Add balance to the _target in the runtime
    }

    // withdraw initializes a new withdrawal request by a user
    // the _maxTxPrice is the max allowed tx price in sat/vbyte
    function withdraw(
        string calldata _reciever,
        uint256 _maxTxPrice
    ) external payable {
        require(isAddrValid(_reciever), "invalid address");

        uint256 amount = msg.value;

        // todo(ericlee42): fee charged for dao
        // if (param.theDAOFeeRate > 0) { amount = ... }

        require(
            amount > param.minWithdrawal && amount % satWei == 0,
            "invalid amount"
        );
        require(_maxTxPrice > param.minTxPrice, "invalid fee rate");
        require(amount > _maxTxPrice * avgTxSize * satWei, "unaffordable");

        uint256 id = withdrawals.length;
        withdrawals.push(
            Withdrawal({
                sender: msg.sender,
                amount: amount,
                maxTxPrice: _maxTxPrice,
                updatedAt: block.timestamp,
                reciever: _reciever,
                status: WithdrawalStatus.Pending
            })
        );

        emit Withdraw(id, msg.sender, amount, _maxTxPrice, _reciever);
    }

    // replaceByFee updates the max tx price to speed-up the withdrawal
    function replaceByFee(uint256 _wid, uint256 _maxTxPrice) external payable {
        WithdrawalStatus status = withdrawals[_wid].status;
        require(status == WithdrawalStatus.Pending, Forbidden());

        require(
            withdrawals[_wid].updatedAt - block.timestamp >
                param.throttleInSecond,
            Throttled()
        );
        withdrawals[_wid].updatedAt = block.timestamp;
        require(msg.sender == withdrawals[_wid].sender, AccessDenied());
        require(
            withdrawals[_wid].maxTxPrice > _maxTxPrice,
            "the max tx price should be larger than before"
        );
        withdrawals[_wid].maxTxPrice = _maxTxPrice;

        emit RBF(_wid, _maxTxPrice);
    }

    // cancel1 cancels the withdrawal by origin user
    function cancel(uint256 _wid) external {
        WithdrawalStatus status = withdrawals[_wid].status;
        require(status == WithdrawalStatus.Pending, Forbidden());
        require(msg.sender == withdrawals[_wid].sender, AccessDenied());

        require(
            withdrawals[_wid].updatedAt - block.timestamp >
                param.throttleInSecond,
            Throttled()
        );
        withdrawals[_wid].updatedAt = block.timestamp;

        withdrawals[_wid].status = WithdrawalStatus.Canceling;
        emit Canceling(_wid);
    }

    // cancel2 apporves the cancellation request by relayer
    // the cancellation won't be approved if the withdrawal is paid
    function cancel2(uint256 _wid) external OnlyRelayer {
        require(withdrawals[_wid].status == WithdrawalStatus.Canceling);
        withdrawals[_wid].status = WithdrawalStatus.Canceled;
        emit Canceled(_wid);
    }

    // refund refunds the amount in the canceled withdrawal to the origin user
    function refund(uint256 _wid) external {
        WithdrawalStatus status = withdrawals[_wid].status;
        require(status == WithdrawalStatus.Canceled, Forbidden());
        withdrawals[_wid].status = WithdrawalStatus.Refunded;

        address payable sender = payable(withdrawals[_wid].sender);
        require(msg.sender == sender, AccessDenied());

        // refund to the address
        sender.transfer(withdrawals[_wid].amount);
        emit Refund(_wid);
    }

    // paid finalizes the withdrawal request and burns the withdrawal amount from network
    function paid(
        uint256 _wid,
        bytes32 _txid,
        uint32 _txout,
        uint256 _paid
    ) external OnlyRelayer {
        WithdrawalStatus status = withdrawals[_wid].status;
        require(
            status == WithdrawalStatus.Pending ||
                status == WithdrawalStatus.Canceling,
            "finalized"
        );

        receipts[_wid] = Receipt(_txid, _txout, _paid);
        withdrawals[_wid].status = WithdrawalStatus.Paid;

        // Burn the withdrawal value from the network
        // todo: send the dao fee
        new Burner{
            value: withdrawals[_wid].amount,
            salt: bytes32(bytes20(address(this)))
        }();
        emit Paid(_wid, _txid, _txout, _paid);
    }
}
