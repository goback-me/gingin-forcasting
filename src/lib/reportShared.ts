// Shared between the report builder and the report viewer page so both
// apply filters/sort identically -- a saved view should look the same
// whether you're actively editing it or just viewing it.

export type ReportFilters = {
  category: string;
  channel: "all" | "Market" | "Online";
  marketName: string;
  status: string;
  search: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  category: "",
  channel: "all",
  marketName: "",
  status: "all",
  search: "",
};

export function applyReportFilters(products: any[], filters: ReportFilters) {
  return products.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.channel !== "all" && p.channel !== filters.channel) return false;
    if (filters.marketName && p.marketName !== filters.marketName) return false;
    if (filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

export function sortReportRows(products: any[], sortKey: string | null, sortDir: 1 | -1) {
  if (!sortKey) return products;
  return [...products].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * ((av as number) - (bv as number));
  });
}