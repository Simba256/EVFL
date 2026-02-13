// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Holds funds for a Fair Launch project with timelock control
 * @dev Owner should be a TimelockController for governance
 */
contract Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutable Config ============
    address public immutable token;

    // ============ Monthly Spending Limit ============
    uint256 public monthlyLimit;
    uint256 public monthlySpent;
    uint256 public monthStartTimestamp;

    // ============ Tracking ============
    uint256 public totalReceived;
    uint256 public totalSpent;

    // ============ Events ============
    event FundsReceived(address indexed from, uint256 amount);
    event BNBSpent(address indexed recipient, uint256 amount, string reason);
    event TokensSpent(address indexed tokenAddress, address indexed recipient, uint256 amount, string reason);
    event MonthlyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    // ============ Errors ============
    error InvalidRecipient();
    error InvalidAmount();
    error MonthlyLimitExceeded();
    error TransferFailed();
    error InsufficientBalance();

    // ============ Constructor ============
    /**
     * @param _token The project token address
     * @param _owner The owner (should be TimelockController)
     * @param _monthlyLimit Optional monthly spending limit (0 = no limit)
     */
    constructor(
        address _token,
        address _owner,
        uint256 _monthlyLimit
    ) Ownable(_owner) {
        token = _token;
        monthlyLimit = _monthlyLimit;
        monthStartTimestamp = block.timestamp;
    }

    // ============ Receive Function ============

    /**
     * @notice Receive BNB
     */
    receive() external payable {
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value);
    }

    // ============ Spending Functions (Owner Only) ============

    /**
     * @notice Spend BNB from treasury (requires timelock)
     * @param recipient Recipient address
     * @param amount Amount to send
     * @param reason Description of the spend
     */
    function spendBNB(
        address payable recipient,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0 || amount > address(this).balance) revert InvalidAmount();

        _checkMonthlyLimit(amount);

        totalSpent += amount;
        monthlySpent += amount;

        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit BNBSpent(recipient, amount, reason);
    }

    /**
     * @notice Spend ERC20 tokens from treasury (requires timelock)
     * @param tokenAddress Token to spend
     * @param recipient Recipient address
     * @param amount Amount to send
     * @param reason Description of the spend
     */
    function spendTokens(
        address tokenAddress,
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        IERC20(tokenAddress).safeTransfer(recipient, amount);

        emit TokensSpent(tokenAddress, recipient, amount, reason);
    }

    // ============ Admin Functions (Owner Only) ============

    /**
     * @notice Update monthly spending limit
     * @param newLimit New limit (0 = no limit)
     */
    function setMonthlyLimit(uint256 newLimit) external onlyOwner {
        uint256 oldLimit = monthlyLimit;
        monthlyLimit = newLimit;
        emit MonthlyLimitUpdated(oldLimit, newLimit);
    }

    // ============ Internal Functions ============

    /**
     * @notice Check and reset monthly limit
     */
    function _checkMonthlyLimit(uint256 amount) internal {
        // Reset monthly counter if new month (30 days)
        if (block.timestamp >= monthStartTimestamp + 30 days) {
            monthlySpent = 0;
            monthStartTimestamp = block.timestamp;
        }

        // Check limit (0 = no limit)
        if (monthlyLimit > 0) {
            if (monthlySpent + amount > monthlyLimit) {
                revert MonthlyLimitExceeded();
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get treasury balances and stats
     */
    function getBalances() external view returns (
        uint256 bnbBalance,
        uint256 tokenBalance,
        uint256 _totalReceived,
        uint256 _totalSpent,
        uint256 _monthlySpent,
        uint256 _monthlyLimit,
        uint256 _monthlyRemaining
    ) {
        bnbBalance = address(this).balance;
        tokenBalance = IERC20(token).balanceOf(address(this));
        _totalReceived = totalReceived;
        _totalSpent = totalSpent;
        _monthlySpent = monthlySpent;
        _monthlyLimit = monthlyLimit;

        if (monthlyLimit > 0 && monthlySpent < monthlyLimit) {
            _monthlyRemaining = monthlyLimit - monthlySpent;
        } else if (monthlyLimit == 0) {
            _monthlyRemaining = type(uint256).max; // No limit
        } else {
            _monthlyRemaining = 0;
        }
    }

    /**
     * @notice Get remaining monthly budget
     */
    function getMonthlyRemaining() external view returns (uint256) {
        if (monthlyLimit == 0) return type(uint256).max;
        if (monthlySpent >= monthlyLimit) return 0;
        return monthlyLimit - monthlySpent;
    }

    /**
     * @notice Check if a spend amount would exceed monthly limit
     */
    function wouldExceedMonthlyLimit(uint256 amount) external view returns (bool) {
        if (monthlyLimit == 0) return false;
        return monthlySpent + amount > monthlyLimit;
    }
}
