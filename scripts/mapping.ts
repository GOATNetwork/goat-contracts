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
import { TokenEntity, ValidatorEntity, LockingEntity, UnlockEntity, ClaimEntity, LockingStatsEntity } from "../generated/schema"

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
  let token = TokenEntity.load(tokenAddress)
  if (!token) {
    token = new TokenEntity(tokenAddress)
    token.address = Bytes.fromHexString(tokenAddress)
    token.exist = true
    token.weight = BigInt.fromI32(0)
    token.limit = BigInt.fromI32(0)
    token.totalLocking = BigInt.fromI32(0)
  }
  return token
}

export function handleUpdateTokenThreshold(event: UpdateTokenThreshold): void {
  const token = ensureToken(event.params.token.toHexString())
  token.threshold = event.params.amount
  token.save()
}

export function handleUpdateTokenWeight(event: UpdateTokenWeight): void {
  const token = ensureToken(event.params.token.toHexString())
  token.weight = event.params.weight
  token.save()
}

export function handleUpdateTokenLimit(event: UpdateTokenLimit): void {
  const token = ensureToken(event.params.token.toHexString())
  token.limit = event.params.limit
  token.save()
}

export function handleGrant(event: Grant): void {
  let stats = LockingStatsEntity.load("1")
  if (!stats) {
    stats = new LockingStatsEntity("1")
    stats.totalReward = BigInt.fromI32(0)
    stats.remainReward = BigInt.fromI32(0)
    stats.claimable = false
  }
  stats.totalReward = stats.totalReward.plus(event.params.amount)
  stats.remainReward = stats.remainReward.plus(event.params.amount)
  stats.save()
}

export function handleOpenCliam(event: OpenCliam): void {
  let stats = LockingStatsEntity.load("1")
  if (!stats) {
    stats = new LockingStatsEntity("1")
    stats.totalReward = BigInt.fromI32(0)
    stats.remainReward = BigInt.fromI32(0)
  }
  stats.claimable = true
  stats.save()
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
  let validator = new ValidatorEntity(event.params.validator.toHexString())
  validator.address = event.params.validator
  validator.owner = event.params.owner
  validator.pubkeyX = event.params.pubkey[0]
  validator.pubkeyY = event.params.pubkey[1]
  validator.save()
}

export function handleLock(event: Lock): void {
  let id = event.params.validator.toHexString() + '-' + event.params.token.toHexString()
  let locking = LockingEntity.load(id)
  if (!locking) {
    locking = new LockingEntity(id)
    locking.validator = event.params.validator.toHexString()
    locking.token = event.params.token.toHexString()
    locking.amount = BigInt.fromI32(0)
  }
  locking.amount = locking.amount.plus(event.params.amount)
  locking.save()

  let token = TokenEntity.load(event.params.token.toHexString())
  if (token) {
    token.totalLocking = token.totalLocking.plus(event.params.amount)
    token.save()
  }
}

export function handleUnlock(event: Unlock): void {
  let id = event.params.id.toString()
  let unlock = new UnlockEntity(id)
  unlock.requestId = event.params.id
  unlock.validator = event.params.validator.toHexString()
  unlock.recipient = event.params.recipient
  unlock.token = event.params.token.toHexString()
  unlock.amount = event.params.amount
  unlock.completed = false
  unlock.save()

  let lockingId = event.params.validator.toHexString() + '-' + event.params.token.toHexString()
  let locking = LockingEntity.load(lockingId)
  if (locking) {
    locking.amount = locking.amount.minus(event.params.amount)
    locking.save()
  }

  let token = TokenEntity.load(event.params.token.toHexString())
  if (token) {
    token.totalLocking = token.totalLocking.minus(event.params.amount)
    token.save()
  }
}

export function handleCompleteUnlock(event: CompleteUnlock): void {
  let unlock = UnlockEntity.load(event.params.id.toString())
  if (unlock) {
    unlock.completed = true
    unlock.completedAmount = event.params.amount
    unlock.save()
  }
}

export function handleClaim(event: Claim): void {
  let id = event.params.id.toString()
  let claim = new ClaimEntity(id)
  claim.requestId = event.params.id
  claim.validator = event.params.validator.toHexString()
  claim.recipient = event.params.recipient
  claim.distributed = false
  claim.save()
}

export function handleDistributeReward(event: DistributeReward): void {
  let claim = ClaimEntity.load(event.params.id.toString())
  if (claim) {
    claim.distributed = true
    claim.distributedAmount = event.params.amount
    claim.save()
  }

  let stats = LockingStatsEntity.load("1")
  if (stats) {
    stats.remainReward = stats.remainReward.minus(event.params.amount)
    stats.save()
  }
}

export function handleChangeValidatorOwner(event: ChangeValidatorOwner): void {
  let validator = ValidatorEntity.load(event.params.validator.toHexString())
  if (validator) {
    validator.owner = event.params.owner
    validator.save()
  }
}
