import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { NewTaskActionFunction } from "hardhat/types/tasks";

function loadAction(modulePath: string, exportName: string) {
  return async () => {
    const actionModule = (await import(modulePath)) as Record<string, unknown>;
    const action = actionModule[exportName];
    if (typeof action !== "function") {
      throw new Error(`Missing task action ${exportName} in ${modulePath}`);
    }
    return { default: action as NewTaskActionFunction };
  };
}

const decodeError = task("decode-error", "decode error message")
  .addOption({
    name: "error",
    description: "the encoded error data",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(loadAction("./index-action.js", "decodeErrorAction"))
  .build();

const bridgeDeposited = task(
  "bridge:deposited",
  "get if deposit is done by txid and txout",
)
  .addOption({
    name: "txid",
    description: "the btc txid",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "txout",
    description: "the tx output index",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(loadAction("./bridge.js", "bridgeDepositedAction"))
  .build();

const bridgeWithdraw = task("bridge:withdraw", "send withdraw tx")
  .addOption({
    name: "address",
    description: "the receiver address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "price",
    description: "the max tx price",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .addOption({
    name: "value",
    description: "the btc value to withdraw",
    type: ArgumentType.FLOAT,
    defaultValue: 0,
  })
  .setAction(loadAction("./bridge.js", "bridgeWithdrawAction"))
  .build();

const bridgeRbf = task("bridge:rbf", "send replaceByFee tx")
  .addOption({
    name: "id",
    description: "the withdrawal id",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .addOption({
    name: "price",
    description: "the new tx price",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(loadAction("./bridge.js", "bridgeRbfAction"))
  .build();

const bridgeCancel = task("bridge:cancel", "send cancel1 tx")
  .addOption({
    name: "id",
    description: "the withdrawal id",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(loadAction("./bridge.js", "bridgeCancelAction"))
  .build();

const bridgeRefund = task("bridge:refund", "send refund tx")
  .addOption({
    name: "id",
    description: "the withdrawal id",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(loadAction("./bridge.js", "bridgeRefundAction"))
  .build();

const bridgeStatus = task("bridge:status", "get withdrawal status by id")
  .addOption({
    name: "id",
    description: "the withdrawal id",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(loadAction("./bridge.js", "bridgeStatusAction"))
  .build();

const btcGetBlockHash = task("btc:getblockhash", "get a Bitcoin block hash")
  .addOption({
    name: "rpc",
    description: "rpc endpoint",
    defaultValue: "http://localhost:8332",
  })
  .addOption({ name: "user", description: "rpc user", defaultValue: "test" })
  .addOption({
    name: "pass",
    description: "rpc password",
    defaultValue: "test",
  })
  .addOption({
    name: "height",
    description: "block height",
    type: ArgumentType.INT,
    defaultValue: 0,
  })
  .setAction(loadAction("./btcrpc.js", "btcGetBlockHashAction"))
  .build();

const btcGetBlock = task("btc:getblock", "get a Bitcoin block")
  .addOption({
    name: "rpc",
    description: "rpc endpoint",
    defaultValue: "http://localhost:8332",
  })
  .addOption({ name: "user", description: "rpc user", defaultValue: "test" })
  .addOption({
    name: "pass",
    description: "rpc password",
    defaultValue: "test",
  })
  .addOption({
    name: "hash",
    description: "block hash",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "height",
    description: "block height",
    type: ArgumentType.INT,
    defaultValue: 0,
  })
  .addOption({
    name: "resultVerbosity",
    description: "result verbosity",
    type: ArgumentType.INT,
    defaultValue: 1,
  })
  .setAction(loadAction("./btcrpc.js", "btcGetBlockAction"))
  .build();

const createGenesis = task("create:genesis", "create a GOAT genesis file")
  .addOption({
    name: "name",
    description: "network name",
    defaultValue: "regtest",
  })
  .addOption({
    name: "force",
    description: "force to rewrite",
    type: ArgumentType.BOOLEAN,
    defaultValue: false,
  })
  .addOption({
    name: "param",
    description: "optional parameter file path",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "gensrv",
    description: "optional genesis server",
    defaultValue: process.env.GENESIS_SERVER_URL ?? "http://localhost:8080",
  })
  .setAction(loadAction("./genesis.js", "createGenesisAction"))
  .build();

const lockingCreate = task("locking:create", "Create a new validator")
  .addOption({
    name: "validator",
    description: "the validator address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "owner",
    description: "the validator owner",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "pubkey",
    description: "the validator pubkey in hex format",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "signature",
    description: "the signature proving the validator ownership",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(loadAction("./lock.js", "lockingCreateAction"))
  .build();

const relayerAdd = task("relayer:add", "send addVoter tx")
  .addOption({
    name: "address",
    description: "address used with vk-hash",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "vkHash",
    description: "vote key hash used with address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "txKey",
    description: "transaction public key used with vote-key",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "voteKey",
    description: "vote public key used with tx-key",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(loadAction("./relayer.js", "relayerAddAction"))
  .build();

const relayerRemove = task("relayer:remove", "send removeVoter tx")
  .addOption({
    name: "address",
    description: "the voter address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(loadAction("./relayer.js", "relayerRemoveAction"))
  .build();

export const projectTasks = [
  decodeError,
  bridgeDeposited,
  bridgeWithdraw,
  bridgeRbf,
  bridgeCancel,
  bridgeRefund,
  bridgeStatus,
  btcGetBlockHash,
  btcGetBlock,
  createGenesis,
  lockingCreate,
  relayerAdd,
  relayerRemove,
];
