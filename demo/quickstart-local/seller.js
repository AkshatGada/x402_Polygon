import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '../.env.local' });

const PORT = process.env.PORT || 8080;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:5401';
const AMOY_USDC = process.env.AMOY_USDC_ADDRESS || '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const PAYMENT_AMOUNT = Number(process.env.PAYMENT_AMOUNT || 10000);
const PAY_TO = process.env.CDP_PAY_TO || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const app = express();
app.use(bodyParser.json());

// Minimal PaymentRequirements response for 402
function makeAccepts() {
  return [
    {
      scheme: 'exact',
      network: 'polygon-amoy',
      maxAmountRequired: PAYMENT_AMOUNT,
      resource: '/premium/summarize',
      description: 'Premium summarize',
      mimeType: 'application/json',
      payTo: PAY_TO,
      maxTimeoutSeconds: 300,
      asset: AMOY_USDC,
      extra: {
        eip712: { name: 'USDC', version: '2' }
      }
    }
  ];
}

app.post('/premium/summarize', async (req, res) => {
  const paymentB64 = req.headers['x-payment'] || req.body.paymentPayloadBase64;
  if (!paymentB64) {
    return res.status(402).json({ accepts: makeAccepts() });
  }

  // Forward payload to facilitator /verify
  try {
    const verifyResp = await axios.post(`${FACILITATOR_URL}/verify`, { paymentPayloadBase64: paymentB64 });
    if (!verifyResp.data || !verifyResp.data.success) {
      return res.status(402).json({ error: 'verification_failed', accepts: makeAccepts() });
    }
  } catch (e) {
    return res.status(400).json({ error: 'verify_failed', details: e.response?.data || e.message });
  }

  // Generate the premium response first
  const responseBody = { result: 'premium content' };

  // Send the response to the client (so client can retry after verify)
  res.json(responseBody);

  // Now call settle in background; do not block the response
  (async () => {
    try {
      const settleResp = await axios.post(`${FACILITATOR_URL}/settle`, { paymentPayloadBase64: paymentB64 });
      // Optionally log or store settleResp.data
      console.log('Background settle result', settleResp.data);
    } catch (e) {
      console.error('Background settle failed', e.response?.data || e.message);
    }
  })();
  return;
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Seller (custom) running on port ${PORT}, facilitator=${FACILITATOR_URL}`)); 