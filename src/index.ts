import { ethers } from "ethers";

import * as dotenv from "dotenv";
import erc20abi from '../abi/erc20abi.json';
import l1bridgeAbi from '../abi/l1bridge-abi.json';
import l2bridgeAbi from '../abi/l2bridge-abi.json';

dotenv.config();


// 1. deposit ETH
// 2. deposit MNT
// 3. withdraw ETH
// 4. withdraw MNT

import { config } from './config'

const {
  ETHEREUM_RPC_URL,
  MANTLE_RPC_URL,
  PRIVATE_KEY,
  SENDER_ADDRESS,
  RECEIVER_ADDRESS,
} = process.env;

const ENV = process.env.ENV as keyof typeof config;
const conf = config[ENV];
const {
  mantleETHAddress, mantleMNTAddress, ethereumMNTAddress, ethereumETHAddress,
  l1BridgeAddress, l2BridgeAddress, ethereumChainId, mantleChainId
} = conf;

const l1l2TokenMapping: {[key: string]: string} = {
  [ethereumETHAddress]: mantleETHAddress,
  [ethereumMNTAddress]: mantleMNTAddress
};
const l2l1TokenMapping: {[key: string]: string} = {
  [mantleETHAddress]: ethereumETHAddress,
  [mantleMNTAddress]: ethereumMNTAddress
}
const tokenToSymbol: {[key: string]: string} = {
  [ethereumETHAddress]: 'ETH',
  [ethereumMNTAddress]: 'MNT',
  [mantleETHAddress]: 'ETH',
  [mantleMNTAddress]: 'MNT'
}

const providerEthereum = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);
const providerMantle = new ethers.providers.JsonRpcProvider(MANTLE_RPC_URL);
const walletEthereum = new ethers.Wallet(PRIVATE_KEY!, providerEthereum);
const walletMantle = new ethers.Wallet(PRIVATE_KEY!, providerMantle);

async function startDeposit(token: string, amount: ethers.BigNumber) {
  // const balanceEthereum = await providerEthereum.getBalance(walletEthereum.address);
  // console.log("Ethereum Sepolia Wallet Balance (ETH):", ethers.utils.formatEther(balanceEthereum));

  // const balanceMantle = await providerMantle.getBalance(walletMantle.address)
  // console.log("Mantle Testnet Wallet Balance (MNT):", ethers.utils.formatEther(balanceMantle));

  const l2Contract = new ethers.Contract(l2BridgeAddress, l2bridgeAbi, walletMantle);
  const ethDepositFilter = l2Contract.filters.DepositFinalized(ethereumETHAddress, null, SENDER_ADDRESS);
  const mntDepositFilter = l2Contract.filters.DepositFinalized(ethereumMNTAddress, null, SENDER_ADDRESS);

  console.log("Listening for DepositFinalized events on the L2 Bridge...");
  // Listen for deposit finalized
  l2Contract.on(ethDepositFilter, (l1Token, l2Token, from, to, amount, extraData) => {
    console.log("ETH deposit Finalized Event:");
    console.log(`l1Token: ${l1Token}, l2Token: ${l2Token}, from: ${from}, to: ${to},
      amount: ${ethers.utils.formatEther(ethers.BigNumber.from(amount))}, extraData: ${extraData}`);
  });
  l2Contract.on(mntDepositFilter, (l1Token, l2Token, from, to, amount, extraData) => {
    console.log("MNT deposit Finalized Event:");
    console.log(`l1Token: ${l1Token}, l2Token: ${l2Token}, from: ${from}, to: ${to},
      amount: ${ethers.utils.formatEther(ethers.BigNumber.from(amount))}, extraData: ${extraData}`);
  });

  const isNative = token === ethereumETHAddress;
  console.log(`Depositing ${ethers.utils.formatEther(amount)} ${tokenToSymbol[token]}, isNative: ${isNative}`)

  await reportBalance(walletEthereum, walletMantle);

  const l1Contract = new ethers.Contract(l1BridgeAddress, l1bridgeAbi, walletEthereum);
  const minGasLimit = ethers.BigNumber.from(200000);
  const extraData = '0x';
  const gasEstimate = await estimateGas(l1Contract, token, amount, minGasLimit, extraData, isNative);
  console.log(`gas estimate: ${gasEstimate}`);

  // send transaction manually
  // const l1BridgeInterface = new ethers.utils.Interface(l1bridgeAbi);
  // const data = l1BridgeInterface.encodeFunctionData('depositETH', [gasEstimate, '0x'])
  // const tx = {
  //   to: l1ETHBridgeProxyAddress,
  //   value: amount,
  //   gasLimit: gasEstimate,
  //   data
  // };
  // const response = await walletEthereum.sendTransaction(tx);

  // L1StandardBridgeProxy -> L1CrossDomainMessengerProxy -> OptimismPortalProxy
  // L2CrossDomainMessenger
  const response: ethers.providers.TransactionResponse = await doDeposit(l1Contract, token, amount, gasEstimate, extraData, isNative);
  console.log(response);
  console.log(`transaction submitted, gas limit: ${response.gasLimit}`);

  const receipt = await response.wait();
  console.log(receipt);
  console.log(`transaction mined, status: ${receipt.status}, gas estimate: ${gasEstimate}, transaction gas limit: ${response.gasLimit}, gas used: ${receipt.gasUsed}`);

  if (receipt.gasUsed.gt(response.gasLimit)) {
    console.log('Gas limit too low');
    return;
  }

  await reportBalance(walletEthereum, walletMantle);
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


async function withdrawETH(
  token: string,
  amount: ethers.BigNumber,
  walletEthereum: ethers.Wallet,
  walletMantle: ethers.Wallet
) {
  // console.log("Withdraw ETH");
  // await reportBalance(walletEthereum, walletMantle);

  // const l2Contract = new ethers.Contract(l2BridgeAddress, l2bridgeAbi, walletMantle);
  // const approve = await l2Contract.approve(l2BridgeAddress, amount);
  // console.log(`approving ${ethers.utils.formatEther(amount)}`)
  // const approveTx = await approve.wait();
  // console.log('approved');

  // const withdraw = await l2Contract.withdraw()
  // // wait for proof to be finalised on l1
  // // submit proof
  // // claim

  // L2StandardBridge -> L2CrossDomainMessenger
  // OptimismPortalProxy -> L1CrossDomainMessengerProxy -> L1StandardBridgeProxy 
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
  // startDeposit(ethereumMNTAddress, ethers.utils.parseEther("1"));
  startDeposit(ethereumETHAddress, ethers.utils.parseEther("0.001"));
}
