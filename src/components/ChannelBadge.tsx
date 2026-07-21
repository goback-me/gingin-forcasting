export default function ChannelBadge({ channel }: { channel: "Market" | "Online" }) {
  const cls =
    channel === "Online"
      ? "bg-blue-50 text-blue-700 border border-blue-200"
      : "bg-surface2 text-inksoft border border-border";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{channel}</span>;
}