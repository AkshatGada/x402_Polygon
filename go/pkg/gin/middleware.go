package gin

import (
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/coinbase/x402/go/pkg/facilitatorclient"
	"github.com/coinbase/x402/go/pkg/types"
)

const x402Version = 1

// PaymentMiddlewareOptions is the options for the PaymentMiddleware.
type PaymentMiddlewareOptions struct {
	Description       string
	MimeType          string
	MaxTimeoutSeconds int
	OutputSchema      *json.RawMessage
	FacilitatorConfig *types.FacilitatorConfig
	Testnet           bool
	CustomPaywallHTML string
	Resource          string
	ResourceRootURL   string
	// New fields
	Network string
	Asset   string
}

// Options is the type for the options for the PaymentMiddleware.
type Options func(*PaymentMiddlewareOptions)

// WithDescription is an option for the PaymentMiddleware to set the description.
func WithDescription(description string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.Description = description
	}
}

// WithMimeType is an option for the PaymentMiddleware to set the mime type.
func WithMimeType(mimeType string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.MimeType = mimeType
	}
}

// WithMaxDeadlineSeconds is an option for the PaymentMiddleware to set the max timeout seconds.
func WithMaxTimeoutSeconds(maxTimeoutSeconds int) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.MaxTimeoutSeconds = maxTimeoutSeconds
	}
}

// WithOutputSchema is an option for the PaymentMiddleware to set the output schema.
func WithOutputSchema(outputSchema *json.RawMessage) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.OutputSchema = outputSchema
	}
}

// WithFacilitatorConfig is an option for the PaymentMiddleware to set the facilitator config.
func WithFacilitatorConfig(config *types.FacilitatorConfig) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.FacilitatorConfig = config
	}
}

// WithTestnet is an option for the PaymentMiddleware to set the testnet flag.
func WithTestnet(testnet bool) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.Testnet = testnet
	}
}

// WithCustomPaywallHTML is an option for the PaymentMiddleware to set the custom paywall HTML.
func WithCustomPaywallHTML(customPaywallHTML string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.CustomPaywallHTML = customPaywallHTML
	}
}

// WithResource is an option for the PaymentMiddleware to set the resource.
func WithResource(resource string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.Resource = resource
	}
}

func WithResourceRootURL(resourceRootURL string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.ResourceRootURL = resourceRootURL
	}
}

// WithNetwork sets a specific blockchain network key (e.g., "polygon", "polygon-amoy").
func WithNetwork(network string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.Network = network
	}
}

// WithAsset sets a specific ERC-20 token address to use as the asset (e.g., USDC address).
func WithAsset(asset string) Options {
	return func(options *PaymentMiddlewareOptions) {
		options.Asset = asset
	}
}

// PaymentMiddleware is the Gin middleware for the resource server using the x402payment protocol.
// Amount: the decimal denominated amount to charge (ex: 0.01 for 1 cent)
func PaymentMiddleware(amount *big.Float, address string, opts ...Options) gin.HandlerFunc {
	options := &PaymentMiddlewareOptions{
		FacilitatorConfig: &types.FacilitatorConfig{
			URL: facilitatorclient.DefaultFacilitatorURL,
		},
		MaxTimeoutSeconds: 60,
		Testnet:           true,
	}

	for _, opt := range opts {
		opt(options)
	}

	return func(c *gin.Context) {
		var (
			network              = "base"
			usdcAddress          = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
			facilitatorClient    = facilitatorclient.NewFacilitatorClient(options.FacilitatorConfig)
			maxAmountRequired, _ = new(big.Float).Mul(amount, big.NewFloat(1e6)).Int(nil)
		)

		// Override with explicit network/asset if provided
		if options.Network != "" {
			network = options.Network
		}
		if options.Asset != "" {
			usdcAddress = options.Asset
		}

		// Default selection behavior when explicit overrides are not provided
		if options.Asset == "" {
			if options.Network == "polygon" {
				usdcAddress = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"
			} else if options.Network == "polygon-amoy" {
				usdcAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
			} else if options.Network == "" { // fall back to Base/Base-Sepolia legacy behavior
				if options.Testnet {
					network = "base-sepolia"
					usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
				} else {
					network = "base"
					usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
				}
			}
		}

		fmt.Println("Payment middleware checking request:", c.Request.URL)

		userAgent := c.GetHeader("User-Agent")
		acceptHeader := c.GetHeader("Accept")
		isWebBrowser := strings.Contains(acceptHeader, "text/html") && strings.Contains(userAgent, "Mozilla")
		var resource string
		if options.Resource == "" {
			resource = options.ResourceRootURL + c.Request.URL.Path
		} else {
			resource = options.Resource
		}

		paymentRequirements := &types.PaymentRequirements{
			Scheme:            "exact",
			Network:           network,
			MaxAmountRequired: maxAmountRequired.String(),
			Resource:          resource,
			Description:       options.Description,
			MimeType:          options.MimeType,
			PayTo:             address,
			MaxTimeoutSeconds: options.MaxTimeoutSeconds,
			Asset:             usdcAddress,
			OutputSchema:      options.OutputSchema,
			Extra:             nil,
		}

		if err := paymentRequirements.SetUSDCInfo(options.Testnet); err != nil {
			fmt.Println("failed to set USDC info:", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":       err.Error(),
				"x402Version": x402Version,
			})
			return
		}

		payment := c.GetHeader("X-PAYMENT")
		paymentPayload, err := types.DecodePaymentPayloadFromBase64(payment)
		if err != nil {
			if isWebBrowser {
				html := options.CustomPaywallHTML
				if html == "" {
					html = getPaywallHtml(options)
				}
				c.Abort()
				c.Data(http.StatusPaymentRequired, "text/html", []byte(html))
				return
			}

			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       "X-PAYMENT header is required",
				"accepts":     []*types.PaymentRequirements{paymentRequirements},
				"x402Version": x402Version,
			})
			return
		}
		paymentPayload.X402Version = x402Version

		// Verify payment
		response, err := facilitatorClient.Verify(paymentPayload, paymentRequirements)
		if err != nil {
			fmt.Println("failed to verify", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":       err.Error(),
				"x402Version": x402Version,
			})
			return
		}

		if !response.IsValid {
			fmt.Println("Invalid payment: ", response.InvalidReason)
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       response.InvalidReason,
				"accepts":     []*types.PaymentRequirements{paymentRequirements},
				"x402Version": x402Version,
			})
			return
		}

		fmt.Println("Payment verified, proceeding")

		// Create a custom response writer to intercept the response
		writer := &responseWriter{
			ResponseWriter: c.Writer,
			body:           &strings.Builder{},
			statusCode:     http.StatusOK,
		}
		c.Writer = writer

		// Execute the handler
		c.Next()

		// Check if the handler was aborted
		if c.IsAborted() {
			return
		}

		// Settle payment
		settleResponse, err := facilitatorClient.Settle(paymentPayload, paymentRequirements)
		if err != nil {
			fmt.Println("Settlement failed:", err)
			// Reset the response writer
			c.Writer = writer.ResponseWriter
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       err.Error(),
				"accepts":     []*types.PaymentRequirements{paymentRequirements},
				"x402Version": x402Version,
			})
			return
		}

		settleResponseHeader, err := settleResponse.EncodeToBase64String()
		if err != nil {
			fmt.Println("Settle Header Encoding failed:", err)
			// Reset the response writer
			c.Writer = writer.ResponseWriter
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":       err.Error(),
				"x402Version": x402Version,
			})
			return
		}

		// Write the original response with the settlement header
		c.Header("X-PAYMENT-RESPONSE", settleResponseHeader)
		// Reset the response writer to the original
		c.Writer = writer.ResponseWriter
		c.Writer.WriteHeader(writer.statusCode)
		c.Writer.Write([]byte(writer.body.String()))
	}
}

// responseWriter is a custom response writer that captures the response
type responseWriter struct {
	gin.ResponseWriter
	body       *strings.Builder
	statusCode int
	written    bool
}

func (w *responseWriter) WriteHeader(code int) {
	if !w.written {
		w.statusCode = code
		w.written = true
	}
}

func (w *responseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.WriteHeader(http.StatusOK)
	}
	w.body.Write(b)
	return len(b), nil
}

func (w *responseWriter) WriteString(s string) (int, error) {
	if !w.written {
		w.WriteHeader(http.StatusOK)
	}
	return w.body.WriteString(s)
}

// getPaywallHtml is the default paywall HTML for the PaymentMiddleware.
func getPaywallHtml(_ *PaymentMiddlewareOptions) string {
	return "<html><body>Payment Required</body></html>"
}
