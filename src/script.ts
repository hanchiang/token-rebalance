import { ethers } from "ethers";
import erc20abi from '../abi/erc20abi.json';
import l1bridgeAbi from '../abi/l1bridge-abi.json';
import l2bridgeAbi from '../abi/l2bridge-abi.json';
import l2ToL1MessagePasserAbi from '../abi/l2tol1-message-passer-abi.json';
import bvmEthAbi from '../abi/bvm-eth-abi.json';
import { CrossChainMessenger } from '@mantleio/sdk';
import { mantleETHAddress, mantleMNTAddress, ethereumMNTAddress, ethereumETHAddress,
    l1BridgeAddress, l2BridgeAddress, l2ToL1MessagePasserAddress,
    l2CrossDomainMessengerAddress, bvmEthAddress, ethereumChainId, mantleChainId,
    l1l2TokenMapping, l2l1TokenMapping, addressToSymbol, symbolToAddress
} from './config'
import * as dotenv from "dotenv";
import { BridgeDirection } from "./types";
import { InsufficientBalanceError, GasLimitTooLowError } from './exception';
dotenv.config();

const {
    ETHEREUM_RPC_URL,
    MANTLE_RPC_URL,
    PRIVATE_KEY,
    SENDER_ADDRESS,
    RECEIVER_ADDRESS,
  } = process.env;
  
  
  const providerEthereum = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
  const providerMantle = new ethers.providers.JsonRpcProvider(MANTLE_RPC_URL);
  const walletEthereum = new ethers.Wallet(PRIVATE_KEY!, providerEthereum);
  const walletMantle = new ethers.Wallet(PRIVATE_KEY!, providerMantle);
  
  const crossChainMessenger =  new CrossChainMessenger({
    l1SignerOrProvider: walletEthereum,
    l2SignerOrProvider: walletMantle,
    l1ChainId: ethereumChainId,
    l2ChainId: mantleChainId
  });


export async function deposit(symbol: string, amount: ethers.BigNumber): Promise<ethers.providers.TransactionReceipt> {
    const tokenAddress = symbolToAddress[BridgeDirection.L1_TO_L2][symbol];

    console.log(tokenAddress);
    const balance = await getBalance(tokenAddress, amount, BridgeDirection.L1_TO_L2);
    console.log(`Deposit ${amount} ${symbol}, balance: ${balance}`);
    if (balance?.lt(amount)) {
        throw new InsufficientBalanceError(`Trying to deposit ${ethers.utils.formatEther(amount)}, but balance is ${ethers.utils.formatEther(balance)}`, balance, amount);
    }
  
    const l2Contract = new ethers.Contract(l2BridgeAddress, l2bridgeAbi, walletMantle);
    const ethDepositFilter = l2Contract.filters.DepositFinalized(ethereumETHAddress, null, SENDER_ADDRESS);
    const mntDepositFilter = l2Contract.filters.DepositFinalized(ethereumMNTAddress, null, SENDER_ADDRESS);
  
    console.log("Listening for DepositFinalized events on the L2 Bridge...");
    // Listen for deposit finalized
    l2Contract.on(ethDepositFilter, (l1Token, l2Token, from, to, amount, extraData) => {
      console.log("ETH deposit Finalized Event:");
      console.log(`l1Token: ${l1Token}, l2Token: ${l2Token}, from: ${from}, to: ${to},
        amount: ${ethers.utils.formatEther(amount)}, extraData: ${extraData}`);
    });
    l2Contract.on(mntDepositFilter, (l1Token, l2Token, from, to, amount, extraData) => {
      console.log("MNT deposit Finalized Event:");
      console.log(`l1Token: ${l1Token}, l2Token: ${l2Token}, from: ${from}, to: ${to},
        amount: ${ethers.utils.formatEther(amount)}, extraData: ${extraData}`);
    });
  
    const isNative = tokenAddress === ethereumETHAddress;
    console.log(`Depositing ${ethers.utils.formatEther(amount)} ${addressToSymbol[tokenAddress]}, isNative: ${isNative}`)
  
    // await reportBalance(walletEthereum, walletMantle);
  
    const l1Contract = new ethers.Contract(l1BridgeAddress, l1bridgeAbi, walletEthereum);
    const minGasLimit = ethers.BigNumber.from(200000);
    const extraData = '0x';
    const gasEstimate = await estimateGas(l1Contract, tokenAddress, amount, minGasLimit, extraData, isNative);
    console.log(`gas estimate: ${gasEstimate}`);
  
    // L1StandardBridgeProxy -> L1CrossDomainMessengerProxy -> OptimismPortalProxy
    // L2CrossDomainMessenger
    const response: ethers.providers.TransactionResponse = await doDeposit(l1Contract, tokenAddress, amount, gasEstimate, extraData, isNative);
    console.log(response);
    console.log(`transaction submitted, gas limit: ${response.gasLimit}`);
  
    const receipt = await response.wait();
    console.log(receipt);
    console.log(`transaction mined, status: ${receipt.status}, gas estimate: ${gasEstimate}, transaction gas limit: ${response.gasLimit}, gas used: ${receipt.gasUsed}`);
  
    if (receipt.gasUsed.gt(response.gasLimit)) {
        throw new GasLimitTooLowError(`Gas limit too low, gas limit: ${response.gasLimit}, gas used: ${receipt.gasUsed}`, 
            response.gasLimit, receipt.gasUsed);
    }

    return receipt;
  
    // await reportBalance(walletEthereum, walletMantle);
  }
  
  async function estimateGas(contract: ethers.Contract, token: string, amount: ethers.BigNumber,
    minGasLimit: ethers.BigNumber, extraData: string, isNative: boolean
  ) {
    if (isNative) {
      return contract.estimateGas.depositETH(minGasLimit, extraData, {
        value: amount,
      })
    }
    if (token === ethereumMNTAddress) {
      return contract.estimateGas.depositMNT(amount, minGasLimit, extraData)
    }
    return contract.estimateGas.depositERC20(token, l1l2TokenMapping[token],
      amount, minGasLimit, extraData)
  }
  
  async function doDeposit(contract: ethers.Contract, token: string,
    amount: ethers.BigNumber, minGasLimit: ethers.BigNumber, 
    extraData: string, isNative: boolean
  ) {
    if (isNative) {
      return contract.depositETH(minGasLimit, extraData, {
        value: amount
      })
    }
    if (token === ethereumMNTAddress) {
      return contract.depositMNT(amount, minGasLimit, extraData);
    }
    return contract.depositERC20(token, l1l2TokenMapping[token],
      amount, minGasLimit, extraData, {
        value: amount
      });
  }
  
  
  export async function withdrawETH(
    token: string,
    amount: ethers.BigNumber
  ) {
    console.log(`Withdraw ${amount}`);
    // await reportBalance(walletEthereum, walletMantle);
  
    
    const bvmEthContract = new ethers.Contract(bvmEthAddress, bvmEthAbi, walletMantle);
  
    const allowance: ethers.BigNumber = await bvmEthContract.allowance(SENDER_ADDRESS, l2BridgeAddress);
    console.log(`get allowance ${ethers.utils.formatEther(allowance)}`);
  
  
    if (allowance < amount) {
      console.log(`allowance is less than amount`);
  
      const approve: ethers.providers.TransactionResponse = await bvmEthContract.approve(l2BridgeAddress, amount);
      console.log(`approving ${ethers.utils.formatEther(amount)}`)
      console.log(approve);
      const approveTx: ethers.providers.TransactionReceipt = await approve.wait();
      console.log(`transaction mined, status: ${approveTx.status}, transaction gas limit: ${approve.gasLimit}, gas used: ${approveTx.gasUsed}`);
      console.log(approveTx);
    }
  
    const extraData = `0x`;
    const minGasLimit = ethers.BigNumber.from(200000);
    const l2Contract = new ethers.Contract(l2BridgeAddress, l2bridgeAbi, walletMantle);
    const gasEstimate = await l2Contract.estimateGas.withdraw(token, amount, minGasLimit, extraData);
    console.log(`gas estimate: ${gasEstimate}`);
  
    const withdraw: ethers.providers.TransactionResponse = await l2Contract.withdraw(token, amount, minGasLimit, extraData);
    console.log('withdraw initiated')
    console.log(withdraw);
    const withdrawTx: ethers.providers.TransactionReceipt = await withdraw.wait();
    console.log(`transaction mined, status: ${withdrawTx.status}, gas estimate: ${minGasLimit}, transaction gas limit: ${withdraw.gasLimit}, gas used: ${withdrawTx.gasUsed}`);
    console.log(withdrawTx);
  
    const l2ToL1MessagePasserContract = new ethers.Contract(l2ToL1MessagePasserAddress, l2ToL1MessagePasserAbi, walletMantle);
  
    const l2ToL1Interface = new ethers.utils.Interface(l2ToL1MessagePasserAbi)
    // need more precise filter
    const withdrawalFilter = l2ToL1MessagePasserContract.filters.MessagePassed(null, l2CrossDomainMessengerAddress, null, null, null, null, null, null);
    console.log('Listening to L2 withdrawal event')
    l2ToL1MessagePasserContract.on(withdrawalFilter, async (nonce, sender, target, mntValue, ethValue, gasLimit, data, withdrawalHash) => {
      console.log("Withdrawal initiated event");
      console.log(`nonce: ${nonce}, sender: ${sender}, target: ${target}, 
        mntValue: ${ethers.utils.formatEther(mntValue)}, ethValue: ${ethers.utils.formatEther(ethValue)},
        gasLimit: ${gasLimit}, data: ${data}, withdrawalHash: ${withdrawalHash}`);
  
        const decodedData = l2ToL1Interface.decodeFunctionData('initiateWithdrawal', data);
        console.log('decoded data')
        console.log(decodedData);
  
        // L1CrossDomainMessengerProxy.relayMessage
        // prove withdrawal on L1 OptimismPortalProxy.proveWithdrawalTransaction
        // TODO: how to get the proof?
  
        // claim finalizeWithdrawalTransaction
  
        crossChainMessenger.getMessageProof(withdrawTx.transactionHash)
          .then(proof => {
            console.log(`proof`);
            console.log(proof);
  
            crossChainMessenger.proveMessage(withdrawTx.transactionHash)
            .then(res => {
              console.log('prove message');
              console.log(res);
  
              // crossChainMessenger.getChallengePeriodSeconds()
            }).catch(error => {
              console.log('error proving message');
              console.log(error);
            })
          })
          .catch(error => {
            console.log('error getting message proof')
            console.log(error);
          })
    });
  
    // L2StandardBridge -> L2CrossDomainMessenger -> L2L1MessagePasser
    // OptimismPortalProxy -> L1CrossDomainMessengerProxy -> L1StandardBridgeProxy 
  }

  async function getBalance(tokenAddress: string, amount: ethers.BigNumber, direction: BridgeDirection): Promise<ethers.BigNumber | null> {
    if (direction == BridgeDirection.L1_TO_L2) {
        if (tokenAddress == ethereumETHAddress) {
            return walletEthereum.getBalance();
        }
        const contract = new ethers.Contract(tokenAddress, erc20abi, walletEthereum);
        return contract.balanceOf(await walletEthereum.getAddress());
    } else if (direction == BridgeDirection.L2_TO_L1) {
        if (tokenAddress == mantleMNTAddress) {
            return walletMantle.getBalance();
        }
        const contract = new ethers.Contract(tokenAddress, erc20abi, walletMantle);
        return contract.balanceOf(await walletMantle.getAddress());
    }
    return null;
  }
  
  
  async function reportBalance(walletEthereum: ethers.Wallet, walletMantle: ethers.Wallet) {
    // ethereum
    const l1Balance = await walletEthereum.getBalance();
    console.log('Ethereum Sepolia Wallet Balance (ETH):', ethers.utils.formatEther(l1Balance));
  
    const ethereumMNT = new ethers.Contract(ethereumMNTAddress, erc20abi, walletEthereum);
    const l1BalanceMNT = await ethereumMNT.balanceOf(await walletEthereum.getAddress());
    console.log('Ethereum Sepolia Wallet Balance (MNT):', ethers.utils.formatEther(l1BalanceMNT));
    
  
    // mantle
    const l2BalanceMNT2 = await walletMantle.getBalance();
    console.log("Mantle Testnet Wallet Balance (MNT):", ethers.utils.formatEther(l2BalanceMNT2)); 
  
    const MNT = new ethers.Contract(mantleMNTAddress, erc20abi, walletMantle);
    const l2BalanceMNT = await MNT.balanceOf(await walletMantle.getAddress())
    console.log("Mantle Testnet Wallet Balance (MNT):", ethers.utils.formatEther(l2BalanceMNT)); 
  
    const ETH = new ethers.Contract(mantleETHAddress, erc20abi, walletMantle);
    const l2Balance = await ETH.balanceOf(await walletMantle.getAddress())
    console.log("Mantle Testnet Wallet Balance (ETH):", ethers.utils.formatEther(l2Balance));
  }
  


if (require.main === module) {
    console.log('hello world');
    // deposit(ethereumMNTAddress, ethers.utils.parseEther("1"));
    // deposit(ethereumETHAddress, ethers.utils.parseEther("0.001"));
    withdrawETH(mantleETHAddress, ethers.utils.parseEther('0.001'));
  }