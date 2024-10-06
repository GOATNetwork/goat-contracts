import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw, Paid, Canceling, Canceled, RBF, Refund } from "../generated/Bridge/Bridge";
import { BridgeTxn, BridgeTxnWidIndex, PaidTxn } from "../generated/schema";
import {
  UpdateTokenThreshold,
  UpdateTokenWeight,
  UpdateTokenLimit,
  Grant,
  OpenCliam,
  Create,
  Lock,
  Unlock,
  CompleteUnlock,
  Claim,
  DistributeReward,
  ChangeValidatorOwner
} from "../generated/Locking/Locking"
import { TokenEntity, ValidatorEntity, LockingEntity, UnlockEntity, ClaimEntity, LockingStatsEntity, RequestCounter } from "../generated/schema"

function loadAndUpdateBridgeTxn(id: string, newStatus: string, newBtcTxid: Bytes | null = null, newMaxTxPrice: BigInt | null = null): void {
  const index = BridgeTxnWidIndex.load(id);
  if (!index) {
    log.warning(`BridgeTxnWidIndex not found for ID: {}`, [id]);
    return;
  }

  const bridgeTxn = BridgeTxn.load(index.bridgeTxnId);
  if (!bridgeTxn) {
    log.warning(`BridgeTxn not found for ID: {}`, [id]);
    return;
  }

  bridgeTxn.status = newStatus;
  if (newBtcTxid !== null) {
    bridgeTxn.btcTxid = newBtcTxid;
  }
  if (newMaxTxPrice !== null) {
    bridgeTxn.maxTxPrice = newMaxTxPrice;
  }

  bridgeTxn.save();
  log.info(`BridgeTxn updated for ID: {}. New status: {}, BTC Txid: {}, Max Tx Price: {}`, [
    id,
    newStatus,
    newBtcTxid ? newBtcTxid.toHex() : "N/A",
    newMaxTxPrice ? newMaxTxPrice.toString() : "N/A"
  ]);
}

export function handleCanceling(event: Canceling): void {
  const id = event.params.id.toString();
  log.info('Handling Canceling event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, "Canceling");
}

export function handleCanceled(event: Canceled): void {
  const id = event.params.id.toString();
  log.info('Handling Canceled event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, "Canceled");
}

export function handleRefund(event: Refund): void {
  const id = event.params.id.toString();
  log.info('Handling Refund event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, "Refunded");
}

export function handleRBF(event: RBF): void {
  const id = event.params.id.toString();
  log.info('Handling RBF event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, "Pending", null, BigInt.fromI32(event.params.maxTxPrice));
}


export function handleDeposit(event: Deposit): void {
  log.info('Handling Deposit event for transaction {}', [event.transaction.hash.toHex()]);
  const entity = new BridgeTxn(event.transaction.hash.toHex());
  entity.type = 0;
  entity.timestamp = event.block.timestamp;
  entity.target = event.params.target;
  entity.amount = event.params.amount;
  entity.btcTxid = Bytes.fromUint8Array(event.params.txid.reverse());
  entity.btcTxout = event.params.txout.toI32();
  entity.tax = event.params.tax;
  entity.withdrawId = null;
  entity.maxTxPrice = BigInt.zero();
  entity.receiver = "";
  entity.status = "Deposited";
  entity.save();
  log.info('Saved Deposit entity with hash {}', [event.transaction.hash.toHex()]);
}

export function handleWithdrawal(event: Withdraw): void {
  log.info('Handling Withdrawal event for transaction {}', [event.transaction.hash.toHex()]);
  const entity = new BridgeTxn(event.transaction.hash.toHex());
  entity.type = 1;
  entity.timestamp = event.block.timestamp;
  entity.withdrawId = event.params.id;
  entity.amount = event.params.amount;
  entity.maxTxPrice = BigInt.fromI32(event.params.maxTxPrice);
  entity.receiver = event.params.receiver;
  entity.target = event.params.from;
  entity.tax = event.params.tax;
  entity.btcTxid = Bytes.empty();
  entity.btcTxout = 0;
  entity.status = "Pending";
  entity.save();

  const index = new BridgeTxnWidIndex(event.params.id.toString());
  index.bridgeTxnId = entity.id;
  index.save();

  log.info('Saved Withdrawal entity and index with ID {}', [event.params.id.toString()]);
}

export function handlePaid(event: Paid): void {
  const transactionHash = event.transaction.hash.toHex();

  log.info('Handling Paid event for transaction {}', [transactionHash]);

  const paidTxn = new PaidTxn(transactionHash);
  paidTxn.withdrawId = event.params.id;
  paidTxn.btcTxid = event.params.txid;
  paidTxn.btcTxout = event.params.txout.toI32();
  paidTxn.value = event.params.value;
  paidTxn.status = "Paid";
  paidTxn.save();

  const id = event.params.id.toString();
  const btcTxid = event.params.txid;
  loadAndUpdateBridgeTxn(id, "Paid", btcTxid);
}

function ensureToken(tokenAddress: string): TokenEntity {
  log.info('Ensuring token exists for address: {}', [tokenAddress])
  let token = TokenEntity.load(tokenAddress)
  if (!token) {
    log.info('Token not found. Creating new TokenEntity for address: {}', [tokenAddress])
    token = new TokenEntity(tokenAddress)
    token.address = Bytes.fromHexString(tokenAddress)
    token.exist = true
    token.weight = BigInt.fromI32(0)
    token.limit = BigInt.fromI32(0)
    token.totalLocking = BigInt.fromI32(0)
    token.threshold = BigInt.fromI32(0) // Adding default threshold
    log.info('New TokenEntity created with default values for address: {}', [tokenAddress])
  } else {
    log.info('Existing TokenEntity found for address: {}', [tokenAddress])
  }
  return token
}

export function handleUpdateTokenThreshold(event: UpdateTokenThreshold): void {
  log.info('Handling UpdateTokenThreshold event for token: {}', [event.params.token.toHexString()])
  const token = ensureToken(event.params.token.toHexString())
  log.info('Token loaded. Current threshold: {}', [token.threshold.toString()])
  log.info('New threshold from event: {}', [event.params.amount.toString()])
  token.threshold = event.params.amount
  token.save()
  log.info('Token threshold updated. New threshold: {}', [token.threshold.toString()])
}

export function handleUpdateTokenWeight(event: UpdateTokenWeight): void {
  log.info('Handling UpdateTokenWeight event for token: {}', [event.params.token.toHexString()])
  const token = ensureToken(event.params.token.toHexString())
  log.info('Token loaded. Current weight: {}', [token.weight.toString()])
  log.info('New weight from event: {}', [event.params.weight.toString()])
  token.weight = event.params.weight
  token.save()
  log.info('Token weight updated and saved. New weight: {}', [token.weight.toString()])
}

export function handleUpdateTokenLimit(event: UpdateTokenLimit): void {
  log.info('Handling UpdateTokenLimit event for token: {}', [event.params.token.toHexString()])
  const token = ensureToken(event.params.token.toHexString())
  log.info('Token loaded. Current limit: {}', [token.limit.toString()])
  log.info('New limit from event: {}', [event.params.limit.toString()])
  token.limit = event.params.limit
  token.save()
  log.info('Token limit updated and saved. New limit: {}', [token.limit.toString()])
}

export function handleGrant(event: Grant): void {
  log.info('Handling Grant event with amount: {}', [event.params.amount.toString()])
  let stats = LockingStatsEntity.load("1")
  if (!stats) {
    log.info('LockingStatsEntity not found. Creating new entity.', [])
    stats = new LockingStatsEntity("1")
    stats.totalReward = BigInt.fromI32(1000).times(BigInt.fromI32(10).pow(18))
    stats.remainReward = BigInt.fromI32(1000).times(BigInt.fromI32(10).pow(18))
    stats.claimable = false
    log.info('New LockingStatsEntity created with initial values', [stats.totalReward.toString(), stats.remainReward.toString()])
  }
  log.info('Previous totalReward: {}, remainReward: {}', [stats.totalReward.toString(), stats.remainReward.toString()])
  stats.totalReward = stats.totalReward.plus(event.params.amount)
  stats.remainReward = stats.remainReward.plus(event.params.amount)
  stats.save()
  log.info('LockingStatsEntity updated. New totalReward: {}, remainReward: {}', [stats.totalReward.toString(), stats.remainReward.toString()])
}

export function handleOpenCliam(event: OpenCliam): void {
  log.info('Handling OpenClaim event', [])
  let stats = LockingStatsEntity.load("1")
  if (!stats) {
    log.info('LockingStatsEntity not found. Creating new entity.', [])
    stats = new LockingStatsEntity("1")
    stats.totalReward = BigInt.fromI32(0)
    stats.remainReward = BigInt.fromI32(0)
    log.info('New LockingStatsEntity created with zero values', [])
  }
  log.info('Previous claimable status: {}', [stats.claimable.toString()])
  stats.claimable = true
  stats.save()
  log.info('LockingStatsEntity updated. New claimable status: true', [stats.claimable.toString()])
}


/*
{
  "id": "0x1234...abcd",
  "address": "0x1234...abcd",
  "owner": "0x5678...efgh",
  "pubkeyX": "0xabcdef1234...",
  "pubkeyY": "0x9876fedcba...",
  "lockings": [
    {
      "id": "0x1234...abcd-0x1234...abcd",
      "validator": "0x1234...abcd",
      "token": "0x1234...abcd",
      "amount": "1000000000000000000"
    },
    {
      "id": "0x1234...abcd-0x1234...abcd",
      "validator": "0x1234...abcd",
      "token": "0x1234...abcd",
      "amount": "1000000000000000000"
    },
    {
      "id": "0x1234...abcd-0x1234...abcd",
      "validator": "0x1234...abcd",
      "token": "0x1234...abcd",
      "amount": "1000000000000000000"
    }
  ],
  "claims": [
    {
      "id": "0x1234...abcd-0x1234...abcd",
      "requestId": "1",
      "validator": "0x1234...abcd",
      "recipient": "0x5678...efgh",
      "distributed": false,
      "distributedAmount": "0"
    },
    {
      "id": "0x1234...abcd-0x1234...abcd",
      "requestId": "2",
      "validator": "0x1234...abcd",
      "recipient": "0x5678...efgh",
      "distributed": false,
      "distributedAmount": "0"
    }
  ]
}
*/
export function handleCreate(event: Create): void {
  log.info('Handling Create event for validator: {}', [event.params.validator.toHexString()])
  let validator = new ValidatorEntity(event.params.validator.toHexString())
  validator.address = event.params.validator
  validator.owner = event.params.owner
  validator.pubkeyX = event.params.pubkey[0]
  validator.pubkeyY = event.params.pubkey[1]
  validator.save()
  log.info('New ValidatorEntity created for address: {}', [event.params.validator.toHexString()])
}

export function handleLock(event: Lock): void {
  log.info('Handling Lock event for validator: {} and token: {}', [event.params.validator.toHexString(), event.params.token.toHexString()])
  let id = event.params.validator.toHexString() + '-' + event.params.token.toHexString()
  let locking = LockingEntity.load(id)
  if (!locking) {
    log.info('LockingEntity not found. Creating new entity with ID: {}', [id])
    locking = new LockingEntity(id)
    locking.validator = event.params.validator.toHexString()
    locking.token = event.params.token.toHexString()
    locking.amount = BigInt.fromI32(0)
  }
  log.info('Previous locking amount: {}', [locking.amount.toString()])
  locking.amount = locking.amount.plus(event.params.amount)
  locking.save()
  log.info('LockingEntity updated. New amount: {}', [locking.amount.toString()])

  let token = TokenEntity.load(event.params.token.toHexString())
  if (token) {
    log.info('Updating TokenEntity totalLocking for token: {}', [event.params.token.toHexString()])
    log.info('Previous totalLocking: {}', [token.totalLocking.toString()])
    token.totalLocking = token.totalLocking.plus(event.params.amount)
    token.save()
    log.info('TokenEntity updated. New totalLocking: {}', [token.totalLocking.toString()])
  } else {
    log.warning('TokenEntity not found for address: {}', [event.params.token.toHexString()])
  }
}

export function handleUnlock(event: Unlock): void {
  log.info('Handling Unlock event for ID: {}', [event.params.id.toString()])
  let id = event.params.id.toString()
  let unlock = new UnlockEntity(id)
  unlock.requestId = event.params.id
  unlock.validator = event.params.validator.toHexString()
  unlock.recipient = event.params.recipient
  unlock.token = event.params.token.toHexString()
  unlock.amount = event.params.amount
  unlock.completed = false
  unlock.save()
  log.info('New UnlockEntity created with ID: {}', [id])

  // Update RequestCounter
  let counter = RequestCounter.load("1")
  if (!counter) {
    counter = new RequestCounter("1")
    counter.lastUnlockReqId = BigInt.fromI32(0)
    counter.lastClaimReqId = BigInt.fromI32(0)
  }
  counter.lastUnlockReqId = event.params.id
  counter.save()
  log.info('RequestCounter updated. Last Unlock reqId: {}', [event.params.id.toString()])

  let lockingId = event.params.validator.toHexString() + '-' + event.params.token.toHexString()
  let locking = LockingEntity.load(lockingId)
  if (locking) {
    log.info('Updating LockingEntity for ID: {}', [lockingId])
    log.info('Previous amount: {}', [locking.amount.toString()])
    locking.amount = locking.amount.minus(event.params.amount)
    locking.save()
    log.info('LockingEntity updated. New amount: {}', [locking.amount.toString()])
  } else {
    log.warning('LockingEntity not found for ID: {}', [lockingId])
  }

  let token = TokenEntity.load(event.params.token.toHexString())
  if (token) {
    log.info('Updating TokenEntity totalLocking for token: {}', [event.params.token.toHexString()])
    log.info('Previous totalLocking: {}', [token.totalLocking.toString()])
    token.totalLocking = token.totalLocking.minus(event.params.amount)
    token.save()
    log.info('TokenEntity updated. New totalLocking: {}', [token.totalLocking.toString()])
  } else {
    log.warning('TokenEntity not found for address: {}', [event.params.token.toHexString()])
  }
}

export function handleCompleteUnlock(event: CompleteUnlock): void {
  log.info('Handling CompleteUnlock event for ID: {}', [event.params.id.toString()])
  let unlock = UnlockEntity.load(event.params.id.toString())
  if (unlock) {
    log.info('UnlockEntity found. Updating completion status and amount', [event.params.id.toString()])
    unlock.completed = true
    unlock.completedAmount = event.params.amount
    unlock.save()
    log.info('UnlockEntity updated. Completed: true, Amount: {}', [event.params.amount.toString()])
  } else {
    log.warning('UnlockEntity not found for ID: {}', [event.params.id.toString()])
  }
}

export function handleClaim(event: Claim): void {
  log.info('Handling Claim event for ID: {}', [event.params.id.toString()])
  let id = event.params.id.toString()
  let claim = new ClaimEntity(id)
  claim.requestId = event.params.id
  claim.validator = event.params.validator.toHexString()
  claim.recipient = event.params.recipient
  claim.distributed = false
  claim.save()
  log.info('New ClaimEntity created with ID: {}', [id])

  // Update RequestCounter
  let counter = RequestCounter.load("1")
  if (!counter) {
    counter = new RequestCounter("1")
    counter.lastUnlockReqId = BigInt.fromI32(0)
    counter.lastClaimReqId = BigInt.fromI32(0)
  }
  counter.lastClaimReqId = event.params.id
  counter.save()
  log.info('RequestCounter updated. Last Claim reqId: {}', [event.params.id.toString()])
}

export function handleDistributeReward(event: DistributeReward): void {
  log.info('Handling DistributeReward event for ID: {}', [event.params.id.toString()])
  let claim = ClaimEntity.load(event.params.id.toString())
  if (claim) {
    log.info('ClaimEntity found. Updating distribution status and amount', [event.params.id.toString()])
    claim.distributed = true
    claim.distributedAmount = event.params.amount
    claim.save()
    log.info('ClaimEntity updated. Distributed: true, Amount: {}', [event.params.amount.toString()])
  } else {
    log.warning('ClaimEntity not found for ID: {}', [event.params.id.toString()])
  }

  let stats = LockingStatsEntity.load("1")
  if (stats) {
    log.info('Updating LockingStatsEntity remainReward', [event.params.amount.toString()])
    log.info('Previous remainReward: {}', [stats.remainReward.toString()])
    stats.remainReward = stats.remainReward.minus(event.params.amount)
    stats.save()
    log.info('LockingStatsEntity updated. New remainReward: {}', [stats.remainReward.toString()])
  } else {
    log.warning('LockingStatsEntity not found', [event.params.amount.toString()])
  }
}

export function handleChangeValidatorOwner(event: ChangeValidatorOwner): void {
  log.info('Handling ChangeValidatorOwner event for validator: {}', [event.params.validator.toHexString()])
  let validator = ValidatorEntity.load(event.params.validator.toHexString())
  if (validator) {
    log.info('ValidatorEntity found. Updating owner', [event.params.validator.toHexString()])
    log.info('Previous owner: {}', [validator.owner.toHexString()])
    validator.owner = event.params.owner
    validator.save()
    log.info('ValidatorEntity updated. New owner: {}', [event.params.owner.toHexString()])
  } else {
    log.warning('ValidatorEntity not found for address: {}', [event.params.validator.toHexString()])
  }
}
