// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "../interfaces/INFTSale.sol";
import "../interfaces/INFTStaking.sol";

contract NFTStakingMock is UUPSUpgradeable, AccessControlUpgradeable {
    using EnumerableSet for *;

    address public immutable NFT_ADDRESS;

    /// @custom:storage-location erc7201:Lumira.storage.NFTStaking.NFTStakingStorage
    struct NFTStakingStorage {
        EnumerableSet.AddressSet _stakers;
        mapping(uint256 => INFTStaking.StakeData) _stakeData;
        mapping(address => EnumerableSet.UintSet) _stakedTokenIds;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("Lumira.storage.NFTStaking.NFTStakingStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant NFT_STAKING_STORAGE_LOCATION = 0x9a1909545c5040414fa862b47d9373488f2a7171880b14ce1469a38547f96d01;

    event Staked(address indexed staker, uint256 indexed tokenId, uint64 stakedAt);
    event Unstaked(address indexed staker, uint256 indexed tokenId, address indexed receiver);

    error NFTStaking__NotAnOwner();
    error NFTStaking__InvalidLength();
    error NFTStaking__InvalidImplementation();

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
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            require(INFTSale(NFT_ADDRESS).ownerOf(tokenIds[i]) == msg.sender, NFTStaking__NotAnOwner());

            $._stakedTokenIds[msg.sender].add(tokenIds[i]);
            $._stakeData[tokenIds[i]] = INFTStaking.StakeData({
                staker: msg.sender,
                stakedAt: uint64(block.timestamp)
            });

            INFTSale(NFT_ADDRESS).transferFrom(msg.sender, address(this), tokenIds[i]);

            emit Staked(msg.sender, tokenIds[i], uint64(block.timestamp));
        }

        $._stakers.add(msg.sender);
        
        return true;
    }

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            require($._stakeData[tokenIds[i]].staker == msg.sender, NFTStaking__NotAnOwner());

            delete $._stakeData[tokenIds[i]];
            $._stakedTokenIds[msg.sender].remove(tokenIds[i]);

            INFTSale(NFT_ADDRESS).safeTransferFrom(address(this), receiver, tokenIds[i]);

            emit Unstaked(msg.sender, tokenIds[i], receiver);
        }

        if ($._stakedTokenIds[msg.sender].length() == 0) $._stakers.remove(msg.sender);

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

    function stakeData(uint256[] calldata tokenIds) external view returns(INFTStaking.StakeData[] memory stakesData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        stakesData = new INFTStaking.StakeData[](tokenIds.length);
        for (uint256 i; tokenIds.length > i; i++) stakesData[i] = $._stakeData[tokenIds[i]];
    }

    function stakeAtByStaker(address staker) external view returns(INFTStaking.StakeAt[] memory stakeAtData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        stakeAtData = new INFTStaking.StakeAt[](_stakedTokensIds.length);

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            stakeAtData[i] = INFTStaking.StakeAt({
                tokenId: _stakedTokensIds[i],
                stakedAt: $._stakeData[_stakedTokensIds[i]].stakedAt
            });
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(INFTStaking).interfaceId || super.supportsInterface(interfaceId);
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

contract NFTStakingMockTwo is UUPSUpgradeable {
    using EnumerableSet for *;

    address public immutable NFT_ADDRESS;

    /// @custom:storage-location erc7201:Lumira.storage.NFTStaking.NFTStakingStorage
    struct NFTStakingStorage {
        EnumerableSet.AddressSet _stakers;
        mapping(uint256 => INFTStaking.StakeData) _stakeData;
        mapping(address => EnumerableSet.UintSet) _stakedTokenIds;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("Lumira.storage.NFTStaking.NFTStakingStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant NFT_STAKING_STORAGE_LOCATION = 0x9a1909545c5040414fa862b47d9373488f2a7171880b14ce1469a38547f96d00;

    event Staked(address indexed staker, uint256 indexed tokenId, uint64 stakedAt);
    event Unstaked(address indexed staker, uint256 indexed tokenId, address indexed receiver);

    error NFTStaking__NotAnOwner();
    error NFTStaking__InvalidLength();
    error NFTStaking__InvalidImplementation();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address nftAddress) {
        _disableInitializers();

        NFT_ADDRESS = nftAddress;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
    }

    function stake(uint256[] calldata tokenIds) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            require(INFTSale(NFT_ADDRESS).ownerOf(tokenIds[i]) == msg.sender, NFTStaking__NotAnOwner());

            $._stakedTokenIds[msg.sender].add(tokenIds[i]);
            $._stakeData[tokenIds[i]] = INFTStaking.StakeData({
                staker: msg.sender,
                stakedAt: uint64(block.timestamp)
            });

            INFTSale(NFT_ADDRESS).transferFrom(msg.sender, address(this), tokenIds[i]);

            emit Staked(msg.sender, tokenIds[i], uint64(block.timestamp));
        }

        $._stakers.add(msg.sender);
        
        return true;
    }

    function unstake(uint256[] calldata tokenIds, address receiver) external returns(bool success) {
        require(tokenIds.length > 0, NFTStaking__InvalidLength());
        NFTStakingStorage storage $ = _getNFTStakingStorage();

        for (uint256 i; tokenIds.length > i; i++) {
            require($._stakeData[tokenIds[i]].staker == msg.sender, NFTStaking__NotAnOwner());

            delete $._stakeData[tokenIds[i]];
            $._stakedTokenIds[msg.sender].remove(tokenIds[i]);

            INFTSale(NFT_ADDRESS).safeTransferFrom(address(this), receiver, tokenIds[i]);

            emit Unstaked(msg.sender, tokenIds[i], receiver);
        }

        if ($._stakedTokenIds[msg.sender].length() == 0) $._stakers.remove(msg.sender);

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

    function stakeData(uint256[] calldata tokenIds) external view returns(INFTStaking.StakeData[] memory stakesData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        stakesData = new INFTStaking.StakeData[](tokenIds.length);
        for (uint256 i; tokenIds.length > i; i++) stakesData[i] = $._stakeData[tokenIds[i]];
    }

    function stakeAtByStaker(address staker) external view returns(INFTStaking.StakeAt[] memory stakeAtData) {
        NFTStakingStorage storage $ = _getNFTStakingStorage();
        uint256[] memory _stakedTokensIds = $._stakedTokenIds[staker].values();
        stakeAtData = new INFTStaking.StakeAt[](_stakedTokensIds.length);

        for (uint256 i; _stakedTokensIds.length > i; i++) {
            stakeAtData[i] = INFTStaking.StakeAt({
                tokenId: _stakedTokensIds[i],
                stakedAt: $._stakeData[_stakedTokensIds[i]].stakedAt
            });
        }
    }

    function supportsInterface(bytes4 interfaceId) public view returns(bool) {
        return interfaceId == type(INFTStaking).interfaceId;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
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