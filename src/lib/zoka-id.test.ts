// @vitest-environment node
// Node has crypto.subtle; jsdom does not.
import { describe, expect, it } from "vitest";
import { zokaId } from "./zoka-id";

// The vectors of docs/ZOKA-ID.md in the node repository.
const VECTORS = [
  {
    short: "public-account:alice",
    code: "F4A4-595C-AF1B-A80B-914F",
    mosaic: "432401304002143331324404132221311134034044240240320441133232224123324403241422013",
  },
  {
    short: "zqtest2ZokaIdExampleShortAddressForTheSpecVectors0000000",
    code: "7E6B-EFD1-09F3-E0AC-979C",
    mosaic: "344213322211120313430011324432441024221440333433223012304030433043022104420412341",
  },
];

describe("Zoka ID", () => {
  it("matches the spec vectors", async () => {
    for (const vector of VECTORS) {
      const id = await zokaId(vector.short);
      expect(id?.code).toBe(vector.code);
      expect(id?.cells.join("")).toBe(vector.mosaic);
    }
  });

  it("has no ID for an empty or malformed input", async () => {
    expect(await zokaId("")).toBeNull();
    expect(await zokaId("bad id")).toBeNull();
    expect(await zokaId("x".repeat(257))).toBeNull();
  });
});
