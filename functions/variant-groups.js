"use strict";

const SKU_SUFFIX_LENGTH = 2;
const MIN_GROUP_KEY_LENGTH = 3;

function splitSku(sku) {
  if (!sku || typeof sku !== "string") return null;
  const trimmed = sku.trim();
  if (trimmed.length <= SKU_SUFFIX_LENGTH) return null;
  const groupKey = trimmed.slice(0, -SKU_SUFFIX_LENGTH);
  const colorCode = trimmed.slice(-SKU_SUFFIX_LENGTH);
  if (groupKey.length < MIN_GROUP_KEY_LENGTH) return null;
  return { groupKey, colorCode };
}

function deriveGroupTitle(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return "";
  const wordLists = list.map((n) => n.trim().split(/\s+/));
  const first = wordLists[0];
  const common = [];
  for (let i = 0; i < first.length; i++) {
    const word = first[i];
    if (wordLists.every((words) => words[i] === word)) {
      common.push(word);
    } else {
      break;
    }
  }
  if (common.length >= 2) return common.join(" ");
  return list[0];
}

function computeSkuGroups(products) {
  const buckets = new Map();
  const ungrouped = [];

  for (const product of products || []) {
    const split = splitSku(product.sku);
    if (!split) {
      ungrouped.push({ ...product, reason: product.sku ? "sku_too_short" : "no_sku" });
      continue;
    }
    if (!buckets.has(split.groupKey)) buckets.set(split.groupKey, []);
    buckets.get(split.groupKey).push(product);
  }

  const groups = [];
  for (const [groupKey, members] of buckets) {
    if (members.length < 2) {
      for (const member of members) {
        ungrouped.push({ ...member, reason: "single_product" });
      }
      continue;
    }
    groups.push({
      groupKey,
      title: deriveGroupTitle(members.map((p) => p.name)),
      products: members,
    });
  }

  return { groups, ungrouped };
}

function diffScanWithPublished(scanResult, publishedGroups) {
  const published = new Map((publishedGroups || []).map((g) => [g.groupKey, g]));
  const newGroups = [];
  const groupsWithAdditions = [];
  const removedFromCatalog = [];

  for (const scanned of scanResult.groups) {
    const pub = published.get(scanned.groupKey);
    if (!pub) {
      newGroups.push(scanned);
      continue;
    }

    const excluded = new Set((pub.excludedProductIds || []).map(String));
    const existingIds = new Set(pub.products.map((p) => String(p.productId)));
    const newProducts = scanned.products.filter(
      (p) => !existingIds.has(String(p.productId)) && !excluded.has(String(p.productId))
    );
    if (newProducts.length) {
      groupsWithAdditions.push({
        groupKey: scanned.groupKey,
        title: pub.title,
        existingProducts: pub.products,
        newProducts,
      });
    }

    const scannedIds = new Set(scanned.products.map((p) => String(p.productId)));
    const missing = pub.products.filter((p) => !scannedIds.has(String(p.productId)));
    if (missing.length) {
      removedFromCatalog.push({ groupKey: scanned.groupKey, title: pub.title, products: missing });
    }
  }

  for (const pub of publishedGroups || []) {
    const stillScanned = scanResult.groups.some((g) => g.groupKey === pub.groupKey);
    if (!stillScanned && pub.products.length) {
      removedFromCatalog.push({ groupKey: pub.groupKey, title: pub.title, products: pub.products });
    }
  }

  return { newGroups, groupsWithAdditions, removedFromCatalog, ungrouped: scanResult.ungrouped };
}

module.exports = {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
  diffScanWithPublished,
};
