import { describe, expect, it } from "vitest";

import {
  daysUntil,
  documentTitle,
  dueLabel,
  firstName,
  formatBytes,
  initials,
} from "@/lib/format";

const NOW = new Date("2026-11-23T09:00:00");

function on(day: string) {
  return new Date(`${day}T12:00:00`);
}

describe("counting days to a date", () => {
  it("ignores the time of day", () => {
    expect(daysUntil(new Date("2026-11-23T23:59:00"), NOW)).toBe(0);
    expect(daysUntil(new Date("2026-11-23T00:01:00"), NOW)).toBe(0);
  });

  it("counts forwards and backwards", () => {
    expect(daysUntil(on("2026-11-24"), NOW)).toBe(1);
    expect(daysUntil(on("2026-11-30"), NOW)).toBe(7);
    expect(daysUntil(on("2026-11-22"), NOW)).toBe(-1);
  });
});

// A missed deadline is the thing a firm cannot afford, so the wording and the
// tone it carries are worth pinning down.
describe("how a deadline is described", () => {
  it("names an overdue date as overdue, not as a date", () => {
    expect(dueLabel(on("2026-11-22"), NOW)).toEqual({
      text: "Overdue by 1 day",
      tone: "late",
    });
    expect(dueLabel(on("2026-11-20"), NOW)).toEqual({
      text: "Overdue by 3 days",
      tone: "late",
    });
  });

  it("marks today and tomorrow", () => {
    expect(dueLabel(on("2026-11-23"), NOW)).toEqual({
      text: "Due today",
      tone: "soon",
    });
    expect(dueLabel(on("2026-11-24"), NOW)).toEqual({
      text: "Due tomorrow",
      tone: "soon",
    });
  });

  it("treats the next three days as soon, and the rest as normal", () => {
    expect(dueLabel(on("2026-11-26"), NOW).tone).toBe("soon");
    expect(dueLabel(on("2026-11-27"), NOW).tone).toBe("normal");
    expect(dueLabel(on("2026-11-27"), NOW).text).toBe("In 4 days");
  });

  it("falls back to a plain date beyond a month", () => {
    expect(dueLabel(on("2027-03-01"), NOW)).toEqual({
      text: "1 Mar 2027",
      tone: "normal",
    });
  });
});

describe("small text helpers", () => {
  it("drops the pdf suffix from a document name", () => {
    expect(documentTitle("Purchase contract.pdf")).toBe("Purchase contract");
    expect(documentTitle("Report.PDF")).toBe("Report");
    expect(documentTitle("Notes")).toBe("Notes");
  });

  it("takes initials from at most two names", () => {
    expect(initials("Elena Vance")).toBe("EV");
    expect(initials("Northwind Logistics Ltd")).toBe("NL");
    expect(initials("Ana")).toBe("A");
  });

  it("takes the first name for a greeting", () => {
    expect(firstName("Ana Berisha")).toBe("Ana");
    expect(firstName("Ana")).toBe("Ana");
  });

  it("formats file sizes the way a person reads them", () => {
    expect(formatBytes(512)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });
});
