// What a QR code or a link carries, as ZKAPriv reads it: the bare address, or
// `zoka:<address>?amount=<ZKA>`.

export interface PaymentText {
  address: string;
  amount?: string;
}

/** The longest text read from a QR or a link: a full address and change. */
const MAX_TEXT = 10_000;

export function parsePaymentText(text: string): PaymentText {
  const trimmed = text.trim().slice(0, MAX_TEXT);
  const body = trimmed.toLowerCase().startsWith("zoka:") ? trimmed.slice(5) : trimmed;
  const [rawAddress = "", query = ""] = body.split("?", 2);
  const address = rawAddress.replace(/^\/\//, "").replace(/\s+/g, "");
  const amount = query
    .split("&")
    .map((part) => part.split("=", 2))
    .find(([key]) => key === "amount")?.[1];
  return amount ? { address, amount: decodeURIComponent(amount) } : { address };
}

/** A `zoka:` link to pay `address`, as the QR of a request carries it. */
export function paymentLink(address: string, amount?: string): string {
  return amount ? `zoka:${address}?amount=${encodeURIComponent(amount)}` : `zoka:${address}`;
}

/** `zqtest1abcd…wxyz`: enough of an address to recognise it. */
export function middle(text: string, keep = 10): string {
  return text.length <= keep * 2 + 1 ? text : `${text.slice(0, keep)}…${text.slice(-keep)}`;
}
