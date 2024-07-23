// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreDeployedAddresses} from "../library/constants/Address.sol";
import {BitcoinAddress} from "../library/codec/Address.sol";
import {BaseAccess} from "../goat/BaseAccess.sol";

import {Burner} from "./Burner.sol";

contract Bridge is BaseAccess {
    using BitcoinAddress for bytes;

    event Deposit(
        bytes32 indexed _txid,
        address indexed _target,
        uint32 _txout,
        uint256 _amount
    );

    event RequestWithrawal(
        uint256 indexed _id,
        address indexed _from,
        uint256 _amount,
        uint256 _tipFee,
        uint256 _maxFee,
        bytes _target
    );

    event FinalizedWithrawal(
        uint256 indexed _id,
        bytes32 _txid,
        uint32 _txout,
        uint256 _received
    );

    // the total deposited value
    uint256 public inbounds;

    // the depoist utxo mapping
    mapping(bytes32 txid => mapping(uint32 txout => uint256 amount))
        public inbound;

    mapping(uint256 id => Receipt receipt) public receipts;

    Withdrawal[] public outbounds;

    enum WithdrawalStatus {
        Invalid,
        Pending,
        Canceling,
        Canceled,
        Finished
    }

    struct Withdrawal {
        address sender;
        uint256 amount; // msg.value - daoFee
        uint256 maxTipFee;
        uint256 maxFee; // the fee uses eip1559 mode
        bytes reciever;
        WithdrawalStatus status;
    }

    struct Receipt {
        bytes32 txid;
        uint32 txout;
        uint256 received;
    }

    function deposit(
        bytes32 _txid,
        uint32 _txout,
        address _target,
        uint256 _amount
    ) external OnlyPosOwner {
        require(_amount > 0 && inbound[_txid][_txout] == 0, "deposited");

        inbound[_txid][_txout] = _amount;
        inbounds += _amount;

        emit Deposit(_txid, _target, _txout, _amount);

        // Add balance to the _target in the runtime
    }

    /**
     * requestWithdrawal initializes a new withdrawal request
     * @param _reciever the receiver address
     * @param _maxTipFee the tip fee
     * @param _maxFee the max fee for the withdrawal
     * @dev the fee model is same with eip1559
     *      if maxFee - tipFee < l1fee, the musiger will not process the withdrawal
     *      the withdrawal fee = l1fee + tipfee
     *      so the actual amount user will get is equal to <withdrawal amount - fee>
     */
    function requestWithdrawal(
        bytes calldata _reciever,
        uint256 _maxTipFee,
        uint256 _maxFee
    ) external payable {
        require(_reciever.isValid(), "invalid address");
        require(msg.value % 1e10 == 0, "invalid amount");
        require(msg.value > _maxFee && _maxFee > _maxTipFee, "invalid fee");

        // todo(ericlee42): fee charged for DAO

        uint256 id = outbounds.length;
        outbounds.push(
            Withdrawal({
                sender: msg.sender,
                amount: msg.value,
                maxTipFee: _maxTipFee,
                maxFee: _maxFee,
                reciever: _reciever,
                status: WithdrawalStatus.Pending
            })
        );

        emit RequestWithrawal(
            id,
            msg.sender,
            msg.value,
            _maxTipFee,
            _maxFee,
            _reciever
        );
    }

    function finalizedWithdrawal(
        uint256 _wid,
        bytes32 _txid,
        uint32 _txout,
        uint256 _received
    ) external OnlyPosOwner {
        receipts[_wid] = Receipt({
            txid: _txid,
            txout: _txout,
            received: _received
        });
        outbounds[_wid].status = WithdrawalStatus.Finished;
        new Burner{
            value: outbounds[_wid].amount,
            salt: bytes32(bytes20(address(this)))
        }();
        emit FinalizedWithrawal(_wid, _txid, _txout, _received);
    }

    // todo: support it in the next version
    // function cancelWithdrawal(uint256 _wid) external {
    //     /**
    //      * todo
    //      * owner check
    //      * status check
    //      * fee and amount check
    //      * user could pay more fee from msg.value
    //      */
    // }

    // function refundCanceledWithdrawal(uint256 _wid) external {
    //     /**
    //      * todo
    //      * owner check
    //      * status check
    //      * fee and amount check
    //      * user could pay more fee from msg.value
    //      */
    // }

    // function updateWithdrawal(
    //     uint256 _wid,
    //     uint256 _maxTipFee,
    //     uint256 _maxFee
    // ) external payable {
    //     /**
    //      * tod
    //      * owner check
    //      * status check
    //      * fee and amount check
    //      * user could pay more fee from msg.value
    //      */
    // }
}
