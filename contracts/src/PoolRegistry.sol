// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PoolRegistry
 * @notice Central registry for all weighted pools
 * @dev Tracks pool addresses and provides query functions
 */
contract PoolRegistry is Ownable {
    // Pool info struct
    struct PoolInfo {
        address pool;
        address token0;
        address token1;
        uint256 weight0;
        uint256 weight1;
        uint256 createdAt;
        bool active;
    }

    // Mapping from pool address to pool info
    mapping(address => PoolInfo) public pools;

    // Mapping from token address to pool address
    mapping(address => address) public tokenToPool;

    // Array of all pool addresses
    address[] public allPools;

    // Authorized factories
    mapping(address => bool) public authorizedFactories;

    // Events
    event PoolRegistered(
        address indexed pool,
        address indexed token0,
        address indexed token1,
        uint256 weight0,
        uint256 weight1
    );
    event PoolDeactivated(address indexed pool);
    event FactoryAuthorized(address indexed factory);
    event FactoryRevoked(address indexed factory);

    // Errors
    error PoolAlreadyRegistered();
    error PoolNotFound();
    error TokenAlreadyHasPool();
    error NotAuthorized();
    error ZeroAddress();

    modifier onlyAuthorized() {
        if (!authorizedFactories[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Authorize a factory to register pools
     * @param factory Factory address to authorize
     */
    function authorizeFactory(address factory) external onlyOwner {
        if (factory == address(0)) revert ZeroAddress();
        authorizedFactories[factory] = true;
        emit FactoryAuthorized(factory);
    }

    /**
     * @notice Revoke factory authorization
     * @param factory Factory address to revoke
     */
    function revokeFactory(address factory) external onlyOwner {
        authorizedFactories[factory] = false;
        emit FactoryRevoked(factory);
    }

    /**
     * @notice Register a new pool
     * @param pool Pool contract address
     * @param token0 First token address
     * @param token1 Second token address
     * @param weight0 Weight of first token
     * @param weight1 Weight of second token
     */
    function registerPool(
        address pool,
        address token0,
        address token1,
        uint256 weight0,
        uint256 weight1
    ) external onlyAuthorized {
        if (pool == address(0)) revert ZeroAddress();
        if (pools[pool].pool != address(0)) revert PoolAlreadyRegistered();
        if (tokenToPool[token0] != address(0)) revert TokenAlreadyHasPool();

        pools[pool] = PoolInfo({
            pool: pool,
            token0: token0,
            token1: token1,
            weight0: weight0,
            weight1: weight1,
            createdAt: block.timestamp,
            active: true
        });

        tokenToPool[token0] = pool;
        allPools.push(pool);

        emit PoolRegistered(pool, token0, token1, weight0, weight1);
    }

    /**
     * @notice Deactivate a pool (doesn't remove, just marks inactive)
     * @param pool Pool address to deactivate
     */
    function deactivatePool(address pool) external onlyOwner {
        if (pools[pool].pool == address(0)) revert PoolNotFound();
        pools[pool].active = false;
        emit PoolDeactivated(pool);
    }

    // ============ View Functions ============

    /**
     * @notice Get pool address for a token
     * @param token Token address
     * @return Pool address (address(0) if not found)
     */
    function getPoolByToken(address token) external view returns (address) {
        return tokenToPool[token];
    }

    /**
     * @notice Get pool info
     * @param pool Pool address
     * @return PoolInfo struct
     */
    function getPoolInfo(address pool) external view returns (PoolInfo memory) {
        return pools[pool];
    }

    /**
     * @notice Get total number of pools
     * @return Number of registered pools
     */
    function getPoolCount() external view returns (uint256) {
        return allPools.length;
    }

    /**
     * @notice Get all pool addresses
     * @return Array of pool addresses
     */
    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    /**
     * @notice Get pools with pagination
     * @param offset Starting index
     * @param limit Maximum number of pools to return
     * @return Array of pool addresses
     */
    function getPools(uint256 offset, uint256 limit) external view returns (address[] memory) {
        if (offset >= allPools.length) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > allPools.length) {
            end = allPools.length;
        }

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allPools[i];
        }

        return result;
    }

    /**
     * @notice Check if a pool is active
     * @param pool Pool address
     * @return True if pool is active
     */
    function isPoolActive(address pool) external view returns (bool) {
        return pools[pool].active;
    }
}
