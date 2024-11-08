export interface Param {
  GoatToken: GoatTokenParam;
  GoatFoundation: GoatFoundationParam;
  GoatDAO: {};
  Bridge: BridgeParam;
  Bitcoin: BitcoinParam;
  WrappedBitcoin: {};
  Relayer: RelayerParam;
  Locking: LockingParam;
  Consensus: ConsensusParam;
}

export interface GoatFoundationParam {
  owner: string;
}

export interface GoatTokenParam {
  owner: string;
  transfers: Array<{ to: string; value: string | number }>;
}

export interface BitcoinParam {
  height: number;
  hash: string;
  network: string;
}

export interface RelayerParam {
  owner: string;
  voters: Array<{ address: string; txKey: string; voteKey: string }>; // the pubkey of secp256k1 and bls12-381 in G2 group
}

export interface LockingParam {
  owner: string;
  tokens: Array<{
    address: string;
    weight: number | string;
    limit: number | string;
    threshold: number | string;
  }>;
  validators: Array<{
    owner: string;
    pubkey: string;
    signature: string;
    validator: string;
  }>; // the validator list in the genesis
  strict?: boolean; // check if the deposit value is consistent with creation threshold
  gas?: string | number; // unit test only
  allowList: string[]; // the validator address list is allowed to create validator when network is running
}

// NB: the InSat suffix means that you should satoshi instead of wei

export interface BridgeParam {
  owner: string;
  depositPrefixMagic: string;
  depositTaxBP?: number | string;
  maxDepositTaxInSat?: number | string;
  withdrawalTaxBP?: number | string;
  maxWithdrawalTaxInSat?: number | string;
  minWithdrawalInSat?: number | string;
  minDepositInSat?: number | string;
  confirmationNumber?: number;
  deposits: Array<{
    txid: string;
    txout: number;
    address: string;
    satoshi: number;
  }>;
}

export interface ConsensusParam {
  Relayer: {
    tssPubkey: string;
    acceptProposerTimeout: string; // go duration
  };
  Locking: {
    exitDuration: string; // go duration
    unlockDuration: string; // go duration
  };
  Goat?: {}; // the genesis block header, don't update it manually
}
