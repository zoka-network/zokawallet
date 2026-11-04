import { middle, parsePaymentText, paymentLink } from "./payment";

describe("payment text", () => {
  it("reads what ZKAPriv's QR codes and links carry", () => {
    expect(parsePaymentText("zqtest2abc")).toEqual({ address: "zqtest2abc" });
    expect(parsePaymentText("  zoka:zqtest2abc  ")).toEqual({ address: "zqtest2abc" });
    expect(parsePaymentText("zoka:zqtest2abc?amount=12.5")).toEqual({ address: "zqtest2abc", amount: "12.5" });
    expect(parsePaymentText("ZOKA:zqtest2abc?memo=x&amount=3")).toEqual({ address: "zqtest2abc", amount: "3" });
    expect(parsePaymentText("zoka://zqtest2abc")).toEqual({ address: "zqtest2abc" });
    // A full address pasted with line breaks is one address.
    expect(parsePaymentText("zqtest2ab\ncd ef")).toEqual({ address: "zqtest2abcdef" });
  });

  it("writes the same links", () => {
    expect(paymentLink("zqtest2abc")).toBe("zoka:zqtest2abc");
    expect(parsePaymentText(paymentLink("zqtest2abc", "1.5"))).toEqual({ address: "zqtest2abc", amount: "1.5" });
  });

  it("shortens long text from the middle", () => {
    expect(middle("abcdef", 2)).toBe("ab…ef");
    expect(middle("abcde", 2)).toBe("abcde");
  });
});
