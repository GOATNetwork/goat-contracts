// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ILocking} from "../interfaces/Locking.sol";
import {Pubkey} from "../library/codec/pubkey.sol";
import {BaseAccess} from "../library/utils/BaseAccess.sol";

import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";

contract Locking is Ownable, BaseAccess, ILocking {
    using SafeERC20 for IERC20;
    using Pubkey for bytes32[2];

    // the consensus request index
    uint64 internal reqId;
    uint256 public remainReward;
    Param internal param;

    mapping(address validator => address owner) public owners;
    mapping(address token => Token config) public tokens; // token weight for validator power

    mapping(address token => uint256 amount) totalLocking;
    mapping(address validator => mapping(address token => uint256 amount)) locking;

    uint256 public constant MAX_WEIGHT = 1e6;

    constructor(address owner, uint256 totalReward) Ownable(owner) {
        tokens[PreDeployedAddresses.GoatToken] = Token(true, 1, 0);
        tokens[address(0)] = Token(true, 12000, 0);
        remainReward = totalReward;
    }

    modifier OnlyValidatorOwner(address validator) {
        require(msg.sender == owners[validator], "not validator owner");
        _;
    }

    /**
     * creationThreshold is the threshold to create a new validator
     */
    function creationThreshold() external view returns (Locking[] memory) {
        return param.creationThreshold;
    }

    /**
     * openClaim let claim is open
     */
    function openClaim() external onlyOwner {
        param.claim = true;
    }

    /**
     * setCreateThreshold upserts current validator creation threshold
     * @param _new the new locking token
     */
    function setCreateThreshold(Locking calldata _new) external onlyOwner {
        require(_new.amount > 0, "amount too low");
        emit SetCreationThreshold(_new.token, _new.amount);
        for (uint256 i = 0; i < param.creationThreshold.length; i++) {
            Locking storage _old = param.creationThreshold[i];
            if (_old.token == _new.token) {
                _old.amount = _new.amount;
                return;
            }
        }
        param.creationThreshold.push(_new);
    }

    /**
     * removeCreationThreshold removes token from creation threshold list
     * @param token the token address
     */
    function removeCreationThreshold(address token) external onlyOwner {
        _removeCreationThreshold(token);
    }

    /**
     * addToken adds new a token
     * @param token the token address
     * @param weight the weight for the validator power
     * @param limit the lock limit, 0 represents no limit
     */
    function addToken(
        address token,
        uint64 weight,
        uint256 limit
    ) external onlyOwner {
        require(!tokens[token].valid, "token exists");
        if (token != address(0)) {
            require(IERC20Metadata(token).decimals() == 18, "invalid decimals");
        }

        require(weight < MAX_WEIGHT, "invalid weight");
        tokens[token] = Token(true, weight, limit);
        emit UpdateTokenWeight(token, weight);
        emit UpdateTokenLimit(token, limit);
    }

    /**
     * setTokenWeight updates token weight
     * @param token the locking token address, the token's decimals must be 18
     * @param weight the weight for the validator power
     * if weight is 0, the token will be not able to lock
     */
    function setTokenWeight(address token, uint64 weight) external onlyOwner {
        require(tokens[token].valid, "token not found");
        require(weight < MAX_WEIGHT, "invalid weight");
        tokens[token].weight = weight;
        if (weight == 0) {
            _removeCreationThreshold(token);
        }
        emit UpdateTokenWeight(token, weight);
    }

    /**
     * setTokenLimit updates token limit
     * @param token the token address
     * @param limit the lock limit, 0 represents no limit
     */
    function setTokenLimit(address token, uint256 limit) external onlyOwner {
        require(tokens[token].valid, "token not found");
        tokens[token].limit = limit;
        emit UpdateTokenLimit(token, limit);
    }

    /**
     * create creates a new validator
     * @param pubkey the validator secp256k1 public key
     * @param sigR the validator sig
     * @param sigS the validator sig
     * @param sigV the validator sig
     *
     * the pubkey, an uncompressed secp256k1 public key
     * It is composed of the public key's 32 bytes X-coordinate and 32 bytes Y-coordinate
     *
     * the validator address =
     * sha256(ripemd160(compressed pubkey))
     *
     * the data to sign =
     * abi.encodePacked(block.chainid, validator address, validator owner(msg.sender))
     * it includes the validator address to prevent usage error
     */
    function create(
        bytes32[2] calldata pubkey,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable {
        address validator = pubkey.ConsAddress();
        bytes32 hash = keccak256(
            abi.encodePacked(block.chainid, validator, msg.sender)
        );
        require(
            pubkey.EthAddress() == ECDSA.recover(hash, sigV, sigR, sigS),
            "signer mismatched"
        );
        require(owners[validator] == address(0), "validator has been created");
        owners[validator] = msg.sender;
        emit Create(validator, msg.sender, pubkey);
        _lock(validator, param.creationThreshold);
    }

    /**
     * lock locks tokens to a validator
     * @param validator the validator address
     * @param values the Locking values
     */
    function lock(
        address validator,
        Locking[] calldata values
    ) external payable OnlyValidatorOwner(validator) {
        _lock(validator, values);
    }

    /**
     * changeValidatorOwner update the validator owner
     * @param validator the validator address
     * @param newOwner the new owner address
     */
    function changeValidatorOwner(
        address validator,
        address newOwner
    ) external OnlyValidatorOwner(validator) {
        owners[validator] = newOwner;
        emit ChangeValidatorOwner(validator, newOwner);
    }

    /**
     * unlock withdraws tokens from consensus layer
     * @param validator the validator address
     * @param recipient the recipient address
     * @param lks the token to unlocks
     *
     * if the validator is slashed, the actual amount will be less than the request amount
     *
     * the consensus layer will send back a `completeUnlock` tx for the undelegation
     */
    function unlock(
        address validator,
        address recipient,
        Locking[] calldata lks
    ) external OnlyValidatorOwner(validator) {
        require(lks.length > 0, "no delegations");
        for (uint i = 0; i < lks.length; i++) {
            Locking memory d = lks[i];
            require(d.amount > 0, "invalid amount");
            locking[validator][d.token] -= d.amount;
            totalLocking[d.token] -= d.amount;
            emit Unlock(reqId++, validator, recipient, d.token, d.amount);
        }
    }

    /**
     * claim claims rewards
     * @param validator the validator address
     * @param recipient the reward recipient address
     *
     * the consensus layer will send back a `distributeReward` tx for the claiming
     */
    function claim(
        address validator,
        address recipient
    ) external OnlyValidatorOwner(validator) {
        require(param.claim, "claim is not open");
        emit Claim(reqId++, validator, recipient);
    }

    /**
     * distributeReward distributes Locking reward(including the goat token and gas fee)
     * @param id the request id
     * @param recipient the reward recipient address
     * @param goat the goat reward
     * @param amount the gas fee reward
     */
    function distributeReward(
        uint64 id,
        address recipient,
        uint256 goat,
        uint256 amount
    ) external OnlyLockingExecutor {
        // performacing the native token adding in the runtime
        if (amount > 0) {
            emit DistributeReward(id, address(0), amount);
        }

        if (remainReward == 0) {
            return;
        }

        if (remainReward < goat) {
            goat = remainReward;
        }

        if (goat == 0) {
            return;
        }

        IERC20(PreDeployedAddresses.GoatToken).safeTransfer(recipient, goat);
        emit DistributeReward(id, PreDeployedAddresses.GoatToken, goat);
        remainReward -= goat;
    }

    /**
     * completeUnlock completes the unlock operation and sends back tokens to the delegator
     * @param id the request id
     * @param recipient the recipient
     * @param token the goat reward
     * @param amount the amount to send back
     */
    function completeUnlock(
        uint64 id,
        address recipient,
        address token,
        uint256 amount
    ) external OnlyLockingExecutor {
        if (token != address(0)) {
            IERC20(token).safeTransfer(recipient, amount);
        }
        // sends back the native token in the runtime
        emit CompleteUnlock(id, token, amount);
    }

    function _lock(address validator, Locking[] memory locks) internal {
        require(locks.length > 0, "no delegations");
        uint256 msgValue = msg.value;
        for (uint256 i = 0; i < locks.length; i++) {
            Locking memory d = locks[i];
            Token memory t = tokens[d.token];

            require(d.amount > 1e15, "invalid amount"); // It's for the minimal power (=1e3)
            require(t.weight > 0, "not lockable token");

            if (d.token == address(0)) {
                require(msgValue == d.amount, "invalid msg.value");
                msgValue -= d.amount;
            } else {
                IERC20(d.token).safeTransferFrom(
                    msg.sender,
                    address(this),
                    d.amount
                );
            }
            uint256 limit = totalLocking[d.token] + d.amount;
            require(t.limit == 0 || t.limit >= limit, "lock amount exceed");
            totalLocking[d.token] = limit;

            locking[validator][d.token] += d.amount;
            emit Lock(validator, d.token, d.amount);
        }
    }

    function _removeCreationThreshold(address token) internal {
        Locking[] storage p = param.creationThreshold;
        for (uint256 i = 0; i < p.length; i++) {
            Locking memory dlg = p[i];
            if (dlg.token == token) {
                if (i != p.length - 1) {
                    p[i] = p[p.length - 1];
                }
                p.pop();
                emit RemoveCreationThreshold(token);
                return;
            }
        }
    }
}
