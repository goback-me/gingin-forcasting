"use client";

export default function ChannelTabs({
  active,
  onChange,
  marketCount,
  onlineCount,
}: {
  active: "Market" | "Online";
  onChange: (channel: "Market" | "Online") => void;
  marketCount?: number;
  onlineCount?: number;
}) {
  return (
    <div className="flex gap-1 mb-4 border-b border-border">
      {(["Market", "Online"] as const).map((tab) => {
        const count = tab === "Market" ? marketCount : onlineCount;
        const isActive = active === tab;
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-green-strong text-green-strong"
                : "border-transparent text-inkfaint hover:text-inksoft"
            }`}
          >
            {tab}
            {count !== undefined && <span className="ml-1.5 text-[11.5px] text-inkfaint">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
