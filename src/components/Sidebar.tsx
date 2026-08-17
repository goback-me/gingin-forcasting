"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/forecast", label: "Forecast table" },
  { href: "/review", label: "This week's plan" },
  { href: "/scenario", label: "Scenario planning" },
  { href: "/alerts", label: "Alerts" },
  { href: "/history", label: "Plan history" },
  { href: "/upload", label: "Upload data" },
  { href: "/reports", label: "Custom Report" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // The login page has its own full-screen layout -- no sidebar there.
  if (pathname.startsWith("/login")) return null;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="w-[220px] shrink-0 bg-green-strong text-green-50 px-4 py-6 flex flex-col gap-7">
      <div>
        <div className="font-display text-white text-lg">Gingin Forecast</div>
        <div className="text-[11px] text-[#B9C7B2]">Monthly demand planning</div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-[13.5px] transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-[#D7E2D1] hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#D7E2D1] hover:bg-white/10 mb-3"
        >
          Sign out
        </button>
        <div className="text-[11px] text-[#9FAE97] leading-relaxed pt-4 border-t border-white/10">
          Data: local import (demo)
          <br />
          Next up: live Google Sheets sync
        </div>
      </div>
    </div>
  );
}