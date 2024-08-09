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

npm run create-local
npm run deploy-local
```
