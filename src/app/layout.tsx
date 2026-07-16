import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Gingin Forecast",
  description: "Weekly SOH demand forecasting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-sm">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 px-9 py-7 max-w-[1360px]">{children}</main>
        </div>
      </body>
    </html>
  );
}
