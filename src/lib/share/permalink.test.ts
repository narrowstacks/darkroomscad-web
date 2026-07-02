import { describe, it, expect } from "vitest";
import { encodeShare, decodeShare, PERMALINK_VERSION, MAX_PAYLOAD_CHARS } from "./permalink";

describe("encodeShare / decodeShare", () => {
  it("round-trips a diff vs. the seed", () => {
    const seed = { Carrier_Type: "omega-d", Font_Size: 8, Alignment_Board: false };
    const values = { Carrier_Type: "beseler-23c", Font_Size: 8, Alignment_Board: true };
    const payload = encodeShare(values, seed);
    expect(decodeShare(payload)).toEqual({ Carrier_Type: "beseler-23c", Alignment_Board: true });
  });

  it("encodes an empty diff when values equal the seed", () => {
    const seed = { Carrier_Type: "omega-d", Font_Size: 8 };
    const values = { Carrier_Type: "omega-d", Font_Size: 8 };
    const payload = encodeShare(values, seed);
    expect(decodeShare(payload)).toEqual({});
  });

  it("round-trips non-ASCII text", () => {
    const seed = { Owner_Name: "" };
    const values = { Owner_Name: "Aarön" };
    const payload = encodeShare(values, seed);
    expect(decodeShare(payload)).toEqual({ Owner_Name: "Aarön" });
  });

  it("rejects oversize payloads", () => {
    const huge = "a".repeat(MAX_PAYLOAD_CHARS + 1);
    expect(decodeShare(huge)).toBeNull();
  });

  it("rejects garbage base64/JSON", () => {
    expect(decodeShare("not-valid-base64!!!")).toBeNull();
    expect(decodeShare("")).toBeNull();
  });

  it("rejects an unknown version", () => {
    const json = JSON.stringify({ v: 2, values: { Owner_Name: "X" } });
    const payload = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(payload)).toBeNull();
  });

  it("rejects non-object values", () => {
    const json = JSON.stringify({ v: PERMALINK_VERSION, values: "not-an-object" });
    const payload = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(payload)).toBeNull();

    const jsonArr = JSON.stringify({ v: PERMALINK_VERSION, values: [1, 2, 3] });
    const payloadArr = btoa(jsonArr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(payloadArr)).toBeNull();
  });

  it("filters non-primitive entries out of otherwise-valid values", () => {
    const json = JSON.stringify({
      v: PERMALINK_VERSION,
      values: { Owner_Name: "ok", Nested: { a: 1 }, ListVal: [1, 2] },
    });
    const payload = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeShare(payload)).toEqual({ Owner_Name: "ok" });
  });
});
