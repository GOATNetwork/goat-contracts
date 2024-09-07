import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw, Paid, Canceling, Canceled, RBF, Refund } from "../generated/Bridge/Bridge";
import { BridgeTxn, BridgeTxnWidIndex, PaidTxn } from "../generated/schema";

function updateBridgeTxnStatus(id: string, status: string): void {
  const index = BridgeTxnWidIndex.load(id);
  if (index) {
    const bridgeTxn = BridgeTxn.load(index.bridgeTxnId);
    if (bridgeTxn) {
      bridgeTxn.status = status;
      bridgeTxn.save();
      log.info(`Updated BridgeTxn status to {} for ID: {}`, [status, id]);
    } else {
      log.warning(`BridgeTxn entity not found for {}: {}`, [status, id]);
    }
  } else {
    log.warning(`BridgeTxnWidIndex entity not found for {}: {}`, [status, id]);
  }
}

function updateBridgeTxnBtcTxid(id: string, btcTxid: Bytes): void {
  const index = BridgeTxnWidIndex.load(id);
  if (index) {
    const bridgeTxn = BridgeTxn.load(index.bridgeTxnId);
    if (bridgeTxn) {
      bridgeTxn.btcTxid = btcTxid;
      bridgeTxn.save();
      log.info(`Updated BridgeTxn btcTxid to {} for ID: {}`, [btcTxid.toHex(), id]);
    } else {
      log.warning(`BridgeTxn entity notfound for {}: {}`, [btcTxid.toHex(), id]);
    }
  } else {
    log.warning(`BridgeTxnWidIndex entity not found for {}: {}`, [btcTxid.toHex(), id]);
  }
}

function updateBridgeTxnMaxTxPrice(id : string, maxTxPrice : BigInt): void {
  const index = BridgeTxnWidIndex.load(id);
  if (index) {
    const bridgeTxn = BridgeTxn.load(index.bridgeTxnId);
    if (bridgeTxn) {
      bridgeTxn.maxTxPrice = maxTxPrice;
      bridgeTxn.save();
      log.info(`Updated BridgeTxn maxTxPrice to {} for ID: {}`, [maxTxPrice.toString(), id]);
    } else {
      log.warning(`BridgeTxn entity not found for {}: {}`, [maxTxPrice.toString(), id]);
    }
  } else {
    log.warning(`BridgeTxnWidIndex entity not found for {}: {}`, [maxTxPrice.toString(), id]);
  }
}

export function handleCanceling(event: Canceling): void {
  const id = event.params.id.toString();
  log.info('Handling Canceling event for ID {}',[id]);
  updateBridgeTxnStatus(id, "Canceling");
}

export function handleCanceled(event: Canceled): void {
  const id = event.params.id.toString();
  log.info('Handling Canceled event for ID {}', [id]);
  updateBridgeTxnStatus(id, "Canceled");
}

export function handleRefund(event: Refund): void {
  const id = event.params.id.toString();
  log.info('Handling Refund event for ID {}', [id]);
  updateBridgeTxnStatus(id, "Refunded");
}

export function handleRBF(event: RBF): void {
  const id = event.params.id.toString();
  log.info('Handling RBF event for ID {}', [id]);
  updateBridgeTxnStatus(id, "RBF");
  updateBridgeTxnMaxTxPrice(id, event.params.maxTxPrice);
}

export function handleDeposit(event: Deposit): void {
  log.info('Handling Deposit event for transaction {}', [event.transaction.hash.toHex()]);
  const entity = new BridgeTxn(event.transaction.hash.toHex());
  entity.type = 0;
  entity.timestamp = event.block.timestamp;
  entity.target = event.params.target;
  entity.amount = event.params.amount;
  entity.btcTxid = event.params.txid;
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
  entity.maxTxPrice = event.params.maxTxPrice;
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
  log.info('Handling Paid event for transaction {}', [event.transaction.hash.toHex()]);
  const paidTxn = new PaidTxn(event.transaction.hash.toHex());
  paidTxn.withdrawId = event.params.id;
  paidTxn.btcTxid = event.params.txid;
  paidTxn.btcTxout = event.params.txout.toI32();
  paidTxn.value = event.params.value;
  paidTxn.status = "Paid";
  paidTxn.save();
  updateBridgeTxnStatus(event.params.id.toString(), "Paid");
  updateBridgeTxnBtcTxid(event.params.id.toString(), event.params.txid);
}
