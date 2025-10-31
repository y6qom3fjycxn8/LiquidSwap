// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./OZ-confidential-contracts-fork/ERC7984.sol";

/**
 * @title ConfidentialToken
 * @dev Concrete implementation of ERC7984 confidential token with public minting capability for testing
 */
contract ConfidentialToken is ERC7984, SepoliaConfig {
    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) {}

    /**
     * @dev Mints encrypted tokens to an address (public for testing)
     * @param to The recipient address
     * @param encryptedAmount The encrypted amount to mint
     * @param inputProof The proof for the encrypted input
     */
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _mint(to, amount);
    }
}
