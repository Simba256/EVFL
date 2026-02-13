// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LaunchToken.sol";
import "./ICOContract.sol";
import "./Treasury.sol";

/**
 * @title FairLaunchFactory
 * @notice Factory for creating Fair Launch ICOs with treasury and governance
 * @dev Creates LaunchToken + ICOContract + Treasury + Timelock for each launch
 */
contract FairLaunchFactory is Ownable, ReentrancyGuard {
    // ============ Constants ============
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 14 days;
    uint256 public constant MIN_RAISE = 0.1 ether; // 0.1 BNB - lowered for testing
    uint256 public constant MIN_SUPPLY = 1_000_000 * 1e18; // 1M tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 * 1e18; // 1T tokens
    uint256 public constant MAX_TEAM_BPS = 2000; // 20%

    // ============ Platform Settings ============
    uint256 public platformFeeBps = 100; // 1% (100 basis points)
    uint256 public constant MAX_FEE_BPS = 500; // Max 5%


    // ============ External Contracts ============
    address public immutable quoteToken; // WBNB
    address public pancakeRouter; // PancakeSwap Router for LP creation

    // ============ Tracking ============
    address[] public allICOs;
    mapping(address => bool) public isValidICO;
    mapping(address => address) public icoToToken;
    mapping(address => address) public icoToTreasury;
    mapping(address => address) public icoToTimelock;

    // ============ Launch Info ============
    struct LaunchInfo {
        address ico;
        address token;
        address treasury;
        address timelock;
        address creator;
        string name;
        string symbol;
        uint256 tokenSupply;
        uint256 minimumRaise;
        uint256 startTime;
        uint256 endTime;
        uint256 createdAt;
    }

    mapping(address => LaunchInfo) public launchInfo;

    // ============ Events ============
    event FairLaunchCreated(
        address indexed ico,
        address indexed token,
        address indexed treasury,
        address timelock,
        address creator,
        uint256 tokenSupply,
        uint256 minimumRaise,
        uint256 startTime,
        uint256 endTime
    );
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    // ============ Errors ============
    error InvalidName();
    error InvalidSymbol();
    error InvalidSupply();
    error InvalidMinimumRaise();
    error InvalidDuration();
    error InvalidTeamAllocation();
    error InvalidTeamWallet();
    error InvalidLPConfig();
    error TransferFailed();
    error ZeroAddress();
    error NoFeesToWithdraw();

    // ============ Constructor ============
    constructor(address _quoteToken, address _pancakeRouter) Ownable(msg.sender) {
        if (_quoteToken == address(0)) revert ZeroAddress();
        quoteToken = _quoteToken;
        pancakeRouter = _pancakeRouter; // Can be 0 initially
    }

    // ============ Launch Parameters Struct ============
    struct LaunchParams {
        // Token details
        string name;
        string symbol;
        string imageURI;
        string description;

        // ICO parameters
        uint256 tokenSupply;       // Total tokens for ICO participants
        uint256 minimumRaise;      // Minimum BNB to succeed
        uint256 icoDuration;       // Duration in seconds (1-14 days)

        // Team allocation (optional)
        uint256 teamTokensBps;     // 0-2000 (0-20%)
        address teamWallet;

        // Treasury
        uint256 monthlyBudget;     // 0 = no limit

        // Treasury owner (should be a multisig or timelock - deployed separately)
        address treasuryOwner;

        // Liquidity Pool (optional)
        uint256 lpBnbBps;          // % of raised BNB for LP (0-5000, max 50%)
        uint256 lpTokensBps;       // % of tokens reserved for LP (0-5000, max 50%)
    }

    // ============ Main Function ============

    /**
     * @notice Create a new Fair Launch ICO
     * @param params Launch parameters
     * @return ico ICO contract address
     * @return token Token address
     * @return treasury Treasury address
     */
    function createFairLaunch(LaunchParams calldata params)
        external
        nonReentrant
        returns (address ico, address token, address treasury)
    {
        // ============ Validate Parameters ============
        if (bytes(params.name).length == 0) revert InvalidName();
        if (bytes(params.symbol).length == 0) revert InvalidSymbol();
        if (params.tokenSupply < MIN_SUPPLY || params.tokenSupply > MAX_SUPPLY) {
            revert InvalidSupply();
        }
        if (params.minimumRaise < MIN_RAISE) revert InvalidMinimumRaise();
        if (params.icoDuration < MIN_DURATION || params.icoDuration > MAX_DURATION) {
            revert InvalidDuration();
        }
        if (params.teamTokensBps > MAX_TEAM_BPS) revert InvalidTeamAllocation();
        if (params.teamTokensBps > 0 && params.teamWallet == address(0)) {
            revert InvalidTeamWallet();
        }
        // LP validation: max 50% each, and if one is set, both must be set
        if (params.lpBnbBps > 5000 || params.lpTokensBps > 5000) {
            revert InvalidLPConfig();
        }
        if ((params.lpBnbBps > 0) != (params.lpTokensBps > 0)) {
            revert InvalidLPConfig(); // Both must be set or both must be 0
        }
        if (params.lpBnbBps > 0 && pancakeRouter == address(0)) {
            revert InvalidLPConfig(); // Router must be set for LP creation
        }

        // ============ Calculate Token Distribution ============
        uint256 teamTokens = (params.tokenSupply * params.teamTokensBps) / 10000;
        uint256 lpTokens = (params.tokenSupply * params.lpTokensBps) / 10000;
        uint256 totalSupply = params.tokenSupply + teamTokens + lpTokens;

        // ============ 1. Deploy Token ============
        LaunchToken newToken = new LaunchToken(
            params.name,
            params.symbol,
            params.imageURI,
            totalSupply,
            msg.sender
        );
        token = address(newToken);

        // ============ 2. Determine Treasury Owner ============
        // If no owner specified, use creator (they can transfer to multisig/timelock later)
        address treasuryOwner = params.treasuryOwner != address(0)
            ? params.treasuryOwner
            : msg.sender;

        // ============ 3. Deploy Treasury ============
        Treasury newTreasury = new Treasury(
            token,
            treasuryOwner,
            params.monthlyBudget
        );
        treasury = address(newTreasury);

        // ============ 4. Deploy ICO Contract ============
        uint256 startTime = block.timestamp + 1 hours; // 1 hour delay
        uint256 endTime = startTime + params.icoDuration;

        ICOContract newICO = new ICOContract(
            ICOContract.ICOConfig({
                token: token,
                treasury: treasury,
                factory: address(this),
                tokenSupply: params.tokenSupply,
                minimumRaise: params.minimumRaise,
                startTime: startTime,
                endTime: endTime,
                platformFeeBps: platformFeeBps,
                teamTokens: teamTokens,
                teamWallet: params.teamWallet,
                router: pancakeRouter,
                lpBnbBps: params.lpBnbBps,
                lpTokens: lpTokens
            })
        );
        ico = address(newICO);

        // ============ 5. Transfer Tokens ============
        // Tokens were minted to this factory, now distribute them
        // ICO tokens + LP tokens to ICO contract
        uint256 icoTotalTokens = params.tokenSupply + lpTokens;
        IERC20(token).transfer(ico, icoTotalTokens);

        // Team tokens to treasury (locked)
        if (teamTokens > 0) {
            IERC20(token).transfer(treasury, teamTokens);
        }

        // ============ 6. Register Launch ============
        allICOs.push(ico);
        isValidICO[ico] = true;
        icoToToken[ico] = token;
        icoToTreasury[ico] = treasury;
        icoToTimelock[ico] = treasuryOwner; // Store the treasury owner

        launchInfo[ico] = LaunchInfo({
            ico: ico,
            token: token,
            treasury: treasury,
            timelock: treasuryOwner,
            creator: msg.sender,
            name: params.name,
            symbol: params.symbol,
            tokenSupply: params.tokenSupply,
            minimumRaise: params.minimumRaise,
            startTime: startTime,
            endTime: endTime,
            createdAt: block.timestamp
        });

        emit FairLaunchCreated(
            ico,
            token,
            treasury,
            treasuryOwner,
            msg.sender,
            params.tokenSupply,
            params.minimumRaise,
            startTime,
            endTime
        );

        return (ico, token, treasury);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidTeamAllocation();
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update PancakeSwap router address
     * @param newRouter New router address
     */
    function setPancakeRouter(address newRouter) external onlyOwner {
        address oldRouter = pancakeRouter;
        pancakeRouter = newRouter;
        emit RouterUpdated(oldRouter, newRouter);
    }

    /**
     * @notice Withdraw collected platform fees
     * @param to Recipient address
     */
    function withdrawFees(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFeesToWithdraw();

        (bool sent, ) = to.call{value: balance}("");
        if (!sent) revert TransferFailed();

        emit FeesWithdrawn(to, balance);
    }

    /**
     * @notice Receive platform fees from ICO contracts
     */
    receive() external payable {}

    // ============ View Functions ============

    /**
     * @notice Get total number of ICOs created
     */
    function getICOCount() external view returns (uint256) {
        return allICOs.length;
    }

    /**
     * @notice Get ICO addresses with pagination
     * @param offset Starting index
     * @param limit Maximum results
     */
    function getICOs(uint256 offset, uint256 limit) external view returns (address[] memory) {
        if (offset >= allICOs.length) {
            return new address[](0);
        }

        uint256 end = offset + limit;
        if (end > allICOs.length) {
            end = allICOs.length;
        }

        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allICOs[i];
        }
        return result;
    }

    /**
     * @notice Get full launch info for an ICO
     * @param ico ICO contract address
     */
    function getLaunchInfo(address ico) external view returns (LaunchInfo memory) {
        return launchInfo[ico];
    }

    /**
     * @notice Get all contract addresses for an ICO
     * @param ico ICO contract address
     */
    function getContracts(address ico) external view returns (
        address token,
        address treasury,
        address timelock
    ) {
        return (
            icoToToken[ico],
            icoToTreasury[ico],
            icoToTimelock[ico]
        );
    }

}
