// SPDX-License-Identifier: BSD-3-Clause-Clear
// Updated for fhEVM 0.9.1 - Self-relaying decryption pattern with Queue Mode

pragma solidity ^0.8.27;

import {FHE, externalEuint64, ebool, euint16, euint32, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "./OZ-confidential-contracts-fork/ERC7984.sol";
import {IERC7984} from "./OZ-confidential-contracts-fork/IERC7984.sol";
import {SwapLib} from "./SwapLib.sol";

/**
 * @title LiquidSwapPair
 * @dev Confidential Swap Pair - fhEVM 0.9.1 version with Queue Mode.
 *      This contract implements liquidity provision, token swapping using confidential computations.
 *      Updated to use self-relaying decryption pattern (no Oracle callbacks).
 *
 *      QUEUE MODE: Multiple users can have pending operations simultaneously.
 *      Each user can have one pending operation at a time, but different users
 *      don't block each other. Operations are processed when callbacks are submitted.
 *
 * @notice In fhEVM 0.9.1, decryption works as follows:
 *         1. Contract marks values as publicly decryptable via FHE.makePubliclyDecryptable()
 *         2. Client uses relayer SDK to decrypt off-chain
 *         3. Client submits decrypted values + proof back to contract
 *         4. Contract verifies with FHE.checkSignatures()
 */
contract LiquidSwapPair is ERC7984, ZamaEthereumConfig {
    // Structs
    struct addLiqDecBundleStruct {
        euint64 _sentAmount0;
        euint64 _sentAmount1;
        euint128 _partialupperPart0;
        euint128 _partialupperPart1;
        euint128 _divLowerPart0;
        euint128 _divLowerPart1;
        euint128 _obfuscatedReserve0;
        euint128 _obfuscatedReserve1;
        address _user;
        uint256 timestamp;
        bool active;
    }
    struct removeLiqDecBundleStruct {
        euint64 _lpSent;
        euint128 _upperPart0;
        euint128 _upperPart1;
        euint128 _divLowerPart0;
        euint128 _divLowerPart1;
        address _from;
        address _to;
        uint256 timestamp;
        bool active;
    }
    struct obfuscatedReservesStruct {
        euint128 obfuscatedReserve0;
        euint128 obfuscatedReserve1;
    }
    struct swapDecBundleStruct {
        euint128 divUpperPart0;
        euint128 divUpperPart1;
        euint128 divLowerPart0;
        euint128 divLowerPart1;
        euint64 amount0In;
        euint64 amount1In;
        address from;
        address to;
        uint256 timestamp;
        bool active;
    }
    struct swapOutputStruct {
        euint64 amount0Out;
        euint64 amount1Out;
    }
    enum Operation {
        None,
        AddLiquidity,
        RemoveLiquidity,
        Swap
    }

    // Per-user pending operation tracking (Queue Mode)
    struct userPendingOperationStruct {
        uint256 requestID;
        Operation operation;
        uint256 timestamp;
        bool hasPending;
    }

    struct standardRefundStruct {
        euint64 amount0;
        euint64 amount1;
    }
    struct liquidityRemovalRefundStruct {
        euint64 lpAmount;
    }

    // Mappings
    mapping(uint256 requestID => addLiqDecBundleStruct) private addLiqDecBundle;
    mapping(uint256 requestID => removeLiqDecBundleStruct) private removeLiqDecBundle;
    mapping(uint256 requestID => swapDecBundleStruct) private swapDecBundle;
    mapping(uint256 requestID => swapOutputStruct) private swapOutput;
    mapping(address from => mapping(uint256 requestID => standardRefundStruct)) public standardRefund;
    mapping(address from => mapping(uint256 requestID => liquidityRemovalRefundStruct)) public liquidityRemovalRefund;

    // Per-user pending operation (Queue Mode)
    mapping(address user => userPendingOperationStruct) public userPendingOperation;

    // Request ID counter
    uint256 private requestIDCounter;

    // Events
    event liquidityMinted(uint256 blockNumber, address user);
    event liquidityBurnt(uint256 blockNumber, address user);
    event DecryptionPending(address indexed from, uint256 indexed requestID, Operation operation, bytes32[] handles);
    event Swap(address from, euint64 amount0In, euint64 amount1In, euint64 amount0Out, euint64 amount1Out, address to);
    event Refund(address from, uint256 blockNumber, uint256 requestID);
    event discloseReservesInfo(
        uint256 blockNumber,
        address user,
        euint128 obfuscatedReserve0,
        euint128 obfuscatedReserve1
    );
    event PriceScannerUpdated(address indexed previousScanner, address indexed newScanner);
    event ReserveViewerAdded(address indexed viewer);

    // Errors
    error Expired();
    error UserHasPendingOperation(address user, uint256 requestID, uint256 until);
    error Forbidden();
    error WrongRequestID();
    error NoRefund();
    error AlreadyInitialized();
    error InvalidAddress();
    error InvalidTokens();
    error UnexpectedOperation();
    error InvalidCleartext();
    error RequestNotActive();
    error NotRequestOwner();
    error OperationNotExpired();

    // Variables
    // Predefined constants and initial values
    euint64 private immutable ZERO;
    uint64 public immutable scalingFactor;
    uint64 public immutable MINIMUM_LIQUIDITY;
    uint256 private constant MAX_OPERATION_TIME = 5 minutes;
    bool private minLiquidityLocked = false;

    // Addresses of the factory and associated tokens
    address public factory;
    address public priceScanner;
    address public token0Address;
    address public token1Address;
    IERC7984 private token0;
    IERC7984 private token1;

    // Reserve values for token0 and token1
    euint64 private reserve0;
    euint64 private reserve1;

    obfuscatedReservesStruct public obfuscatedReserves;
    address[] private reserveViewerList;
    mapping(address => bool) private _reserveViewer;

    /**
     * @dev Constructor for the pair contract.
     * Sets the factory address and initializes the token.
     */
    constructor(address _priceScanner) ERC7984("Liquidity Token", "PAIR", "") {
        factory = msg.sender;
        priceScanner = _priceScanner;

        ZERO = FHE.asEuint64(0);

        scalingFactor = uint64(10) ** uint64(decimals());
        MINIMUM_LIQUIDITY = 100 * scalingFactor;

        reserve0 = ZERO;
        reserve1 = ZERO;

        FHE.allowThis(reserve0);
        FHE.allowThis(reserve1);

        if (_priceScanner != address(0)) {
            _registerReserveViewer(_priceScanner);
        }

        _updateObfuscatedReserves();
    }

    /**
     * @dev Modifier to ensure only factory can call certain functions.
     */
    modifier onlyFactory() {
        if (msg.sender != factory) revert Forbidden();
        _;
    }

    /**
     * @dev Modifier to ensure that the action occurs before the deadline epoch.
     * @param deadlineTimestamp The deadline timestamp.
     */
    modifier ensure(uint256 deadlineTimestamp) {
        if (block.timestamp >= deadlineTimestamp) revert Expired();
        _;
    }

    /**
     * @dev Modifier to ensure user doesn't have a pending operation (Queue Mode).
     *      Each user can only have one pending operation at a time.
     *      Different users can operate simultaneously.
     */
    modifier userOperationAvailable() {
        userPendingOperationStruct memory pending = userPendingOperation[msg.sender];
        if (
            pending.hasPending &&
            block.timestamp < pending.timestamp + MAX_OPERATION_TIME
        ) {
            revert UserHasPendingOperation(msg.sender, pending.requestID, pending.timestamp + MAX_OPERATION_TIME);
        }
        _;
    }

    /**
     * @dev Initializes the pair contract with the addresses of the two tokens.
     *      This function can only be called once by the factory contract.
     * @param _token0 Address of the first token in the pair.
     * @param _token1 Address of the second token in the pair.
     */
    function initialize(address _token0, address _token1) external onlyFactory {
        if (token0Address != address(0) || token1Address != address(0)) revert AlreadyInitialized();
        if (_token0 == address(0) || _token1 == address(0) || _token0 == _token1) revert InvalidTokens();
        token0 = IERC7984(_token0);
        token1 = IERC7984(_token1);
        token0Address = _token0;
        token1Address = _token1;
    }

    /**
     * @dev Updates the designated price scanner address and ensures it can read obfuscated reserves.
     *      Only callable by the factory that deployed the pair.
     * @param newScanner Address of the new scanner service.
     */
    function setPriceScanner(address newScanner) external onlyFactory {
        if (newScanner == address(0)) revert InvalidAddress();
        address previous = priceScanner;
        if (previous == newScanner) {
            return;
        }

        priceScanner = newScanner;
        _registerReserveViewer(newScanner);

        emit PriceScannerUpdated(previous, newScanner);
    }

    /**
     * @dev Grants access to obfuscated reserve snapshots for an additional viewer.
     * @param viewer Address allowed to request decryption of obfuscated reserves.
     */
    function addReserveViewer(address viewer) external onlyFactory {
        _registerReserveViewer(viewer);
    }

    /**
     * @dev Batch grants access to obfuscated reserve snapshots for additional viewers.
     * @param viewers List of addresses to authorize.
     */
    function addReserveViewers(address[] calldata viewers) external onlyFactory {
        for (uint256 i = 0; i < viewers.length; i++) {
            _registerReserveViewer(viewers[i]);
        }
    }

    /**
     * @dev Returns all addresses that currently receive obfuscated reserve snapshots.
     */
    function getReserveViewers() external view returns (address[] memory) {
        return reserveViewerList;
    }

    /**
     * @dev Returns true once the minimum liquidity has been locked, meaning the pool holds assets.
     */
    function hasLiquidity() external view returns (bool) {
        return minLiquidityLocked;
    }

    /**
     * @dev Checks whether an address already has access to obfuscated reserves.
     */
    function isReserveViewer(address viewer) external view returns (bool) {
        return _reserveViewer[viewer];
    }

    /**
     * @dev Exposes the pending operation for a specific user (Queue Mode).
     * @param user The address to check
     */
    function getUserPendingOperationInfo(address user)
        external
        view
        returns (uint256 requestID, bool hasPending, uint256 timestamp, Operation operation)
    {
        userPendingOperationStruct memory info = userPendingOperation[user];
        return (info.requestID, info.hasPending, info.timestamp, info.operation);
    }

    /**
     * @dev Legacy function for backward compatibility - returns caller's pending operation.
     */
    function getPendingOperationInfo()
        external
        view
        returns (uint256 requestID, bool isPending, uint256 timestamp, Operation operation)
    {
        userPendingOperationStruct memory info = userPendingOperation[msg.sender];
        return (info.requestID, info.hasPending, info.timestamp, info.operation);
    }

    /**
     * @dev Updates the reserve amounts for token0 and token1.
     * @param newReserve0 The new reserve amount for token0.
     * @param newReserve1 The new reserve amount for token1.
     */
    function _updateReserves(euint64 newReserve0, euint64 newReserve1) internal {
        reserve0 = newReserve0;
        reserve1 = newReserve1;

        FHE.allowThis(reserve0);
        FHE.allowThis(reserve1);
        _updateObfuscatedReserves();
    }

    /**
     * @dev Recomputes and stores obfuscated reserves using randomized multipliers,
     *      then updates ACL so this contract and every registered viewer can read them.
     *      This helps publish reserve-like values without revealing exact reserves.
     *      Computed price from obfuscated reserve is +- 7% close to the real price.
     */
    function _updateObfuscatedReserves() internal {
        (euint128 _obfuscatedReserve0, euint128 _obfuscatedReserve1) = SwapLib.computeObfuscatedReserves(
            reserve0,
            reserve1,
            scalingFactor
        );

        obfuscatedReserves.obfuscatedReserve0 = _obfuscatedReserve0;
        obfuscatedReserves.obfuscatedReserve1 = _obfuscatedReserve1;

        FHE.allowThis(obfuscatedReserves.obfuscatedReserve0);
        FHE.allowThis(obfuscatedReserves.obfuscatedReserve1);

        _allowObfuscatedReservesToViewers();
    }

    function _allowObfuscatedReservesToViewers() internal {
        uint256 length = reserveViewerList.length;
        for (uint256 i = 0; i < length; i++) {
            address viewer = reserveViewerList[i];
            if (viewer == address(0)) {
                continue;
            }
            FHE.allow(obfuscatedReserves.obfuscatedReserve0, viewer);
            FHE.allow(obfuscatedReserves.obfuscatedReserve1, viewer);
        }
    }

    function _registerReserveViewer(address viewer) internal {
        if (viewer == address(0)) revert InvalidAddress();
        if (_reserveViewer[viewer]) {
            return;
        }

        _reserveViewer[viewer] = true;
        reserveViewerList.push(viewer);

        if (FHE.isInitialized(obfuscatedReserves.obfuscatedReserve0)) {
            FHE.allow(obfuscatedReserves.obfuscatedReserve0, viewer);
            FHE.allow(obfuscatedReserves.obfuscatedReserve1, viewer);
        }

        emit ReserveViewerAdded(viewer);
    }

    /**
     * @dev Transfers tokens from a user to the pool and updates reserves.
     */
    function _transferTokensToPool(
        address from,
        euint64 amount0In,
        euint64 amount1In,
        bool updateReserves
    ) internal returns (euint64 sentAmount0, euint64 sentAmount1) {
        euint64 balance0Before = token0.confidentialBalanceOf(address(this));
        euint64 balance1Before = token1.confidentialBalanceOf(address(this));

        token0.confidentialTransferFrom(from, address(this), amount0In);
        token1.confidentialTransferFrom(from, address(this), amount1In);

        euint64 balance0After = token0.confidentialBalanceOf(address(this));
        euint64 balance1After = token1.confidentialBalanceOf(address(this));

        sentAmount0 = FHE.sub(balance0After, balance0Before);
        sentAmount1 = FHE.sub(balance1After, balance1Before);

        if (updateReserves) {
            _updateReserves(FHE.add(reserve0, sentAmount0), FHE.add(reserve1, sentAmount1));
        }
    }

    /**
     * @dev Transfers tokens from the pool to a user.
     */
    function _transferTokensFromPool(address to, euint64 amount0Out, euint64 amount1Out, bool updateReserves) internal {
        euint64 balance0Before = token0.confidentialBalanceOf(address(this));
        euint64 balance1Before = token1.confidentialBalanceOf(address(this));

        FHE.allowTransient(amount0Out, token0Address);
        FHE.allowTransient(amount1Out, token1Address);

        token0.confidentialTransfer(to, amount0Out);
        token1.confidentialTransfer(to, amount1Out);

        euint64 balance0After = token0.confidentialBalanceOf(address(this));
        euint64 balance1After = token1.confidentialBalanceOf(address(this));

        euint64 sentAmount0 = FHE.sub(balance0Before, balance0After);
        euint64 sentAmount1 = FHE.sub(balance1Before, balance1After);

        if (updateReserves) {
            _updateReserves(FHE.sub(reserve0, sentAmount0), FHE.sub(reserve1, sentAmount1));
        }
    }

    /**
     * @dev Transfers liquidity tokens from a user to the pool.
     */
    function _transferLPToPool(address from, euint64 LPAmount) internal returns (euint64 sentAmount) {
        euint64 balanceBefore = confidentialBalanceOf(address(this));
        confidentialTransferFrom(from, address(this), LPAmount);
        euint64 balanceAfter = confidentialBalanceOf(address(this));

        sentAmount = FHE.sub(balanceAfter, balanceBefore);
    }

    /**
     * @dev Mints liquidity tokens for the user.
     */
    function _mintLP(euint64 liquidityAmount, address user) internal {
        if (!minLiquidityLocked) {
            euint64 mintAmount = FHE.sub(liquidityAmount, MINIMUM_LIQUIDITY);
            _mint(user, mintAmount);
            minLiquidityLocked = true;
        } else {
            _mint(user, liquidityAmount);
        }

        emit liquidityMinted(block.number, user);
    }

    /**
     * @dev Handles the initial liquidity mint ensuring minimum liquidity constraints.
     */
    function _firstMint(address to, euint64 amount0, euint64 amount1) internal {
        (euint64 liquidityAmount, euint64 amount0Back, euint64 amount1Back) = SwapLib.computeFirstMint(
            amount0,
            amount1,
            MINIMUM_LIQUIDITY
        );

        FHE.allowTransient(amount0Back, token0Address);
        FHE.allowTransient(amount1Back, token1Address);

        token0.confidentialTransfer(msg.sender, amount0Back);
        token1.confidentialTransfer(msg.sender, amount1Back);

        _mintLP(liquidityAmount, to);
    }

    /**
     * @dev Generate next request ID
     */
    function _getNextRequestID() internal returns (uint256) {
        return ++requestIDCounter;
    }

    /**
     * @dev Set user's pending operation (Queue Mode)
     */
    function _setUserPendingOperation(address user, uint256 requestID, Operation operation) internal {
        userPendingOperation[user] = userPendingOperationStruct({
            requestID: requestID,
            operation: operation,
            timestamp: block.timestamp,
            hasPending: true
        });
    }

    /**
     * @dev Clear user's pending operation (Queue Mode)
     */
    function _clearUserPendingOperation(address user) internal {
        delete userPendingOperation[user];
    }

    // ========== ADD LIQUIDITY ==========

    /**
     * @dev External function that manage liquidity adding.
     *      This function is called by another smart contract.
     */
    function addLiquidity(euint64 amount0, euint64 amount1, uint256 deadline) external {
        FHE.allowTransient(amount0, token0Address);
        FHE.allowTransient(amount1, token1Address);
        _addLiquidity(amount0, amount1, msg.sender, deadline);
    }

    /**
     * @dev External function that manage liquidity adding from dApp with encrypted inputs.
     */
    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        uint256 deadline,
        bytes calldata inputProof
    ) external {
        euint64 amount0 = FHE.fromExternal(encryptedAmount0, inputProof);
        euint64 amount1 = FHE.fromExternal(encryptedAmount1, inputProof);

        FHE.allowTransient(amount0, token0Address);
        FHE.allowTransient(amount1, token1Address);

        _addLiquidity(amount0, amount1, msg.sender, deadline);
    }

    /**
     * @dev Internal function that manages liquidity addition.
     *      In fhEVM 0.9.1, values are marked as publicly decryptable and client
     *      must call addLiquidityCallback with decrypted values + proof.
     */
    function _addLiquidity(
        euint64 amount0,
        euint64 amount1,
        address from,
        uint256 deadline
    ) internal ensure(deadline) userOperationAvailable {
        if (!minLiquidityLocked) {
            (euint64 sentAmount0, euint64 sentAmount1) = _transferTokensToPool(from, amount0, amount1, true);
            _firstMint(from, sentAmount0, sentAmount1);
        } else {
            (euint64 sentAmount0, euint64 sentAmount1) = _transferTokensToPool(from, amount0, amount1, false);
            euint128 currentLPSupply = FHE.asEuint128(confidentialTotalSupply());

            (
                euint128 divLowerPart0,
                euint128 divLowerPart1,
                euint128 partialUpperPart0,
                euint128 partialUpperPart1
            ) = SwapLib.computeAddLiquidity(reserve0, reserve1, currentLPSupply);

            uint256 requestID = _getNextRequestID();

            // Store bundle for later callback
            addLiqDecBundle[requestID]._sentAmount0 = sentAmount0;
            addLiqDecBundle[requestID]._sentAmount1 = sentAmount1;
            addLiqDecBundle[requestID]._partialupperPart0 = partialUpperPart0;
            addLiqDecBundle[requestID]._partialupperPart1 = partialUpperPart1;
            addLiqDecBundle[requestID]._divLowerPart0 = divLowerPart0;
            addLiqDecBundle[requestID]._divLowerPart1 = divLowerPart1;
            addLiqDecBundle[requestID]._obfuscatedReserve0 = obfuscatedReserves.obfuscatedReserve0;
            addLiqDecBundle[requestID]._obfuscatedReserve1 = obfuscatedReserves.obfuscatedReserve1;
            addLiqDecBundle[requestID]._user = from;
            addLiqDecBundle[requestID].timestamp = block.timestamp;
            addLiqDecBundle[requestID].active = true;

            FHE.allowThis(addLiqDecBundle[requestID]._sentAmount0);
            FHE.allowThis(addLiqDecBundle[requestID]._sentAmount1);
            FHE.allowThis(addLiqDecBundle[requestID]._partialupperPart0);
            FHE.allowThis(addLiqDecBundle[requestID]._partialupperPart1);

            // Mark values as publicly decryptable (fhEVM 0.9.1)
            FHE.makePubliclyDecryptable(divLowerPart0);
            FHE.makePubliclyDecryptable(divLowerPart1);
            FHE.makePubliclyDecryptable(obfuscatedReserves.obfuscatedReserve0);
            FHE.makePubliclyDecryptable(obfuscatedReserves.obfuscatedReserve1);

            // Set user's pending operation (Queue Mode)
            _setUserPendingOperation(from, requestID, Operation.AddLiquidity);

            standardRefund[from][requestID].amount0 = sentAmount0;
            standardRefund[from][requestID].amount1 = sentAmount1;

            FHE.allowThis(standardRefund[from][requestID].amount0);
            FHE.allowThis(standardRefund[from][requestID].amount1);
            FHE.allow(standardRefund[from][requestID].amount0, from);
            FHE.allow(standardRefund[from][requestID].amount1, from);

            // Emit handles for client to decrypt
            bytes32[] memory handles = new bytes32[](4);
            handles[0] = FHE.toBytes32(divLowerPart0);
            handles[1] = FHE.toBytes32(divLowerPart1);
            handles[2] = FHE.toBytes32(obfuscatedReserves.obfuscatedReserve0);
            handles[3] = FHE.toBytes32(obfuscatedReserves.obfuscatedReserve1);

            emit DecryptionPending(from, requestID, Operation.AddLiquidity, handles);
        }
    }

    /**
     * @dev Callback for add-liquidity after client decrypts values off-chain.
     *      Client must call this with decrypted values and proof from relayer SDK.
     *      Anyone can submit the callback, not just the original user.
     * @param requestID The request ID from DecryptionPending event
     * @param cleartexts ABI-encoded decrypted values (divLowerPart0, divLowerPart1, obfRes0, obfRes1)
     * @param decryptionProof Proof from relayer SDK
     */
    function addLiquidityCallback(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        if (!addLiqDecBundle[requestID].active) revert RequestNotActive();

        // Verify decryption proof (fhEVM 0.9.1)
        bytes32[] memory handles = new bytes32[](4);
        handles[0] = FHE.toBytes32(addLiqDecBundle[requestID]._divLowerPart0);
        handles[1] = FHE.toBytes32(addLiqDecBundle[requestID]._divLowerPart1);
        handles[2] = FHE.toBytes32(addLiqDecBundle[requestID]._obfuscatedReserve0);
        handles[3] = FHE.toBytes32(addLiqDecBundle[requestID]._obfuscatedReserve1);

        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint128 divLowerPart0, uint128 divLowerPart1, uint128 _obfuscatedReserve0, uint128 _obfuscatedReserve1) = abi
            .decode(cleartexts, (uint128, uint128, uint128, uint128));
        if (divLowerPart0 == 0 || divLowerPart1 == 0) revert InvalidCleartext();

        uint128 scaling = uint128(scalingFactor);
        uint128 reserve1Base = _obfuscatedReserve1 / scaling;
        uint128 reserve0Base = _obfuscatedReserve0 / scaling;
        if (reserve1Base == 0 || reserve0Base == 0) revert InvalidCleartext();

        uint128 priceToken0 = _obfuscatedReserve0 / reserve1Base;
        uint128 priceToken1 = _obfuscatedReserve1 / reserve0Base;

        euint64 sentAmount0 = addLiqDecBundle[requestID]._sentAmount0;
        euint64 sentAmount1 = addLiqDecBundle[requestID]._sentAmount1;
        euint128 partialUpperPart0 = addLiqDecBundle[requestID]._partialupperPart0;
        euint128 partialUpperPart1 = addLiqDecBundle[requestID]._partialupperPart1;
        address user = addLiqDecBundle[requestID]._user;

        (
            euint64 refundAmount0,
            euint64 refundAmount1,
            euint64 mintAmount,
            euint64 amount0,
            euint64 amount1
        ) = SwapLib.computeAddLiquidityCallback(
                sentAmount0,
                sentAmount1,
                partialUpperPart0,
                partialUpperPart1,
                divLowerPart0,
                divLowerPart1,
                priceToken0,
                priceToken1,
                scalingFactor
            );

        _transferTokensFromPool(user, refundAmount0, refundAmount1, false);
        _mintLP(mintAmount, user);
        _updateReserves(FHE.add(reserve0, amount0), FHE.add(reserve1, amount1));

        // Clear user's pending operation (Queue Mode)
        _clearUserPendingOperation(user);
        delete standardRefund[user][requestID];
        delete addLiqDecBundle[requestID];
    }

    // ========== REMOVE LIQUIDITY ==========

    function _removeLiquidity(
        euint64 lpAmount,
        address from,
        address to,
        uint256 deadline
    ) internal ensure(deadline) userOperationAvailable {
        euint64 sentLP = _transferLPToPool(from, lpAmount);
        euint128 currentLPSupply128 = FHE.asEuint128(confidentialTotalSupply());

        (euint128 divUpperPart0, euint128 divUpperPart1, euint128 divLowerPart0, euint128 divLowerPart1) = SwapLib
            .computeRemoveLiquidity(reserve0, reserve1, sentLP, currentLPSupply128);

        uint256 requestID = _getNextRequestID();

        removeLiqDecBundle[requestID]._lpSent = sentLP;
        removeLiqDecBundle[requestID]._upperPart0 = divUpperPart0;
        removeLiqDecBundle[requestID]._upperPart1 = divUpperPart1;
        removeLiqDecBundle[requestID]._divLowerPart0 = divLowerPart0;
        removeLiqDecBundle[requestID]._divLowerPart1 = divLowerPart1;
        removeLiqDecBundle[requestID]._from = from;
        removeLiqDecBundle[requestID]._to = to;
        removeLiqDecBundle[requestID].timestamp = block.timestamp;
        removeLiqDecBundle[requestID].active = true;

        FHE.allowThis(removeLiqDecBundle[requestID]._lpSent);
        FHE.allowThis(removeLiqDecBundle[requestID]._upperPart0);
        FHE.allowThis(removeLiqDecBundle[requestID]._upperPart1);

        // Mark values as publicly decryptable (fhEVM 0.9.1)
        FHE.makePubliclyDecryptable(divLowerPart0);
        FHE.makePubliclyDecryptable(divLowerPart1);

        // Set user's pending operation (Queue Mode)
        _setUserPendingOperation(from, requestID, Operation.RemoveLiquidity);

        liquidityRemovalRefund[from][requestID].lpAmount = sentLP;

        FHE.allowThis(liquidityRemovalRefund[from][requestID].lpAmount);
        FHE.allow(liquidityRemovalRefund[from][requestID].lpAmount, from);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(divLowerPart0);
        handles[1] = FHE.toBytes32(divLowerPart1);

        emit DecryptionPending(from, requestID, Operation.RemoveLiquidity, handles);
    }

    function removeLiquidityCallback(
        uint256 requestID,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        if (!removeLiqDecBundle[requestID].active) revert RequestNotActive();

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(removeLiqDecBundle[requestID]._divLowerPart0);
        handles[1] = FHE.toBytes32(removeLiqDecBundle[requestID]._divLowerPart1);

        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint128 divLowerPart0, uint128 divLowerPart1) = abi.decode(cleartexts, (uint128, uint128));
        if (divLowerPart0 == 0 || divLowerPart1 == 0) revert InvalidCleartext();

        euint64 burnAmount = removeLiqDecBundle[requestID]._lpSent;
        euint128 divUpperPart0 = removeLiqDecBundle[requestID]._upperPart0;
        euint128 divUpperPart1 = removeLiqDecBundle[requestID]._upperPart1;
        address from = removeLiqDecBundle[requestID]._from;
        address to = removeLiqDecBundle[requestID]._to;

        euint64 amount0Out = FHE.asEuint64(FHE.div(divUpperPart0, divLowerPart0));
        euint64 amount1Out = FHE.asEuint64(FHE.div(divUpperPart1, divLowerPart1));

        _transferTokensFromPool(to, amount0Out, amount1Out, true);
        _burn(address(this), burnAmount);
        emit liquidityBurnt(block.number, from);

        // Clear user's pending operation (Queue Mode)
        _clearUserPendingOperation(from);
        delete liquidityRemovalRefund[from][requestID];
        delete removeLiqDecBundle[requestID];
    }

    function removeLiquidity(euint64 lpAmount, address to, uint256 deadline) external {
        _removeLiquidity(lpAmount, msg.sender, to, deadline);
    }

    function removeLiquidity(
        externalEuint64 encryptedLPAmount,
        address to,
        uint256 deadline,
        bytes calldata inputProof
    ) external {
        euint64 lpAmount = FHE.fromExternal(encryptedLPAmount, inputProof);
        _removeLiquidity(lpAmount, msg.sender, to, deadline);
    }

    // ========== SWAP ==========

    function swapTokens(euint64 amount0In, euint64 amount1In, address to, uint256 deadline) external {
        FHE.allowTransient(amount0In, token0Address);
        FHE.allowTransient(amount1In, token1Address);
        _swapTokens(amount0In, amount1In, msg.sender, to, deadline);
    }

    function swapTokens(
        externalEuint64 encryptedAmount0In,
        externalEuint64 encryptedAmount1In,
        address to,
        uint256 deadline,
        bytes calldata inputProof
    ) external {
        euint64 amount0In = FHE.fromExternal(encryptedAmount0In, inputProof);
        euint64 amount1In = FHE.fromExternal(encryptedAmount1In, inputProof);

        FHE.allowTransient(amount0In, token0Address);
        FHE.allowTransient(amount1In, token1Address);

        _swapTokens(amount0In, amount1In, msg.sender, to, deadline);
    }

    function _swapTokens(
        euint64 amount0In,
        euint64 amount1In,
        address from,
        address to,
        uint256 deadline
    ) internal ensure(deadline) userOperationAvailable {
        (euint64 sent0, euint64 sent1) = _transferTokensToPool(from, amount0In, amount1In, true);

        (euint128 divUpperPart0, euint128 divUpperPart1, euint128 divLowerPart0, euint128 divLowerPart1) = SwapLib
            .computeSwap(sent0, sent1, reserve0, reserve1);

        uint256 requestID = _getNextRequestID();

        swapDecBundle[requestID].divUpperPart0 = divUpperPart0;
        swapDecBundle[requestID].divUpperPart1 = divUpperPart1;
        swapDecBundle[requestID].divLowerPart0 = divLowerPart0;
        swapDecBundle[requestID].divLowerPart1 = divLowerPart1;
        swapDecBundle[requestID].amount0In = amount0In;
        swapDecBundle[requestID].amount1In = amount1In;
        swapDecBundle[requestID].from = from;
        swapDecBundle[requestID].to = to;
        swapDecBundle[requestID].timestamp = block.timestamp;
        swapDecBundle[requestID].active = true;

        FHE.allowThis(swapDecBundle[requestID].divUpperPart0);
        FHE.allowThis(swapDecBundle[requestID].divUpperPart1);
        FHE.allowThis(swapDecBundle[requestID].amount0In);
        FHE.allowThis(swapDecBundle[requestID].amount1In);

        // Mark values as publicly decryptable (fhEVM 0.9.1)
        FHE.makePubliclyDecryptable(divLowerPart0);
        FHE.makePubliclyDecryptable(divLowerPart1);

        // Set user's pending operation (Queue Mode)
        _setUserPendingOperation(from, requestID, Operation.Swap);

        standardRefund[from][requestID].amount0 = sent0;
        standardRefund[from][requestID].amount1 = sent1;

        FHE.allowThis(standardRefund[from][requestID].amount0);
        FHE.allowThis(standardRefund[from][requestID].amount1);
        FHE.allow(standardRefund[from][requestID].amount0, from);
        FHE.allow(standardRefund[from][requestID].amount1, from);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(divLowerPart0);
        handles[1] = FHE.toBytes32(divLowerPart1);

        emit DecryptionPending(from, requestID, Operation.Swap, handles);
    }

    function swapTokensCallback(uint256 requestID, bytes memory cleartexts, bytes memory decryptionProof) external {
        if (!swapDecBundle[requestID].active) revert RequestNotActive();

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(swapDecBundle[requestID].divLowerPart0);
        handles[1] = FHE.toBytes32(swapDecBundle[requestID].divLowerPart1);

        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint128 _divLowerPart0, uint128 _divLowerPart1) = abi.decode(cleartexts, (uint128, uint128));
        if (_divLowerPart0 == 0 || _divLowerPart1 == 0) revert InvalidCleartext();

        euint128 _divUpperPart0 = swapDecBundle[requestID].divUpperPart0;
        euint128 _divUpperPart1 = swapDecBundle[requestID].divUpperPart1;
        address from = swapDecBundle[requestID].from;
        address to = swapDecBundle[requestID].to;

        euint64 amount0Out = FHE.asEuint64(FHE.div(_divUpperPart0, _divLowerPart0));
        euint64 amount1Out = FHE.asEuint64(FHE.div(_divUpperPart1, _divLowerPart1));

        FHE.allowThis(amount0Out);
        FHE.allowThis(amount1Out);
        _transferTokensFromPool(to, amount0Out, amount1Out, true);

        swapOutput[requestID].amount0Out = amount0Out;
        swapOutput[requestID].amount1Out = amount1Out;

        FHE.allow(swapDecBundle[requestID].amount0In, from);
        FHE.allow(swapDecBundle[requestID].amount1In, from);
        FHE.allow(swapOutput[requestID].amount0Out, from);
        FHE.allow(swapOutput[requestID].amount1Out, from);

        emit Swap(
            from,
            swapDecBundle[requestID].amount0In,
            swapDecBundle[requestID].amount1In,
            swapOutput[requestID].amount0Out,
            swapOutput[requestID].amount1Out,
            to
        );

        // Clear user's pending operation (Queue Mode)
        _clearUserPendingOperation(from);
        delete standardRefund[from][requestID];
        delete swapDecBundle[requestID];
        delete swapOutput[requestID];
    }

    // ========== REFUNDS ==========

    function requestLiquidityAddingRefund(uint256 requestID) public {
        if (
            !FHE.isInitialized(standardRefund[msg.sender][requestID].amount0) ||
            !FHE.isInitialized(standardRefund[msg.sender][requestID].amount1)
        ) revert NoRefund();

        euint64 refundAmount0 = standardRefund[msg.sender][requestID].amount0;
        euint64 refundAmount1 = standardRefund[msg.sender][requestID].amount1;

        _transferTokensFromPool(msg.sender, refundAmount0, refundAmount1, false);

        // Clear user's pending operation if this is their current one (Queue Mode)
        if (userPendingOperation[msg.sender].requestID == requestID) {
            _clearUserPendingOperation(msg.sender);
        }

        delete standardRefund[msg.sender][requestID];
        delete addLiqDecBundle[requestID];
        emit Refund(msg.sender, block.number, requestID);
    }

    function requestSwapRefund(uint256 requestID) public {
        if (
            !FHE.isInitialized(standardRefund[msg.sender][requestID].amount0) ||
            !FHE.isInitialized(standardRefund[msg.sender][requestID].amount1)
        ) revert NoRefund();

        euint64 refundAmount0 = standardRefund[msg.sender][requestID].amount0;
        euint64 refundAmount1 = standardRefund[msg.sender][requestID].amount1;

        _transferTokensFromPool(msg.sender, refundAmount0, refundAmount1, true);

        // Clear user's pending operation if this is their current one (Queue Mode)
        if (userPendingOperation[msg.sender].requestID == requestID) {
            _clearUserPendingOperation(msg.sender);
        }

        delete standardRefund[msg.sender][requestID];
        delete swapDecBundle[requestID];
        delete swapOutput[requestID];
        emit Refund(msg.sender, block.number, requestID);
    }

    function requestLiquidityRemovalRefund(uint256 requestID) public {
        if (!FHE.isInitialized(liquidityRemovalRefund[msg.sender][requestID].lpAmount)) revert NoRefund();

        _transfer(address(this), msg.sender, liquidityRemovalRefund[msg.sender][requestID].lpAmount);

        // Clear user's pending operation if this is their current one (Queue Mode)
        if (userPendingOperation[msg.sender].requestID == requestID) {
            _clearUserPendingOperation(msg.sender);
        }

        delete liquidityRemovalRefund[msg.sender][requestID];
        delete removeLiqDecBundle[requestID];
        emit Refund(msg.sender, block.number, requestID);
    }
}
