function localizedName(name) {
  if (name == null) return "";
  if (typeof name === "string") return name;
  return name.es || Object.values(name)[0] || "";
}

export function buildCategoryTree(flat) {
  const nodes = new Map();
  (flat || []).forEach((c) => nodes.set(String(c.id), { id: String(c.id), name: localizedName(c.name), children: [] }));
  const roots = [];
  (flat || []).forEach((c) => {
    const node = nodes.get(String(c.id));
    const parentId = c.parent != null && String(c.parent) !== "0" ? String(c.parent) : null;
    if (parentId && nodes.has(parentId)) nodes.get(parentId).children.push(node);
    else roots.push(node);
  });
  return roots;
}

export function flattenTreeForSelect(tree, depth = 0) {
  const out = [];
  (tree || []).forEach((n) => {
    out.push({ id: n.id, name: n.name, depth });
    out.push(...flattenTreeForSelect(n.children, depth + 1));
  });
  return out;
}
