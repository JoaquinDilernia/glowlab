import test from "node:test";
import assert from "node:assert/strict";
import { buildCategoryTree, flattenTreeForSelect } from "./categoryTree.js";

test("buildCategoryTree anida por parent y resuelve name localizado", () => {
  const flat = [
    { id: 1, name: { es: "Ropa" }, parent: null },
    { id: 2, name: "Remeras", parent: 1 },
    { id: 3, name: "Pantalones", parent: 1 },
    { id: 4, name: "Oversize", parent: 2 },
  ];
  const tree = buildCategoryTree(flat);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "Ropa");
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[0].children[0].children[0].name, "Oversize");
});

test("flattenTreeForSelect devuelve depth para indentar", () => {
  const rows = flattenTreeForSelect(buildCategoryTree([
    { id: 1, name: "A", parent: null },
    { id: 2, name: "B", parent: 1 },
  ]));
  assert.deepEqual(rows.map((r) => [r.name, r.depth]), [["A", 0], ["B", 1]]);
});
