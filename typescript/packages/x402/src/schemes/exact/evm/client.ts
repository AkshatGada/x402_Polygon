import { Address, Chain, LocalAccount, Transport } from "viem";
import { isSignerWallet, SignerWallet } from "../../../types/shared/evm";
import { PaymentPayload, PaymentRequirements, UnsignedPaymentPayload } from "../../../types/verify";
import { createNonce, signAuthorization } from "./sign";
import { encodePayment } from "./utils/paymentUtils";

/**
 * Prepares an unsigned payment header with the given sender address and payment requirements.
 *
 * @param from - The sender's address from which the payment will be made
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns An unsigned payment payload containing authorization details
 */
export function preparePaymentHeader(
  from: Address,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
): UnsignedPaymentPayload & { scheme: "exact" } {
  if (paymentRequirements.scheme !== "exact") {
    throw new Error("preparePaymentHeader only supports exact scheme");
  }

  const nonce = createNonce();

  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 600, // 10 minutes before
  ).toString();
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000 + paymentRequirements.maxTimeoutSeconds),
  ).toString();

  return {
    x402Version,
    scheme: "exact" as const,
    network: paymentRequirements.network,
    payload: {
      signature: undefined,
      authorization: {
        from,
        to: paymentRequirements.payTo as Address,
        value: paymentRequirements.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      } as any, // Type assertion needed due to discriminated union complexity
    },
  } as UnsignedPaymentPayload & { scheme: "exact" };
}

/**
 * Signs a payment header using the provided client and payment requirements.
 *
 * @param client - The signer wallet instance used to sign the payment header
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param unsignedPaymentHeader - The unsigned payment payload to be signed
 * @returns A promise that resolves to the signed payment payload
 */
export async function signPaymentHeader<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  paymentRequirements: PaymentRequirements,
  unsignedPaymentHeader: UnsignedPaymentPayload & { scheme: "exact" },
): Promise<PaymentPayload & { scheme: "exact" }> {
  if (unsignedPaymentHeader.scheme !== "exact") {
    throw new Error("signPaymentHeader only supports exact scheme");
  }

  // Type narrowing: ensure payload has exact authorization structure
  if (!("value" in unsignedPaymentHeader.payload.authorization)) {
    throw new Error("Invalid authorization structure for exact scheme");
  }

  const { signature } = await signAuthorization(
    client,
    unsignedPaymentHeader.payload.authorization as any,
    paymentRequirements,
  );

  // Type-safe construction of exact payment payload
  const result: PaymentPayload & { scheme: "exact" } = {
    x402Version: unsignedPaymentHeader.x402Version,
    scheme: "exact" as const,
    network: unsignedPaymentHeader.network,
    payload: {
      signature,
      authorization: unsignedPaymentHeader.payload.authorization as any, // Type assertion needed
    },
  };
  return result;
}

/**
 * Creates a complete payment payload by preparing and signing a payment header.
 *
 * @param client - The signer wallet instance used to create and sign the payment
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the complete signed payment payload
 */
export async function createPayment<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements & { scheme: "exact" },
): Promise<PaymentPayload & { scheme: "exact" }> {
  const from = isSignerWallet(client) ? client.account!.address : client.address;
  const unsignedPaymentHeader = preparePaymentHeader(from, x402Version, paymentRequirements);
  return signPaymentHeader(client, paymentRequirements, unsignedPaymentHeader);
}

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The signer wallet instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @returns A promise that resolves to the encoded payment header string
 */
export async function createPaymentHeader(
  client: SignerWallet | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements & { scheme: "exact" },
): Promise<string> {
  const payment = await createPayment(client, x402Version, paymentRequirements);
  return encodePayment(payment);
}
