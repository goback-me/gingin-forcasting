export default function BarList({
  items,
  color = "#3F6B4A",
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-[12.5px] mb-1">
            <span className="text-ink truncate pr-2">{item.label}</span>
            <span className="font-mono text-inksoft shrink-0">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
