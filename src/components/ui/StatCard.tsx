type StatCardProps = {
  title: string;
  value: number | string;
};

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-zinc-400">{title}</h3>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}