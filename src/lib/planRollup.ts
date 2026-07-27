/**
 * Consolidated category -> subcategory -> product rollup for "This week's
 * plan". Takes the flat list of PlanItems (one row per product per
 * channel per market) and collapses it into a tree:
 *
 *   Category (e.g. "Grass Fed Beef")            <- total kg = sum of its subcategories
 *     Subcategory (e.g. "Chuck")                <- total kg = sum of its products
 *       Product                                 <- Market consolidated (all markets summed) + Online (qty & kg)
 *
 * Market and Online numbers are kept separate per product (client wants
 * them "separated entirely"), plus a combined total per product and up
 * the tree, so there's also one dashboard-style consolidated figure.
 */

export type RollupPlanItem = {
  productName: string;
  category: string;
  subCategory: string | null;
  productCode: string | null;
  channel: "Market" | "Online";
  recommendedQty: number;
  recommendedKg: number | null;
  approvedQty: number | null;
  approvedKg: number | null;
};

export type ProductRollup = {
  productName: string;
  productCode: string | null;
  marketKg: number | null; // null if this product has no Market rows at all
  marketQty: number;
  onlineKg: number | null; // null if this product has no Online rows at all
  onlineQty: number;
  combinedKg: number;
};

export type SubcategoryRollup = {
  subCategory: string;
  totalKg: number; // combined (Market + Online)
  marketKg: number; // Market only, consolidated across all markets
  onlineKg: number; // Online only
  onlineQty: number; // Online only
  products: ProductRollup[];
};

export type CategoryRollup = {
  category: string;
  totalKg: number; // combined (Market + Online)
  marketKg: number; // Market only
  onlineKg: number; // Online only
  onlineQty: number; // Online only
  subcategories: SubcategoryRollup[];
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function buildCategoryRollup(items: RollupPlanItem[]): CategoryRollup[] {
  type Acc = {
    category: string;
    subCategory: string;
    productCode: string | null;
    marketKg: number;
    marketQty: number;
    onlineKg: number;
    onlineQty: number;
    hasMarketKg: boolean;
    hasOnlineKg: boolean;
    hasMarket: boolean;
    hasOnline: boolean;
  };

  const byProduct = new Map<string, Acc>();

  for (const item of items) {
    let acc = byProduct.get(item.productName);
    if (!acc) {
      acc = {
        category: item.category || "Uncategorised",
        subCategory: item.subCategory || "General",
        productCode: item.productCode ?? null,
        marketKg: 0,
        marketQty: 0,
        onlineKg: 0,
        onlineQty: 0,
        hasMarketKg: false,
        hasOnlineKg: false,
        hasMarket: false,
        hasOnline: false,
      };
      byProduct.set(item.productName, acc);
    }
    // The "live" number: whatever's been approved/overridden takes
    // precedence, falling back to the recommendation while still pending.
    const qty = item.approvedQty ?? item.recommendedQty;
    const kg = item.approvedKg ?? item.recommendedKg;

    if (item.channel === "Market") {
      acc.hasMarket = true;
      acc.marketQty += qty;
      if (kg !== null) {
        acc.marketKg += kg;
        acc.hasMarketKg = true;
      }
    } else {
      acc.hasOnline = true;
      acc.onlineQty += qty;
      if (kg !== null) {
        acc.onlineKg += kg;
        acc.hasOnlineKg = true;
      }
    }
  }

  const categories = new Map<string, Map<string, ProductRollup[]>>();

  for (const [productName, acc] of byProduct) {
    if (!categories.has(acc.category)) categories.set(acc.category, new Map());
    const subMap = categories.get(acc.category)!;
    if (!subMap.has(acc.subCategory)) subMap.set(acc.subCategory, []);
    subMap.get(acc.subCategory)!.push({
      productName,
      productCode: acc.productCode,
      marketKg: acc.hasMarket ? (acc.hasMarketKg ? round1(acc.marketKg) : null) : null,
      marketQty: acc.marketQty,
      onlineKg: acc.hasOnline ? (acc.hasOnlineKg ? round1(acc.onlineKg) : null) : null,
      onlineQty: acc.onlineQty,
      combinedKg: round1((acc.hasMarketKg ? acc.marketKg : 0) + (acc.hasOnlineKg ? acc.onlineKg : 0)),
    });
  }

  const result: CategoryRollup[] = [];
  for (const [category, subMap] of categories) {
    const subcategories: SubcategoryRollup[] = [];
    let categoryTotal = 0;
    let categoryMarketKg = 0;
    let categoryOnlineKg = 0;
    let categoryOnlineQty = 0;
    for (const [subCategory, products] of subMap) {
      products.sort((a, b) => b.combinedKg - a.combinedKg);
      const totalKg = round1(products.reduce((sum, p) => sum + p.combinedKg, 0));
      const marketKg = round1(products.reduce((sum, p) => sum + (p.marketKg ?? 0), 0));
      const onlineKg = round1(products.reduce((sum, p) => sum + (p.onlineKg ?? 0), 0));
      const onlineQty = products.reduce((sum, p) => sum + p.onlineQty, 0);
      subcategories.push({ subCategory, totalKg, marketKg, onlineKg, onlineQty, products });
      categoryTotal += totalKg;
      categoryMarketKg += marketKg;
      categoryOnlineKg += onlineKg;
      categoryOnlineQty += onlineQty;
    }
    subcategories.sort((a, b) => b.totalKg - a.totalKg);
    result.push({
      category,
      totalKg: round1(categoryTotal),
      marketKg: round1(categoryMarketKg),
      onlineKg: round1(categoryOnlineKg),
      onlineQty: categoryOnlineQty,
      subcategories,
    });
  }
  result.sort((a, b) => b.totalKg - a.totalKg);
  return result;
}