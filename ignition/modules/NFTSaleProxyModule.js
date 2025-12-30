const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NFTSaleProxyModule", (m) => {

    const initializeCalldataSBT = m.getParameter("initializeCalldataSBT");
    const initializeCalldataNFT = m.getParameter("initializeCalldataNFT");
    const maxTotalSupply = m.getParameter("maxTotalSupply");
    const whitelistPrice = m.getParameter("whitelistPrice");
    const publicPrice = m.getParameter("publicPrice");

    const SBTImplementation = m.contract("SBTParticipation", []);

    const SBTProxy = m.contract('ERC1967Proxy', [SBTImplementation, initializeCalldataSBT], { id: "SBTProxy" });

    const NFTSaleImplementation = m.contract("NFTSale", [SBTProxy, maxTotalSupply, whitelistPrice, publicPrice]);

    const NFTSaleProxy = m.contract('ERC1967Proxy', [NFTSaleImplementation, initializeCalldataNFT], { id: "NFTSaleProxy" });

    return { NFTSaleImplementation, NFTSaleProxy, SBTImplementation, SBTProxy };
});