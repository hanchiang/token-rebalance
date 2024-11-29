export interface BridgeRequest {
    direction: BridgeDirection;
    token: string;  // eth, mnt
    amount: number;
    to?: string;
}

export enum BridgeDirection {
    L1_TO_L2 = 1,
    L2_TO_L1 = 2
}

export enum DepositTransactionStatus {
    SUBMITTED = 0,
    MINED = 1,
    FINALISED = 2
}