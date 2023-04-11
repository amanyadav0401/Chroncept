import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

require('hardhat-contract-sizer');
dotenv.config();


export default {
  networks: {
    hardhat: {
      // gas: 10000000000,
      allowUnlimitedContractSize: true,

    },
    // mumbaitest: {
    //   url: "https://rpc-mumbai.maticvigil.com/",
    //   accounts: [`0x${process.env.PVTKEY}`]
    // },
    // matic: {
    //   url: "https://polygon-rpc.com/",
    //   accounts: [`0x${process.env.PVTKEY}`]
    // },
    // localhost: {
    //   url: "http://127.0.0.1:8545",
    // },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // rinkeby: {
    //   url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
    //   accounts: [`0x${process.env.PVTKEY}`],
    // },
    // testnet: {
    //   url: "https://data-seed-prebsc-2-s2.binance.org:8545",
    //   chainId: 97,
    //   // gasPrice: 20000000000,
    //   accounts: [`0x${process.env.PVTKEY}`]
    // },
  },  
  etherscan: {
    apiKey: process.env.API_FOR_MUMBAI,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['NFTContract','Marketplace','chronFactory']
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  }
}
