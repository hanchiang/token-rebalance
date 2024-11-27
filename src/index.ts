import { ethers } from "ethers";
import fs from 'fs';
import path from 'path';
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

const transactionResponseFile = path.join(__dirname, '..', 'example', 'transaction_response.json');
const transactionReceiptFile = path.join(__dirname, '..', 'example', 'transaction_receipt.json');

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

const l1l2TokenMapping = {
  ethereumETHAddress: mantleETHAddress,
  ethereumMNTAddress: mantleMNTAddress
};
const l2l1TokenMapping = {
  mantleETHAddress: ethereumETHAddress,
  mantleMNTAddress: ethereumMNTAddress
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
  const filter = l2Contract.filters.DepositFinalized();

  console.log("Listening for DepositFinalized events on the L2 Bridge...");
  // Listen for deposit finalized
  l2Contract.on(filter, (l1Token, l2Token, from, to, amount, extraData) => {
    console.log("Deposit Finalized Event:");
    console.log(`l1Token: ${l1Token}, l1Token: ${l2Token}, from: ${from}, to: ${to},
      amount: ${ethers.utils.formatEther(ethers.BigNumber.from(amount))}, extraData: ${extraData}`);
  });

  // 15585867
  // const events = await l2Contract.queryFilter(filter, 15585866, 15585868)
  // console.log(events);

  await reportBalance(walletEthereum, walletMantle);

  const l1Contract = new ethers.Contract(l1BridgeAddress, l1bridgeAbi, walletEthereum);
  // 200000 may fail
  const minGasLimit = ethers.BigNumber.from(200000);
  const gasEstimate = await l1Contract.estimateGas.depositETH(minGasLimit, '0x', {
    value: amount,
  })
  const finalGasEstimate  = gasEstimate.mul(ethers.BigNumber.from(102)).div(ethers.BigNumber.from(100));
  console.log(`gas estimate: ${gasEstimate}, final gas esimate: ${finalGasEstimate}`);;

  await reportBalance(walletEthereum, walletMantle);

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

  // L1StandardBridgeProxy -> L1CrossDomainMessengerProxy -> OptimisePortalProxy
  const response = await l1Contract.depositETH(gasEstimate, '0x', {
    value: amount
  })
  console.log('transaction submitted');
  console.log(response);

  const receipt = await response.wait();
  console.log('transaction mined');
  console.log(receipt);

  await reportBalance(walletEthereum, walletMantle);
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

}

function readTransactionReceipts() {
  return readFile(transactionReceiptFile);
}

function readTransactionResponse() {
  return readFile(transactionResponseFile);
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

function writeToFile(path: string, data: string) {
  const options: fs.WriteFileOptions = { encoding: 'utf8' };
  fs.writeFileSync(path, data, options);
}

function readFile(path: string) {
  const data = fs.readFileSync(path, { encoding: 'utf8' })
  if (data.length === 0) {
    return [];
  }
  return JSON.parse(data);
}

if (require.main === module) {
  console.log('hello world');
  startDeposit(ethereumMNTAddress, ethers.utils.parseEther("1"));
}

// mainnet: https://1rpc.io/eth
const ethereum = '0x1';
// https://ethereum-sepolia-rpc.publicnode.com,
// WETH 0xEB590e5A96CD0E943A0899412E4fB06e0B362a7f, 18 decimal
// sepoliaMNT or MNT 0x65e37B558F64E2Be5768DB46DF22F93d85741A9E, 18 decimal
const ethereumSepolia = '0xaa36a7'; // 11155111
// https://1rpc.io/mantle

const mantle = '0x1388';

// https://endpoints.omniatech.io/v1/mantle/sepolia/public
// WETH 0xEB590e5A96CD0E943A0899412E4fB06e0B362a7f, 18 decimal
// WETH correct 0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111
// MNT 0x81cca157f2ec0d65cc4d435e53062beda6107d1e, 18 decimal
// wrapped MNT 0x19f5557E23e9914A18239990f6C70D68FDF0deD5
const mantleSepolia = '0x138b'; // 5003

// ethereum to mantle: eth -> weth
// mantle to ethereum: mnt -> mnt

// ethereum sepolia to mantle sepolia: sepoliaETH -> WETH?
// mantle sepolia to ethereum sepolia: sepoliaMNT -> MNT?