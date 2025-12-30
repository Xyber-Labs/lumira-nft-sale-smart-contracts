# SBTParticipation

## Overview

* **Purpose:** Soulbound Token (SBT) representing participation credentials.
* **Features:**

  * Non-transferable, bound to a single address.
  * Implements ERC721 with a single token URI for all tokens.
  * UUPS upgradeable contract with custom storage slot (ERC7201).

## Roles

* `MINTER_ROLE` - accounts allowed to mint new SBTs.

## Events

* `TokenURISet(newTokenURI, caller)` - emitted when token URI is updated.

## Errors

* `SBTParticipation__NonTransferableToken` - transfer attempt of a non-transferable token.
* `SBTParticipation__InvalidImplementation` - invalid implementation during upgrade.

## Public Functions

### `initialize(defaultAdmin, name, symbol)`

* Initializes proxy contract.
* Grants `DEFAULT_ADMIN_ROLE` to `defaultAdmin`.

### `mint(to)`

* Mints a new SBT to `to` address.
* Only callable by `MINTER_ROLE`.
* Each address can hold only one token.

### `setTokenURI(newTokenURI)`

* Updates token URI.
* Only callable by `DEFAULT_ADMIN_ROLE`.
* Emits `TokenURISet` event.

### `totalSupply()`

* Returns total minted SBTs.

### `tokenURI(tokenId)`

* Returns token URI for a given token.
* Token ID is ignored; all tokens share the same URI.

### `supportsInterface(interfaceId)`

* Returns true if contract implements interface identified by `interfaceId`.

### `transferFrom(from, to, tokenId)`

* Disabled; always reverts with `SBTParticipation__NonTransferableToken`.

## Internal Functions

* `_authorizeUpgrade(newImplementation)` - restricts contract upgrade.
* `_setTokenURI(newTokenURI)` - internal function to update token URI.
* `_getSBTParticipationStorage()` - returns storage struct reference.