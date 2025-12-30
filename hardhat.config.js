require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require('dotenv').config();

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {

        },
        eth: {
            url: process.env.ETH_RPC_URL !== undefined ? process.env.ETH_RPC_URL : "https://eth.llamarpc.com",
            chainId: 1,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL !== undefined ? process.env.SEPOLIA_RPC_URL : "https://ethereum-sepolia-rpc.publicnode.com",
            chainId: 11155111,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        }
    },

    etherscan: {
        apiKey: {
            mainnet: process.env.ETH_API_KEY,
            sepolia: process.env.ETH_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.28",
                settings: {
                    viaIR: true,
                    evmVersion: "cancun",
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    }
}