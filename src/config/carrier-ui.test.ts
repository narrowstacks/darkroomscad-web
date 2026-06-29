import { describe, it, expect } from "vitest";
import { CARRIER_UI } from "./carrier-ui";
import { validateOverlay, resolveFormModel } from "../lib/form/form-model";
import schema from "../../generated/param-schema.json";
import type { ParamSchema } from "../lib/params/types";

describe("carrier-ui overlay vs generated schema", () => {
  it("references only params that exist in the generated schema", () => {
    expect(validateOverlay(schema as ParamSchema, CARRIER_UI)).toEqual([]);
  });
  it("resolves every field against the real schema without throwing", () => {
    expect(() => resolveFormModel(schema as ParamSchema, CARRIER_UI)).not.toThrow();
  });
});
