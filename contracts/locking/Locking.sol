// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILocking} from "../interfaces/Locking.sol";
import {IGoatToken} from "../interfaces/GoatToken.sol";
import {Pubkey} from "../library/codec/pubkey.sol";
import {BaseAccess} from "../library/utils/BaseAccess.sol";

/*
TODO: 

review if the distributeReward and completeUndelegation implemention are consistent with goat-geth

add throttle modifier to reduce consensus request number per block
*/

contract Locking is Ownable, BaseAccess, ILocking {
    using SafeERC20 for IERC20;
    using Pubkey for bytes32[2];

    // the callback index for consensus layer c
    uint64 public index;

    mapping(address token => bool yes) public tokens;

    mapping(address owner => Delegator delegator) public delegators;

    mapping(address validator => Validator config) public validators;

    Param internal param;

    constructor(address owner) Ownable(owner) {
        tokens[address(0x0)] = true;
        tokens[PreDeployedAddresses.GoatToken] = true;
    }

    function minSelfDelegation() external view returns (Delegation[] memory) {
        return param.minSelfDelegation;
    }

    function setMinSelfDelegation(Delegation calldata _new) external onlyOwner {
        require(_new.amount > 0, "amount too low");
        emit SetMinSelfDelegation(_new.token, _new.amount);
        for (uint256 i = 0; i < param.minSelfDelegation.length; i++) {
            Delegation storage _old = param.minSelfDelegation[i];
            if (_old.token == _new.token) {
                _old.amount = _new.amount;
                return;
            }
        }
        param.minSelfDelegation.push(_new);
    }

    function removeMinSelfDelegation(address token) external onlyOwner {
        Delegation[] storage p = param.minSelfDelegation;
        for (uint256 i = 0; i < p.length; i++) {
            Delegation memory dlg = p[i];
            if (dlg.token == token) {
                if (i != p.length - 1) {
                    p[i] = p[p.length - 1];
                }
                p.pop();
                emit RemoveMinSelfDelegation(token);
            }
        }
    }

    function setDelegationToken(address token, bool yes) external onlyOwner {
        tokens[token] = yes;
        emit SetDelegationToken(token, yes);
    }

    /**
     * create creates a new validator
     * @param pubkey the validator secp256k1 public key
     * @param commission the commission percent rate, range is from 0 to 100
     * @param sigR the validator sig
     * @param sigS the validator sig
     * @param sigV the validator sig
     *
     * the data to sign =
     * abi.encodePacked(block.chainid, validator address, validator owner, commission)
     */
    function create(
        bytes32[2] calldata pubkey,
        uint8 commission,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable {
        require(commission < 101, "invalid commission rate");
        address validator = pubkey.ConsAddress();
        bytes32 hash = keccak256(
            abi.encodePacked(block.chainid, validator, msg.sender, commission)
        );
        require(
            pubkey.EthAddress() == ECDSA.recover(hash, sigV, sigR, sigS),
            "signer mismatched"
        );
        Validator storage config = validators[validator];
        require(config.owner == address(0x0), "validator has been created");
        config.owner = msg.sender;
        config.commission = commission;
        _delegate(validator, param.minSelfDelegation);
        emit Create(validator, pubkey, commission);
    }

    /**
     * setCommission sets validator commitssion percent rate by the valiator owner
     * @param validator the validator address
     * @param commission the new commission value
     */
    function setCommission(address validator, uint8 commission) external {
        require(commission < 101, "invalid commission rate");
        Validator storage config = validators[validator];
        require(config.owner == msg.sender, "not the validator owner");
        config.commission = commission;
        emit SetCommission(validator, commission);
    }

    /**
     * delegate delegates tokens to a validator
     * @param validator the validator address
     * @param delegations the delegation information
     */
    function delegate(
        address validator,
        Delegation[] calldata delegations
    ) external payable {
        require(
            validators[validator].owner != address(0x0),
            "validator not found"
        );
        _delegate(validator, delegations);
    }

    /**
     * undelegate undelegates tokens from a validator
     * @param token the token address to undelegate
     * @param amount the amount to undelegate
     *
     * the consensus layer will send back a `completeUndelegation` tx for the undelegation
     */
    function undelegate(address token, uint256 amount) external {
        Delegator storage d = delegators[msg.sender];
        require(d.validator != address(0x0), "no delegation");
        require(amount > 0 && d.delegating[token] >= amount, "invalid amount");
        emit Undelegate(index, msg.sender, token, amount);
        index++;
    }

    /**
     * claim claims rewards
     *
     * the consensus layer will send back a `distributeReward` tx for the claiming
     */
    function claim() external {
        Delegator storage d = delegators[msg.sender];
        require(d.validator != address(0x0), "no delegation");
        emit Claim(index, msg.sender);
        index++;
    }

    /**
     * distributeReward distributes delegation reward(including the goat token and gas fee)
     * @param id the request index
     * @param delegator the delegator address
     * @param goat the goat reward
     * @param amount the gas fee reward
     */
    function distributeReward(
        uint64 id,
        address delegator,
        uint256 goat,
        uint256 amount
    ) external OnlyLocking {
        emit DistributeReward(
            id,
            delegator,
            PreDeployedAddresses.GoatToken,
            goat
        );

        if (goat > 0) {
            IGoatToken(PreDeployedAddresses.GoatToken).mint(delegator, goat);
        }

        if (amount > 0) {
            // performacing the adding in the runtime
            emit DistributeReward(id, delegator, address(0), amount);
        }
    }

    /**
     * completeUndelegation completes the undelegation operation and sends back tokens to the delegator
     * @param id the request index
     * @param delegator the delegator address
     * @param token the goat reward
     * @param amount the amount to send back
     */
    function completeUndelegation(
        uint64 id,
        address delegator,
        address token,
        uint256 amount
    ) external OnlyLocking {
        Delegator storage d = delegators[msg.sender];
        d.delegating[token] -= amount;

        // sending back the native token in the runtime
        if (token != address(0x0)) {
            IERC20(token).safeTransfer(delegator, amount);
        }

        emit CompleteUndelegation(id, delegator, token, amount);
    }

    function _delegate(
        address validator,
        Delegation[] memory delegations
    ) internal {
        Delegator storage delegator = delegators[msg.sender];
        if (delegator.validator == address(0x0)) {
            delegator.validator = validator;
        } else {
            require(
                delegator.validator == validator,
                "delegate to multiple validators"
            );
        }

        uint256 mval = msg.value;
        for (uint256 i = 0; i < delegations.length; i++) {
            Delegation memory d = delegations[i];
            require(d.amount > 0, "invalid amount");
            require(tokens[d.token], "not delegation token");

            if (d.token == address(0x0)) {
                require(mval >= d.amount, "insufficient msg.value to pay");
                mval -= d.amount;
            } else {
                IERC20(d.token).safeTransferFrom(
                    msg.sender,
                    address(this),
                    d.amount
                );
            }
            delegator.delegating[d.token] += d.amount;
            emit Delegate(validator, msg.sender, d.token, d.amount);
        }
        require(mval == 0, "paid msg.value more than delegation");
    }
}
