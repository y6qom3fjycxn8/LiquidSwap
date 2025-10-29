// SPDX-License-Identifier: MIT
// Fork of un-commited "@openzeppelin/confidential-contracts update to fhevm 0.8.0
// See : https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/pull/202

pragma solidity ^0.8.27;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @dev Draft interface for a confidential fungible token standard utilizing the Zama FHE library.
interface IERC7984 {
    /**
     * @dev Emitted when the expiration timestamp for an operator `operator` is updated for a given `holder`.
     * The operator may move any amount of tokens on behalf of the holder until the timestamp `until`.
     */
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    /// @dev Emitted when a confidential transfer is made from `from` to `to` of encrypted amount `amount`.
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);

    /**
     * @dev Emitted when an encrypted amount is disclosed.
     *
     * Accounts with access to the encrypted amount `encryptedAmount` that is also accessible to this contract
     * should be able to disclose the amount. This functionality is implementation specific.
     */
    event AmountDisclosed(euint64 indexed encryptedAmount, uint64 amount);

    /// @dev Returns the name of the token.
    function name() external view returns (string memory);

    /// @dev Returns the symbol of the token.
    function symbol() external view returns (string memory);

    /// @dev Returns the number of decimals of the token. Recommended to be 6.
    function decimals() external view returns (uint8);

    /// @dev Returns the token URI.
    function tokenURI() external view returns (string memory);

    /// @dev Returns the confidential total supply of the token.
    function confidentialTotalSupply() external view returns (euint64);

    /// @dev Returns the confidential balance of the account `account`.
    function confidentialBalanceOf(address account) external view returns (euint64);

    /// @dev Returns true if `spender` is currently an operator for `holder`.
    function isOperator(address holder, address spender) external view returns (bool);

    /**
     * @dev Sets `operator` as an operator for `holder` until the timestamp `until`.
     *
     * NOTE: An operator may transfer any amount of tokens on behalf of a holder while approved.
     */
    function setOperator(address operator, uint48 until) external;

    /**
     * @dev Transfers the encrypted amount `encryptedAmount` to `to` with the given input proof `inputProof`.
     *
     * Returns the encrypted amount that was actually transferred.
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);

    /**
     * @dev Similar to {confidentialTransfer-address-externalEuint64-bytes} but without an input proof. The caller
     * *must* already be allowed by ACL for the given `amount`.
     */
    function confidentialTransfer(address to, euint64 amount) external returns (euint64 transferred);

    /**
     * @dev Transfers the encrypted amount `encryptedAmount` from `from` to `to` with the given input proof
     * `inputProof`. `msg.sender` must be either `from` or an operator for `from`.
     *
     * Returns the encrypted amount that was actually transferred.
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);

    /**
     * @dev Similar to {confidentialTransferFrom-address-address-externalEuint64-bytes} but without an input proof.
     * The caller *must* be already allowed by ACL for the given `amount`.
     */
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64 transferred);

    /**
     * @dev Similar to {confidentialTransfer-address-externalEuint64-bytes} but with a callback to `to` after
     * the transfer.
     *
     * The callback is made to the {IERC7984Receiver-onConfidentialTransferReceived} function on the
     * to address with the actual transferred amount (may differ from the given `encryptedAmount`) and the given
     * data `data`.
     */
    function confidentialTransferAndCall(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);

    /// @dev Similar to {confidentialTransfer-address-euint64} but with a callback to `to` after the transfer.
    function confidentialTransferAndCall(
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);

    /**
     * @dev Similar to {confidentialTransferFrom-address-address-externalEuint64-bytes} but with a callback to `to`
     * after the transfer.
     */
    function confidentialTransferFromAndCall(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);

    /**
     * @dev Similar to {confidentialTransferFrom-address-address-euint64} but with a callback to `to`
     * after the transfer.
     *
     */
    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);
}
