# GOAT Contracts

This package contains the genesis smart contracts for the GOAT.

## Predeployed contracts

We have a few contracts that are predeployed on the GOAT network.

The addresses are hardcoded in the genesis file.

| Name                | Address                                                                                   | Description                           |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| WrappedGoatBitcoin  | [0xbC10000000000000000000000000000000000000](./contracts/bitcoin/WrappedBitcoin)          | Native Wrapped Token(WETH9+EIP712)    |
| GoatDAO             | [0xBC10000000000000000000000000000000000Da0](./contracts/goat/GoatDAO.sol)                | Governance                            |
| GoatToken           | [0xbC10000000000000000000000000000000000001](./contracts/goat/GoatToken.sol)              | Goat ERC20                            |
| GoatFoundation      | [0xBc10000000000000000000000000000000000002](./contracts/goat/GoatFoundation.sol)         | The GOAT Foundation                   |
| Bridge              | [0xBC10000000000000000000000000000000000003](./contracts/bridge/Bridge.sol)               | Native Bitcoin bridge                 |
| Locking             | [0xbC10000000000000000000000000000000000004](./contracts/locking/Locking.sol)             | PoS Entrypoint                        |
| BitcoinBlocks       | [0xbc10000000000000000000000000000000000005](./contracts/bitcoin/Bitcoin.sol)             | L1 state oracle                       |
| Relayer             | [0xBC10000000000000000000000000000000000006](./contracts/relayer/Relayer.sol)             | Relayer Entrypoint                    |
| LockingTokenFactory | [0xBc10000000000000000000000000000000000007](./contracts/locking/LockingTokenFactory.sol) | wrapper for non-standard ERC20 tokens |
