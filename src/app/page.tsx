import Sidebar from "@/components/Sidebar";
import SecurityScore from "@/components/SecurityScore";
import StatsCards from "@/components/StatsCards";
import ThreatFeed from "@/components/ThreatFeed";
import SecurityStatus from "@/components/SecurityStatus";
import DomainScanner from "@/components/DomainScanner";
import { mockScan } from "@/data/mockScan";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090B] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 p-8">
          <h2 className="text-4xl font-bold">
            Security Overview
          </h2>

          <p className="text-zinc-400 mt-2">
            Real-time threat intelligence dashboard
          </p>

          <SecurityScore />

          <DomainScanner />

          <StatsCards />

          <div className="grid grid-cols-2 gap-6 mt-8">
            <ThreatFeed />
            <SecurityStatus />
          </div>
        </section>
      </div>
    </main>
  );
}