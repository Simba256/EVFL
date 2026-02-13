// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IICOContract
 * @notice Interface for the Fair Launch ICO Contract
 */
interface IICOContract {
    enum Status {
        PENDING,
        ACTIVE,
        FINALIZED,
        FAILED
    }

    struct ICOInfo {
        Status status;
        uint256 totalCommitted;
        uint256 tokenPrice;
        uint256 participantCount;
        uint256 minimumRaise;
        uint256 tokenSupply;
        uint256 startTime;
        uint256 endTime;
    }

    // Events
    event Committed(address indexed user, uint256 amount, uint256 totalUserCommitment);
    event Finalized(uint256 totalRaised, uint256 tokenPrice, uint256 participantCount);
    event TokensClaimed(address indexed user, uint256 allocation);
    event Refunded(address indexed user, uint256 amount);
    event ICOFailed(uint256 totalCommitted, uint256 minimumRequired);

    // Core functions
    function commit() external payable;
    function finalize() external;
    function markFailed() external;
    function claimTokens() external;
    function refund() external;

    // View functions
    function getAllocation(address user) external view returns (uint256);
    function getICOInfo() external view returns (ICOInfo memory);
    function commitments(address user) external view returns (uint256);
    function hasClaimed(address user) external view returns (bool);
}
