import { describe, it, expect } from 'vitest';
import axios from 'axios';

const INTERNAL_FACILITATOR_URL = 'https://x402.polygon.technology';

describe('Internal Facilitator Integration Tests', () => {
  describe('Supported Networks', () => {
    it('should verify supported networks from internal facilitator', async () => {
      const response = await axios.get(`${INTERNAL_FACILITATOR_URL}/supported`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('kinds');
      expect(response.data.kinds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            network: 'polygon-amoy'
          })
        ])
      );
    });
  });

  describe('Payment Requirements', () => {
    it('should handle payment requirements correctly', async () => {
      // Create a test payment payload
      const testPayload = {
        chainId: 80002,
        validAfter: Math.floor(Date.now() / 1000),
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: '0x' + Math.random().toString(16).slice(2),
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000' // 1 USDC (6 decimals)
      };

      const payloadBase64 = Buffer.from(JSON.stringify(testPayload)).toString('base64');

      try {
        await axios.post(`${INTERNAL_FACILITATOR_URL}/verify`, {
          paymentPayloadBase64: payloadBase64
        });
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('Failed to deserialize');
      }

      try {
        await axios.post(`${INTERNAL_FACILITATOR_URL}/settle`, {
          paymentPayloadBase64: payloadBase64
        });
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('Failed to deserialize');
      }
    });
  });
}); 