import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Deposit,Withdraw } from '../generated/Bridge/Bridge'
import { Deposit as DS } from '../generated/schema'

export function handleDeposit(event: Deposit): void {
  let entity = new DS(event.transaction.hash.toHex())
  /*
  if (event.receipt) {
    entity.status = event.receipt!.status;
  } else {
    entity.status = BigInt.zero();
  }
    */
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

  entity.save()
}

export function handleWithdrawal(event: Withdraw): void {
  let entity = new DS(event.transaction.hash.toHex())
  /*
  if (event.receipt) {
    entity.status = event.receipt!.status;
  } else {
    entity.status = BigInt.zero();
  }
    */
  entity.type = 1; 
  entity.timestamp = event.block.timestamp
  entity.withdrawId = event.params.id
  entity.amount = event.params.amount
  entity.maxTxPrice = event.params.maxTxPrice
  entity.receiver = event.params.reciever
  entity.target = event.params.from
  entity.tax = event.params.tax
  
  entity.btcTxid = Bytes.empty();
  entity.btcTxout = 0; 


  entity.save()
}
