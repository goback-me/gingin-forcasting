/**
 * TEMPORARY placeholder categorization.
 *
 * The client hasn't sent a real category/subcategory file yet (expected
 * next week). Until then, this guesses a category + subcategory from the
 * product name itself using keyword matching, purely so the category
 * rollup view has realistic-looking groupings to demo against.
 *
 * Delete/replace this the moment real category + subcategory columns
 * exist in the source files -- it's a stand-in, not a real taxonomy.
 */

const CUT_RULES: [string, string][] = [
  ["SCOTCH FILLET", "Scotch Fillet"],
  ["FILLET", "Fillet"],
  ["MINCE", "Mince"],
  ["CHUCK", "Chuck"],
  ["WHOLE", "Whole"],
  ["DICED", "Diced"],
  ["BRISKET", "Brisket"],
  ["RIBS", "Ribs"],
  ["SCALLOPINI", "Scallopini"],
  ["TENDON", "Tendon"],
  ["TENDERLOIN", "Tenderloin"],
  ["BURGER", "Burgers"],
  ["SAUSAGE", "Sausages"],
  ["CHEEK", "Cheeks"],
  ["LIVER", "Liver"],
  ["HEART", "Heart"],
  ["BLADE", "Blade"],
  ["ROAST", "Roast"],
  ["SCHNITZEL", "Schnitzel"],
  ["BREAST", "Breast"],
  ["THIGH", "Thigh"],
  ["WING", "Wings"],
  ["DRUMSTICK", "Drumstick"],
  ["FEET", "Feet"],
  ["FRAME", "Frames"],
  ["NECK", "Necks"],
  ["SKIN", "Skin"],
  ["MARYLAND", "Maryland"],
  ["KIEV", "Kiev"],
  ["SHOULDER", "Shoulder"],
  ["CHOP", "Chops"],
  ["LEG", "Leg"],
  ["RACK", "Rack"],
];

function guessCut(name: string): string {
  for (const [key, label] of CUT_RULES) {
    if (name.includes(key)) return label;
  }
  return "General";
}

export function guessCategory(productName: string): { category: string; subCategory: string } {
  const n = productName.toUpperCase();

  if (n.includes("CHICKEN")) return { category: "Chicken", subCategory: guessCut(n) };
  if (n.includes("LAMB")) return { category: "Lamb", subCategory: guessCut(n) };

  if (n.includes("GRASS FED BEEF") || n.includes("GRASS-FED BEEF")) {
    return { category: "Grass Fed Beef", subCategory: guessCut(n) };
  }
  if (n.includes("DRY AGED BEEF") || n.includes("DRY-AGED BEEF")) {
    return { category: "Dry Aged Beef", subCategory: guessCut(n) };
  }
  if (n.includes("BEEF")) return { category: "Beef", subCategory: guessCut(n) };

  if (n.includes("PORK")) return { category: "Pork", subCategory: guessCut(n) };
  if (n.includes("SAUSAGE")) return { category: "Sausages", subCategory: "General" };
  if (n.includes("EGG")) return { category: "Eggs", subCategory: "General" };
  if (n.includes("BUTTER")) return { category: "Dairy", subCategory: "Butter" };
  if (n.includes("SOAP") || n.includes("CREAM") || n.includes("BALM") || n.includes("LOTION")) {
    return { category: "Skincare", subCategory: "General" };
  }
  if (n.includes("ELECTROLYTE") || n.includes("SALT") || n.includes("SPRAY")) {
    return { category: "Wellness", subCategory: "General" };
  }

  return { category: "Other", subCategory: "General" };
}