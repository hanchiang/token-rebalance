import * as dotenv from "dotenv";
import { BridgeDirection } from './types'
dotenv.config();

export const config = {
    testnet: {
        mantleETHAddress: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
        mantleMNTAddress: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
        ethereumMNTAddress: '0x65e37B558F64E2Be5768DB46DF22F93d85741A9E',
        ethereumETHAddress: '0x0000000000000000000000000000000000000000',
        l1BridgeAddress: '0x21f308067241b2028503c07bd7cb3751ffab0fb2',
        l2BridgeAddress: '0x4200000000000000000000000000000000000010',
        l2ToL1MessagePasserAddress: '0x4200000000000000000000000000000000000016',
        l2CrossDomainMessengerAddress: '0x4200000000000000000000000000000000000007',
        bvmEthAddress: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
        ethereumChainId: 11155111,
        mantleChainId: 5001
    },
    mainnet: {
        mantleETHAddress: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
        mantleMNTAddress: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
        ethereumMNTAddress: '0x3c3a81e81dc49a522a592e7622a7e711c06bf354',
        ethereumETHAddress: '0x0000000000000000000000000000000000000000',
        l1BridgeAddress: '0x21f308067241b2028503c07bd7cb3751ffab0fb2',
        l2BridgeAddress: '0x4200000000000000000000000000000000000010',
        l2ToL1MessagePasserAddress: '0x4200000000000000000000000000000000000016',
        l2CrossDomainMessengerAddress: '0x4200000000000000000000000000000000000007',
        bvmEthAddress: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
        ethereumChainId: 1,
        mantleChainId: 5000
    }
}

const ENV = process.env.ENV as keyof typeof config;
const conf = config[ENV];
  export const {
    mantleETHAddress, mantleMNTAddress, ethereumMNTAddress, ethereumETHAddress,
    l1BridgeAddress, l2BridgeAddress, l2ToL1MessagePasserAddress,
    l2CrossDomainMessengerAddress, bvmEthAddress, ethereumChainId, mantleChainId
  } = conf;
  
  export const l1l2TokenMapping: {[key: string]: string} = {
    [ethereumETHAddress]: mantleETHAddress,
    [ethereumMNTAddress]: mantleMNTAddress
  };
  export const l2l1TokenMapping: {[key: string]: string} = {
    [mantleETHAddress]: ethereumETHAddress,
    [mantleMNTAddress]: ethereumMNTAddress
  }
  export const addressToSymbol: {[key: string]: string} = {
    [ethereumETHAddress]: 'ETH',
    [ethereumMNTAddress]: 'MNT',
    [mantleETHAddress]: 'ETH',
    [mantleMNTAddress]: 'MNT'
  }
  export const symbolToAddress: {[key in BridgeDirection]: {[key: string]: string}} = {
    [BridgeDirection.L1_TO_L2]: {
      ETH: ethereumETHAddress,
      MNT: ethereumMNTAddress
    },
    [BridgeDirection.L2_TO_L1]: {
      ETH: mantleETHAddress,
      MNT: mantleMNTAddress
    }
  }

export const supportedL1Tokens = ['ETH', 'MNT'];
export const supportedL2Tokens = ['ETH', 'MNT'];
