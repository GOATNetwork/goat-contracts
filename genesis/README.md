# How to create a genesis file

1. Prepare your configuration

There is an example, please check out [genesis/mainnet.ts](../genesis/mainnet.ts) for the details

In short, you will have a file named `mynet.ts` in the `genesis` directory if your network name is `mynet`

2. Start anvil server

if your chain id is `48815`, you can use following commands

```sh
docker run --name anvil --rm -p 8545:8545 --entrypoint anvil ghcr.io/foundry-rs/foundry:stable --host=0.0.0.0 --auto-impersonate --chain-id=48815 --no-request-size-limit
```

3. Start genesis server

```sh
docker run --name gensrv --rm -p 8080:8080 ghcr.io/goatnetwork/geth-gensrv:main
```

4. Generate

```sh
npx hardhat create:genesis --network genesis --name mynet
```

You will see a file `mynet.json` in the genesis directory.

# The PreDeployed contracts

- 0x4e59b44847b379578588920ca78fbf26c0b4956c [DeterministicCreate2Deployer](https://github.com/Arachnid/deterministic-deployment-proxy)
- 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24 [EIP-1820](https://eips.ethereum.org/EIPS/eip-1820) Pseudo-introspection Registry Contract
- 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2 [Create2Deployer](https://optimistic.etherscan.io/address/0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2#code)
- 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02 [EIP-4788](https://eips.ethereum.org/EIPS/eip-4788) Beacon Roots contract
- 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed [CreateX](https://github.com/pcaversaccio/createx)
- 0xcA11bde05977b3631167028862bE2a173976CA11 [Multicall3](https://www.multicall3.com/)
- 0x000000000022D473030F116dDEE9F6B43aC78BA3 [Permit2](https://github.com/Uniswap/permit2)
- 0xBA11eE51ecC770fC9aCdC6F2ad91528549a071De [EIP-2935](https://eips.ethereum.org/EIPS/eip-2935) Serve historical block hashes from state (**Note: GOAT uses a different address**)
- 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7 [Safe Singleton Factory](https://github.com/safe-global/safe-singleton-factory)
