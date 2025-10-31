/**
 * Scaled Payment Helpers for X402-SCALED
 *
 * Provides helper functions for working with exact-scaled scheme,
 * including deposit management and cumulative payment creation.
 */
/**
 * Payment contract ABI for deposit function
 */
const PAYMENT_CONTRACT_ABI = [
    {
        inputs: [
            { name: "server", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "expiresBy", type: "uint256" },
        ],
        name: "deposit",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];
/**
 * Check deposit status for a client-server pair
 *
 * @param client Public client for blockchain queries
 * @param clientAddress Client's address
 * @param serverAddress Server's address
 * @param paymentContract Payment contract address
 * @param network Network identifier
 * @returns DepositStatus object
 */
export async function checkDepositStatus(client, clientAddress, serverAddress, paymentContract, network) {
    // Return basic deposit status
    // Full implementation would query contract for deposit info
    return {
        isLocked: false,
        amountLocked: "0",
        amountUsed: "0",
        availableBalance: "0",
        lockupExpiry: "0",
        paymentContract,
        lastTotalValue: "0",
    };
}
/**
 * Deposit funds into the payment contract
 *
 * @param wallet Signer wallet that will submit the deposit transaction
 * @param paymentContract Payment contract address
 * @param serverAddress Server's address
 * @param amount Amount to deposit (in token base units, e.g., 10_000_000 for $10 USDC)
 * @param expiresBy Unix timestamp when deposit expires
 * @returns Transaction hash
 */
export async function depositFunds(wallet, paymentContract, serverAddress, amount, expiresBy) {
    const tx = await wallet.writeContract({
        address: paymentContract,
        abi: PAYMENT_CONTRACT_ABI,
        functionName: "deposit",
        args: [serverAddress, amount, expiresBy],
        chain: wallet.chain,
    });
    const receipt = await wallet.waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") {
        throw new Error("Deposit transaction failed");
    }
    return tx;
}
/**
 * Create a cumulative payment header for exact-scaled scheme
 *
 * @param client Signer wallet or local account
 * @param x402Version X402 protocol version
 * @param paymentRequirements Payment requirements with paymentContract
 * @returns Encoded payment header string
 */
export async function createCumulativePaymentHeaderHelper(client, x402Version, paymentRequirements) {
    // Placeholder implementation
    // Full implementation would use the exact-scaled scheme from x402 package
    throw new Error("Not yet fully implemented");
}
//# sourceMappingURL=scaled.js.map