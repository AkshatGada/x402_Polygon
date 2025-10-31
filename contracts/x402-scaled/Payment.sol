// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IPayment.sol";

/**
 * @title Payment
 * @dev An implementation of the IPayment interface.
 * This contract handles user deposits for servers and allows for gas-less
 * transfers via EIP-712 signatures, inspired by EIP-3009 but optimized for
 * cumulative authorization patterns.
 */
contract Payment is IPayment, EIP712 {
    using SafeERC20 for IERC20;

    /// @dev The ERC20 token address (e.g., USDC)
    IERC20 public immutable token;

    /// @dev Main data structure: user address => server address => deposit details.
    mapping(address => mapping(address => DepositInfo))
        public
        override deposits;

    /// @dev The EIP-712 typehash for the TransferWithAuthorization function.
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 totalValue)"
        );

    /// @dev The EIP-712 typehash for the ReceiveWithAuthorization function.
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "ReceiveWithAuthorization(address from,address to,uint256 totalValue)"
        );

    /**
     * @dev Sets the EIP-712 domain separator and token address.
     * @param name The EIP-712 domain name (e.g., "X402Payment").
     * @param version The EIP-712 domain version (e.g., "1").
     * @param tokenAddress The address of the ERC20 token to use for payments.
     */
    constructor(
        string memory name,
        string memory version,
        address tokenAddress
    ) EIP712(name, version) {
        require(
            tokenAddress != address(0),
            "Payment: token address cannot be zero"
        );
        token = IERC20(tokenAddress);
    }

    /**
     * @inheritdoc IPayment
     */
    function deposit(
        address server,
        uint256 amount,
        uint256 expiresBy
    ) external override {
        require(
            expiresBy > block.timestamp,
            "Payment: expiration must be in the future"
        );
        require(amount > 0, "Payment: deposit amount must be positive");
        require(server != address(0), "Payment: server address cannot be zero");

        DepositInfo storage depositInfo = deposits[msg.sender][server];
        depositInfo.amount += amount;
        depositInfo.expiresBy = expiresBy; // Can be updated on new deposits

        // Transfer tokens from user to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, server, amount, expiresBy);
    }

    /**
     * @inheritdoc IPayment
     */
    function withdraw(address server) external override {
        DepositInfo storage depositInfo = deposits[msg.sender][server];
        require(
            block.timestamp >= depositInfo.expiresBy,
            "Payment: deposit has not expired yet"
        );

        uint256 amountToWithdraw = depositInfo.amount - depositInfo.amountUsed;
        require(amountToWithdraw > 0, "Payment: no funds to withdraw");

        // Reset deposit info
        depositInfo.amount = 0;
        depositInfo.amountUsed = 0;
        depositInfo.expiresBy = 0;

        // Transfer unused tokens back to user
        token.safeTransfer(msg.sender, amountToWithdraw);

        emit Withdrawal(msg.sender, server, amountToWithdraw);
    }

    /**
     * @inheritdoc IPayment
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 totalValue,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(
            from != address(0) && to != address(0),
            "Payment: zero address"
        );

        // Construct EIP-712 hash
        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                totalValue
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash)
        );

        // Recover signer address
        address recoveredAddress = ecrecover(digest, v, r, s);

        require(recoveredAddress == from, "Payment: invalid signature");
        require(
            recoveredAddress != address(0),
            "Payment: invalid signature from zero address"
        );

        // 'to' is treated as the server address for the deposit context
        DepositInfo storage depositInfo = deposits[from][to];

        // The totalValue must be strictly greater than the amount already used.
        // This prevents replay attacks and ensures forward progress.
        require(
            totalValue > depositInfo.amountUsed,
            "Payment: cumulative value must be greater than amount used"
        );

        // Calculate the incremental amount to transfer for this authorization
        uint256 amountToTransfer = totalValue - depositInfo.amountUsed;

        // Check if there are enough unused funds in the deposit
        require(
            amountToTransfer <= (depositInfo.amount - depositInfo.amountUsed),
            "Payment: insufficient deposited balance for this transfer"
        );

        // Check deposit has not expired
        require(
            block.timestamp < depositInfo.expiresBy,
            "Payment: deposit has expired"
        );

        // Update the amount used to the new cumulative value
        depositInfo.amountUsed = totalValue;

        // Transfer tokens from this contract to the server
        token.safeTransfer(to, amountToTransfer);

        emit TransferWithAuthorization(from, to, amountToTransfer);
    }

    /**
     * @inheritdoc IPayment
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 totalValue,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(
            from != address(0) && to != address(0),
            "Payment: zero address"
        );

        // Construct EIP-712 hash
        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                totalValue
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash)
        );

        // Recover signer address (must be 'to' for receiveWithAuthorization)
        address recoveredAddress = ecrecover(digest, v, r, s);

        require(recoveredAddress == to, "Payment: invalid signature");
        require(
            recoveredAddress != address(0),
            "Payment: invalid signature from zero address"
        );

        // 'to' is the server address that authorized this pull payment
        DepositInfo storage depositInfo = deposits[from][to];

        // The totalValue must be strictly greater than the amount already used.
        require(
            totalValue > depositInfo.amountUsed,
            "Payment: cumulative value must be greater than amount used"
        );

        // Calculate the incremental amount to transfer for this authorization
        uint256 amountToTransfer = totalValue - depositInfo.amountUsed;

        // Check if there are enough unused funds in the deposit
        require(
            amountToTransfer <= (depositInfo.amount - depositInfo.amountUsed),
            "Payment: insufficient deposited balance for this transfer"
        );

        // Check deposit has not expired
        require(
            block.timestamp < depositInfo.expiresBy,
            "Payment: deposit has expired"
        );

        // Update the amount used to the new cumulative value
        depositInfo.amountUsed = totalValue;

        // Transfer tokens from this contract to the server
        token.safeTransfer(to, amountToTransfer);

        emit ReceiveWithAuthorization(from, to, amountToTransfer);
    }
}
