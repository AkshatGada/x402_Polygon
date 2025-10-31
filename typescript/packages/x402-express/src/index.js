import { getAddress } from "viem";
import { exact } from "x402/schemes";
import { computeRoutePatterns, findMatchingPaymentRequirements, findMatchingRoute, getPaywallHtml, processPriceToAtomicAmount, toJsonSafe, } from "x402/shared";
import { moneySchema, settleResponseHeader, } from "x402/types";
import { useFacilitator } from "x402/verify";
import { signatureStorage } from "x402/facilitator";
/**
 * Creates a payment middleware factory for Express
 *
 * @param payTo - The address to receive payments
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @param paywall - Optional configuration for the default paywall
 * @returns An Express middleware handler
 *
 * @example
 * ```typescript
 * // Simple configuration - All endpoints are protected by $0.01 of USDC on base-sepolia
 * app.use(paymentMiddleware(
 *   '0x123...', // payTo address
 *   {
 *     price: '$0.01', // USDC amount in dollars
 *     network: 'base-sepolia'
 *   },
 *   // Optional facilitator configuration. Defaults to x402.org/facilitator for testnet usage
 * ));
 *
 * // Advanced configuration - Endpoint-specific payment requirements & custom facilitator
 * app.use(paymentMiddleware('0x123...', // payTo: The address to receive payments*    {
 *   {
 *     '/weather/*': {
 *       price: '$0.001', // USDC amount in dollars
 *       network: 'base',
 *       config: {
 *         description: 'Access to weather data'
 *       }
 *     }
 *   },
 *   {
 *     url: 'https://facilitator.example.com',
 *     createAuthHeaders: async () => ({
 *       verify: { "Authorization": "Bearer token" },
 *       settle: { "Authorization": "Bearer token" }
 *     })
 *   },
 *   {
 *     cdpClientKey: 'your-cdp-client-key',
 *     appLogo: '/images/logo.svg',
 *     appName: 'My App',
 *   }
 * ));
 * ```
 */
export function paymentMiddleware(payTo, routes, facilitator, paywall) {
    const { verify, settle } = useFacilitator(facilitator);
    const x402Version = 1;
    // Pre-compile route patterns to regex and extract verbs
    const routePatterns = computeRoutePatterns(routes);
    return async function paymentMiddleware(req, res, next) {
        const matchingRoute = findMatchingRoute(routePatterns, req.path, req.method.toUpperCase());
        if (!matchingRoute) {
            return next();
        }
        const { price, network, config = {} } = matchingRoute.config;
        const { description, mimeType, maxTimeoutSeconds, inputSchema, outputSchema, customPaywallHtml, resource, discoverable, paymentContract, scheme = "exact", maxAmountLockRequired, } = config;
        const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
        if ("error" in atomicAmountForAsset) {
            throw new Error(atomicAmountForAsset.error);
        }
        const { maxAmountRequired, asset } = atomicAmountForAsset;
        const resourceUrl = resource || `${req.protocol}://${req.headers.host}${req.path}`;
        // Determine scheme: use exact-scaled if paymentContract is provided, otherwise use configured scheme
        const useScaledScheme = scheme === "exact-scaled" || (scheme === "exact" && paymentContract);
        const finalScheme = useScaledScheme ? "exact-scaled" : "exact";
        // For exact-scaled, get deposit status info
        let depositInfo = {};
        if (useScaledScheme && paymentContract) {
            // Try to get deposit status if payment header exists (for returning deposit info)
            if (req.header("X-PAYMENT")) {
                try {
                    const payment = req.header("X-PAYMENT");
                    const decoded = exact.evm.decodePayment(payment);
                    if (decoded.scheme === "exact-scaled") {
                        const lastTotalValue = signatureStorage.getLastTotalValue(decoded.payload.authorization.from, getAddress(payTo));
                        depositInfo.lastTotalValue = lastTotalValue.toString();
                    }
                }
                catch {
                    // Ignore errors when decoding payment
                }
            }
        }
        const paymentRequirements = [
            {
                scheme: finalScheme,
                network,
                maxAmountRequired,
                resource: resourceUrl,
                description: description ?? "",
                mimeType: mimeType ?? "",
                payTo: getAddress(payTo),
                maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
                asset: getAddress(asset.address),
                // TODO: Rename outputSchema to requestStructure
                outputSchema: {
                    input: {
                        type: "http",
                        method: req.method.toUpperCase(),
                        discoverable: discoverable ?? true,
                        ...inputSchema,
                    },
                    output: outputSchema,
                },
                extra: asset.eip712,
                // Scaled-specific fields
                ...(useScaledScheme && paymentContract ? {
                    paymentContract,
                    isLocked: depositInfo.isLocked,
                    amountLocked: depositInfo.amountLocked,
                    maxAmountLockRequired: maxAmountLockRequired,
                    lockupExpiry: depositInfo.lockupExpiry,
                } : {}),
            },
        ];
        const payment = req.header("X-PAYMENT");
        const userAgent = req.header("User-Agent") || "";
        const acceptHeader = req.header("Accept") || "";
        const isWebBrowser = acceptHeader.includes("text/html") && userAgent.includes("Mozilla");
        if (!payment) {
            if (isWebBrowser) {
                let displayAmount;
                if (typeof price === "string" || typeof price === "number") {
                    const parsed = moneySchema.safeParse(price);
                    if (parsed.success) {
                        displayAmount = parsed.data;
                    }
                    else {
                        displayAmount = Number.NaN;
                    }
                }
                else {
                    displayAmount = Number(price.amount) / 10 ** price.asset.decimals;
                }
                const html = customPaywallHtml ||
                    getPaywallHtml({
                        amount: displayAmount,
                        paymentRequirements: toJsonSafe(paymentRequirements),
                        currentUrl: req.originalUrl,
                        testnet: network === "base-sepolia",
                        cdpClientKey: paywall?.cdpClientKey,
                        appName: paywall?.appName,
                        appLogo: paywall?.appLogo,
                        sessionTokenEndpoint: paywall?.sessionTokenEndpoint,
                    });
                res.status(402).send(html);
                return;
            }
            res.status(402).json({
                x402Version,
                error: "X-PAYMENT header is required",
                accepts: toJsonSafe(paymentRequirements),
            });
            return;
        }
        let decodedPayment;
        try {
            // Try to decode - exact.evm.decodePayment handles both schemes via discriminated union
            decodedPayment = exact.evm.decodePayment(payment);
            decodedPayment.x402Version = x402Version;
        }
        catch (error) {
            res.status(402).json({
                x402Version,
                error: error || "Invalid or malformed payment header",
                accepts: toJsonSafe(paymentRequirements),
            });
            return;
        }
        const selectedPaymentRequirements = findMatchingPaymentRequirements(paymentRequirements, decodedPayment);
        if (!selectedPaymentRequirements) {
            res.status(402).json({
                x402Version,
                error: "Unable to find matching payment requirements",
                accepts: toJsonSafe(paymentRequirements),
            });
            return;
        }
        try {
            const response = await verify(decodedPayment, selectedPaymentRequirements);
            if (!response.isValid) {
                res.status(402).json({
                    x402Version,
                    error: response.invalidReason,
                    accepts: toJsonSafe(paymentRequirements),
                    payer: response.payer,
                });
                return;
            }
        }
        catch (error) {
            res.status(402).json({
                x402Version,
                error,
                accepts: toJsonSafe(paymentRequirements),
            });
            return;
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */
        const originalEnd = res.end.bind(res);
        let endArgs = null;
        res.end = function (...args) {
            endArgs = args;
            return res; // maintain correct return type
        };
        // Proceed to the next middleware or route handler
        await next();
        // If the response from the protected route is >= 400, do not settle payment
        if (res.statusCode >= 400) {
            res.end = originalEnd;
            if (endArgs) {
                originalEnd(...endArgs);
            }
            return;
        }
        try {
            const settleResponse = await settle(decodedPayment, selectedPaymentRequirements);
            const responseHeader = settleResponseHeader(settleResponse);
            res.setHeader("X-PAYMENT-RESPONSE", responseHeader);
        }
        catch (error) {
            // If settlement fails and the response hasn't been sent yet, return an error
            if (!res.headersSent) {
                res.status(402).json({
                    x402Version,
                    error,
                    accepts: toJsonSafe(paymentRequirements),
                });
                return;
            }
        }
        finally {
            res.end = originalEnd;
            if (endArgs) {
                originalEnd(...endArgs);
            }
        }
    };
}
//# sourceMappingURL=index.js.map