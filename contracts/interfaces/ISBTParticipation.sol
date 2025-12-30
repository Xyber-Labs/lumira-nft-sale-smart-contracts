// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

interface ISBTParticipation is IERC721Metadata {

    function SBT_PARTICIPATION_STORAGE_LOCATION() external view returns(bytes32 storagePointer);

    function totalSupply() external view returns(uint256 tokenTotalSupply);

    function mint(address to) external;

    function setTokenURI(string calldata newTokenURI) external;

}