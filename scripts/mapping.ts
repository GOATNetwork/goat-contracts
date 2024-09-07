import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw, Paid, Canceling, Canceled, RBF, Refund } from "../generated/Bridge/Bridge";
import { BridgeTxn, BridgeTxnWidIndex, PaidTxn } from "../generated/schema";

function loadAndUpdateBridgeTxn(id: string, updateFn: (txn: BridgeTxn) => void): void {
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

  updateFn(bridgeTxn); // Perform the update through the passed function

  bridgeTxn.save();
}


export function handleCanceling(event: Canceling): void {
  const id = event.params.id.toString();
  log.info('Handling Canceling event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, (txn) => {
    txn.status = "Canceling";
    log.info("Updated BridgeTxn status to {}", [txn.status]);
  });
}

export function handleCanceled(event: Canceled): void {
  const id = event.params.id.toString();
  log.info('Handling Canceled event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, (txn) => {
    txn.status = "Canceled";
    log.info("Updated BridgeTxn status to {}", [txn.status]);
  });
}

export function handleRefund(event: Refund): void {
  const id = event.params.id.toString();
  log.info('Handling Refund event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, (txn) => {
    txn.status = "Refunded";
    log.info("Updated BridgeTxn status to {}", [txn.status]);
  });
}

export function handleRBF(event: RBF): void {
  const id = event.params.id.toString();
  log.info('Handling RBF event for ID {}', [id]);
  loadAndUpdateBridgeTxn(id, (txn) => {
    txn.status = "RBF";
    txn.maxTxPrice = event.params.maxTxPrice;
    log.info("Updated BridgeTxn status to {} and Max Tx Price {}", [txn.status, txn.maxTxPrice]);
  });
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
  const id = event.params.id.toString();
  const transactionHash = event.transaction.hash.toHex();

  log.info('Handling Paid event for transaction {}', [transactionHash]);

  const paidTxn = new PaidTxn(transactionHash);
  paidTxn.withdrawId = id;
  paidTxn.btcTxid = event.params.txid;
  paidTxn.btcTxout = event.params.txout.toI32();
  paidTxn.value = event.params.value;
  paidTxn.status = "Paid";
  paidTxn.save();

  log.info('Updated BridgeTxn status to Paid and BTC Txid for ID: {}', [id]);
  loadAndUpdateBridgeTxn(id, (txn) => {
    txn.status = "Paid";
    txn.btcTxid = event.params.txid;
    log.info("Updated BridgeTxn status to {} and BTC Txid {}", [txn.status, txn.btcTxid])
  });
}
