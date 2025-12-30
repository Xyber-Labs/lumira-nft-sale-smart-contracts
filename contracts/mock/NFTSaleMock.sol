// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";

import "../interfaces/ISBTParticipation.sol";
import "../interfaces/INFTSale.sol";

contract NFTSaleMock is INFTSale, ERC721AUpgradeable, UUPSUpgradeable, AccessControlUpgradeable {
    using Address for *;

    address public immutable SBT_PARTICIPATION;

    uint64 public immutable MAX_TOTAL_SUPPLY;
    uint64 public immutable WHITELIST_PRICE;
    uint64 public immutable PUBLIC_PRICE;

    /// @custom:storage-location erc7201:Lumira.storage.NFTSale.NFTSaleStorage
    struct NFTSaleStorage {
        string _baseURI;
        address _receiver;
        uint32 _depositStart;  
        uint32 _depositEnd;
        uint32 _claimStart;
        uint64 _whitelistDeposited;
        uint64 _publicDeposited;
        uint64 _whitelistClaimed;
        uint64 _publicClaimed;
        bytes32 _whitelistRoot;
        bytes32 _publicRoot;
        bytes32 _refundRoot;
        mapping(address user => UserData) _userData;
    }

    // keccak256(abi.encode(uint64(keccak256("Lumira.storage.NFTSale.NFTSaleStorage")) - 1)) & ~bytes32(uint64(0xff))
    bytes32 public constant NFT_SALE_STORAGE_LOCATION = 0x707edf5e14bfdf1ba58ecef846c170a48a35301414f4b4056ce0592b3a7a1c01;

    error NFTSale__InvalidValue();
    error NFTSale__DepositedAlready();
    error NFTSale__IncorrectState();
    error NFTSale__MerkleProofFailed();
    error NFTSale__NothingToClaim();
    error NFTSale__ParamsLengthMismatch();
    error NFTSale__InvalidTimestamp();
    error NFTSale__TotalSupplyExceeded();
    error NFTSale__InvalidImplementation();

    event Deposited(address indexed user, uint256 amount, bool indexed whitelist, uint64 publicAmount);
    event Refunded(address indexed user, uint256 amount, uint64 publicAmount);
    event Claimed(address indexed user, bool indexed whitelist, uint64 publicAmount);
    event BaseURISet(string newBaseURI, address indexed caller);
    event ReceiverSet(address newReceiver, address indexed caller);
    event RootsSet(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address participationToken, 
        uint64 maxTotalSupply, 
        uint64 publicAllocation, 
        uint64 whitelistPrice, 
        uint64 publicPrice
    ) {
        _disableInitializers();

        SBT_PARTICIPATION = participationToken;
        MAX_TOTAL_SUPPLY = maxTotalSupply;
        WHITELIST_PRICE = whitelistPrice;
        PUBLIC_PRICE = publicPrice;
    }
    
    function initialize(
        address defaultAdmin, 
        string calldata name, 
        string calldata symbol
    ) external initializerERC721A() initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC721A_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function deposit(bytes32[] calldata proof) external payable {
        _validateState(State.Deposit);
        if (msg.value == 0) revert NFTSale__InvalidValue();
    
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        uint256 _publicDepositValue;

        if (proof.length > 0) {
            if (userData.whitelistDeposited > 0) revert NFTSale__DepositedAlready();
            if (WHITELIST_PRICE > msg.value) revert NFTSale__InvalidValue();
            if (!MerkleProof.verify(proof, $._whitelistRoot, keccak256(abi.encode(msg.sender)))) {
                revert NFTSale__MerkleProofFailed();
            }

            userData.whitelistDeposited += 1;
            $._whitelistDeposited += 1;

            payable($._receiver).sendValue(WHITELIST_PRICE);

            if (msg.value > WHITELIST_PRICE) _publicDepositValue = msg.value - WHITELIST_PRICE;
        } else {
            _publicDepositValue = msg.value;
        }

        if (_publicDepositValue > 0) {
            if (_publicDepositValue % PUBLIC_PRICE != 0) revert NFTSale__InvalidValue();

            uint64 _amount = uint64(_publicDepositValue / PUBLIC_PRICE);

            userData.publicDeposited += _amount;
            $._publicDeposited += _amount;
        }

        emit Deposited(msg.sender, msg.value, proof.length > 0, uint64(_publicDepositValue / PUBLIC_PRICE));

        ISBTParticipation(SBT_PARTICIPATION).mint(msg.sender);
    }

    function refund(uint64 amountToRefund, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        if (!MerkleProof.verify(proof, $._refundRoot, keccak256(abi.encode(msg.sender, amountToRefund)))) {
            revert NFTSale__MerkleProofFailed();
        }

        uint64 _publicUnclaimed = userData.publicDeposited - userData.publicClaimed;
        
        if (_publicUnclaimed == 0) revert NFTSale__NothingToClaim();
        if (amountToRefund > _publicUnclaimed) revert NFTSale__NothingToClaim();

        uint64 _publicRefundAmount = amountToRefund * PUBLIC_PRICE;

        userData.publicDeposited -= amountToRefund;
        $._publicDeposited -= amountToRefund;

        payable(msg.sender).sendValue(_publicRefundAmount);

        emit Refunded(msg.sender, _publicRefundAmount, amountToRefund);
    }

    function claim(uint64 publicAllocationAmount, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        if (userData.whitelistDeposited == 0 && userData.publicDeposited == 0) {
            revert NFTSale__NothingToClaim();
        }

        uint64 _publicAmount;

        if (proof.length > 0) {
            if (!MerkleProof.verify(proof, $._publicRoot, keccak256(abi.encode(msg.sender, publicAllocationAmount)))) {
                revert NFTSale__MerkleProofFailed();
            }
            _publicAmount = publicAllocationAmount - userData.publicClaimed;
        }

        uint64 _whitelistAmount = userData.whitelistDeposited - userData.whitelistClaimed;

        if (_publicAmount == 0 && _whitelistAmount == 0) {
            revert NFTSale__NothingToClaim();
        }

        if (_publicAmount > 0) {
            $._publicClaimed += _publicAmount;
            userData.publicClaimed += _publicAmount;
            payable($._receiver).sendValue(_publicAmount * PUBLIC_PRICE);
        }

        if (_whitelistAmount > 0) {
            $._whitelistClaimed += _whitelistAmount;
            userData.whitelistClaimed += _whitelistAmount;
        }

        _validateTotalSupply(_publicAmount + _whitelistAmount);

        _safeMint(msg.sender, _publicAmount + _whitelistAmount);

        emit Claimed(msg.sender, _whitelistAmount > 0, _publicAmount);
    }

    function mintByAdmin(address[] calldata to, uint16[] calldata amounts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to.length != amounts.length) revert NFTSale__ParamsLengthMismatch();

        uint16 _totalAmount;

        for (uint16 i; to.length > i; i++) {
            _totalAmount += amounts[i];
        }

        _validateTotalSupply(_totalAmount);

        for (uint16 i; to.length > i; i++) {
            _safeMint(to[i], amounts[i]);
        }
    }

    function setTimestamps(
        uint32 newDepositStart,
        uint32 newDepositEnd,
        uint32 newClaimStart
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();

        if ($._depositStart == 0 && block.timestamp >= newDepositStart) revert NFTSale__InvalidTimestamp();
        if (newDepositStart >= newDepositEnd) revert NFTSale__InvalidTimestamp();
        if (newDepositEnd >= newClaimStart) revert NFTSale__InvalidTimestamp();

        $._depositStart = newDepositStart;
        $._depositEnd = newDepositEnd;
        $._claimStart = newClaimStart;
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseURI(newBaseURI);
    }

    function setReceiver(address newReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setReceiver(newReceiver);
    }

    function setRoots(
        bytes32 newWhitelistRoot, 
        bytes32 newPublicRoot, 
        bytes32 newRefundRoot
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRoots(newWhitelistRoot, newPublicRoot, newRefundRoot);
    }

    function withdrawFunds(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        payable($._receiver).sendValue(amount);
    }

    function getState() public view returns(State currentState) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        if ($._depositStart == 0) return State.Preparation;
        if ($._depositStart <= block.timestamp && block.timestamp <= $._depositEnd) return State.Deposit;
        if ($._claimStart <= block.timestamp) return State.Claim;
        return State.Preparation;
    }

    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids) {
        uint256 _ownerBalance = balanceOf(owner);
        if (_ownerBalance == 0) return new uint64[](0);

        ids = new uint64[](_ownerBalance);
        uint64 _counter;

        for (uint64 i; totalSupply() > i; i++) {
            if (ownerOf(i) == owner) {
                ids[_counter] = i;
                _counter += 1;
                if (_counter == _ownerBalance) return ids;
            }
        }
    }

    function receiver() external view returns(address fundsReceiver) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._receiver;
    }

    function getTimestamps() external view returns(uint32 depositStart, uint32 depositEnd, uint32 claimStart) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._depositStart, $._depositEnd, $._claimStart);
    }

    function getStats() external view returns(
        uint64 whitelistDeposited, 
        uint64 publicDeposited, 
        uint64 whitelistClaimed, 
        uint64 publicClaimed
    ) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistDeposited, $._publicDeposited, $._whitelistClaimed, $._publicClaimed);
    }

    function getRoots() external view returns(bytes32 whitelistRoot, bytes32 publicRoot, bytes32 refundRoot) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistRoot, $._publicRoot, $._refundRoot);
    }

    function getUserData(address user) external view returns(UserData memory userData) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._userData[user];
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC721AUpgradeable, ERC721AUpgradeable, AccessControlUpgradeable) returns(bool) {
        return super.supportsInterface(interfaceId);
    }

    function _validateTotalSupply(uint64 newTokensAmount) internal view {
        if (totalSupply() + newTokensAmount > MAX_TOTAL_SUPPLY) revert NFTSale__TotalSupplyExceeded();
    }

    function _validateState(State desiredState) internal view {
        if (getState() != desiredState) revert NFTSale__IncorrectState();          
    }

    function _baseURI() internal view override returns(string memory) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._baseURI;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (INFTSale(newImplementation).NFT_SALE_STORAGE_LOCATION() != NFT_SALE_STORAGE_LOCATION) {
            revert NFTSale__InvalidImplementation();
        }

        if (!IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId)) {
            revert NFTSale__InvalidImplementation();
        }
    }

    function _setBaseURI(string calldata newBaseURI) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._baseURI = newBaseURI;

        emit BaseURISet(newBaseURI, msg.sender);
    }

    function _setReceiver(address newReceiver) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._receiver = newReceiver;

        emit ReceiverSet(newReceiver, msg.sender);
    }

    function _setRoots(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._whitelistRoot = newWhitelistRoot;
        $._publicRoot = newPublicRoot;
        $._refundRoot = newRefundRoot;

        emit RootsSet(newWhitelistRoot, newPublicRoot, newRefundRoot, msg.sender);
    }

    function _getNFTSaleStorage() private pure returns(NFTSaleStorage storage $) {
        assembly {
            $.slot := NFT_SALE_STORAGE_LOCATION
        }
    }

}

contract NFTSaleMockTwo is INFTSale, ERC721AUpgradeable, UUPSUpgradeable {
    using Address for *;

    address public immutable SBT_PARTICIPATION;

    uint64 public immutable MAX_TOTAL_SUPPLY;
    uint64 public immutable WHITELIST_PRICE;
    uint64 public immutable PUBLIC_PRICE;

    /// @custom:storage-location erc7201:Lumira.storage.NFTSale.NFTSaleStorage
    struct NFTSaleStorage {
        string _baseURI;
        address _receiver;
        uint32 _depositStart;  
        uint32 _depositEnd;
        uint32 _claimStart;
        uint64 _whitelistDeposited;
        uint64 _publicDeposited;
        uint64 _whitelistClaimed;
        uint64 _publicClaimed;
        bytes32 _whitelistRoot;
        bytes32 _publicRoot;
        bytes32 _refundRoot;
        mapping(address user => UserData) _userData;
    }

    // keccak256(abi.encode(uint256(keccak256("Lumira.storage.NFTSale.NFTSaleStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant NFT_SALE_STORAGE_LOCATION = 0x707edf5e14bfdf1ba58ecef846c170a48a35301414f4b4056ce0592b3a7a1c00;

    error NFTSale__InvalidValue();
    error NFTSale__DepositedAlready();
    error NFTSale__IncorrectState();
    error NFTSale__MerkleProofFailed();
    error NFTSale__NothingToClaim();
    error NFTSale__ParamsLengthMismatch();
    error NFTSale__InvalidTimestamp();
    error NFTSale__TotalSupplyExceeded();
    error NFTSale__InvalidImplementation();

    event Deposited(address indexed user, uint256 amount, bool indexed whitelist, uint64 publicAmount);
    event Refunded(address indexed user, uint256 amount, uint64 publicAmount);
    event Claimed(address indexed user, bool indexed whitelist, uint64 publicAmount);
    event BaseURISet(string newBaseURI, address indexed caller);
    event ReceiverSet(address newReceiver, address indexed caller);
    event RootsSet(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address participationToken, 
        uint64 maxTotalSupply, 
        uint64 publicAllocation, 
        uint64 whitelistPrice, 
        uint64 publicPrice
    ) {
        _disableInitializers();

        SBT_PARTICIPATION = participationToken;
        MAX_TOTAL_SUPPLY = maxTotalSupply;
        WHITELIST_PRICE = whitelistPrice;
        PUBLIC_PRICE = publicPrice;
    }
    
    function initialize(
        address defaultAdmin, 
        string calldata name, 
        string calldata symbol
    ) external initializerERC721A() initializer() {
        __UUPSUpgradeable_init();
        __ERC721A_init(name, symbol);
    }

    function deposit(bytes32[] calldata proof) external payable {
        _validateState(State.Deposit);
        if (msg.value == 0) revert NFTSale__InvalidValue();
    
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        uint256 _publicDepositValue;

        if (proof.length > 0) {
            if (userData.whitelistDeposited > 0) revert NFTSale__DepositedAlready();
            if (WHITELIST_PRICE > msg.value) revert NFTSale__InvalidValue();
            if (!MerkleProof.verify(proof, $._whitelistRoot, keccak256(abi.encode(msg.sender)))) {
                revert NFTSale__MerkleProofFailed();
            }

            userData.whitelistDeposited += 1;
            $._whitelistDeposited += 1;

            payable($._receiver).sendValue(WHITELIST_PRICE);

            if (msg.value > WHITELIST_PRICE) _publicDepositValue = msg.value - WHITELIST_PRICE;
        } else {
            _publicDepositValue = msg.value;
        }

        if (_publicDepositValue > 0) {
            if (_publicDepositValue % PUBLIC_PRICE != 0) revert NFTSale__InvalidValue();

            uint64 _amount = uint64(_publicDepositValue / PUBLIC_PRICE);

            userData.publicDeposited += _amount;
            $._publicDeposited += _amount;
        }

        emit Deposited(msg.sender, msg.value, proof.length > 0, uint64(_publicDepositValue / PUBLIC_PRICE));

        ISBTParticipation(SBT_PARTICIPATION).mint(msg.sender);
    }

    function refund(uint64 amountToRefund, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        if (!MerkleProof.verify(proof, $._refundRoot, keccak256(abi.encode(msg.sender, amountToRefund)))) {
            revert NFTSale__MerkleProofFailed();
        }

        uint64 _publicUnclaimed = userData.publicDeposited - userData.publicClaimed;
        
        if (_publicUnclaimed == 0) revert NFTSale__NothingToClaim();
        if (amountToRefund > _publicUnclaimed) revert NFTSale__NothingToClaim();

        uint64 _publicRefundAmount = amountToRefund * PUBLIC_PRICE;

        userData.publicDeposited -= amountToRefund;
        $._publicDeposited -= amountToRefund;

        payable(msg.sender).sendValue(_publicRefundAmount);

        emit Refunded(msg.sender, _publicRefundAmount, amountToRefund);
    }

    function claim(uint64 publicAllocationAmount, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        if (userData.whitelistDeposited == 0 && userData.publicDeposited == 0) {
            revert NFTSale__NothingToClaim();
        }

        uint64 _publicAmount;

        if (proof.length > 0) {
            if (!MerkleProof.verify(proof, $._publicRoot, keccak256(abi.encode(msg.sender, publicAllocationAmount)))) {
                revert NFTSale__MerkleProofFailed();
            }
            _publicAmount = publicAllocationAmount - userData.publicClaimed;
        }

        uint64 _whitelistAmount = userData.whitelistDeposited - userData.whitelistClaimed;

        if (_publicAmount == 0 && _whitelistAmount == 0) {
            revert NFTSale__NothingToClaim();
        }

        if (_publicAmount > 0) {
            $._publicClaimed += _publicAmount;
            userData.publicClaimed += _publicAmount;
            payable($._receiver).sendValue(_publicAmount * PUBLIC_PRICE);
        }

        if (_whitelistAmount > 0) {
            $._whitelistClaimed += _whitelistAmount;
            userData.whitelistClaimed += _whitelistAmount;
        }

        _validateTotalSupply(_publicAmount + _whitelistAmount);

        _safeMint(msg.sender, _publicAmount + _whitelistAmount);

        emit Claimed(msg.sender, _whitelistAmount > 0, _publicAmount);
    }

    function mintByAdmin(address[] calldata to, uint16[] calldata amounts) external {
        if (to.length != amounts.length) revert NFTSale__ParamsLengthMismatch();

        uint16 _totalAmount;

        for (uint16 i; to.length > i; i++) {
            _totalAmount += amounts[i];
        }

        _validateTotalSupply(_totalAmount);

        for (uint16 i; to.length > i; i++) {
            _safeMint(to[i], amounts[i]);
        }
    }

    function setTimestamps(
        uint32 newDepositStart,
        uint32 newDepositEnd,
        uint32 newClaimStart
    ) external {
        NFTSaleStorage storage $ = _getNFTSaleStorage();

        if ($._depositStart == 0 && block.timestamp >= newDepositStart) revert NFTSale__InvalidTimestamp();
        if (newDepositStart >= newDepositEnd) revert NFTSale__InvalidTimestamp();
        if (newDepositEnd >= newClaimStart) revert NFTSale__InvalidTimestamp();

        $._depositStart = newDepositStart;
        $._depositEnd = newDepositEnd;
        $._claimStart = newClaimStart;
    }

    function setBaseURI(string calldata newBaseURI) external {
        _setBaseURI(newBaseURI);
    }

    function setReceiver(address newReceiver) external {
        _setReceiver(newReceiver);
    }

    function setRoots(
        bytes32 newWhitelistRoot, 
        bytes32 newPublicRoot, 
        bytes32 newRefundRoot
    ) external {
        _setRoots(newWhitelistRoot, newPublicRoot, newRefundRoot);
    }

    function withdrawFunds(uint256 amount) external {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        payable($._receiver).sendValue(amount);
    }

    function getState() public view returns(State currentState) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        if ($._depositStart == 0) return State.Preparation;
        if ($._depositStart <= block.timestamp && block.timestamp <= $._depositEnd) return State.Deposit;
        if ($._claimStart <= block.timestamp) return State.Claim;
        return State.Preparation;
    }

    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids) {
        uint256 _ownerBalance = balanceOf(owner);
        if (_ownerBalance == 0) return new uint64[](0);

        ids = new uint64[](_ownerBalance);
        uint64 _counter;

        for (uint64 i; totalSupply() > i; i++) {
            if (ownerOf(i) == owner) {
                ids[_counter] = i;
                _counter += 1;
                if (_counter == _ownerBalance) return ids;
            }
        }
    }

    function receiver() external view returns(address fundsReceiver) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._receiver;
    }

    function getTimestamps() external view returns(uint32 depositStart, uint32 depositEnd, uint32 claimStart) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._depositStart, $._depositEnd, $._claimStart);
    }

    function getStats() external view returns(
        uint64 whitelistDeposited, 
        uint64 publicDeposited, 
        uint64 whitelistClaimed, 
        uint64 publicClaimed
    ) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistDeposited, $._publicDeposited, $._whitelistClaimed, $._publicClaimed);
    }

    function getRoots() external view returns(bytes32 whitelistRoot, bytes32 publicRoot, bytes32 refundRoot) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistRoot, $._publicRoot, $._refundRoot);
    }

    function getUserData(address user) external view returns(UserData memory userData) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._userData[user];
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC721AUpgradeable, ERC721AUpgradeable) returns(bool) {
        return super.supportsInterface(interfaceId);
    }

    function _validateTotalSupply(uint64 newTokensAmount) internal view {
        if (totalSupply() + newTokensAmount > MAX_TOTAL_SUPPLY) revert NFTSale__TotalSupplyExceeded();
    }

    function _validateState(State desiredState) internal view {
        if (getState() != desiredState) revert NFTSale__IncorrectState();          
    }

    function _baseURI() internal view override returns(string memory) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._baseURI;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        if (INFTSale(newImplementation).NFT_SALE_STORAGE_LOCATION() != NFT_SALE_STORAGE_LOCATION) {
            revert NFTSale__InvalidImplementation();
        }

        if (!IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId)) {
            revert NFTSale__InvalidImplementation();
        }
    }

    function _setBaseURI(string calldata newBaseURI) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._baseURI = newBaseURI;

        emit BaseURISet(newBaseURI, msg.sender);
    }

    function _setReceiver(address newReceiver) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._receiver = newReceiver;

        emit ReceiverSet(newReceiver, msg.sender);
    }

    function _setRoots(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot) internal {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        $._whitelistRoot = newWhitelistRoot;
        $._publicRoot = newPublicRoot;
        $._refundRoot = newRefundRoot;

        emit RootsSet(newWhitelistRoot, newPublicRoot, newRefundRoot, msg.sender);
    }

    function _getNFTSaleStorage() private pure returns(NFTSaleStorage storage $) {
        assembly {
            $.slot := NFT_SALE_STORAGE_LOCATION
        }
    }

}