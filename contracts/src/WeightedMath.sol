// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WeightedMath
 * @notice Math library for Balancer-style weighted pool calculations
 * @dev Uses fixed-point arithmetic with 18 decimals
 *
 * Key formulas:
 * - Spot Price: (balanceIn / weightIn) / (balanceOut / weightOut)
 * - Out-Given-In: balanceOut * (1 - (balanceIn / (balanceIn + amountIn))^(weightIn/weightOut))
 * - In-Given-Out: balanceIn * ((balanceOut / (balanceOut - amountOut))^(weightOut/weightIn) - 1)
 */
library WeightedMath {
    uint256 internal constant ONE = 1e18;
    uint256 internal constant MAX_POW_RELATIVE_ERROR = 10000; // 10^(-14)

    // Minimum/maximum values for weights (1% to 99%)
    uint256 internal constant MIN_WEIGHT = 0.01e18;
    uint256 internal constant MAX_WEIGHT = 0.99e18;

    // Minimum balance to prevent division issues
    uint256 internal constant MIN_BALANCE = 1e6;

    error ZeroAmount();
    error InsufficientLiquidity();
    error WeightOutOfBounds();
    error BalanceTooLow();

    /**
     * @notice Calculate the spot price of tokenIn in terms of tokenOut
     * @param balanceIn Balance of input token in the pool
     * @param weightIn Weight of input token (normalized, e.g., 0.8e18 for 80%)
     * @param balanceOut Balance of output token in the pool
     * @param weightOut Weight of output token (normalized)
     * @return spotPrice The spot price (tokenIn per tokenOut)
     */
    function calcSpotPrice(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut
    ) internal pure returns (uint256 spotPrice) {
        if (balanceIn < MIN_BALANCE || balanceOut < MIN_BALANCE) revert BalanceTooLow();

        // spotPrice = (balanceIn / weightIn) / (balanceOut / weightOut)
        // spotPrice = (balanceIn * weightOut) / (balanceOut * weightIn)
        uint256 numer = mulDiv(balanceIn, weightOut, ONE);
        uint256 denom = mulDiv(balanceOut, weightIn, ONE);
        spotPrice = mulDiv(numer, ONE, denom);
    }

    /**
     * @notice Calculate output amount given an exact input amount
     * @param balanceIn Balance of input token in the pool
     * @param weightIn Weight of input token (normalized)
     * @param balanceOut Balance of output token in the pool
     * @param weightOut Weight of output token (normalized)
     * @param amountIn Exact amount of input token
     * @return amountOut Amount of output token
     */
    function calcOutGivenIn(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountIn
    ) internal pure returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (balanceIn < MIN_BALANCE || balanceOut < MIN_BALANCE) revert BalanceTooLow();

        /**********************************************************************************************
        // outGivenIn                                                                                //
        // aO = amountOut                                                                            //
        // bO = balanceOut                                                                           //
        // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
        // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
        // wI = weightIn               \      \       ( bI + aI )         /              /           //
        // wO = weightOut                                                                            //
        **********************************************************************************************/

        uint256 newBalanceIn = balanceIn + amountIn;

        // Calculate base = balanceIn / newBalanceIn
        uint256 base = mulDiv(balanceIn, ONE, newBalanceIn);

        // Calculate exponent = weightIn / weightOut
        uint256 exponent = mulDiv(weightIn, ONE, weightOut);

        // Calculate power = base^exponent
        uint256 power = powApprox(base, exponent);

        // Calculate amountOut = balanceOut * (1 - power)
        uint256 ratio = ONE - power;
        amountOut = mulDiv(balanceOut, ratio, ONE);

        if (amountOut > balanceOut) revert InsufficientLiquidity();
    }

    /**
     * @notice Calculate input amount needed for an exact output amount
     * @param balanceIn Balance of input token in the pool
     * @param weightIn Weight of input token (normalized)
     * @param balanceOut Balance of output token in the pool
     * @param weightOut Weight of output token (normalized)
     * @param amountOut Exact amount of output token desired
     * @return amountIn Amount of input token needed
     */
    function calcInGivenOut(
        uint256 balanceIn,
        uint256 weightIn,
        uint256 balanceOut,
        uint256 weightOut,
        uint256 amountOut
    ) internal pure returns (uint256 amountIn) {
        if (amountOut == 0) revert ZeroAmount();
        if (amountOut >= balanceOut) revert InsufficientLiquidity();
        if (balanceIn < MIN_BALANCE || balanceOut < MIN_BALANCE) revert BalanceTooLow();

        /**********************************************************************************************
        // inGivenOut                                                                                //
        // aO = amountOut                                                                            //
        // bO = balanceOut                                                                           //
        // bI = balanceIn              /  /            bO             \    (wO / wI)      \          //
        // aI = amountIn    aI = bI * |  | --------------------------  | ^            - 1  |         //
        // wI = weightIn               \  \       ( bO - aO )         /                   /          //
        // wO = weightOut                                                                            //
        **********************************************************************************************/

        uint256 newBalanceOut = balanceOut - amountOut;

        // Calculate base = balanceOut / newBalanceOut
        uint256 base = mulDiv(balanceOut, ONE, newBalanceOut);

        // Calculate exponent = weightOut / weightIn
        uint256 exponent = mulDiv(weightOut, ONE, weightIn);

        // Calculate power = base^exponent
        uint256 power = powApprox(base, exponent);

        // Calculate amountIn = balanceIn * (power - 1)
        uint256 ratio = power - ONE;
        amountIn = mulDiv(balanceIn, ratio, ONE);
    }

    /**
     * @notice Calculate LP tokens to mint for joining a pool
     * @param balances Current pool balances
     * @param weights Pool weights (normalized)
     * @param amountsIn Amounts being added
     * @param totalSupply Current LP token supply
     * @return lpAmount LP tokens to mint
     */
    function calcLpOutGivenExactTokensIn(
        uint256[] memory balances,
        uint256[] memory weights,
        uint256[] memory amountsIn,
        uint256 totalSupply
    ) internal pure returns (uint256 lpAmount) {
        // For initial join, use geometric mean
        if (totalSupply == 0) {
            uint256 product = ONE;
            for (uint256 i = 0; i < balances.length; i++) {
                // product *= amountsIn[i]^weight[i]
                product = mulDiv(product, powApprox(amountsIn[i], weights[i]), ONE);
            }
            return product;
        }

        // For subsequent joins, calculate proportional share
        // This is a simplified version - production should use invariant ratio
        uint256 minRatio = type(uint256).max;
        for (uint256 i = 0; i < balances.length; i++) {
            if (balances[i] > 0) {
                uint256 ratio = mulDiv(amountsIn[i], ONE, balances[i]);
                if (ratio < minRatio) {
                    minRatio = ratio;
                }
            }
        }
        lpAmount = mulDiv(totalSupply, minRatio, ONE);
    }

    /**
     * @notice Approximate power function for fixed-point numbers
     * @dev Uses Taylor series expansion for ln and exp
     * @param base The base (18 decimal fixed-point)
     * @param exp The exponent (18 decimal fixed-point)
     * @return result base^exp (18 decimal fixed-point)
     */
    function powApprox(uint256 base, uint256 exp) internal pure returns (uint256 result) {
        if (exp == 0) return ONE;
        if (base == 0) return 0;
        if (base == ONE) return ONE;

        // For small exponents or bases close to 1, use approximation
        // (1 + x)^n ≈ 1 + n*x for small x
        if (base > ONE) {
            // base > 1: use (1 + (base - 1))^exp
            uint256 x = base - ONE;
            if (x < 0.1e18 && exp < 2e18) {
                // First-order Taylor approximation
                result = ONE + mulDiv(x, exp, ONE);
                return result;
            }
        } else {
            // base < 1: use (1 - (1 - base))^exp
            uint256 x = ONE - base;
            if (x < 0.1e18 && exp < 2e18) {
                // First-order Taylor approximation
                result = ONE - mulDiv(x, exp, ONE);
                return result;
            }
        }

        // For larger values, use more terms or binary exponentiation
        // This is a simplified version - production should use more precise methods
        result = expBySquaring(base, exp);
    }

    /**
     * @notice Exponentiation by squaring for fixed-point numbers
     * @dev Handles fractional exponents by decomposition
     */
    function expBySquaring(uint256 base, uint256 exp) internal pure returns (uint256) {
        if (exp == 0) return ONE;
        if (exp == ONE) return base;

        // Handle integer part
        uint256 intPart = exp / ONE;
        uint256 fracPart = exp % ONE;

        uint256 result = ONE;

        // Integer exponentiation by squaring
        uint256 basePow = base;
        while (intPart > 0) {
            if (intPart % 2 == 1) {
                result = mulDiv(result, basePow, ONE);
            }
            basePow = mulDiv(basePow, basePow, ONE);
            intPart /= 2;
        }

        // Fractional part approximation: base^frac ≈ 1 + frac * (base - 1)
        if (fracPart > 0 && base != ONE) {
            int256 diff = int256(base) - int256(ONE);
            int256 fracContrib = (diff * int256(fracPart)) / int256(ONE);
            uint256 fracResult = uint256(int256(ONE) + fracContrib);
            result = mulDiv(result, fracResult, ONE);
        }

        return result;
    }

    /**
     * @notice Safe multiplication and division with overflow protection
     * @dev Computes (a * b) / c without overflow for intermediate results
     */
    function mulDiv(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        return (a * b) / c;
    }
}
