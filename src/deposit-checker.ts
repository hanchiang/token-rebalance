import { ethers } from 'ethers';
import EventEmitter from 'events';
import { GasLimitTooLowError } from './exception';
import { l2Contract, providerEthereum } from './config';
import { MyEventEmitter } from './event-emitter';
import { getDb, TransactionDetail } from './db';
import { DepositTransactionStatus } from './types';

export class DepositChecker {
    l2contract: ethers.Contract
    eventEmitter: EventEmitter
    l1provider: ethers.providers.JsonRpcProvider
    static instance: DepositChecker

    private constructor(l2contract: ethers.Contract, eventEmitter: EventEmitter,
        l1provider: ethers.providers.JsonRpcProvider
    ) {
        this.l2contract = l2contract;
        this.eventEmitter = eventEmitter;
        this.l1provider = l1provider;

        eventEmitter.on('depositFinalised', async (tx) => {
            const statement = getDb().prepare('UPDATE transaction_detail set status = ? where tx = ?')
            statement.run([DepositTransactionStatus.FINALISED, tx]);
            console.log(`handled deposit finalised tx ${tx}`);
        });
    }


    public static getInstance() {
        if (!!DepositChecker.instance) {
            return DepositChecker.instance;
        }
        DepositChecker.instance = new DepositChecker(l2Contract, MyEventEmitter.getInstance().getEmitter(), providerEthereum);
        return DepositChecker.instance;
    }

    public async listenToDepositFinalise(l1Token: string, l2Token: string, from: string, to: string, amount: ethers.BigNumber, tx: string) {
        const ethDepositFilter = this.l2contract.filters.DepositFinalized();
        console.log('listen to deposit finalise event')
        this.l2contract.on(ethDepositFilter, (_l1Token, _l2Token, _from, _to, _amount, _extraData) => {
            // console.log(`l1Token: ${_l1Token}, l2Token: ${_l2Token}, from: ${_from}, to: ${_to},
            //   amount: ${ethers.utils.formatEther(_amount)}, extraData: ${_extraData}, amount equal: ${_amount.eq(amount)},
            //   _from == from: ${_from == from}, _to == to: ${_to == to}, _l1Token == l1Token: ${_l1Token == l1Token}, 
            //   _l2Token == l2Token: ${_l2Token == l2Token}`);
            if (_from == from && _to == to && _l1Token == l1Token && _amount.eq(amount)) {
                console.log(`tx: ${tx} deposit is finalised`)
                this.eventEmitter.emit('depositFinalised', tx);
            }
          });
    }

    public async waitForTransactionMined(tx: string): Promise<ethers.providers.TransactionReceipt> {
        const response = await this.l1provider.getTransaction(tx);
        console.log(response);
        let receipt = await this.l1provider.getTransactionReceipt(tx);

        if (receipt == null) {
            console.log('wait for transaction to be mined')
            try {
                receipt = await response.wait();
                console.log('transaction mined')
                console.log(receipt);

                if (receipt.gasUsed.gt(response.gasLimit)) {
                    throw new GasLimitTooLowError(`Gas limit too low, gas limit: ${response.gasLimit}, gas used: ${receipt.gasUsed}`, 
                        response.gasLimit, receipt.gasUsed);
                }
            } catch(error ) {
                console.log('transaction error');
                console.log(error);
            }
        }
        console.log(`gas limit: ${response.gasLimit}, gas used: ${receipt?.gasUsed}`);

        // update status
        const statement = getDb().prepare('SELECT * FROM transaction_detail where tx = ?')
        try {
            const transactionDb: TransactionDetail = await new Promise((resolve, reject) => {
                statement.get(tx, (err: Error, res: TransactionDetail) => {
                    console.log(err, res);
                    if (err) {
                        reject(err);
                    }
                    resolve(res);
                });
            })
            // already mined
            if (transactionDb?.status != null) {
                return receipt;
            }
            if (receipt != null && receipt.status != transactionDb?.status) {            
                const statement = getDb().prepare('UPDATE transaction_detail set status = ? where tx = ?')
                statement.run([receipt.status, tx]);
            }
            return receipt;
        } catch(error) {
            console.log('query error');
            console.log(error);
        }
        return receipt;
    }
}