// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPayment
 * @dev Interface for a payment smart contract that allows for deposits,
 * withdrawals, and EIP-712 based meta-transactions for transfers.
 * This interface defines the events, structs, and functions that the
 * payment contract must implement.
 */
interface IPayment {
    /**
     * @dev A struct to hold information about a user's deposit for a server.
     * @param amount The total amount of the deposit.
     * @param expiresBy The Unix timestamp when the deposit lock expires.
     * @param amountUsed The portion of the deposit that has been utilized.
     */
    struct DepositInfo {
        uint256 amount;
        uint256 expiresBy;
        uint256 amountUsed;
    }

    /**
     * @notice Emitted when a user deposits funds for a server.
     * @param user The address of the user making the deposit.
     * @param server The address of the server receiving the deposit context.
     * @param amount The amount of funds deposited.
     * @param expiresBy The Unix timestamp until which the funds are locked.
     */
    event Deposit(
        address indexed user,
        address indexed server,
        uint256 amount,
        uint256 expiresBy
    );

    /**
     * @notice Emitted when a user withdraws unused funds after expiration.
     * @param user The address of the user withdrawing funds.
     * @param server The address of the server associated with the deposit.
     * @param amount The amount of funds withdrawn.
     */
    event Withdrawal(
        address indexed user,
        address indexed server,
        uint256 amount
    );

    /**
     * @notice Emitted when a transfer is executed via transferWithAuthorization.
     * @param from The address of the sender.
     * @param to The address of the receiver (server).
     * @param amount The incremental amount transferred (not the cumulative totalValue).
     */
    event TransferWithAuthorization(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    /**
     * @notice Emitted when a transfer is executed via receiveWithAuthorization.
     * @param from The address of the sender.
     * @param to The address of the receiver (server) who authorized the pull.
     * @param amount The incremental amount transferred (not the cumulative totalValue).
     */
    event ReceiveWithAuthorization(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    /**
     * @notice Returns the deposit information for a given user and server.
     * @param user The address of the user.
     * @param server The address of the server.
     * @return amount The total amount deposited.
     * @return expiresBy The Unix timestamp when the deposit expires.
     * @return amountUsed The amount that has been used from the deposit.
     */
    function deposits(
        address user,
        address server
    )
        external
        view
        returns (uint256 amount, uint256 expiresBy, uint256 amountUsed);

    /**
     * @notice Deposits funds for a specific server, locking them until a specified time.
     * @param server The address of the server receiving the deposit context.
     * @param amount The amount of funds to deposit.
     * @param expiresBy The Unix timestamp until which the funds are locked.
     */
    function deposit(
        address server,
        uint256 amount,
        uint256 expiresBy
    ) external;

    /**
     * @notice Withdraws the unused portion of a deposit after its expiration time has passed.
     * @param server The address of the server associated with the deposit.
     */
    function withdraw(address server) external;

    /**
     * @notice Executes a transfer on behalf of the 'from' address, authorized by their signature.
     * The amount transferred is the difference between `totalValue` and the previously used amount.
     * @param from The address of the sender (who must have signed the message).
     * @param to The address of the receiver (server).
     * @param totalValue The cumulative value authorized by the user. This is not the transfer amount.
     * @param v The recovery id of the signature.
     * @param r The r value of the signature.
     * @param s The s value of the signature.
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 totalValue,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Allows a payee to execute a transfer from a payer, authorized by the payee's signature.
     * The amount transferred is the difference between `totalValue` and the previously used amount.
     * @param from The address of the sender.
     * @param to The address of the receiver (who must have signed the message).
     * @param totalValue The cumulative value authorized by receiver. This is not the transfer amount.
     * @param v The recovery id of the signature.
     * @param r The r value of the signature.
     * @param s The s value of the signature.
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 totalValue,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
