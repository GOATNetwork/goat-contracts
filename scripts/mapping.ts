import { Deposit } from '../generated/Bridge/Bridge'
import { Deposit as DS } from '../generated/schema'

export function handleDeposit(event: Deposit): void {
  let entity = new DS(event.transaction.hash.toHex())
  entity.target = event.params.target
  entity.amount = event.params.amount
  entity.btcTxid = event.params.txid
  entity.btcTxout = event.params.txout.toI32()
  entity.tax = event.params.tax
  entity.save()
}

