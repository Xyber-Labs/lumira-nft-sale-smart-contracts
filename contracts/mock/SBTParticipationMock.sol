// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../interfaces/ISBTParticipation.sol";

contract SBTParticipationMock is ISBTParticipation, ERC721Upgradeable, UUPSUpgradeable, AccessControlUpgradeable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @custom:storage-location erc7201:Lumira.storage.SBTParticipation.SBTParticipationStorage
    struct SBTParticipationStorage {
        string _tokenURI;
        uint256 _totalSupply;
    }

    // keccak256(abi.encode(uint256(keccak256("Lumira.storage.SBTParticipation.SBTParticipationStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant SBT_PARTICIPATION_STORAGE_LOCATION = 0xa782adf6f0f856f02f0b3b335988a42afe2ebfdd01e88ab039268431e8040e01;

    error SBTParticipation__NonTransferableToken();
    error SBTParticipation__InvalidImplementation();

    event TokenURISet(string newTokenURI, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address defaultAdmin, string calldata name, string calldata symbol) external initializer() {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC721_init(name, symbol);

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function mint(address to) external onlyRole(MINTER_ROLE) {
        if (balanceOf(to) == 0) {
            _safeMint(to, totalSupply());

            SBTParticipationStorage storage $ = _getSBTParticipationStorage();
            $._totalSupply++;
        }
    }

    function setTokenURI(string calldata newTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(newTokenURI);
    }

    function totalSupply() public view returns(uint256 tokenTotalSupply) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._totalSupply;
    }

    function tokenURI(uint256 /* tokenId */) public view override(ERC721Upgradeable, IERC721Metadata) returns(string memory tokenURIString) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._tokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC721Upgradeable, AccessControlUpgradeable) returns(bool) {
        return interfaceId == type(ISBTParticipation).interfaceId || super.supportsInterface(interfaceId);
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* tokenId */) public override(ERC721Upgradeable, IERC721) {
        revert SBTParticipation__NonTransferableToken();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (ISBTParticipation(newImplementation).SBT_PARTICIPATION_STORAGE_LOCATION() != SBT_PARTICIPATION_STORAGE_LOCATION) {
            revert SBTParticipation__InvalidImplementation();
        }

        if (!IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId)) {
            revert SBTParticipation__InvalidImplementation();
        }
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

contract SBTParticipationMockTwo is ISBTParticipation, ERC721Upgradeable, UUPSUpgradeable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @custom:storage-location erc7201:Lumira.storage.SBTParticipation.SBTParticipationStorage
    struct SBTParticipationStorage {
        string _tokenURI;
        uint256 _totalSupply;
    }

    // keccak256(abi.encode(uint256(keccak256("Lumira.storage.SBTParticipation.SBTParticipationStorage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 public constant SBT_PARTICIPATION_STORAGE_LOCATION = 0xa782adf6f0f856f02f0b3b335988a42afe2ebfdd01e88ab039268431e8040e00;

    error SBTParticipation__NonTransferableToken();
    error SBTParticipation__InvalidImplementation();

    event TokenURISet(string newTokenURI, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address defaultAdmin, string calldata name, string calldata symbol) external initializer() {
        __UUPSUpgradeable_init();
        __ERC721_init(name, symbol);
    }

    function mint(address to) external {
        if (balanceOf(to) == 0) {
            _safeMint(to, totalSupply());

            SBTParticipationStorage storage $ = _getSBTParticipationStorage();
            $._totalSupply++;
        }
    }

    function setTokenURI(string calldata newTokenURI) external {
        _setTokenURI(newTokenURI);
    }

    function totalSupply() public view returns(uint256 tokenTotalSupply) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._totalSupply;
    }

    function tokenURI(uint256 /* tokenId */) public view override(ERC721Upgradeable, IERC721Metadata) returns(string memory tokenURIString) {
        SBTParticipationStorage storage $ = _getSBTParticipationStorage();
        return $._tokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC721Upgradeable) returns(bool) {
        return interfaceId == type(ISBTParticipation).interfaceId || super.supportsInterface(interfaceId);
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* tokenId */) public override(ERC721Upgradeable, IERC721) {
        revert SBTParticipation__NonTransferableToken();
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        if (ISBTParticipation(newImplementation).SBT_PARTICIPATION_STORAGE_LOCATION() != SBT_PARTICIPATION_STORAGE_LOCATION) {
            revert SBTParticipation__InvalidImplementation();
        }

        if (!IERC165(newImplementation).supportsInterface(type(IAccessControl).interfaceId)) {
            revert SBTParticipation__InvalidImplementation();
        }
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