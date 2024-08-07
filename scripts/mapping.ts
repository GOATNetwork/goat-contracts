import { Deposit } from '../generated/Bridge/Bridge'
import { Deposit as DS } from '../generated/schema'

export function handleDeposit(event: Deposit): void {
  let entity = new DS(event.params.id.toHex())
  entity.id = event.params.id.toHex()
  entity.target = event.params.target
  entity.amount = event.params.amount
  entity.txid = event.params.txid
  entity.txout = event.params.txout.toI32()
  entity.tax = event.params.tax
  entity.save()
}

