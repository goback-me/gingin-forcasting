// Single source of truth for turning whatever a source file calls its
// sales channel into one of the two buckets the dashboard actually cares
// about. Default is always "Market" -- a row only becomes "Online" if the
// source explicitly says so. Add a keyword here if a new source uses a
// word for online sales we don't recognise yet.
export type Channel = "Market" | "Online";

const ONLINE_KEYWORDS = [
  "online",
  "web",
  "website",
  "shopify",
  "woocommerce",
  "ecommerce",
  "e-commerce",
  "internet",
];

export function classifyChannel(raw?: string | null): Channel {
  if (!raw) return "Market";
  const norm = raw.trim().toLowerCase();
  if (!norm) return "Market";
  return ONLINE_KEYWORDS.some((k) => norm.includes(k)) ? "Online" : "Market";
}