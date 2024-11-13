# Genesis contract

- 0x4e59b44847b379578588920ca78fbf26c0b4956c [DeterministicCreate2Deployer](https://github.com/Arachnid/deterministic-deployment-proxy)
- 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24 [EIP-1820](https://eips.ethereum.org/EIPS/eip-1820) Pseudo-introspection Registry Contract
- 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2 [Create2Deployer](https://optimistic.etherscan.io/address/0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2#code)
- 0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02 [EIP-4788](https://eips.ethereum.org/EIPS/eip-4788) Beacon Roots contract
- 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed [CreateX](https://github.com/pcaversaccio/createx)
- 0xcA11bde05977b3631167028862bE2a173976CA11 [Multicall3](https://www.multicall3.com/)

# How to create a genesis file

1. Install foundry

https://book.getfoundry.sh/getting-started/installation

by the way, you need to have node lts and the latest go installed as well

2. Prepare your configuration

There is an example, please check out [genesis/testnet3.ts](../genesis/testnet3.ts) for the details

In short, you will have a file named `mynet.ts` in the `genesis` directory if your network name is `mynet`

3. Generate

if your chain id is `48815`, you will have the following commands

```sh
anvil --auto-impersonate --chain-id=48815
```

```sh
npx hardhat create:genesis --network genesis --name mynet
```

You will have `mynet.json` in the genesis directory.
