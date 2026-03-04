import { describe, expect, it } from "vitest";
import { getInputCategories, type CategoryModel } from "./category";

describe("category", () => {
  it("filters input enabled categories", () => {
    const categories: CategoryModel[] = [
      { id: 1, name: "本業売上", kind: "income", inputEnabled: true },
      { id: 2, name: "売上", kind: "income", inputEnabled: false },
      { id: 3, name: "交通費", kind: "expense", inputEnabled: true },
    ];

    const inputs = getInputCategories(categories);
    expect(inputs.map((c) => c.name)).toEqual(["本業売上", "交通費"]);
  });
});
