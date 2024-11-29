import { ethers } from 'ethers';

export class InsufficientBalanceError extends Error {
    balance: ethers.BigNumber
    amount: ethers.BigNumber

    constructor(msg: string, balance: ethers.BigNumber, amount: ethers.BigNumber) {
        super(msg);
        this.balance = balance;
        this.amount = amount;
    }
}

export class GasLimitTooLowError extends Error {
    gasUsed: ethers.BigNumber
    gasLimit: ethers.BigNumber

    constructor(msg: string, gasLimit: ethers.BigNumber, gasUsed: ethers.BigNumber) {
        super(msg);
        this.gasLimit = gasLimit;
        this.gasUsed = gasUsed;
    }
}