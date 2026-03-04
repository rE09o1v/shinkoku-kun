export type CategoryModel = {
  id: number;
  name: string;
  kind: "income" | "expense";
  inputEnabled: boolean;
};

export function getInputCategories(categories: CategoryModel[]): CategoryModel[] {
  return categories.filter((c) => c.inputEnabled);
}
