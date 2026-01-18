// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWeightedPool
 * @notice Interface for weighted pool operations
 */
interface IWeightedPool {
    // Events
    event Swap(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed trader
    );

    event LiquidityAdded(
        address indexed provider,
        uint256[] amounts,
        uint256 lpTokens
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256[] amounts,
        uint256 lpTokens
    );

    // View functions
    function getTokens() external view returns (address[] memory);
    function getWeights() external view returns (uint256[] memory);
    function getBalances() external view returns (uint256[] memory);
    function getSwapFee() external view returns (uint256);

    // Swap functions
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        address recipient
    ) external returns (uint256 amountIn);

    // Liquidity functions
    function joinPool(
        uint256[] calldata amounts,
        uint256 minLpTokens,
        address recipient
    ) external returns (uint256 lpTokens);

    function exitPool(
        uint256 lpTokens,
        uint256[] calldata minAmounts,
        address recipient
    ) external returns (uint256[] memory amounts);

    // Price functions
    function getSpotPrice(address tokenIn, address tokenOut) external view returns (uint256);
    function calcOutGivenIn(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
    function calcInGivenOut(address tokenIn, address tokenOut, uint256 amountOut) external view returns (uint256);
}
