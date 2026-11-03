import Sidebar from "@/components/Sidebar";

export default function SectionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#09090B]">
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
