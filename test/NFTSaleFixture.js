
const { maxTotalSupply, whitelistPrice, publicPrice, sbtName, sbtSymbol, nftName, nftSymbol } = require("./Constants.js");
const NFTStakingProxyModule = require("../ignition/modules/NFTStakingProxyModule.js");
const NFTSaleProxyModule = require("../ignition/modules/NFTSaleProxyModule.js");
const AbiCoder = new ethers.AbiCoder();
const { expect } = require("chai");

async function NFTSaleFixture() {
    const [admin, user, collector, userTwo] = await ethers.getSigners();

    const initializeParamsSBT = AbiCoder.encode([
        "address",
        "string",
        "string"
    ], [
        admin.address,
        sbtName,
        sbtSymbol
    ]);

    const initializeCalldataSBT = ethers.id('initialize(address,string,string)').substring(0, 10) + initializeParamsSBT.slice(2);

    const initializeParamsNFT = AbiCoder.encode([
        "address",
        "string",
        "string"
    ], [
        admin.address,
        nftName,
        nftSymbol
    ]);

    const initializeCalldataNFT = ethers.id('initialize(address,string,string)').substring(0, 10) + initializeParamsNFT.slice(2);

    const { NFTSaleImplementation, NFTSaleProxy, SBTImplementation, SBTProxy } = await ignition.deploy(NFTSaleProxyModule, {
        parameters: {
            NFTSaleProxyModule: {
                initializeCalldataSBT: initializeCalldataSBT,
                initializeCalldataNFT: initializeCalldataNFT,
                maxTotalSupply: maxTotalSupply,
                whitelistPrice: whitelistPrice,
                publicPrice: publicPrice
            },
        },
    });

    const initializeCalldataNFTStaking = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

    const { NFTStakingImplementation, NFTStakingProxy } = await ignition.deploy(NFTStakingProxyModule, {
        parameters: {
            NFTStakingProxyModule: {
                initializeCalldataNFTStaking: initializeCalldataNFTStaking,
                nftAddress: NFTSaleProxy.target
            },
        },
    });

    const nftSale = await ethers.getContractAt("NFTSale", NFTSaleProxy);
    const sbt = await ethers.getContractAt("SBTParticipation", SBTProxy);
    const nftStaking = await ethers.getContractAt("NFTStaking", NFTStakingProxy);

    const adminRole = await nftSale.DEFAULT_ADMIN_ROLE();
    const minterRole = await sbt.MINTER_ROLE();

    await sbt.connect(admin).grantRole(minterRole, nftSale.target);
    await expect(nftSale.connect(admin).initializeV2(
        admin.address
    )).to.emit(nftSale, "Initialized").withArgs(
        2n
    ).to.emit(nftSale, "OwnershipTransferred").withArgs(
        ethers.ZeroAddress,
        admin.address
    );

    return {
        admin, user, collector, userTwo, NFTSaleImplementation, nftSale, SBTImplementation, sbt, adminRole, minterRole, nftStaking, NFTStakingImplementation
    };
};

module.exports = { NFTSaleFixture };