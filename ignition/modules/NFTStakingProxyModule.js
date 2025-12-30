const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NFTStakingProxyModule", (m) => {

    const initializeCalldataNFTStaking = m.getParameter("initializeCalldataNFTStaking");
    const nftAddress = m.getParameter("nftAddress");

    const NFTStakingImplementation = m.contract("NFTStaking", [nftAddress]);

    const NFTStakingProxy = m.contract('ERC1967Proxy', [NFTStakingImplementation, initializeCalldataNFTStaking]);

    return { NFTStakingImplementation, NFTStakingProxy };
});