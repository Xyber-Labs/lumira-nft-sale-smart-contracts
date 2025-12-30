// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a-upgradeable/contracts/IERC721AUpgradeable.sol";

interface INFTSale is IERC721AUpgradeable {

    struct UserData {
        uint64 whitelistDeposited;
        uint64 publicDeposited;
        uint64 whitelistClaimed;
        uint64 publicClaimed;
    }

    enum State {Preparation, Deposit, Claim}

    function SBT_PARTICIPATION() external view returns(address participationTokenAddress);

    function MAX_TOTAL_SUPPLY() external view returns(uint64 maxTotalSupply);

    function WHITELIST_PRICE() external view returns(uint64 whitelistPrice);

    function PUBLIC_PRICE() external view returns(uint64 publicPrice);

    function NFT_SALE_STORAGE_LOCATION() external view returns(bytes32 storagePointer);

    function getState() external view returns(State currentState);

    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids);

    function receiver() external view returns(address fundsReceiver);

    function getTimestamps() external view returns(uint32 depositStart, uint32 depositEnd, uint32 claimStart);

    function getStats() external view returns(
        uint64 whitelistDeposited, 
        uint64 publicDeposited, 
        uint64 whitelistClaimed, 
        uint64 publicClaimed
    );

    function getRoots() external view returns(bytes32 whitelistRoot, bytes32 publicRoot, bytes32 refundRoot);

    function getUserData(address user) external view returns(UserData memory userData);

    function deposit(bytes32[] calldata proof) external payable;

    function refund(uint64 amountToRefund, bytes32[] calldata proof) external;

    function claim(uint64 publicAllocationAmount, bytes32[] calldata proof) external;

    function mintByAdmin(address[] calldata to, uint16[] calldata amounts) external;

    function setTimestamps(uint32 newDepositStart, uint32 newDepositEnd, uint32 newClaimStart) external;

    function setBaseURI(string calldata newBaseURI) external;

    function setReceiver(address newReceiver) external;

    function setRoots(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot) external;

    function withdrawFunds(uint256 amount) external;

}