import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw, Paid, Canceling, Canceled, RBF, Refund } from "../generated/Bridge/Bridge";
import { BridgeTxn, BridgeTxnWidIndex, PaidTxn } from "../generated/schema";

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
  loadAndUpdateBridgeTxn(id, "Pending", null, event.params.maxTxPrice);
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
