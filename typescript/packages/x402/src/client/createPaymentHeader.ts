import { LocalAccount } from "viem";
import { createPaymentHeader as createPaymentHeaderExactEVM } from "../schemes/exact/evm/client";
import { createCumulativePaymentHeader } from "../schemes/exact-scaled/client";
import { SupportedEVMNetworks } from "../types/shared";
import { SignerWallet } from "../types/shared/evm";
import { PaymentRequirements } from "../types/verify";
import { signatureStorage } from "../facilitator/storage";

/**
 * Creates a payment header based on the provided client and payment requirements.
 * 
 * @param client - The signer wallet instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the created payment header string
 */
export async function createPaymentHeader(
  client: SignerWallet | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): Promise<string> {
  // Handle exact scheme
  if (
    paymentRequirements.scheme === "exact" &&
    SupportedEVMNetworks.includes(paymentRequirements.network)
  ) {
    return await createPaymentHeaderExactEVM(
      client,
      x402Version,
      paymentRequirements as PaymentRequirements & { scheme: "exact" }
    );
  }

  // Handle exact-scaled scheme
  if (
    paymentRequirements.scheme === "exact-scaled" &&
    SupportedEVMNetworks.includes(paymentRequirements.network) &&
    paymentRequirements.paymentContract
  ) {
    // Get last totalValue from storage
    const clientAddress = "account" in client && client.account
      ? client.account.address
      : (client as LocalAccount).address;

    const lastTotalValue = signatureStorage.getLastTotalValue(
      clientAddress,
      paymentRequirements.payTo as any
    );

    return await createCumulativePaymentHeader(
      client,
      x402Version,
      paymentRequirements as PaymentRequirements & { paymentContract: string },
      lastTotalValue
    );
  }

  throw new Error(`Unsupported scheme: ${paymentRequirements.scheme}`);
}