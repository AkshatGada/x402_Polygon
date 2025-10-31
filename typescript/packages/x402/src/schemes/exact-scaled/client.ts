import { Address, Chain, LocalAccount, Transport } from "viem";
import { isSignerWallet, SignerWallet } from "../../types/shared/evm";
import {
  PaymentPayload,
  PaymentRequirements,
  UnsignedPaymentPayload,
  ScaledEvmPayload
} from "../../types/verify";
import { signCumulativeAuthorization } from "./sign";
import { encodePayment } from "../exact/evm/utils/paymentUtils";

/**
 * Prepares an unsigned cumulative payment header with the given sender address and payment requirements.
 * 
 * For exact-scaled scheme, this prepares a cumulative authorization where totalValue
 * must be greater than the last known totalValue for this client-server pair.
 *
 * @param from - The sender's address from which the payment will be made
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param lastTotalValue - The last known cumulative totalValue (defaults to 0 for first request)
 * @returns An unsigned payment payload containing cumulative authorization details
 */
export function prepareCumulativePaymentHeader(
  from: Address,
  x402Version: number,
  paymentRequirements: PaymentRequirements & { paymentContract: string },
  lastTotalValue: bigint = 0n,
): UnsignedPaymentPayload {
  // Calculate new cumulative totalValue
  const requestAmount = BigInt(paymentRequirements.maxAmountRequired);
  const newTotalValue = lastTotalValue + requestAmount;

  return {
    x402Version,
    scheme: "exact-scaled",
    network: paymentRequirements.network,
    payload: {
      signature: undefined,
      authorization: {
        from,
        to: paymentRequirements.payTo as Address,
        totalValue: newTotalValue.toString(),
      },
    },
  };
}

/**
 * Signs a cumulative payment header using the provided client and payment requirements.
 *
 * @param client - The signer wallet instance used to sign the payment header
 * @param paymentRequirements - The payment requirements containing payment contract info
 * @param unsignedPaymentHeader - The unsigned cumulative payment payload to be signed
 * @returns A promise that resolves to the signed payment payload
 */
export async function signCumulativePaymentHeader<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  paymentRequirements: PaymentRequirements & { paymentContract: string },
  unsignedPaymentHeader: UnsignedPaymentPayload & { scheme: "exact-scaled" },
): Promise<PaymentPayload & { scheme: "exact-scaled" }> {
  const { signature } = await signCumulativeAuthorization(
    client,
    unsignedPaymentHeader.payload.authorization as { from: Address; to: Address; totalValue: string },
    paymentRequirements,
  );

  return {
    ...unsignedPaymentHeader,
    payload: {
      ...unsignedPaymentHeader.payload,
      signature,
    } as ScaledEvmPayload,
  };
}

/**
 * Creates a complete cumulative payment payload by preparing and signing a payment header.
 *
 * @param client - The signer wallet instance used to create and sign the payment
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing payment contract info
 * @param lastTotalValue - The last known cumulative totalValue (defaults to 0 for first request)
 * @returns A promise that resolves to the complete signed payment payload
 */
export async function createCumulativePayment<transport extends Transport, chain extends Chain>(
  client: SignerWallet<chain, transport> | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements & { paymentContract: string },
  lastTotalValue: bigint = 0n,
): Promise<PaymentPayload & { scheme: "exact-scaled" }> {
  const from = isSignerWallet(client) ? client.account!.address : client.address;
  const unsignedPaymentHeader = prepareCumulativePaymentHeader(
    from,
    x402Version,
    paymentRequirements,
    lastTotalValue,
  );

  return signCumulativePaymentHeader(
    client,
    paymentRequirements,
    unsignedPaymentHeader as UnsignedPaymentPayload & { scheme: "exact-scaled" },
  );
}

/**
 * Creates and encodes a cumulative payment header for the given client and payment requirements.
 *
 * @param client - The signer wallet instance used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing payment contract info
 * @param lastTotalValue - The last known cumulative totalValue (defaults to 0 for first request)
 * @returns A promise that resolves to the encoded payment header string
 */
export async function createCumulativePaymentHeader(
  client: SignerWallet | LocalAccount,
  x402Version: number,
  paymentRequirements: PaymentRequirements & { paymentContract: string },
  lastTotalValue: bigint = 0n,
): Promise<string> {
  const payment = await createCumulativePayment(client, x402Version, paymentRequirements, lastTotalValue);
  return encodePayment(payment);
}

