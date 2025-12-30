// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "./interfaces/INFTSale.sol";
import "./interfaces/INFTStaking.sol";

contract NFTStaking is INFTStaking, UUPSUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for *;

    address public immutable NFT_ADDRESS;

    /// @custom:storage-location erc7201:Lumira.storage.NFTStaking.NFTStakingStorage
    struct NFTStakingStorage {
        EnumerableSet.AddressSet _stakers;
        mapping(uint256 tokenId => StakeData) _stakeData;
        mapping(address staker => EnumerableSet.UintSet) _stakedTokenIds;
        mapping(uint256 tokenId => uint256 unlockTimestamp) _locks;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("Lumira.storage.NFTStaking.NFTStakingStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant NFT_STAKING_STORAGE_LOCATION = 0x9a1909545c5040414fa862b47d9373488f2a7171880b14ce1469a38547f96d00;

    event Staked(address indexed staker, uint256 indexed tokenId, uint64 stakedAt);
    event Unstaked(address indexed staker, uint256 indexed tokenId, address indexed receiver);

    error NFTStaking__NotAnOwner();
    error NFTStaking__InvalidLength();
    error NFTStaking__InvalidImplementation();
    error NFTStaking__LockedToken();
    error NFTStaking__ZeroAddress();
    error NFTStaking__UnstakedToken();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address nftAddress) {
        _disableInitializers();

        NFT_ADDRESS = nftAddress;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function stake(uint256[] calldata tokenIds) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _stake(msg.sender, msg.sender, tokenIds[i], 0);
        }
        
        return true;
    }

    function stakeWithLockOnBehalfOf(
        uint256[] calldata tokenIds, 
        address[] calldata receivers, 
        uint256[] calldata lockDurations
    ) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());
        require(tokenIds.length == receivers.length && tokenIds.length == lockDurations.length, NFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _stake(msg.sender, receivers[i], tokenIds[i], lockDurations[i]);
        }

        return true;
    }

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _unstake(tokenIds[i], receiver, false);
        }

        return true;
    }

    function unstakeByAdmin(uint256[] calldata tokenIds) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());

        for (uint256 i; tokenIds.length > i; i++) {
            _unstake(tokenIds[i], msg.sender, true);
        }

        return true;
    }

    function setUnlockTimestamps(
        uint256[] calldata tokenIds, 
        uint256[] calldata unlockTimestamps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());
        require(tokenIds.length == unlockTimestamps.length, NFTStaking__InvalidLength());

        NFTStakingStorage storage $ = _getNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            $._locks[tokenIds[i]] = unlockTimestamps[i];
        }

        return true;
    }

    function stakers() external view returns(address[] memory stakersList) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        return $._stakers.values();
    }

    function stakedTokenIds(address staker) external view returns(uint256[] memory stakedTokensIds) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        return $._stakedTokenIds[staker].values();
    }

    function stakeData(uint256[] calldata tokenIds) external view returns(StakeData[] memory stakesData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        stakesData = new StakeData[](tokenIds.length);
        for (uint256 i; tokenIds.length > i; i++) stakesData[i] = $._stakeData[tokenIds[i]];
    }

    function locks(uint256[] calldata tokenIds) external view returns(uint256[] memory lockedUntil) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        lockedUntil = new uint256[](tokenIds.length);
        for (uint256 i; tokenIds.length > i; i++) lockedUntil[i] = $._locks[tokenIds[i]];
    }

    function stakeAtByStaker(address staker) external view returns(StakeAt[] memory stakeAtData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        stakeAtData = new StakeAt[](_stakedTokensIds.length);

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            stakeAtData[i] = StakeAt({
                tokenId: _stakedTokensIds[i],
                stakedAt: $._stakeData[_stakedTokensIds[i]].stakedAt
            });
        }
    }

    function locksByStaker(address staker) external view returns(LockedUntil[] memory locksData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        locksData = new LockedUntil[](_stakedTokensIds.length);

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            locksData[i] = LockedUntil({
                tokenId: _stakedTokensIds[i],
                lockedUntil: $._locks[_stakedTokensIds[i]]
            });
        }
    }

    function lockedUntilByStaker(address staker) external view returns(LockedUntil[] memory lockedUntilData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        uint256 _lockedTokensNumber;

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            if ($._locks[_stakedTokensIds[i]] > block.timestamp) _lockedTokensNumber++;
        }

        lockedUntilData = new LockedUntil[](_lockedTokensNumber);

        uint256 j;

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            if ($._locks[_stakedTokensIds[i]] > block.timestamp) {
                lockedUntilData[j] = LockedUntil({
                    tokenId: _stakedTokensIds[i],
                    lockedUntil: $._locks[_stakedTokensIds[i]]
                });

                j++;
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(INFTStaking).interfaceId || super.supportsInterface(interfaceId);
    }

    function _stake(address holder, address receiver, uint256 tokenId, uint256 lockDuration) internal {
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        require(receiver != address(0), NFTStaking__ZeroAddress());
        require(INFTSale(NFT_ADDRESS).ownerOf(tokenId) == holder, NFTStaking__NotAnOwner());

        $._stakers.add(receiver);
        $._stakedTokenIds[receiver].add(tokenId);
        $._stakeData[tokenId] = StakeData({
            staker: receiver,
            stakedAt: uint64(block.timestamp)
        });
        if (lockDuration > 0) $._locks[tokenId] = block.timestamp + lockDuration;

        INFTSale(NFT_ADDRESS).transferFrom(holder, address(this), tokenId);

        emit Staked(receiver, tokenId, uint64(block.timestamp));
    }

    function _unstake(uint256 tokenId, address receiver, bool force) internal {
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        address _staker = $._stakeData[tokenId].staker;

        if (force) {
            require(_staker != address(0), NFTStaking__UnstakedToken());
        } else {
            require(_staker == msg.sender, NFTStaking__NotAnOwner());
            require(block.timestamp >= $._locks[tokenId], NFTStaking__LockedToken());
        }

        delete $._locks[tokenId];
        delete $._stakeData[tokenId];
        $._stakedTokenIds[_staker].remove(tokenId);
        if ($._stakedTokenIds[_staker].length() == 0) $._stakers.remove(_staker);

        INFTSale(NFT_ADDRESS).safeTransferFrom(address(this), receiver, tokenId);

        emit Unstaked(_staker, tokenId, receiver);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            INFTStaking(newImplementation).NFT_STAKING_STORAGE_LOCATION() == NFT_STAKING_STORAGE_LOCATION,
            NFTStaking__InvalidImplementation()
        );

        require(
            IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId),
            NFTStaking__InvalidImplementation()
        );
    }

    function _getNFTStakingStorage() private pure returns(NFTStakingStorage storage $) {
        assembly {
            $.slot := NFT_STAKING_STORAGE_LOCATION
        }
    }

}