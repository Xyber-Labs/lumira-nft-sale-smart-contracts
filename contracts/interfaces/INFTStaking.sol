// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INFTStaking {

    struct StakeData {
        address staker;
        uint64 stakedAt;
    }

    struct StakeAt {
        uint256 tokenId;
        uint64 stakedAt;
    }

    struct LockedUntil {
        uint256 tokenId;
        uint256 lockedUntil;
    }

    function NFT_ADDRESS() external view returns(address nftAddress);

    function NFT_STAKING_STORAGE_LOCATION() external view returns(bytes32 storagePointer);

    function stakers() external view returns(address[] memory stakersList);

    function stakedTokenIds(address staker) external view returns(uint256[] memory stakedTokensIds);

    function stakeData(uint256[] calldata tokenIds) external view returns(StakeData[] memory stakesData);

    function locks(uint256[] calldata tokenIds) external view returns(uint256[] memory lockedUntil);

    function stakeAtByStaker(address staker) external view returns(StakeAt[] memory stakeAtData);

    function locksByStaker(address staker) external view returns(LockedUntil[] memory locksData);

    function lockedUntilByStaker(address staker) external view returns(LockedUntil[] memory lockedUntilData);

    function stake(uint256[] calldata tokenIds) external returns(bool success);

    function stakeWithLockOnBehalfOf(
        uint256[] calldata tokenIds, 
        address[] calldata receivers, 
        uint256[] calldata lockDurations
    ) external returns(bool success);

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success);

    function unstakeByAdmin(uint256[] calldata tokenIds) external returns(bool success);

    function setUnlockTimestamps(uint256[] calldata tokenIds, uint256[] calldata unlockTimestamps) external returns(bool success);

}