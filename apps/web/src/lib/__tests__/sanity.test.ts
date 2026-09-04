import { describe, it, expect } from "vitest";

describe("workspace bootstrap", () => {
  it("runs a test through the vitest pipeline", () => {
    expect(1 + 1).toBe(2);
  });
});
