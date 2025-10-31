import { Chain, getAddress, Hex, LocalAccount, Transport } from "viem";
import { getNetworkId } from "../../shared";
import {
  isAccount,
  isSignerWallet,
  SignerWallet,
} from "../../types/shared/evm";
import { CumulativeAuthorization, PaymentRequirements } from "../../types/verify";

/**
 * EIP-712 types for cumulative authorization (simplified, no nonce/validAfter/validBefore)
 */
export const cumulativeAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "totalValue", type: "uint256" },
  ],
} as const;

/**
 * Signs a cumulative authorization for scaled payment
 * 
 * This creates an EIP-712 signature that authorizes a cumulative totalValue,
 * not an incremental amount. The contract will calculate the incremental
 * amount by subtracting the previously used amount.
 *
 * @param walletClient - The wallet client that will sign the authorization
 * @param params - The cumulative authorization parameters
 * @param params.from - The address tokens will be transferred from
 * @param params.to - The address tokens will be transferred to
 * @param params.totalValue - The cumulative total value authorized (not incremental)
 * @param paymentRequirements - The payment requirements containing payment contract info
 * @param paymentRequirements.paymentContract - The address of the Payment contract
 * @param paymentRequirements.network - The network where the contract exists
 * @returns The signature for the cumulative authorization
 */
export async function signCumulativeAuthorization<transport extends Transport, chain extends Chain>(
  walletClient: SignerWallet<chain, transport> | LocalAccount,
  { from, to, totalValue }: CumulativeAuthorization,
  { paymentContract, network }: PaymentRequirements & { paymentContract: string },
): Promise<{ signature: Hex }> {
  if (!paymentContract) {
    throw new Error("Payment contract address is required for exact-scaled scheme");
  }

  const chainId = getNetworkId(network);

  const data = {
    types: cumulativeAuthorizationTypes as any, // Type assertion needed for viem compatibility
    domain: {
      name: "X402Payment",
      version: "1",
      chainId,
      verifyingContract: getAddress(paymentContract),
    },
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: getAddress(from),
      to: getAddress(to),
      totalValue: BigInt(totalValue),
    },
  };

  if (isSignerWallet(walletClient)) {
    const signature = await walletClient.signTypedData(data);
    return {
      signature,
    };
  } else if (isAccount(walletClient) && walletClient.signTypedData) {
    const signature = await walletClient.signTypedData(data);
    return {
      signature,
    };
  } else {
    throw new Error("Invalid wallet client provided does not support signTypedData");
  }
}

