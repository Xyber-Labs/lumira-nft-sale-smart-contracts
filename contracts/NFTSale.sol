// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";

import "./interfaces/ISBTParticipation.sol";
import "./interfaces/INFTSale.sol";

/**
 * @title NFTSale
 * @notice ERC721A NFT Sale contract with whitelist and public allocations.        
 * @dev 
 * - Manages ETH deposits, refunds, and claims of ERC721A NFTs with MerkleTree verification.
 * - Implements ERC721A (https://github.com/chiru-labs/ERC721A) standard.
 * - UUPS upgradeable contract with custom storage slot noted as ERC7201.
 */
contract NFTSale is INFTSale, ERC721AUpgradeable, UUPSUpgradeable, AccessControlUpgradeable, OwnableUpgradeable {
    using Address for *;

    /// @notice Address of the {SBTParticipation} token contract.
    address public immutable SBT_PARTICIPATION;

    /// @notice Maximum total supply of {NFTSale} {ERC721A} NFTs.
    uint64 public immutable MAX_TOTAL_SUPPLY;

    /// @notice Price per one NFT for whitelist participants.
    uint64 public immutable WHITELIST_PRICE;

    /// @notice Price per one NFT for public participants.
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

    /// @dev keccak256(abi.encode(uint256(keccak256("Lumira.storage.NFTSale.NFTSaleStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant NFT_SALE_STORAGE_LOCATION = 0x707edf5e14bfdf1ba58ecef846c170a48a35301414f4b4056ce0592b3a7a1c00;

    /// @notice Error indicating a {msg.value} is incorrect.
    error NFTSale__InvalidValue();

    /// @notice Error indicating a whitelist participant has already deposited.
    error NFTSale__DepositedAlready();

    /// @notice Error indicating an incorrect sale phase for the desired action.
    error NFTSale__IncorrectState();

    /// @notice Error indicating a {MerkleProof} verification fails.
    error NFTSale__MerkleProofFailed();

    /// @notice Error indicating there are no NFTs available to claim.
    error NFTSale__NothingToClaim();

    /// @notice Error indicating a parameters length mismatch.
    error NFTSale__ParamsLengthMismatch();

    /// @notice Error indicating an invalid specified timestamps.
    error NFTSale__InvalidTimestamp();

    /// @notice Error indicating a total supply would be exceeded.
    error NFTSale__TotalSupplyExceeded();

    /// @notice Error indicating an invalid specified new implementation during {upgradeToAndCall}.
    error NFTSale__InvalidImplementation();

    /**
     * @notice Emitted when a user deposits funds for NFTs by {deposit} function.
     * @param user Address of the user who made the deposit.
     * @param amount Amount of ETH deposited.
     * @param whitelist True if the deposit included the whitelist allocation, false if only public.
     * @param publicAmount Number of NFTs paid within a public allocation.
     */
    event Deposited(address indexed user, uint256 amount, bool indexed whitelist, uint64 publicAmount);

    /**
     * @notice Emitted when a user get an ETH refund within a public allocation by {refund} function.
     * @param user Address of the user receiving the ETH refund.
     * @param amount Amount of ETH refunded.
     * @param publicAmount Number of NFTs corresponding to the refunded amount.
     */
    event Refunded(address indexed user, uint256 amount, uint64 publicAmount);

    /**
     * @notice Emitted when a user claims NFTs by {claim} function.
     * @param user Address of the user claiming NFTs.
     * @param whitelist True if the claim included the whitelist allocation, false if only public.
     * @param publicAmount Number of NFTs claimed within a public allocation.
     */
    event Claimed(address indexed user, bool indexed whitelist, uint64 publicAmount);

    /**
     * @notice Emitted when baseURI is updated by {setBaseURI} function.
     * @param newBaseURI The new {_baseURI} string.
     * @param caller The {msg.sender} address that updated the {_baseURI}.
     */
    event BaseURISet(string newBaseURI, address indexed caller);

    /**
     * @notice Emitted when receiver is updated by {setReceiver} function.
     * @param newReceiver The new {_receiver} address.
     * @param caller The {msg.sender} address that updated the {_receiver}.
     */
    event ReceiverSet(address newReceiver, address indexed caller);

    /**
     * @notice Emitted when merkleTree roots are updated by {setRoots} function.
     * @param newWhitelistRoot The new {_whitelistRoot} for whitelist allocation deposits.
     * @param newPublicRoot The new {_publicRoot} for public allocation claims.
     * @param newRefundRoot The new {_refundRoot} for public allocation refunds.
     * @param caller The {msg.sender} address that updated the {_whitelistRoot}, {_publicRoot}, and {_refundRoot}.
     */
    event RootsSet(bytes32 newWhitelistRoot, bytes32 newPublicRoot, bytes32 newRefundRoot, address indexed caller);

    /**
     * @notice Constructor disables initializer and sets immutable variables.
     * @param participationToken Address of the {SBTParticipation} token contract.
     * @param maxTotalSupply Maximum total supply of {NFTSale} {ERC721A} NFTs.
     * @param whitelistPrice Price per one NFT for whitelist participants.
     * @param publicPrice Price per one NFT for public sale participants.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(
        address participationToken, 
        uint64 maxTotalSupply, 
        uint64 whitelistPrice, 
        uint64 publicPrice
    ) {
        _disableInitializers();

        SBT_PARTICIPATION = participationToken;
        MAX_TOTAL_SUPPLY = maxTotalSupply;
        WHITELIST_PRICE = whitelistPrice;
        PUBLIC_PRICE = publicPrice;
    }

    /**
     * @notice Initializes the proxy contract with admin and ERC721A parameters.
     * @dev Grants {DEFAULT_ADMIN_ROLE} to {defaultAdmin}.
     * @param defaultAdmin Address that will be granted of {DEFAULT_ADMIN_ROLE} role.
     * @param name ERC721A token {name}.
     * @param symbol ERC721A token {symbol}.
     */
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

    function initializeV2(address defaultOwner) external reinitializer(2) {
        __Ownable_init(defaultOwner);
    }

    /**
     * @notice Allows a user to deposit ETH to participate in the NFT sale within whitelist or/and public allocations.
     * @dev Handles whitelist and public deposits, emits {Deposited} event, and mints {SBTParticipation} token.
     * @param proof MerkleTree-proof array for whitelist eligibility verification.
     */
    function deposit(bytes32[] calldata proof) external payable {
        _validateState(State.Deposit);
        require(msg.value > 0, NFTSale__InvalidValue());
    
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        uint256 _publicDepositValue;
        uint256 _valueToSend;
        uint64 _publicAmount;

        if (proof.length > 0) {
            require(userData.whitelistDeposited == 0, NFTSale__DepositedAlready());
            require(msg.value >= WHITELIST_PRICE, NFTSale__InvalidValue());
            _merkleProofVerify(proof, $._whitelistRoot, abi.encode(msg.sender));

            userData.whitelistDeposited += 1;
            $._whitelistDeposited += 1;
            _valueToSend += WHITELIST_PRICE;

            if (msg.value > WHITELIST_PRICE) _publicDepositValue = msg.value - WHITELIST_PRICE;
        } else {
            _publicDepositValue = msg.value;
        }

        if (_publicDepositValue > 0) {
            require(_publicDepositValue % PUBLIC_PRICE == 0, NFTSale__InvalidValue());

            _publicAmount = uint64(_publicDepositValue / PUBLIC_PRICE);

            userData.publicDeposited += _publicAmount;
            $._publicDeposited += _publicAmount;
        }

        emit Deposited(msg.sender, msg.value, proof.length > 0, _publicAmount);

        ISBTParticipation(SBT_PARTICIPATION).mint(msg.sender);

        if (_valueToSend > 0) payable($._receiver).sendValue(_valueToSend);
    }

    /**
     * @notice Refunds a user's previously deposited ETH within public allocation.
     * @dev Verifies refund eligibility using MerkleTree-proof, send ETH, and emits {Refunded} event.
     * @param amountToRefund Number of NFTs to refund within the public allocation.
     * @param proof MerkleTree-proof array for refund eligibility verification.
     */
    function refund(uint64 amountToRefund, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        _merkleProofVerify(proof, $._refundRoot, abi.encode(msg.sender, amountToRefund));

        uint64 _publicUnclaimed = userData.publicDeposited - userData.publicClaimed;
        
        require(_publicUnclaimed >= amountToRefund && _publicUnclaimed != 0, NFTSale__NothingToClaim());

        uint64 _publicRefundAmount = amountToRefund * PUBLIC_PRICE;

        userData.publicDeposited -= amountToRefund;
        $._publicDeposited -= amountToRefund;

        emit Refunded(msg.sender, _publicRefundAmount, amountToRefund);

        payable(msg.sender).sendValue(_publicRefundAmount);
    }

    /**
     * @notice Claims purchased NFTs after claim phase starts.
     * @dev Verifies public allocation claims using MerkleTree-proof, mints NFTs, and emits {Claimed} event.
     * @param publicAllocationAmount Number of NFTs to claim within public allocation.
     * @param proof MerkleTree-proof array for public eligibility verification.
     */
    function claim(uint64 publicAllocationAmount, bytes32[] calldata proof) external {
        _validateState(State.Claim);

        NFTSaleStorage storage $ = _getNFTSaleStorage();
        UserData storage userData = $._userData[msg.sender];

        require(userData.whitelistDeposited > 0 || userData.publicDeposited > 0, NFTSale__NothingToClaim());

        uint64 _publicAmount;

        if (proof.length > 0) {
            _merkleProofVerify(proof, $._publicRoot, abi.encode(msg.sender, publicAllocationAmount));

            _publicAmount = publicAllocationAmount - userData.publicClaimed;
        }

        uint64 _whitelistAmount = userData.whitelistDeposited - userData.whitelistClaimed;

        require(_publicAmount > 0 || _whitelistAmount > 0, NFTSale__NothingToClaim());

        if (_publicAmount > 0) {
            $._publicClaimed += _publicAmount;
            userData.publicClaimed += _publicAmount;
        }

        if (_whitelistAmount > 0) {
            $._whitelistClaimed += _whitelistAmount;
            userData.whitelistClaimed += _whitelistAmount;
        }

        _validateTotalSupply(_publicAmount + _whitelistAmount);

        _safeMint(msg.sender, _publicAmount + _whitelistAmount);

        emit Claimed(msg.sender, _whitelistAmount > 0, _publicAmount);
    }

    /**
     * @notice Allows an admin to mint NFTs directly to specified addresses.
     * @dev Validates arrays' lengths and total supply before minting.
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}.
     * @param to Array of recievers addresses.
     * @param amounts Array of amounts to mint per reciever.
     */
    function mintByAdmin(address[] calldata to, uint16[] calldata amounts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to.length == amounts.length, NFTSale__ParamsLengthMismatch());

        uint16 _totalAmount;

        for (uint16 i; to.length > i; i++) _totalAmount += amounts[i];

        _validateTotalSupply(_totalAmount);

        for (uint16 i; to.length > i; i++) _safeMint(to[i], amounts[i]);
    }

    /**
     * @notice Sets deposit and claim phase timestamps.
     * @dev Validates that timestamps are in chronological order.
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}.
     * @param newDepositStart Start timestamp of the deposit phase.
     * @param newDepositEnd End timestamp of the deposit phase.
     * @param newClaimStart Start timestamp of the claim phase.
     */
    function setTimestamps(
        uint32 newDepositStart,
        uint32 newDepositEnd,
        uint32 newClaimStart
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();

        if ($._depositStart == 0) require(newDepositStart > block.timestamp, NFTSale__InvalidTimestamp());
        require(newDepositEnd > newDepositStart, NFTSale__InvalidTimestamp());
        require(newClaimStart > newDepositEnd, NFTSale__InvalidTimestamp());

        $._depositStart = newDepositStart;
        $._depositEnd = newDepositEnd;
        $._claimStart = newClaimStart;
    }

    /**
     * @notice Updates the base URI for all minted NFTs.
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}. Emits {BaseURISet} event.
     * @param newBaseURI The new {_baseURI} string.
     */
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseURI(newBaseURI);
    }

    /**
     * @notice Updates the receiver of deposited ETH (all of whitelist allocation and public allocation).
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}. Emits {ReceiverSet} event.
     * @param newReceiver The new {_receiver} address.
     */
    function setReceiver(address newReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setReceiver(newReceiver);
    }

    /**
     * @notice Sets all merkleTree roots for whitelist and public allocations, and refund eligibility.
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}. Emits {RootsSet} event.
     * @param newWhitelistRoot The new {_whitelistRoot} for whitelist allocation deposits.
     * @param newPublicRoot The new {_publicRoot} for public allocation claims.
     * @param newRefundRoot The new {_refundRoot} for public allocation refunds.
     */
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

    /**
     * @notice Returns the current ETH receiver address.
     * @return fundsReceiver The {_receiver} address.
     */
    function receiver() external view returns(address fundsReceiver) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._receiver;
    }

    /**
     * @notice Returns the current NFT sale phase.
     * @return currentState Current {INFTSale.State} NFT sale phase.
     */
    function getState() public view returns(State currentState) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        if ($._depositStart == 0) return State.Preparation;
        if ($._depositStart <= block.timestamp && block.timestamp <= $._depositEnd) return State.Deposit;
        if ($._claimStart <= block.timestamp) return State.Claim;
        return State.Preparation;
    }

    /**
     * @notice Returns the IDs of all NFTs owned by a specified user.
     * @param owner Address of the NFTs holder.
     * @return ids Array of NFT token IDs.
     */
    function getIdsOfOwner(address owner) external view returns(uint64[] memory ids) {
        uint256 _ownerBalance = balanceOf(owner);
        if (_ownerBalance == 0) return new uint64[](0);

        ids = new uint64[](_ownerBalance);
        uint16 _counter;

        for (uint16 i; totalSupply() > i; i++) {
            if (ownerOf(i) == owner) {
                ids[_counter] = i;
                _counter += 1;
                if (_counter == _ownerBalance) return ids;
            }
        }
    }

    /**
     * @notice Returns timestamps of deposit and claim phases.
     * @return depositStart Start timestamp {_depositStart} of the deposit phase.
     * @return depositEnd End timestamp {_depositEnd} of the deposit phase.
     * @return claimStart Start timestamp {_claimStart} of the claim phase.
     */
    function getTimestamps() external view returns(uint32 depositStart, uint32 depositEnd, uint32 claimStart) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._depositStart, $._depositEnd, $._claimStart);
    }

    /**
     * @notice Returns sale statistics of paid and claimed NFTs.
     * @return whitelistDeposited The {_whitelistDeposited} number of paid NFTs within whitelist allocation.
     * @return publicDeposited The {_publicDeposited} number of paid NFTs within public allocation.
     * @return whitelistClaimed The {_whitelistClaimed} number of claimed NFTs within whitelist allocation.
     * @return publicClaimed The {_publicClaimed} number of claimed NFTs within public allocation.
     */
    function getStats() external view returns(
        uint64 whitelistDeposited, 
        uint64 publicDeposited, 
        uint64 whitelistClaimed, 
        uint64 publicClaimed
    ) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistDeposited, $._publicDeposited, $._whitelistClaimed, $._publicClaimed);
    }

    /**
     * @notice Returns all merkleTree roots used for verification.
     * @return whitelistRoot The {_whitelistRoot} for whitelist allocation deposits.
     * @return publicRoot The {_publicRoot} for public allocation claims.
     * @return refundRoot The{_refundRoot} for public allocation refunds.
     */
    function getRoots() external view returns(bytes32 whitelistRoot, bytes32 publicRoot, bytes32 refundRoot) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return ($._whitelistRoot, $._publicRoot, $._refundRoot);
    }

    /**
     * @notice Returns stored user's data for a specified user address.
     * @param user Address of the user.
     * @return userData {INFTSale.UserData} struct containing user's deposits and claims:
     *         - {_userData[user].whitelistDeposited} - number of paid NFTs within whitelist allocation.
     *         - {_userData[user].publicDeposited} - number of paid NFTs within public allocation.
     *         - {_userData[user].whitelistClaimed} - number of claimed NFTs within whitelist allocation.
     *         - {_userData[user].publicClaimed} - number of claimed NFTs within public allocation.
     */
    function getUserData(address user) external view returns(UserData memory userData) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._userData[user];
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(IERC721AUpgradeable, ERC721AUpgradeable, AccessControlUpgradeable) returns(bool) {
        return interfaceId == type(INFTSale).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Internal function to validate max total supply.
    function _validateTotalSupply(uint64 newTokensAmount) internal view {
        require(MAX_TOTAL_SUPPLY >= totalSupply() + newTokensAmount, NFTSale__TotalSupplyExceeded());
    }

    /// @notice Internal function to validate the sale phase.
    function _validateState(State desiredState) internal view {
        require(getState() == desiredState, NFTSale__IncorrectState());
    }

    /// @notice Overridden {ERC721A} internal function to returns base URI for NFTs metadata.
    function _baseURI() internal view override returns(string memory) {
        NFTSaleStorage storage $ = _getNFTSaleStorage();
        return $._baseURI;
    }

    /// @notice Internal function to verify merkleTree-proof.
    function _merkleProofVerify(bytes32[] calldata proof, bytes32 root, bytes memory leaf) internal pure {
        require(MerkleProof.verify(proof, root, keccak256(bytes.concat(keccak256(leaf)))), NFTSale__MerkleProofFailed());
    }

    /** 
     * @notice Overridden {UUPSUpgradeable} internal function to restrict implementation upgrade.
     * @dev Ensures {newImplementation} has correct storage slot and supports {AccessControl}.
     * @param newImplementation Address of the specified {newImplementation}.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            INFTSale(newImplementation).NFT_SALE_STORAGE_LOCATION() == NFT_SALE_STORAGE_LOCATION,
            NFTSale__InvalidImplementation()
        );

        require(
            IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId),
            NFTSale__InvalidImplementation()
        );
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