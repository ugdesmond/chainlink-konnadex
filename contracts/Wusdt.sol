// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Wusdt is ERC20 {
    constructor() ERC20("WUSDT", "Wrapped USDT") {
        _mint(msg.sender, 5000 * 10**18);
    }

    function mint(address _addressToCredit, uint256 _amount) external payable {
        _mint(_addressToCredit, _amount);
    }
}
