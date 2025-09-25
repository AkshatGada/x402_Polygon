import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";

const account = typeof process !== 'undefined' ? process.env.PRIVATE_KEY : undefined;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.polygon.technology";

const fetchWithPayment = wrapFetchWithPayment(fetch, account);

const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

fetchWithPayment(url, { //url should be something like https://api.example.com/paid-endpoint
  method: "GET",
})
  .then(async response => {
    const body = await response.json();
    console.log(body);

    const paymentResponse = decodeXPaymentResponse(response.headers.get("x-payment-response"));
    console.log(paymentResponse);
  })
  .catch(error => {
    console.error(error.response?.data?.error || error.message);
  }); 