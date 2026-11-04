import { AmountError, atomsToInput, formatZka, memoBytes, parseZka } from "./amount";

describe("amounts", () => {
  it("reads what a person types, exactly, in atoms", () => {
    expect(parseZka("1")).toBe(1_000_000n);
    expect(parseZka("0.1")).toBe(100_000n);
    expect(parseZka(".5")).toBe(500_000n);
    expect(parseZka("1,234.000001")).toBe(1_234_000_001n);
    expect(parseZka(" 7. ")).toBe(7_000_000n);
    expect(parseZka("23000000")).toBe(23_000_000_000_000n);
  });

  it("refuses what is not an amount it can send", () => {
    for (const text of ["", " ", ".", "abc", "1.2.3", "-1", "1e3", "0", "0.000000", "0.0000001", "23000000.000001"]) {
      expect(() => parseZka(text), text).toThrow(AmountError);
    }
  });

  it("writes atoms back with grouping and without float rounding", () => {
    expect(formatZka(0)).toBe("0.00");
    expect(formatZka(1)).toBe("0.000001");
    expect(formatZka(5_019_799_999_600n)).toBe("5,019,799.9996");
    expect(formatZka(12_000_000)).toBe("12.00");
    expect(formatZka(12_000_000, 0)).toBe("12");
    expect(formatZka("1234567890123")).toBe("1,234,567.890123");
    expect(atomsToInput(1_234_500_000n)).toBe("1234.5");
    expect(parseZka(atomsToInput(987_654_321n))).toBe(987_654_321n);
  });

  it("counts a note in UTF-8 bytes", () => {
    expect(memoBytes("abc")).toBe(3);
    expect(memoBytes("ñ")).toBe(2);
    expect(memoBytes("🙂")).toBe(4);
  });
});
