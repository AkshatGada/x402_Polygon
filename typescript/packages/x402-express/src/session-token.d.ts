import type { Request, Response } from "express";
/**
 * Generate a session token for Coinbase Onramp and Offramp using Secure Init
 *
 * This endpoint creates a server-side session token that can be used
 * instead of passing appId and addresses directly in onramp/offramp URLs.
 *
 * Setup:
 * 1. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables
 * 2. Add this to your Express app: app.post("/api/x402/session-token", POST);
 *
 * @param req - The Express Request containing the session token request
 * @param res - The Express Response object
 * @returns Promise<void> - The response containing the session token or error
 */
export declare function POST(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=session-token.d.ts.map