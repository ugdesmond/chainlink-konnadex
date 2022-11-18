// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
error TokenExists();
error TokenNotFound();
error ReetrantCall();
error NotOwner();
error TransferFailed();
error InsufficientBalance();
error NeedsMoreThanZero();
error OwnerIsZeroAddress();
error ReceiverAddressLengthNotEqualWithSalaryAmountLength();
error EmptyPayrollDataNotAllowed();

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;

        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

contract KonnadexMultiSender {
    using SafeMath for uint256;
    EnteredState private status;
    address payable public owner;
    uint256 private salaryCharge;
    uint256 private feeAmountConverter;
    mapping(bytes8 => address) public tokens;

    enum EnteredState {
        ENTERED,
        NOT_ENTERED
    }
    event OwnershipTransferred(address oldOwner, address newOwner);

    event BulkPaymentSuccessful(
        bytes indexed _paymentReference,
        address indexed _tokenAddress,
        address indexed _caller,
        uint256 _recipientCount,
        uint256 _totalTokensSent,
        uint256 _feeAmount,
        address _feeAddress
    );

    event SalaryChargeChanged(address indexed _caller, uint256 _oldPrice, uint256 _newPrice);
    event NativeTokenMoved(
        address indexed _caller,
        address indexed _to,
        uint256 _amount,
        address indexed _tokenAddress
    );
    event TokensMoved(
        address indexed _caller,
        address indexed _to,
        uint256 _amount,
        address indexed _tokenAddress
    );
    event TransferNativeTokenFailed(
        address indexed _caller,
        bytes indexed _paymentReference,
        uint256 totalTokensSent,
        address indexed _reciepientAddress,
        uint256 _amount
    );

    /**
     * Constructor function
     *
     * Initializes contract with salary charge.
     */
    constructor(uint256 _salaryCharge, uint256 _feeAmountConverter) {
        status = EnteredState.NOT_ENTERED;
        owner = payable(msg.sender);
        salaryCharge = _salaryCharge;
        feeAmountConverter = _feeAmountConverter;
    }

    modifier onlyUnsetToken(bytes8 symbol) {
        if (tokens[symbol] != address(0)) {
            revert TokenExists();
        }
        _;
    }
    modifier onlySetToken(bytes8 symbol) {
        if (tokens[symbol] == address(0)) {
            revert TokenNotFound();
        }
        _;
    }
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert NeedsMoreThanZero();
        }
        _;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }
    modifier nonReentrant() {
        if (status == EnteredState.ENTERED) {
            revert ReetrantCall();
        }
        status = EnteredState.ENTERED;
        _;
        status = EnteredState.NOT_ENTERED;
    }

    function reverseFund(uint256 amount) public payable onlyOwner {
        (bool sendBackSuccess, ) = payable(msg.sender).call{value: msg.value - amount}("");
        require(sendBackSuccess, "Could not send remaining funds to the payer");
    }

    function addToken(bytes8 _symbol, address _tokenAddress)
        external
        onlyOwner
        onlyUnsetToken(_symbol)
    {
        tokens[_symbol] = _tokenAddress;
    }

    function removeToken(bytes8 _symbol) external onlyOwner onlySetToken(_symbol) {
        delete (tokens[_symbol]);
    }

    function getTokenBalance(bytes8 _symbol)
        public
        view
        onlyOwner
        onlySetToken(_symbol)
        returns (uint256)
    {
        return IERC20(tokens[_symbol]).balanceOf(address(this));
    }

    function getBalance() public view onlyOwner returns (uint256) {
        return address(this).balance;
    }

    /**
     * Distribute tokens
     *
     * Send `_salaryAmounts` tokens to `_addresses` from your account
     *
     * @param _addresses The address of the recipient
     * @param _salaryAmounts the amount to send
     * @param _reference the unique indentifier
     * @param _symbol token symbol
     **/
    function distributeToken(
        bytes calldata _reference,
        bytes8 _symbol,
        address[] calldata _addresses,
        uint256[] calldata _salaryAmounts
    ) external payable onlySetToken(_symbol) nonReentrant returns (bool) {
        if (_addresses.length != _salaryAmounts.length) {
            revert ReceiverAddressLengthNotEqualWithSalaryAmountLength();
        }
        if (_addresses.length == 0) {
            revert EmptyPayrollDataNotAllowed();
        }
        uint256 totalAmount = 0;
        for (uint256 index = 0; index < _salaryAmounts.length; index++) {
            totalAmount = totalAmount.add(_salaryAmounts[index]);
            require(_salaryAmounts[index] > 0, "Value invalid");
        }
        if (IERC20(tokens[_symbol]).balanceOf(msg.sender) < totalAmount) {
            revert InsufficientBalance();
        }
        uint256 totalTokensSent;
        uint256 feeAmount = (salaryCharge.mul(totalAmount)).div(feeAmountConverter);
        //send fee to contract
        IERC20(tokens[_symbol]).transferFrom(msg.sender, owner, feeAmount);
        for (uint256 i = 0; i < _addresses.length; i += 1) {
            require(_addresses[i] != address(0), "Address invalid");
            IERC20(tokens[_symbol]).transferFrom(msg.sender, _addresses[i], _salaryAmounts[i]);
            totalTokensSent = totalTokensSent.add(_salaryAmounts[i]);
        }
        emit BulkPaymentSuccessful(
            _reference,
            tokens[_symbol],
            msg.sender,
            _addresses.length,
            totalTokensSent,
            feeAmount,
            owner
        );
        return true;
    }

    /**
     * Distribute Native tokens
     *
     * Send `_salaryAmounts` tokens to `_addresses` from your account
     *
     * @param _addresses The address of the recipient
     * @param _salaryAmounts the amount to send
     * @param _reference the unique indentifier
     **/

    function distributeNativeCoin(
        bytes calldata _reference,
        address[] calldata _addresses,
        uint256[] calldata _salaryAmounts
    ) external payable nonReentrant returns (bool) {
        if (_addresses.length != _salaryAmounts.length) {
            revert ReceiverAddressLengthNotEqualWithSalaryAmountLength();
        }
        if (_addresses.length == 0) {
            revert EmptyPayrollDataNotAllowed();
        }
        uint256 totalAmount = 0;
        for (uint256 index = 0; index < _salaryAmounts.length; index++) {
            totalAmount = totalAmount.add(_salaryAmounts[index]);
            require(_salaryAmounts[index] > 0, "Value invalid");
        }
        if (msg.value < totalAmount) {
            revert InsufficientBalance();
        }
        uint256 totalTokensSent = 0;
        uint256 feeAmount = (salaryCharge.mul(totalAmount)).div(feeAmountConverter);
        uint256 recipientAmount = totalAmount - feeAmount;
        //send fee to contract
        payable(owner).transfer(feeAmount);
        for (uint256 i = 0; i < _addresses.length; i += 1) {
            require(_addresses[i] != address(0), "Address invalid");
            (bool sent, ) = payable(_addresses[i]).call{value: _salaryAmounts[i]}("");
            if (!sent) {
                emit TransferNativeTokenFailed(
                    msg.sender,
                    _reference,
                    totalTokensSent,
                    _addresses[i],
                    _salaryAmounts[i]
                );
                revert TransferFailed();
            }
            totalTokensSent = totalTokensSent.add(_salaryAmounts[i]);
        }
        emit BulkPaymentSuccessful(
            _reference,
            address(this),
            msg.sender,
            _addresses.length,
            totalTokensSent,
            feeAmount,
            owner
        );
        return true;
    }

    function setSalaryCharge(uint256 _newSalaryCharge) external onlyOwner returns (bool) {
        uint256 oldPrice = salaryCharge;
        salaryCharge = _newSalaryCharge;
        emit SalaryChargeChanged(msg.sender, oldPrice, _newSalaryCharge);
        return true;
    }

    function getSalaryCharge() public view returns (uint256) {
        return salaryCharge;
    }

    function moveNativeTokens(address payable _account) external onlyOwner returns (bool) {
        uint256 contractBalance = address(this).balance;
        (bool sendBackSuccess, ) = _account.call{value: contractBalance}("");
        require(sendBackSuccess, "Could not send remaining funds to the receiver");
        emit NativeTokenMoved(msg.sender, _account, contractBalance, address(this));
        return true;
    }

    function moveTokens(bytes8 _symbol, address _account)
        external
        onlyOwner
        onlySetToken(_symbol)
        returns (bool)
    {
        uint256 contractTokenBalance = IERC20(tokens[_symbol]).balanceOf(address(this));
        IERC20(tokens[_symbol]).transfer(_account, contractTokenBalance);
        emit TokensMoved(msg.sender, _account, contractTokenBalance, tokens[_symbol]);
        return true;
    }

    function transferOwnership(address payable _newOwner) public virtual onlyOwner {
        if (_newOwner == address(0)) {
            revert OwnerIsZeroAddress();
        }
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    function getFeeConverter() public view returns (uint256) {
        return feeAmountConverter;
    }

    function setFeeAmountConverter(uint256 _feeConverter) external onlyOwner returns (uint256) {
        feeAmountConverter = _feeConverter;
        return feeAmountConverter;
    }
}
