import { describe, expect, it } from "vitest";

import {
  MAX_SESSIONS,
  addDays,
  buildSchedule,
  countAvailableSessions,
  formatMinutes,
  formatShort,
} from "./schedule";

// 2026-10-19 is a Monday, which anchors every weekday assertion below.
const MON = "2026-10-19";

describe("buildSchedule", () => {
  it("returns one session per weekday over two full weeks", () => {
    expect(buildSchedule(MON, "2026-11-02", 5)).toHaveLength(10);
  });

  it("starts on the requested start date", () => {
    expect(buildSchedule(MON, "2026-11-02", 5)[0]).toBe(MON);
  });

  it("skips weekends at five days a week", () => {
    // 2026-10-24 is a Saturday.
    expect(buildSchedule(MON, "2026-11-02", 5)).not.toContain("2026-10-24");
  });

  it("uses every calendar day at seven days a week", () => {
    expect(buildSchedule(MON, "2026-11-02", 7)).toHaveLength(14);
  });

  it("never schedules the exam day itself", () => {
    const dates = buildSchedule(MON, "2026-11-02", 7);
    expect(dates).not.toContain("2026-11-02");
    expect(dates).toContain("2026-11-01");
  });

  it("uses Mon/Wed/Fri at three days a week", () => {
    expect(buildSchedule(MON, "2026-10-26", 3)).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
  });

  it("caps long ranges at MAX_SESSIONS", () => {
    expect(buildSchedule(MON, "2027-10-19", 7)).toHaveLength(MAX_SESSIONS);
  });

  it("falls back to every day when the weekday pattern matches nothing", () => {
    // Sat 24th to Mon 26th contains no Mon/Wed/Fri, so the pattern is dropped
    // rather than returning an empty plan.
    expect(buildSchedule("2026-10-24", "2026-10-26", 3).length).toBeGreaterThan(0);
  });

  it("returns nothing when the exam is on the start date", () => {
    expect(buildSchedule(MON, MON, 5)).toHaveLength(0);
  });
});

describe("countAvailableSessions", () => {
  it("reports the uncapped total so the UI can warn about truncation", () => {
    expect(countAvailableSessions(MON, "2027-10-19", 7)).toBeGreaterThan(MAX_SESSIONS);
  });

  it("agrees with buildSchedule when under the cap", () => {
    expect(countAvailableSessions(MON, "2026-11-02", 5)).toBe(
      buildSchedule(MON, "2026-11-02", 5).length,
    );
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("formatting", () => {
  it("formats a short date", () => {
    expect(formatShort(MON)).toBe("Mon 19 Oct");
  });

  it.each([
    [90, "1h 30m"],
    [45, "45m"],
    [120, "2h"],
    [0, "0m"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});
