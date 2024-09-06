import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw, Paid, Canceling, Canceled, RBF } from "../generated/Bridge/Bridge";
import { BridgeTxn, PaidTxn } from '../generated/schema'


export function handleCanceling(event: Canceling): void {
  let id = event.params.id.toString();
  let entity = BridgeTxn.load(id);
  if (entity) {
    entity.status = "Canceling";
    entity.save();
  }
}

export function handleCanceled(event: Canceled): void {
  let id = event.params.id.toString();
  let entity = BridgeTxn.load(id);
  if (entity) {
    entity.status = "Canceled";
    entity.save();
  }
}

export function handleRBF(event: RBF): void {
  let id = event.params.id.toString();
  let entity = BridgeTxn.load(id);
  if (entity) {
    entity.maxTxPrice = event.params.maxTxPrice;
    entity.status = "RBF Updated";  // Or any other status you see fit
    entity.save();
  }
}

export function handleDeposit(event: Deposit): void {
  let entity = new BridgeTxn(event.transaction.hash.toHex())
  entity.type = 0;
  entity.timestamp = event.block.timestamp
  entity.target = event.params.target
  entity.amount = event.params.amount
  entity.btcTxid = event.params.txid
  entity.btcTxout = event.params.txout.toI32()
  entity.tax = event.params.tax

  entity.withdrawId = BigInt.zero();
  entity.maxTxPrice = BigInt.zero();
  entity.receiver = "";
  entity.status = "Pending";

  entity.save()
}

export function handleWithdrawal(event: Withdraw): void {
  let entity = new BridgeTxn(event.transaction.hash.toHex())
  entity.type = 1;
  entity.timestamp = event.block.timestamp
  entity.withdrawId = event.params.id
  entity.amount = event.params.amount
  entity.maxTxPrice = event.params.maxTxPrice
  entity.receiver = event.params.receiver
  entity.target = event.params.from
  entity.tax = event.params.tax

  entity.btcTxid = Bytes.empty();
  entity.btcTxout = 0;
  entity.status = "Pending";

  entity.save()
}

export function handlePaid(event: Paid): void {
  let entity = new PaidTxn(event.transaction.hash.toHex())

  entity.withdrawId = event.params.id
  entity.btcTxid = event.params.txid;
  entity.btcTxout = event.params.txout.toI32();
  entity.value = event.params.value
  entity.status = "Paid";

  let id = event.params.id.toString();
  let bridgeEntity = BridgeTxn.load(id);

  if (bridgeEntity) {
    bridgeEntity.status = "Paid";
    bridgeEntity.save();
    console.log(`BridgeTxn entity updated: ${id}`);
  } else {
    console.log(`BridgeTxn entity not found: ${id}`);
  }


  entity.save()
}
