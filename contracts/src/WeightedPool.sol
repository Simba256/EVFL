// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./WeightedMath.sol";
import "./interfaces/IWeightedPool.sol";

/**
 * @title WeightedPool
 * @notice Balancer-style weighted pool for token swaps
 * @dev Supports two tokens with configurable weights (e.g., 80/20)
 */
contract WeightedPool is ERC20, ReentrancyGuard, IWeightedPool {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SWAP_FEE = 0.1e18; // 10%
    uint256 public constant MIN_WEIGHT = 0.01e18; // 1%
    uint256 public constant MAX_WEIGHT = 0.99e18; // 99%
    uint256 public constant ONE = 1e18;

    address public immutable factory;
    address public immutable token0; // The launched token
    address public immutable token1; // BNB (WBNB) or quote token

    uint256 public immutable weight0; // Weight of token0 (e.g., 0.8e18 for 80%)
    uint256 public immutable weight1; // Weight of token1 (e.g., 0.2e18 for 20%)

    uint256 public swapFee; // Swap fee (e.g., 0.003e18 for 0.3%)

    uint256 private _balance0;
    uint256 private _balance1;

    bool private _initialized;

    // Errors
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidToken();
    error InvalidWeight();
    error InvalidFee();
    error SlippageExceeded();
    error InsufficientLiquidity();
    error ZeroAmount();
    error OnlyFactory();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier whenInitialized() {
        if (!_initialized) revert NotInitialized();
        _;
    }

    constructor(
        address token0_,
        address token1_,
        uint256 weight0_,
        uint256 weight1_,
        uint256 swapFee_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        if (weight0_ < MIN_WEIGHT || weight0_ > MAX_WEIGHT) revert InvalidWeight();
        if (weight1_ < MIN_WEIGHT || weight1_ > MAX_WEIGHT) revert InvalidWeight();
        if (weight0_ + weight1_ != ONE) revert InvalidWeight();
        if (swapFee_ > MAX_SWAP_FEE) revert InvalidFee();

        factory = msg.sender;
        token0 = token0_;
        token1 = token1_;
        weight0 = weight0_;
        weight1 = weight1_;
        swapFee = swapFee_;
    }

    /**
     * @notice Initialize the pool with initial liquidity
     * @dev Can only be called once by the factory
     * @param amount0 Initial amount of token0
     * @param amount1 Initial amount of token1
     * @param recipient Address to receive LP tokens
     */
    function initialize(
        uint256 amount0,
        uint256 amount1,
        address recipient
    ) external onlyFactory returns (uint256 lpTokens) {
        if (_initialized) revert AlreadyInitialized();
        if (amount0 == 0 || amount1 == 0) revert ZeroAmount();

        _initialized = true;

        // Transfer tokens to pool
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        _balance0 = amount0;
        _balance1 = amount1;

        // Calculate initial LP tokens using weighted geometric mean
        // lpTokens = amount0^weight0 * amount1^weight1
        uint256[] memory balances = new uint256[](2);
        uint256[] memory weights = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);

        balances[0] = 0;
        balances[1] = 0;
        weights[0] = weight0;
        weights[1] = weight1;
        amounts[0] = amount0;
        amounts[1] = amount1;

        lpTokens = WeightedMath.calcLpOutGivenExactTokensIn(balances, weights, amounts, 0);
        _mint(recipient, lpTokens);

        emit LiquidityAdded(recipient, amounts, lpTokens);
    }

    // ============ View Functions ============

    function getTokens() external view override returns (address[] memory tokens) {
        tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
    }

    function getWeights() external view override returns (uint256[] memory weights) {
        weights = new uint256[](2);
        weights[0] = weight0;
        weights[1] = weight1;
    }

    function getBalances() external view override returns (uint256[] memory balances) {
        balances = new uint256[](2);
        balances[0] = _balance0;
        balances[1] = _balance1;
    }

    function getSwapFee() external view override returns (uint256) {
        return swapFee;
    }

    function getSpotPrice(address tokenIn, address tokenOut) external view override whenInitialized returns (uint256) {
        (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) = _getSwapParams(tokenIn, tokenOut);
        return WeightedMath.calcSpotPrice(balanceIn, weightIn, balanceOut, weightOut);
    }

    function calcOutGivenIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override whenInitialized returns (uint256) {
        (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) = _getSwapParams(tokenIn, tokenOut);

        // Apply swap fee
        uint256 amountInAfterFee = amountIn - (amountIn * swapFee / ONE);

        return WeightedMath.calcOutGivenIn(balanceIn, weightIn, balanceOut, weightOut, amountInAfterFee);
    }

    function calcInGivenOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) external view override whenInitialized returns (uint256) {
        (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) = _getSwapParams(tokenIn, tokenOut);

        uint256 amountIn = WeightedMath.calcInGivenOut(balanceIn, weightIn, balanceOut, weightOut, amountOut);

        // Add swap fee
        return amountIn * ONE / (ONE - swapFee);
    }

    // ============ Swap Functions ============

    /**
     * @notice Swap exact input for output
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Exact amount of input token
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param recipient Address to receive output tokens
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override nonReentrant whenInitialized returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();

        (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) = _getSwapParams(tokenIn, tokenOut);

        // Apply swap fee
        uint256 amountInAfterFee = amountIn - (amountIn * swapFee / ONE);

        // Calculate output
        amountOut = WeightedMath.calcOutGivenIn(balanceIn, weightIn, balanceOut, weightOut, amountInAfterFee);

        if (amountOut < minAmountOut) revert SlippageExceeded();
        if (amountOut >= balanceOut) revert InsufficientLiquidity();

        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        // Update balances
        _updateBalances(tokenIn, tokenOut, amountIn, amountOut);

        emit Swap(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
    }

    /**
     * @notice Swap input for exact output
     */
    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        address recipient
    ) external override nonReentrant whenInitialized returns (uint256 amountIn) {
        if (amountOut == 0) revert ZeroAmount();

        (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) = _getSwapParams(tokenIn, tokenOut);

        if (amountOut >= balanceOut) revert InsufficientLiquidity();

        // Calculate required input
        uint256 amountInBeforeFee = WeightedMath.calcInGivenOut(balanceIn, weightIn, balanceOut, weightOut, amountOut);
        amountIn = amountInBeforeFee * ONE / (ONE - swapFee);

        if (amountIn > maxAmountIn) revert SlippageExceeded();

        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        // Update balances
        _updateBalances(tokenIn, tokenOut, amountIn, amountOut);

        emit Swap(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
    }

    // ============ Liquidity Functions ============

    /**
     * @notice Add liquidity to the pool
     * @param amounts Amounts of each token to add [token0, token1]
     * @param minLpTokens Minimum LP tokens to receive
     * @param recipient Address to receive LP tokens
     */
    function joinPool(
        uint256[] calldata amounts,
        uint256 minLpTokens,
        address recipient
    ) external override nonReentrant whenInitialized returns (uint256 lpTokens) {
        if (amounts.length != 2) revert ZeroAmount();
        if (amounts[0] == 0 && amounts[1] == 0) revert ZeroAmount();

        uint256[] memory balances = new uint256[](2);
        uint256[] memory weights = new uint256[](2);

        balances[0] = _balance0;
        balances[1] = _balance1;
        weights[0] = weight0;
        weights[1] = weight1;

        lpTokens = WeightedMath.calcLpOutGivenExactTokensIn(balances, weights, amounts, totalSupply());

        if (lpTokens < minLpTokens) revert SlippageExceeded();

        // Transfer tokens
        if (amounts[0] > 0) {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), amounts[0]);
            _balance0 += amounts[0];
        }
        if (amounts[1] > 0) {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), amounts[1]);
            _balance1 += amounts[1];
        }

        _mint(recipient, lpTokens);

        emit LiquidityAdded(recipient, amounts, lpTokens);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param lpTokens Amount of LP tokens to burn
     * @param minAmounts Minimum amounts of each token to receive
     * @param recipient Address to receive tokens
     */
    function exitPool(
        uint256 lpTokens,
        uint256[] calldata minAmounts,
        address recipient
    ) external override nonReentrant whenInitialized returns (uint256[] memory amounts) {
        if (lpTokens == 0) revert ZeroAmount();
        if (minAmounts.length != 2) revert ZeroAmount();

        uint256 supply = totalSupply();
        amounts = new uint256[](2);

        // Calculate proportional amounts
        amounts[0] = (_balance0 * lpTokens) / supply;
        amounts[1] = (_balance1 * lpTokens) / supply;

        if (amounts[0] < minAmounts[0] || amounts[1] < minAmounts[1]) revert SlippageExceeded();

        // Burn LP tokens
        _burn(msg.sender, lpTokens);

        // Transfer tokens
        if (amounts[0] > 0) {
            _balance0 -= amounts[0];
            IERC20(token0).safeTransfer(recipient, amounts[0]);
        }
        if (amounts[1] > 0) {
            _balance1 -= amounts[1];
            IERC20(token1).safeTransfer(recipient, amounts[1]);
        }

        emit LiquidityRemoved(recipient, amounts, lpTokens);
    }

    // ============ Internal Functions ============

    function _getSwapParams(
        address tokenIn,
        address tokenOut
    ) internal view returns (uint256 balanceIn, uint256 weightIn, uint256 balanceOut, uint256 weightOut) {
        if (tokenIn == token0 && tokenOut == token1) {
            return (_balance0, weight0, _balance1, weight1);
        } else if (tokenIn == token1 && tokenOut == token0) {
            return (_balance1, weight1, _balance0, weight0);
        } else {
            revert InvalidToken();
        }
    }

    function _updateBalances(address tokenIn, address /* tokenOut */, uint256 amountIn, uint256 amountOut) internal {
        if (tokenIn == token0) {
            _balance0 += amountIn;
            _balance1 -= amountOut;
        } else {
            _balance1 += amountIn;
            _balance0 -= amountOut;
        }
    }
}
