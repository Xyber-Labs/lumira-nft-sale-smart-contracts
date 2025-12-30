# NFTSale

## Overview

* **Purpose:** ERC721A NFT sale contract with whitelist and public allocations.
* **Features:**

  * Manages ETH deposits, refunds, and NFT claims with MerkleTree verification.
  * Implements ERC721A standard.
  * UUPS upgradeable contract with custom storage slot (ERC7201).

## Constants and Roles

* `SBT_PARTICIPATION` - address of the SBTParticipation contract.
* `MAX_TOTAL_SUPPLY` - maximum total supply of NFTs.
* `PUBLIC_ALLOCATION` - number of NFTs reserved for public allocation.
* `WHITELIST_PRICE` - price per NFT for whitelist participants.
* `PUBLIC_PRICE` - price per NFT for public participants.

## Events

* `Deposited(user, amount, whitelist, publicAmount)` - emitted on deposit.
* `Refunded(user, amount, publicAmount)` - emitted on ETH refund.
* `Claimed(user, whitelist, publicAmount)` - emitted when claiming NFTs.
* `BaseURISet(newBaseURI, caller)` - emitted when baseURI is updated.
* `ReceiverSet(newReceiver, caller)` - emitted when receiver address is updated.
* `RootsSet(newWhitelistRoot, newPublicRoot, newRefundRoot, caller)` - emitted when Merkle roots are updated.

## Errors

* `NFTSale__InvalidValue` - invalid msg.value.
* `NFTSale__DepositedAlready` - user already deposited in whitelist.
* `NFTSale__IncorrectState` - action not allowed in current sale phase.
* `NFTSale__MerkleProofFailed` - MerkleProof verification failed.
* `NFTSale__NothingToClaim` - no NFTs available to claim.
* `NFTSale__ParamsLengthMismatch` - parameter arrays length mismatch.
* `NFTSale__InvalidTimestamp` - invalid timestamps provided.
* `NFTSale__TotalSupplyExceeded` - total supply exceeded.
* `NFTSale__InvalidImplementation` - invalid implementation during upgrade.

## Public Functions

### `initialize(defaultAdmin, name, symbol)`

* Initializes the proxy contract.
* Grants `DEFAULT_ADMIN_ROLE` to `defaultAdmin`.

### `deposit(proof)`

* Allows a user to deposit ETH to participate in the NFT sale.
* Parameter: `proof` - MerkleProof array for whitelist verification.
* Emits `Deposited` event.
* Mints SBTParticipation token.

### `refund(amountToRefund, proof)`

* Refunds previously deposited ETH within public allocation.
* Parameters: `amountToRefund` - number of NFTs to refund, `proof` - MerkleProof array.
* Emits `Refunded` event.

### `claim(publicAllocationAmount, proof)`

* Claims purchased NFTs after the claim phase starts.
* Verifies public allocation with MerkleProof.
* Emits `Claimed` event.

### `mintByAdmin(to, amounts)`

* Admin function to mint NFTs directly to specified addresses.
* Checks array lengths and total supply.

### `setTimestamps(newDepositStart, newDepositEnd, newClaimStart)`

* Sets timestamps for deposit and claim phases.

### `setBaseURI(newBaseURI)`

* Updates base URI for all NFTs.
* Emits `BaseURISet` event.

### `setReceiver(newReceiver)`

* Updates ETH receiver address.
* Emits `ReceiverSet` event.

### `setRoots(newWhitelistRoot, newPublicRoot, newRefundRoot)`

* Sets Merkle roots for whitelist, public allocations, and refunds.
* Emits `RootsSet` event.

### `receiver()`

* Returns the current ETH receiver address.

### `getState()`

* Returns the current sale phase: `Preparation`, `Deposit`, or `Claim`.

### `getIdsOfOwner(owner)`

* Returns an array of token IDs owned by the specified address.

### `getTimestamps()`

* Returns timestamps of deposit and claim phases.

### `getStats()`

* Returns statistics for paid and claimed NFTs.

### `getRoots()`

* Returns storage stored Merkle roots.

### `getUserData(user)`

* Returns user's deposit and claim data.

## Internal Functions

* `_validateTotalSupply(newTokensAmount)` - validates max total supply.
* `_validateState(desiredState)` - validates current sale phase.
* `_baseURI()` - returns base URI.
* `_merkleProofVerify(proof, root, leaf)` - verifies Merkle proof.
* `_authorizeUpgrade(newImplementation)` - restricts contract upgrade.
* `_setBaseURI(newBaseURI)` - internal base URI update.
* `_setReceiver(newReceiver)` - internal receiver update.
* `_setRoots(newWhitelistRoot, newPublicRoot, newRefundRoot)` - internal roots update.
* `_getNFTSaleStorage()` - returns storage struct reference.