import * as dotenv from "dotenv";
import { BridgeRequest, BridgeDirection } from './types';
import { supportedL1Tokens, supportedL2Tokens } from './config';
import { ethers } from "ethers";

export const isValidTokenTransfer = (token: string, direction: BridgeDirection): boolean => {
    token = token.toUpperCase();
    if (direction == BridgeDirection.L1_TO_L2) {
        return supportedL1Tokens.includes(token);
    }
    if (direction == BridgeDirection.L2_TO_L1) {
        return supportedL2Tokens.includes(token);
    }
    return false;
  }

export const validateAmount = (amount: number): ethers.BigNumber | null => {
    try {
        return ethers.utils.parseEther(amount.toString());
    } catch(error) {
        console.log(error);
        return null;
    }
}

export const validateEnoughBalance = (amount: ethers.BigNumber) => {
    
}