import { describe, expect, it } from "vitest";
import {
  isPositiveIntegerYen,
  normalizeMonthInput,
  normalizeYearInput,
} from "./validation";

describe("validation", () => {
  it("accepts positive integer yen only", () => {
    expect(isPositiveIntegerYen("1200")).toBe(true);
    expect(isPositiveIntegerYen("0")).toBe(false);
    expect(isPositiveIntegerYen("-1")).toBe(false);
    expect(isPositiveIntegerYen("12.5")).toBe(false);
    expect(isPositiveIntegerYen(" 100 ")).toBe(true);
  });

  it("normalizes year values", () => {
    expect(normalizeYearInput("24")).toBe(2024);
    expect(normalizeYearInput("2024")).toBe(2024);
    expect(normalizeYearInput("1899")).toBeNull();
    expect(normalizeYearInput("x")).toBeNull();
  });

  it("normalizes month values", () => {
    expect(normalizeMonthInput("1")).toBe(1);
    expect(normalizeMonthInput("12")).toBe(12);
    expect(normalizeMonthInput("0")).toBeNull();
    expect(normalizeMonthInput("13")).toBeNull();
  });
});
