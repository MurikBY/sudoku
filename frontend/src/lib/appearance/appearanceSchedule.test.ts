import { describe, expect, it } from "vitest";

import { isAutoDarkHour } from "@/lib/appearance/appearanceSchedule";

describe("isAutoDarkHour", () => {
  it("is dark from 18:00 until 08:00", () => {
    expect(isAutoDarkHour(17)).toBe(false);
    expect(isAutoDarkHour(18)).toBe(true);
    expect(isAutoDarkHour(19)).toBe(true);
    expect(isAutoDarkHour(20)).toBe(true);
    expect(isAutoDarkHour(7)).toBe(true);
    expect(isAutoDarkHour(8)).toBe(false);
  });
});
