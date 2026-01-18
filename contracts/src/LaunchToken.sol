// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title LaunchToken
 * @notice Basic ERC20 token deployed for each new memecoin launch
 * @dev Minting is controlled by the factory during initial creation
 */
contract LaunchToken is ERC20, ERC20Burnable {
    address public immutable factory;
    address public immutable creator;
    string public tokenURI;

    error OnlyFactory();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenURI_,
        uint256 initialSupply_,
        address creator_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        creator = creator_;
        tokenURI = tokenURI_;
        _mint(msg.sender, initialSupply_);
    }

    /**
     * @notice Returns the number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
