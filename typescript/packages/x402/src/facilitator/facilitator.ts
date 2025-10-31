import { verify as verifyExact, settle as settleExact } from "../schemes/exact/evm";
import { verify as verifyScaled, settle as settleScaled } from "../schemes/exact-scaled/facilitator";
import { SupportedEVMNetworks } from "../types/shared";
import { ConnectedClient, SignerWallet } from "../types/shared/evm";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "../types/verify";
import { signatureStorage } from "./storage";
import { Chain, Transport, Account } from "viem";

/**
 * Verifies a payment payload against the required payment details regardless of the scheme
 * this function wraps all verify functions for each specific scheme
 *
 * @param client - The public client used for blockchain interactions
 * @param payload - The signed payment payload containing transfer parameters and signature
 * @param paymentRequirements - The payment requirements that the payload must satisfy
 * @returns A ValidPaymentRequest indicating if the payment is valid and any invalidation reason
 */
export async function verify<
  transport extends Transport,
  chain extends Chain,
  account extends Account | undefined,
>(
  client: ConnectedClient<transport, chain, account>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
  // Handle exact scheme
  if (
    paymentRequirements.scheme === "exact" &&
    SupportedEVMNetworks.includes(paymentRequirements.network)
  ) {
    const valid = await verifyExact(client, payload, paymentRequirements);
    return valid;
  }

  // Handle exact-scaled scheme
  if (
    paymentRequirements.scheme === "exact-scaled" &&
    SupportedEVMNetworks.includes(paymentRequirements.network) &&
    paymentRequirements.paymentContract
  ) {
    // Get last totalValue from storage
    const lastTotalValue = signatureStorage.getLastTotalValue(
      payload.payload.authorization.from as any,
      paymentRequirements.payTo as any
    );

    const valid = await verifyScaled(
      client,
      payload as PaymentPayload & { scheme: "exact-scaled" },
      paymentRequirements as PaymentRequirements & { paymentContract: string },
      lastTotalValue
    );

    // If valid, store the signature state
    if (valid.isValid && payload.scheme === "exact-scaled") {
      signatureStorage.storeSignature(
        payload.payload.authorization.from as any,
        paymentRequirements.payTo as any,
        payload.payload.authorization.totalValue,
        payload.payload.signature
      );
    }

    return valid;
  }

  return {
    isValid: false,
    invalidReason: "invalid_scheme",
    payer: payload.payload.authorization.from,
  };
}

/**
 * Settles a payment payload against the required payment details regardless of the scheme
 * this function wraps all settle functions for each specific scheme
 *
 * @param client - The signer wallet used for blockchain interactions
 * @param payload - The signed payment payload containing transfer parameters and signature
 * @param paymentRequirements - The payment requirements that the payload must satisfy
 * @returns A SettleResponse indicating if the payment is settled and any settlement reason
 */
export async function settle<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  // Handle exact scheme
  if (
    paymentRequirements.scheme === "exact" &&
    SupportedEVMNetworks.includes(paymentRequirements.network)
  ) {
    return settleExact(client, payload, paymentRequirements);
  }

  // Handle exact-scaled scheme
  if (
    paymentRequirements.scheme === "exact-scaled" &&
    SupportedEVMNetworks.includes(paymentRequirements.network) &&
    paymentRequirements.paymentContract
  ) {
    return settleScaled(
      client,
      payload as PaymentPayload & { scheme: "exact-scaled" },
      paymentRequirements as PaymentRequirements & { paymentContract: string }
    );
  }

  return {
    success: false,
    errorReason: "invalid_scheme",
    transaction: "",
    network: paymentRequirements.network,
    payer: payload.payload.authorization.from,
  };
}

export type Supported = {
  x402Version: number;
  kind: {
    scheme: string;
    networkId: string;
  }[];
};
