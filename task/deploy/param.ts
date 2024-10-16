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
    voters: Array<
        | { txKey: string; voteKey: string }
        | { address: string; voteKeyHash: string }
    >;
}

export interface LockingParam {
    owner: string;
    tokens: Array<{
        address: string;
        weight: number | string;
        limit: number | string;
        threshold: number | string;
    }>;
    validators: Array<
        | { owner: string; prvkey: string }
        | { owner: string; pubkey: string; signature: string }
    >;
    strict?: boolean; // check if the deposit value is consistent with creation threshold
    gas?: string | number; // unit test only
}

export interface BridgeParam {
    owner: string;
    depositTaxBP?: number | string;
    maxDepositTaxInWei?: number | string;
    withdrawalTaxBP?: number | string;
    maxWithdrawalTax?: number | string;
    minWithdrawalInWei?: number | string;
    deposits: Array<{ txid: string; txout: number; address: string; satoshi: number; }>
}

export interface ConsensusParam {
    Bridge: { minDepositInSat: number };
    Relayer: {
        tssPubkey: string;
        acceptProposerTimeout: string; // go duration
    };
    Locking: {
        exitDuration: string; // go duration
        unlockDuration: string; // go duration
    },
}
