/**
 * Facilitator functions for exact-scaled scheme
 * 
 * This module provides verification and settlement functions for cumulative
 * payment signatures in the exact-scaled scheme.
 */

import { Account, Address, Chain, getAddress, Hex, Transport } from "viem";
import { getNetworkId } from "../../shared";
import {
  ConnectedClient,
  SignerWallet,
} from "../../types/shared/evm";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "../../types/verify";
import { cumulativeAuthorizationTypes } from "./sign";

/**
 * Verifies a cumulative payment payload against the required payment details
 *
 * This function performs several verification steps:
 * - Verifies protocol version compatibility
 * - Validates the cumulative signature
 * - Confirms payment contract address is correct
 * - Checks deposit exists and has sufficient funds
 * - Verifies cumulative value progression (prevents replay)
 *
 * @param client - The public client used for blockchain interactions
 * @param payload - The signed cumulative payment payload
 * @param paymentRequirements - The payment requirements that the payload must satisfy
 * @param lastTotalValue - The last known totalValue for this client-server pair (from storage)
 * @returns A VerifyResponse indicating if the payment is valid
 */
export async function verify<
  transport extends Transport,
  chain extends Chain,
  account extends Account | undefined,
>(
  client: ConnectedClient<transport, chain, account>,
  payload: PaymentPayload & { scheme: "exact-scaled" },
  paymentRequirements: PaymentRequirements & { paymentContract: string },
  lastTotalValue: bigint = 0n,
): Promise<VerifyResponse> {
  // Verify scheme matches
  if (payload.scheme !== "exact-scaled" || paymentRequirements.scheme !== "exact-scaled") {
    return {
      isValid: false,
      invalidReason: "invalid_scheme",
      payer: payload.payload.authorization.from,
    };
  }

  let chainId: number;
  let paymentContractAddress: Address;

  try {
    chainId = getNetworkId(payload.network);
    paymentContractAddress = paymentRequirements.paymentContract as Address;
  } catch {
    return {
      isValid: false,
      invalidReason: "invalid_network",
      payer: payload.payload.authorization.from,
    };
  }

  // Verify cumulative signature is recoverable
  const typedData = {
    types: cumulativeAuthorizationTypes,
    primaryType: "TransferWithAuthorization" as const,
    domain: {
      name: "X402Payment",
      version: "1",
      chainId,
      verifyingContract: paymentContractAddress,
    },
    message: {
      from: payload.payload.authorization.from,
      to: payload.payload.authorization.to,
      totalValue: payload.payload.authorization.totalValue,
    },
  };

  const recoveredAddress = await client.verifyTypedData({
    address: payload.payload.authorization.from as Address,
    ...typedData,
    signature: payload.payload.signature as Hex,
  });

  if (!recoveredAddress) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_signature",
      payer: payload.payload.authorization.from,
    };
  }

  // Verify that payment was made to the correct address
  if (getAddress(payload.payload.authorization.to) !== getAddress(paymentRequirements.payTo)) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_recipient_mismatch",
      payer: payload.payload.authorization.from,
    };
  }

  // Query deposit info from contract
  try {
    const depositInfo = await client.readContract({
      address: paymentContractAddress,
      abi: [
        {
          inputs: [
            { name: "user", type: "address" },
            { name: "server", type: "address" },
          ],
          name: "deposits",
          outputs: [
            { name: "amount", type: "uint256" },
            { name: "expiresBy", type: "uint256" },
            { name: "amountUsed", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "deposits",
      args: [payload.payload.authorization.from as Address, paymentRequirements.payTo as Address],
    });

    const [amount, expiresBy, amountUsed] = depositInfo as [bigint, bigint, bigint];

    // Check deposit exists
    if (amount === 0n) {
      return {
        isValid: false,
        invalidReason: "no_deposit",
        payer: payload.payload.authorization.from,
      };
    }

    // Check deposit not expired
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (expiresBy <= now) {
      return {
        isValid: false,
        invalidReason: "deposit_expired",
        payer: payload.payload.authorization.from,
      };
    }

    // CRITICAL: Verify cumulative progression
    const newTotalValue = BigInt(payload.payload.authorization.totalValue);
    if (newTotalValue <= lastTotalValue) {
      return {
        isValid: false,
        invalidReason: "totalValue_not_incremental",
        payer: payload.payload.authorization.from,
      };
    }

    // Verify sufficient funds available
    const available = amount - amountUsed;
    const incrementalAmount = newTotalValue - amountUsed;

    if (incrementalAmount > available) {
      return {
        isValid: false,
        invalidReason: "insufficient_deposit",
        payer: payload.payload.authorization.from,
      };
    }

    // Verify incremental amount covers request cost
    const requestCost = BigInt(paymentRequirements.maxAmountRequired);
    if (incrementalAmount < requestCost) {
      return {
        isValid: false,
        invalidReason: "insufficient_funds",
        payer: payload.payload.authorization.from,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      invalidReason: "invalid_payment_requirements",
      payer: payload.payload.authorization.from,
    };
  }

  return {
    isValid: true,
    invalidReason: undefined,
    payer: payload.payload.authorization.from,
  };
}

/**
 * Settles a cumulative payment by executing transferWithAuthorization on the payment contract
 *
 * This function calls the payment contract's transferWithAuthorization function,
 * which calculates the incremental amount (totalValue - amountUsed) and transfers it.
 *
 * @param wallet - The facilitator wallet that will submit the transaction
 * @param paymentPayload - The signed cumulative payment payload
 * @param paymentRequirements - The original payment details
 * @returns A SettleResponse containing the transaction status and hash
 */
export async function settle<transport extends Transport, chain extends Chain>(
  wallet: SignerWallet<chain, transport>,
  paymentPayload: PaymentPayload & { scheme: "exact-scaled" },
  paymentRequirements: PaymentRequirements & { paymentContract: string },
): Promise<SettleResponse> {
  // Parse signature components (65 bytes: r(32) + s(32) + v(1))
  // viem signatures are 65 bytes: r(32) + s(32) + v(1)
  const signature = paymentPayload.payload.signature as Hex;
  if (signature.length !== 132) { // 0x + 130 hex chars = 65 bytes
    return {
      success: false,
      errorReason: "invalid_exact_evm_payload_signature",
      transaction: "0x" as Hex,
      network: paymentPayload.network,
      payer: paymentPayload.payload.authorization.from,
    };
  }

  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const vByte = signature.slice(130, 132);
  let v: 0 | 1 | 27 | 28;
  const vNum = parseInt(vByte, 16);
  if (vNum === 27 || vNum === 28) {
    v = vNum as 27 | 28;
  } else {
    v = (vNum === 0 ? 27 : 28) as 27 | 28; // Recover v
  }

  // Call payment contract's transferWithAuthorization
  const tx = await wallet.writeContract({
    address: paymentRequirements.paymentContract as Address,
    abi: [
      {
        inputs: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "totalValue", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
        name: "transferWithAuthorization",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    functionName: "transferWithAuthorization",
    args: [
      paymentPayload.payload.authorization.from as Address,
      paymentPayload.payload.authorization.to as Address,
      BigInt(paymentPayload.payload.authorization.totalValue),
      v,
      r,
      s,
    ],
    chain: wallet.chain as Chain,
  });

  const receipt = await wallet.waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    return {
      success: false,
      errorReason: "invalid_transaction_state",
      transaction: tx,
      network: paymentPayload.network,
      payer: paymentPayload.payload.authorization.from,
    };
  }

  return {
    success: true,
    transaction: tx,
    network: paymentPayload.network,
    payer: paymentPayload.payload.authorization.from,
  };
}

