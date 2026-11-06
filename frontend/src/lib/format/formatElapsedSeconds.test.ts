import { describe, expect, it } from "vitest";

import {
  formatElapsedSeconds,
  formatOptionalElapsedSeconds,
} from "@/lib/format/formatElapsedSeconds";

describe("formatElapsedSeconds", () => {
  it("pads seconds to two digits", () => {
    expect(formatElapsedSeconds(0)).toBe("0:00");
    expect(formatElapsedSeconds(65)).toBe("1:05");
  });

  it("keeps minutes unbounded instead of rolling into hours", () => {
    expect(formatElapsedSeconds(3600)).toBe("60:00");
  });
});

describe("formatOptionalElapsedSeconds", () => {
  it("renders a dash for a missing time", () => {
    expect(formatOptionalElapsedSeconds(null)).toBe("–");
    expect(formatOptionalElapsedSeconds(9)).toBe("0:09");
  });
});
