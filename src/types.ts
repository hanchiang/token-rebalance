export interface BridgeRequest {
    direction: BridgeDirection;
    token: string;  // eth, mnt
    amount: number;
}

export enum BridgeDirection {
    L1_TO_L2 = 1,
    L2_TO_L1 = 2
}