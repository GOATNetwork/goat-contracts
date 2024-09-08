# Thegraph


```
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
```
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
```
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
