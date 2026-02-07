// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../WeightedMath.sol";

/**
 * @title WeightedMathHarness
 * @notice Test harness to expose WeightedMath internal library functions
 */
contract WeightedMathHarness {
    function calcSpotPrice(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut
    ) external pure returns (uint256) {
        return WeightedMath.calcSpotPrice(balanceIn, weightIn, balanceOut, weightOut);
    }

    function calcOutGivenIn(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountIn
    ) external pure returns (uint256) {
        return WeightedMath.calcOutGivenIn(balanceIn, weightIn, balanceOut, weightOut, amountIn);
    }

    function calcInGivenOut(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountOut
    ) external pure returns (uint256) {
        return WeightedMath.calcInGivenOut(balanceIn, weightIn, balanceOut, weightOut, amountOut);
    }

    function calcLpOutGivenExactTokensIn(
        uint256[] memory balances,
        uint256[] memory weights,
        uint256[] memory amountsIn,
        uint256 totalSupply
    ) external pure returns (uint256) {
        return WeightedMath.calcLpOutGivenExactTokensIn(balances, weights, amountsIn, totalSupply);
    }

    function powApprox(uint256 base, uint256 exp) external pure returns (uint256) {
        return WeightedMath.powApprox(base, exp);
    }

    function expBySquaring(uint256 base, uint256 exp) external pure returns (uint256) {
        return WeightedMath.expBySquaring(base, exp);
    }

    function mulDiv(uint256 a, uint256 b, uint256 c) external pure returns (uint256) {
        return WeightedMath.mulDiv(a, b, c);
    }

    // Constants exposed for testing
    function ONE() external pure returns (uint256) {
        return 1e18;
    }

    function MIN_BALANCE() external pure returns (uint256) {
        return 1e6;
    }

    function MIN_WEIGHT() external pure returns (uint256) {
        return 0.01e18;
    }

    function MAX_WEIGHT() external pure returns (uint256) {
        return 0.99e18;
    }
}
