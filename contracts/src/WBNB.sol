// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title WBNB
 * @notice Wrapped BNB contract for testing purposes
 * @dev On mainnet, use the official WBNB contract
 */
contract WBNB is ERC20 {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    constructor() ERC20("Wrapped BNB", "WBNB") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(balanceOf(msg.sender) >= wad, "WBNB: insufficient balance");
        _burn(msg.sender, wad);
        (bool success, ) = msg.sender.call{value: wad}("");
        require(success, "WBNB: transfer failed");
        emit Withdrawal(msg.sender, wad);
    }
}
