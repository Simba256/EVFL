// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IICOContract.sol";
import "./interfaces/IPancakeRouter.sol";

/**
 * @title ICOContract
 * @notice Fair Launch ICO - accepts commitments, distributes tokens pro-rata
 * @dev Gas-optimized: no loops in finalize(), allocations calculated at claim time
 *      Supports automatic LP creation on finalization
 */
contract ICOContract is IICOContract, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutable Config ============
    address public immutable token;
    address public immutable treasury;
    address public immutable factory;
    uint256 public immutable tokenSupply;
    uint256 public immutable minimumRaise;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable platformFeeBps;

    // Optional team tokens
    uint256 public immutable teamTokens;
    address public immutable teamWallet;

    // LP Creation Config
    address public immutable router; // PancakeSwap router
    uint256 public immutable lpBnbBps; // % of raised BNB for LP (basis points)
    uint256 public immutable lpTokens; // Tokens reserved for LP

    // ============ Mutable State ============
    Status public status;
    uint256 public totalCommitted;
    uint256 public tokenPrice;
    uint256 public participantCount;

    // User State
    mapping(address => uint256) public commitments;
    mapping(address => bool) public hasClaimed;

    // ============ Errors ============
    error NotStarted();
    error AlreadyEnded();
    error NotEnded();
    error NotActive();
    error NotFinalized();
    error NotFailed();
    error ZeroAmount();
    error NoCommitment();
    error AlreadyClaimed();
    error MinimumNotMet();
    error MinimumWasMet();
    error TransferFailed();
    error InvalidConfig();
    error LPCreationFailed();

    // ============ Constructor ============
    struct ICOConfig {
        address token;
        address treasury;
        address factory;
        uint256 tokenSupply;
        uint256 minimumRaise;
        uint256 startTime;
        uint256 endTime;
        uint256 platformFeeBps;
        uint256 teamTokens;
        address teamWallet;
        // LP Config
        address router;
        uint256 lpBnbBps;
        uint256 lpTokens;
    }

    constructor(ICOConfig memory config) {
        if (config.token == address(0)) revert InvalidConfig();
        if (config.treasury == address(0)) revert InvalidConfig();
        if (config.endTime <= config.startTime) revert InvalidConfig();
        if (config.tokenSupply == 0) revert InvalidConfig();
        if (config.platformFeeBps > 500) revert InvalidConfig(); // Max 5%
        if (config.teamTokens > (config.tokenSupply * 20) / 100) revert InvalidConfig(); // Max 20%
        if (config.lpBnbBps > 5000) revert InvalidConfig(); // Max 50% for LP
        // Router is optional - if 0, no LP creation
        if (config.lpBnbBps > 0 && config.router == address(0)) revert InvalidConfig();
        if (config.lpBnbBps > 0 && config.lpTokens == 0) revert InvalidConfig();

        token = config.token;
        treasury = config.treasury;
        factory = config.factory;
        tokenSupply = config.tokenSupply;
        minimumRaise = config.minimumRaise;
        startTime = config.startTime;
        endTime = config.endTime;
        platformFeeBps = config.platformFeeBps;
        teamTokens = config.teamTokens;
        teamWallet = config.teamWallet;
        router = config.router;
        lpBnbBps = config.lpBnbBps;
        lpTokens = config.lpTokens;

        status = Status.PENDING;
    }

    // ============ External Functions ============

    /**
     * @notice Commit BNB to the ICO
     * @dev Multiple commits from same address accumulate
     */
    function commit() external payable nonReentrant {
        if (block.timestamp < startTime) revert NotStarted();
        if (block.timestamp > endTime) revert AlreadyEnded();
        if (msg.value == 0) revert ZeroAmount();

        // Update status on first commit
        if (status == Status.PENDING) {
            status = Status.ACTIVE;
        }
        if (status != Status.ACTIVE) revert NotActive();

        // Track if new participant
        if (commitments[msg.sender] == 0) {
            participantCount++;
        }

        commitments[msg.sender] += msg.value;
        totalCommitted += msg.value;

        emit Committed(msg.sender, msg.value, commitments[msg.sender]);
    }

    /**
     * @notice Finalize the ICO after end time (anyone can call)
     * @dev Calculates token price, creates LP, and distributes funds to treasury
     */
    function finalize() external nonReentrant {
        if (status != Status.ACTIVE) revert NotActive();
        if (block.timestamp <= endTime) revert NotEnded();
        if (totalCommitted < minimumRaise) revert MinimumNotMet();

        status = Status.FINALIZED;

        // Calculate token price: (totalRaised * 1e18) / tokenSupply
        // This gives price in wei per token with 18 decimal precision
        tokenPrice = (totalCommitted * 1e18) / tokenSupply;

        // Calculate fee and LP amounts
        uint256 platformFee = (totalCommitted * platformFeeBps) / 10000;
        uint256 lpBnbAmount = (totalCommitted * lpBnbBps) / 10000;
        uint256 treasuryAmount = totalCommitted - platformFee - lpBnbAmount;

        // Create LP if configured
        if (lpBnbBps > 0 && router != address(0) && lpTokens > 0) {
            _createLiquidity(lpBnbAmount);
        } else {
            // If no LP, add the LP BNB to treasury
            treasuryAmount += lpBnbAmount;
        }

        // Transfer to treasury
        (bool treasurySent, ) = payable(treasury).call{value: treasuryAmount}("");
        if (!treasurySent) revert TransferFailed();

        // Transfer platform fee to factory
        if (platformFee > 0) {
            (bool feeSent, ) = payable(factory).call{value: platformFee}("");
            if (!feeSent) revert TransferFailed();
        }

        emit Finalized(totalCommitted, tokenPrice, participantCount);
    }

    /**
     * @notice Internal function to create liquidity pool
     * @param bnbAmount Amount of BNB to add to LP
     */
    function _createLiquidity(uint256 bnbAmount) internal {
        // Approve router to spend tokens
        IERC20(token).approve(router, lpTokens);

        // Add liquidity - LP tokens go to treasury
        try IPancakeRouter(router).addLiquidityETH{value: bnbAmount}(
            token,
            lpTokens,
            (lpTokens * 95) / 100, // 5% slippage on tokens
            (bnbAmount * 95) / 100, // 5% slippage on BNB
            treasury, // LP tokens sent to treasury
            block.timestamp + 300 // 5 minute deadline
        ) returns (uint256 amountToken, uint256 amountBNB, uint256 liquidity) {
            emit LiquidityAdded(amountToken, amountBNB, liquidity);

            // Refund any unused tokens back to treasury
            uint256 remainingTokens = IERC20(token).balanceOf(address(this)) - tokenSupply;
            if (remainingTokens > 0) {
                IERC20(token).safeTransfer(treasury, remainingTokens);
            }
        } catch {
            // If LP creation fails, send tokens and BNB to treasury instead
            IERC20(token).safeTransfer(treasury, lpTokens);
            (bool sent, ) = payable(treasury).call{value: bnbAmount}("");
            if (!sent) revert LPCreationFailed();
        }
    }

    /**
     * @notice Mark ICO as failed (anyone can call after end time if minimum not met)
     */
    function markFailed() external {
        if (status != Status.ACTIVE && status != Status.PENDING) revert NotActive();
        if (block.timestamp <= endTime) revert NotEnded();
        if (totalCommitted >= minimumRaise) revert MinimumWasMet();

        status = Status.FAILED;

        emit ICOFailed(totalCommitted, minimumRaise);
    }

    /**
     * @notice Claim tokens after successful ICO
     * @dev Allocation calculated at claim time (gas-optimized, no loops in finalize)
     */
    function claimTokens() external nonReentrant {
        if (status != Status.FINALIZED) revert NotFinalized();
        if (commitments[msg.sender] == 0) revert NoCommitment();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        hasClaimed[msg.sender] = true;

        // Calculate allocation: (userCommitment * tokenSupply) / totalCommitted
        uint256 allocation = (commitments[msg.sender] * tokenSupply) / totalCommitted;

        IERC20(token).safeTransfer(msg.sender, allocation);

        emit TokensClaimed(msg.sender, allocation);
    }

    /**
     * @notice Refund BNB after failed ICO
     */
    function refund() external nonReentrant {
        if (status != Status.FAILED) revert NotFailed();
        if (commitments[msg.sender] == 0) revert NoCommitment();

        uint256 refundAmount = commitments[msg.sender];
        commitments[msg.sender] = 0; // Clear before transfer (CEI pattern)

        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!sent) revert TransferFailed();

        emit Refunded(msg.sender, refundAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Calculate user's token allocation (view only)
     * @param user Address to check
     * @return Estimated token allocation
     */
    function getAllocation(address user) external view returns (uint256) {
        if (totalCommitted == 0) return 0;
        return (commitments[user] * tokenSupply) / totalCommitted;
    }

    /**
     * @notice Get full ICO info
     */
    function getICOInfo() external view returns (ICOInfo memory) {
        return ICOInfo({
            status: status,
            totalCommitted: totalCommitted,
            tokenPrice: tokenPrice,
            participantCount: participantCount,
            minimumRaise: minimumRaise,
            tokenSupply: tokenSupply,
            startTime: startTime,
            endTime: endTime
        });
    }

    /**
     * @notice Get time remaining until ICO ends
     * @return Seconds remaining, or 0 if ended
     */
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        if (block.timestamp < startTime) return endTime - startTime;
        return endTime - block.timestamp;
    }

    /**
     * @notice Check if ICO can be finalized
     */
    function canFinalize() external view returns (bool) {
        return status == Status.ACTIVE &&
               block.timestamp > endTime &&
               totalCommitted >= minimumRaise;
    }

    /**
     * @notice Check if ICO can be marked as failed
     */
    function canMarkFailed() external view returns (bool) {
        return (status == Status.ACTIVE || status == Status.PENDING) &&
               block.timestamp > endTime &&
               totalCommitted < minimumRaise;
    }
}
