import type { Metadata } from "next";
import ReportView from "@/components/report/ReportView";

export const metadata: Metadata = { title: "Relatório · AEGIS" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ d?: string | string[] }> }) {
  const { d } = await searchParams;
  return <ReportView domain={(Array.isArray(d) ? d[0] : d) ?? ""} />;
}
