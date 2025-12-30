// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/ISBTParticipation.sol";

/**
 * @title SBTParticipation
 * @notice Soulbound Token (SBT) representing participation credentials.
 * @dev
 * - Tokens are non-transferable and bound to a single address.
 * - Implements ERC721 standard with a single token URI for all tokens.
 * - UUPS upgradeable contract with custom storage slot noted as ERC7201.
 */
contract SBTParticipation is ISBTParticipation, ERC721Upgradeable, UUPSUpgradeable, AccessControlUpgradeable {

    /// @notice {AccessControl} role identifier for accounts allowed to mint new SBTs.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @custom:storage-location erc7201:Lumira.storage.SBTParticipation.SBTParticipationStorage
    struct SBTParticipationStorage {
        string _tokenURI;
        uint256 _totalSupply;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("Lumira.storage.SBTParticipation.SBTParticipationStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant SBT_PARTICIPATION_STORAGE_LOCATION = 0xa782adf6f0f856f02f0b3b335988a42afe2ebfdd01e88ab039268431e8040e00;

    /// @notice Error indicating an attempt transfer of a non-transferable token.
    error SBTParticipation__NonTransferableToken();
 
    /// @notice Error indicating an invalid specified new implementation during {upgradeToAndCall}.
    error SBTParticipation__InvalidImplementation();

    /**
     * @notice Emitted when the token URI is updated.
     * @param newTokenURI The new {_tokenURI} string.
     * @param caller The {msg.sender} address that updated the {_tokenURI}.
     */
    event TokenURISet(string newTokenURI, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initializes the proxy contract with admin and ERC721 parameters.
     * @dev Grants {DEFAULT_ADMIN_ROLE} to {defaultAdmin}.
     * @param defaultAdmin Address that will be granted of {DEFAULT_ADMIN_ROLE} role.
     * @param name ERC721 soulbound token {name}.
     * @param symbol ERC721 soulbound token {symbol}.
     */
    function initialize(address defaultAdmin, string calldata name, string calldata symbol) external initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC721_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Mints a new SBT to the specified address.
     * @dev Only callable by {MINTER_ROLE}. Each address may hold only one token.
     * @param to Address that will receive the SBT.
     */
    function mint(address to) external onlyRole(MINTER_ROLE) {
        if (balanceOf(to) == 0) {
            _safeMint(to, totalSupply());

            SBTParticipationStorage storage $ = _getSBTParticipationStorage();
            $._totalSupply++;
        }
    }

    /**
     * @notice Updates the base token URI.
     * @dev Only callable by {DEFAULT_ADMIN_ROLE}. Emits {TokenURISet} event.
     * @param newTokenURI The new {_tokenURI} string.
     */
    function setTokenURI(string calldata newTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(newTokenURI);
    }

    /**
     * @notice Returns the total supply of SBTs.
     * @return tokenTotalSupply The total minted supply.
     */
    function totalSupply() public view returns(uint256 tokenTotalSupply) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._totalSupply;
    }

    /**
     * @notice Returns the token URI for a given token.
     * @dev TokenId is ignored, all tokens share the same URI.
     * @return tokenURIString The metadata {_tokenURI} string.
     */
    function tokenURI(uint256 /* tokenId */) public view override(ERC721Upgradeable, IERC721Metadata) returns(string memory tokenURIString) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._tokenURI;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC721Upgradeable, AccessControlUpgradeable) returns(bool) {
        return interfaceId == type(ISBTParticipation).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Prevents transfer of SBTs.
     * @dev Always reverts with {SBTParticipation__NonTransferableToken}.
     */
    function transferFrom(address /* from */, address /* to */, uint256 /* tokenId */) public override(ERC721Upgradeable, IERC721) {
        revert SBTParticipation__NonTransferableToken();
    }

    /**
     * @notice Overridden {UUPSUpgradeable} internal function to restrict implementation upgrade.
     * @dev Ensures {newImplementation} has correct storage slot and supports {AccessControl}.
     * @param newImplementation Address of the specified {newImplementation}.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            ISBTParticipation(newImplementation).SBT_PARTICIPATION_STORAGE_LOCATION() == SBT_PARTICIPATION_STORAGE_LOCATION,
            SBTParticipation__InvalidImplementation()
        );

        require(
            IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId),
            SBTParticipation__InvalidImplementation()
        );
    }

    function _setTokenURI(string calldata newTokenURI) internal {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        $._tokenURI = newTokenURI;

        emit TokenURISet(newTokenURI, msg.sender);
    } 

    function _getSBTParticipationStorage() private pure returns(SBTParticipationStorage storage $) {
        assembly {
            $.slot := SBT_PARTICIPATION_STORAGE_LOCATION
        }
    }

}