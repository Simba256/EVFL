// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LaunchToken.sol";
import "./WeightedPool.sol";
import "./PoolRegistry.sol";

/**
 * @title TokenFactory
 * @notice Factory contract for creating new tokens and their weighted pools
 * @dev Creates LaunchToken + WeightedPool pairs for memecoin launches
 */
contract TokenFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant ONE = 1e18;
    uint256 public constant DEFAULT_SWAP_FEE = 0.003e18; // 0.3%
    uint256 public constant MIN_INITIAL_SUPPLY = 1000e18; // Minimum 1000 tokens
    uint256 public constant MAX_INITIAL_SUPPLY = 1_000_000_000_000e18; // Max 1 trillion

    // Quote token (WBNB on BSC)
    address public immutable quoteToken;

    // Pool registry
    PoolRegistry public immutable registry;

    // Launch fee in native token (BNB)
    uint256 public launchFee;

    // Default weights (can be overridden per launch)
    uint256 public defaultTokenWeight = 0.8e18; // 80%
    uint256 public defaultQuoteWeight = 0.2e18; // 20%

    // Fee recipient
    address public feeRecipient;

    // Track all created tokens
    address[] public allTokens;
    mapping(address => bool) public isTokenFromFactory;

    // Token info struct
    struct TokenInfo {
        address token;
        address pool;
        address creator;
        string name;
        string symbol;
        uint256 initialSupply;
        uint256 createdAt;
    }

    mapping(address => TokenInfo) public tokenInfo;

    // Events
    event TokenCreated(
        address indexed token,
        address indexed pool,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event DefaultWeightsUpdated(uint256 tokenWeight, uint256 quoteWeight);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // Errors
    error InvalidSupply();
    error InvalidWeight();
    error InsufficientFee();
    error InsufficientLiquidity();
    error TransferFailed();
    error ZeroAddress();
    error SymbolTaken();

    constructor(
        address quoteToken_,
        address registry_,
        uint256 launchFee_,
        address feeRecipient_
    ) Ownable(msg.sender) {
        if (quoteToken_ == address(0)) revert ZeroAddress();
        if (registry_ == address(0)) revert ZeroAddress();
        if (feeRecipient_ == address(0)) revert ZeroAddress();

        quoteToken = quoteToken_;
        registry = PoolRegistry(registry_);
        launchFee = launchFee_;
        feeRecipient = feeRecipient_;
    }

    /**
     * @notice Create a new token and its weighted pool
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI Token metadata URI (IPFS)
     * @param initialSupply Initial token supply
     * @param initialQuoteAmount Initial quote token (WBNB) for liquidity
     * @param tokenWeight Weight of the new token (e.g., 0.8e18 for 80%)
     * @return token Address of created token
     * @return pool Address of created pool
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata tokenURI,
        uint256 initialSupply,
        uint256 initialQuoteAmount,
        uint256 tokenWeight
    ) external payable nonReentrant returns (address token, address pool) {
        // Validate inputs
        if (initialSupply < MIN_INITIAL_SUPPLY || initialSupply > MAX_INITIAL_SUPPLY) {
            revert InvalidSupply();
        }
        if (msg.value < launchFee) revert InsufficientFee();
        if (initialQuoteAmount == 0) revert InsufficientLiquidity();

        uint256 quoteWeight = ONE - tokenWeight;
        if (tokenWeight < 0.5e18 || tokenWeight > 0.99e18) revert InvalidWeight();

        // Collect launch fee
        if (launchFee > 0) {
            (bool sent, ) = feeRecipient.call{value: launchFee}("");
            if (!sent) revert TransferFailed();
        }

        // Refund excess BNB
        uint256 excess = msg.value - launchFee;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            if (!refunded) revert TransferFailed();
        }

        // Transfer quote tokens from creator
        IERC20(quoteToken).safeTransferFrom(msg.sender, address(this), initialQuoteAmount);

        // Deploy new token
        LaunchToken newToken = new LaunchToken(
            name,
            symbol,
            tokenURI,
            initialSupply,
            msg.sender
        );
        token = address(newToken);

        // Deploy weighted pool
        string memory poolName = string(abi.encodePacked("RoboLP-", symbol));
        string memory poolSymbol = string(abi.encodePacked("RLP-", symbol));

        WeightedPool newPool = new WeightedPool(
            token,
            quoteToken,
            tokenWeight,
            quoteWeight,
            DEFAULT_SWAP_FEE,
            poolName,
            poolSymbol
        );
        pool = address(newPool);

        // Approve pool to spend tokens
        IERC20(token).approve(pool, initialSupply);
        IERC20(quoteToken).approve(pool, initialQuoteAmount);

        // Initialize pool with liquidity
        newPool.initialize(initialSupply, initialQuoteAmount, msg.sender);

        // Register pool
        registry.registerPool(pool, token, quoteToken, tokenWeight, quoteWeight);

        // Store token info
        allTokens.push(token);
        isTokenFromFactory[token] = true;
        tokenInfo[token] = TokenInfo({
            token: token,
            pool: pool,
            creator: msg.sender,
            name: name,
            symbol: symbol,
            initialSupply: initialSupply,
            createdAt: block.timestamp
        });

        emit TokenCreated(token, pool, msg.sender, name, symbol, initialSupply);
    }

    /**
     * @notice Create token with default weights
     */
    function createTokenWithDefaults(
        string calldata name,
        string calldata symbol,
        string calldata tokenURI,
        uint256 initialSupply,
        uint256 initialQuoteAmount
    ) external payable returns (address token, address pool) {
        return this.createToken{value: msg.value}(
            name,
            symbol,
            tokenURI,
            initialSupply,
            initialQuoteAmount,
            defaultTokenWeight
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Update launch fee
     * @param newFee New fee in wei
     */
    function setLaunchFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = launchFee;
        launchFee = newFee;
        emit LaunchFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update default weights
     * @param tokenWeight New default token weight
     * @param quoteWeight New default quote weight
     */
    function setDefaultWeights(uint256 tokenWeight, uint256 quoteWeight) external onlyOwner {
        if (tokenWeight + quoteWeight != ONE) revert InvalidWeight();
        if (tokenWeight < 0.5e18 || tokenWeight > 0.99e18) revert InvalidWeight();

        defaultTokenWeight = tokenWeight;
        defaultQuoteWeight = quoteWeight;
        emit DefaultWeightsUpdated(tokenWeight, quoteWeight);
    }

    /**
     * @notice Update fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    // ============ View Functions ============

    /**
     * @notice Get total number of tokens created
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Get all token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @notice Get tokens with pagination
     */
    function getTokens(uint256 offset, uint256 limit) external view returns (address[] memory) {
        if (offset >= allTokens.length) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > allTokens.length) {
            end = allTokens.length;
        }

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTokens[i];
        }

        return result;
    }

    /**
     * @notice Get token info by address
     */
    function getTokenInfo(address token) external view returns (TokenInfo memory) {
        return tokenInfo[token];
    }

    /**
     * @notice Get pool address for a token
     */
    function getPoolForToken(address token) external view returns (address) {
        return tokenInfo[token].pool;
    }
}
