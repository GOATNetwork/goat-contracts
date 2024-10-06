# Thegraph

```sh
npx hardhat node --port 8546 --hostname 0.0.0.0

npm run clean-graph-node
npm run start-graph-node

npx hardhat run --network localhost scripts/deploy.ts

npm run compile-graph
npx hardhat mock-event deposit --network localhost
npx hardhat mock-event withdraw --network localhost
npx hardhat mock-event pay --network localhost
npx hardhat mock-event cancel1 --network localhost
npx hardhat mock-event cancel2 --network localhost
npx hardhat mock-event replace --network localhost

npm run remove-local
npm run create-local
npm run deploy-local
```

### localhost

```sh
npx hardhat node --port 8546 --hostname 0.0.0.0

npm run clean-graph-node
npm run start-graph-node

npx hardhat run --network localhost scripts/deploy.ts

npm run compile-graph
npm run create-local
npm run deploy-local

npx hardhat init-params --network localhost
npx hardhat deposit --network localhost --txid <txid>
npx hardhat paid --network localhost --txid <txid> --wid <wid>
npx hardhat cancel --network localhost --wid <wid>
npx hardhat refund --network localhost --wid <wid>
```

### devnet

```sh
npm run clean-graph-node
npm run start-graph-node

npx hardhat run --network devnet scripts/deploy.ts

npm run compile-graph:devnet
npm run create-local
npm run deploy-local

npx hardhat init-params --network devnet
npx hardhat deposit --network devnet --txid <txid>
npx hardhat paid --network devnet --txid <txid> --wid <wid>
npx hardhat cancel --network devnet --wid <wid>
npx hardhat refund --network devnet --wid <wid>
```

### locking

```sh
npx hardhat init-locking --eth-threshold 1 --goat-threshold 10 --network devnet
npx hardhat create-validator --private-key <private-key> --network devnet
npx hardhat grant-rewards --amount 100 --network devnet
npx hardhat open-claim --network devnet
npx hardhat claim-rewards --validator <validator_address> --recipient <recipient_address> --network devnet
npx hardhat distribute-reward --id <request_id> --recipient <recipient_address> --goat <goat_amount> --gas-reward <gas_reward_amount> --network devnet

npx hardhat lock-token --validator 0x1fb4ec3b5df58e9b8d62fecd78ee64b4c20c92df --token 0x649FDEBeb9462f5686259614882f489e21AA3444 --amount 5 --network devnet

npx hardhat unlock-tokens --validator 0x3f691db54bf4c77a7495bf64c97ac77c369d4fa0 --recipient 0xcB2D241791622eDbD739856bdfBF6696C2BE0F32 --tokens 0x649FDEBeb9462f5686259614882f489e21AA3444 --amounts 5 --network devnet

npx hardhat complete-unlock --id 2 --recipient 0xcB2D241791622eDbD739856bdfBF6696C2BE0F32 --token 0x649FDEBeb9462f5686259614882f489e21AA3444 --amount 5 --network devnet

npx hardhat locking-info --network devnet
npx hardhat locking-validator-info --validator <validator-address> --network devnet
npx hardhat locking-token-info --token <token-address> --network devnet
npx hardhat locking-validator-tokens --validator <validator-address> --network devnet
npx hardhat locking-creation-threshold --network devnet

```
