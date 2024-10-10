export interface Param {
    GoatToken: GoatTokenParam;
    GoatFoundation: GoatFoundationParam;
    GoatDAO: {};
    Bridge: BridgeParam;
    Bitcoin: BitcoinParam;
    WrappedBitcoin: {};
    Relayer: RelayerParam;
    Locking: LockingParam;
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
    voters: Array<{ txKey?: string, voteKey?: string, address?: string, voteKeyHash?: string }>;
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
        prvkey?: string;
        pubkey?: string;
        signature?: string;
    }>;
    gas: string | number;
}

export interface BridgeParam {
    owner: string;
    depositTaxBP?: number | string;
    maxDepositTax?: number | string;
    withdrawalTaxBP?: number | string;
    maxWithdrawalTax?: number | string;
    minWithdrawal?: number | string;
}
