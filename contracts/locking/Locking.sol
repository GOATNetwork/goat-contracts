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
import {RateLimiter} from "../library/utils/RateLimiter.sol";

/**
 * Note
 *
 * a validator can have only 1 consensus request per block
 *
 * all validators can have up to 32 consensus requests per block
 *
 * the restriction is to prevent DoS attack, you have to obey the rule
 */

contract Locking is Ownable, RateLimiter, BaseAccess, ILocking {
    using SafeERC20 for IERC20;
    using Pubkey for bytes32[2];

    address public immutable goatToken;

    // the consensus request id, +1 every request
    uint64 internal reqId;

    uint256 public remainReward;

    // threshold for validator creation
    address[] internal threshold;

    // claimable represents current status of reward claiming
    bool public claimable;

    mapping(address validator => address owner) public owners;

    // token config for locking
    mapping(address token => Token config) public tokens;

    // locking values
    mapping(address token => uint256 amount) public totalLocking;
    mapping(address validator => mapping(address token => uint256 amount))
        public locking;

    // unclaimed goat balances before goat token is enabled
    mapping(address owner => uint256 amount) public unclaimed;

    uint64 public constant MAX_WEIGHT = 1e6;

    uint256 public constant MAX_TOKEN_SIZE = 8;

    constructor(
        address owner,
        address goat,
        uint256 totalReward
    ) Ownable(owner) RateLimiter(32, true) {
        goatToken = goat;
        remainReward = totalReward;
    }

    /**
     * grant sends goat token to the reward pool
     * @param amount the amount
     */
    function grant(uint256 amount) external override onlyOwner {
        require(amount > 0, "invalid amount");
        IERC20(goatToken).safeTransferFrom(msg.sender, address(this), amount);
        remainReward += amount;
        emit Grant(amount);
    }

    modifier OnlyValidatorOwner(address validator) {
        address owner = owners[validator];
        require(owner != address(0), "validator not found");
        require(owner == msg.sender, "not validator owner");
        _;
    }

    /**
     * create creates a new validator
     * @param pubkey the validator secp256k1 public key
     * @param sigR the validator sig
     * @param sigS the validator sig
     * @param sigV the validator sig
     *
     * the pubkey, an uncompressed secp256k1 public key
     * the first index represents the X-coordinate and second is the Y-coordinate
     *
     * the validator address =
     * ripemd160(sha256(compressed pubkey))
     *
     * the data to sign =
     * keccak256(abi.encodePacked(block.chainid, validator address, validator owner(msg.sender)))
     * it includes the validator address to prevent usage error
     *
     * the msg.sender will be the owner of the validator, and an owner can have multiple validators
     */
    function create(
        bytes32[2] calldata pubkey,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable override {
        require(threshold.length > 0, "not started");

        address validator = pubkey.ConsAddress();
        bytes32 hash = keccak256(
            abi.encodePacked(block.chainid, validator, msg.sender)
        );
        require(
            pubkey.EthAddress() == ECDSA.recover(hash, sigV, sigR, sigS),
            "signer mismatched"
        );
        require(owners[validator] == address(0), "duplicated");
        _checkLimiting(validator, threshold.length + 1);

        owners[validator] = msg.sender;
        emit Create(validator, msg.sender, pubkey);
        _lock(validator, creationThreshold());
    }

    /**
     * lock locks new tokens to a validator
     * @param validator the validator address
     * @param values the Locking values
     *
     * only the validator owner can lock new tokens to prevent mistakes
     */
    function lock(
        address validator,
        Locking[] calldata values
    )
        external
        payable
        override
        OnlyValidatorOwner(validator)
        RateLimiting2(validator, values.length)
    {
        require(
            values.length > 0 && values.length <= MAX_TOKEN_SIZE,
            "invalid tokens size"
        );
        _lock(validator, values);
    }

    /**
     * changeValidatorOwner transfers the validator owner to a new address
     * @param validator the validator address
     * @param newOwner the new owner address, the new owner can have a validator before
     */
    function changeValidatorOwner(
        address validator,
        address newOwner
    ) external OnlyValidatorOwner(validator) {
        require(newOwner != address(0), "invalid address");
        owners[validator] = newOwner;
        emit ChangeValidatorOwner(validator, newOwner);
    }

    /**
     * unlock withdraws tokens from consensus layer
     * @param validator the validator address
     * @param recipient the recipient address
     * @param values the token to unlock
     *
     * we don't have a storage slot and a function to keep the recipient for the validator
     * you can have a contract to control the recipient
     *
     * if the validator is slashed, the actual amount will be less than the request amount
     *
     * the consensus layer will send back a `completeUnlock` tx for the unlock
     */
    function unlock(
        address validator,
        address recipient,
        Locking[] calldata values
    )
        external
        override
        OnlyValidatorOwner(validator)
        RateLimiting2(validator, values.length)
    {
        require(
            values.length > 0 && values.length <= MAX_TOKEN_SIZE,
            "invalid tokens size"
        );
        require(recipient != address(0), "invalid recipient");
        for (uint256 i = 0; i < values.length; i++) {
            Locking memory d = values[i];
            require(d.amount > 0, "invalid amount");
            locking[validator][d.token] -= d.amount;
            totalLocking[d.token] -= d.amount;
            emit Unlock(reqId++, validator, recipient, d.token, d.amount);
        }
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
    ) external override OnlyLockingExecutor {
        if (token != address(0) && amount > 0) {
            IERC20(token).safeTransfer(recipient, amount);
        }
        // sends back the native token in the runtime
        emit CompleteUnlock(id, amount);
    }

    /**
     * openClaim let claim is open
     */
    function openClaim() external onlyOwner {
        require(!claimable, "claim is open");
        claimable = true;
        emit OpenCliam();
    }

    /**
     * claim claims rewards
     * @param validator the validator address
     * @param recipient the reward recipient address
     *
     * we don't have a storage slot and a function to keep the recipient for the validator
     * you can have a contract to control the recipient
     *
     * the consensus layer will send back a `distributeReward` tx for the claiming
     */
    function claim(
        address validator,
        address recipient
    ) external override OnlyValidatorOwner(validator) RateLimiting {
        require(recipient != address(0), "invalid recipient");
        emit Claim(reqId++, validator, recipient);
    }

    /**
     * distributeReward distributes reward which includes the goat token and gas fee
     * @param id the request id
     * @param recipient the reward recipient address
     * @param goat the goat reward
     * @param gasReward the gas fee reward
     */
    function distributeReward(
        uint64 id,
        address recipient,
        uint256 goat,
        uint256 gasReward
    ) external override OnlyLockingExecutor {
        if (remainReward < goat) {
            goat = remainReward;
        }

        // performing the native token adding in the runtime
        if (goat != 0) {
            if (claimable) {
                IERC20(goatToken).safeTransfer(recipient, goat);
            } else {
                unclaimed[recipient] += goat;
            }
            remainReward -= goat;
        }
        emit DistributeReward(id, goat, gasReward);
    }

    /**
     * reclaim withdraws accumulated goat tokens when claim is available
     */
    function reclaim() external {
        require(claimable, "claim is not open");
        uint256 amount = unclaimed[msg.sender];
        require(amount > 0, "no unclaimed");
        unclaimed[msg.sender] = 0;
        IERC20(goatToken).safeTransfer(msg.sender, amount);
    }

    /**
     * creationThreshold is the threshold to create a new validator
     */
    function creationThreshold()
        public
        view
        override
        returns (Locking[] memory)
    {
        Locking[] memory res = new Locking[](threshold.length);
        for (uint256 i = 0; i < threshold.length; i++) {
            address addr = threshold[i];
            res[i] = Locking(addr, tokens[addr].threshold);
        }
        return res;
    }

    /**
     * addToken adds new a token
     * @param token the token address
     * @param weight the weight for the validator power
     * @param limit the lock limit, 0 represents no limit
     * @param thrs the creation threshold, add it to the list if it's not 0
     */
    function addToken(
        address token,
        uint64 weight,
        uint256 limit,
        uint256 thrs
    ) external override onlyOwner {
        require(!tokens[token].exist, "token exists");
        if (token != address(0)) {
            require(IERC20Metadata(token).decimals() == 18, "invalid decimals");
        }

        require(weight > 0 && weight < MAX_WEIGHT, "invalid weight");
        tokens[token] = Token(true, weight, limit, thrs);
        emit UpdateTokenWeight(token, weight);
        emit UpdateTokenLimit(token, limit);

        if (thrs > 0) {
            require(limit == 0 || limit >= thrs, "limit < threshold");
            require(
                threshold.length < MAX_TOKEN_SIZE,
                "threshold length too large"
            );
            threshold.push(token);
            emit UpdateTokenThreshold(token, thrs);
        }
    }

    /**
     * setTokenWeight updates token weight
     * @param token the locking token address, the token's decimals must be 18
     * @param weight the weight for the validator power
     * if weight is 0, the token will be not able to lock
     */
    function setTokenWeight(
        address token,
        uint64 weight
    ) external override onlyOwner {
        require(tokens[token].exist, "token not found");
        require(weight < MAX_WEIGHT, "invalid weight");

        emit UpdateTokenWeight(token, weight);

        if (weight != 0) {
            tokens[token].weight = weight;
            return;
        }

        bool remove = tokens[token].threshold > 0;
        delete tokens[token];
        if (!remove) {
            return;
        }

        // we can delete all from the threshold list, then we don't allow to create a new validator
        for (uint256 i = 0; i < threshold.length; i++) {
            if (threshold[i] != token) {
                continue;
            }

            if (i != threshold.length - 1) {
                threshold[i] = threshold[threshold.length - 1];
            }
            threshold.pop();
            emit UpdateTokenThreshold(token, 0);
            return;
        }
    }

    /**
     * setTokenLimit updates token limit
     * @param token the token address
     * @param limit the lock limit, 0 represents no limit
     */
    function setTokenLimit(
        address token,
        uint256 limit
    ) external override onlyOwner {
        require(tokens[token].exist, "token not found");
        tokens[token].limit = limit;
        emit UpdateTokenLimit(token, limit);
    }

    /**
     * setThreshold upserts current validator creation threshold for the token
     * @param token the locking token to update
     * @param amount the new amount, if the amount is 0, then removes it from the list
     */
    function setThreshold(
        address token,
        uint256 amount
    ) external override onlyOwner {
        require(tokens[token].exist, "token not found");

        uint256 thres = tokens[token].threshold;
        require(thres != amount, "no changes");

        tokens[token].threshold = amount;
        emit UpdateTokenThreshold(token, amount);

        if (thres == 0 && amount > 0) {
            require(
                threshold.length < MAX_TOKEN_SIZE,
                "threshold length too large"
            );
            threshold.push(token);
            return;
        }

        if (thres > 0 && amount > 0) {
            return;
        }

        // remove
        for (uint256 i = 0; i < threshold.length; i++) {
            if (threshold[i] != token) {
                continue;
            }

            if (i != threshold.length - 1) {
                threshold[i] = threshold[threshold.length - 1];
            }
            threshold.pop();
            return;
        }
    }

    function getAddressByPubkey(
        bytes32[2] calldata pubkey
    ) public pure override returns (address, address) {
        return (pubkey.ConsAddress(), pubkey.EthAddress());
    }

    function _lock(address validator, Locking[] memory values) internal {
        uint256 msgValue = msg.value;
        for (uint256 i = 0; i < values.length; i++) {
            Locking memory d = values[i];
            Token memory t = tokens[d.token];

            require(d.amount > 0, "invalid amount");
            require(t.weight > 0, "not lockable token");

            // the threshold changed
            uint256 locked = locking[validator][d.token];
            if (locked < t.threshold) {
                require(d.amount >= t.threshold - locked, "below threshold");
            }

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
        require(msgValue == 0, "msg.value more than locked");
    }
}
