type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div className="
      bg-gradient-to-b from-zinc-900/80 to-zinc-950
      border border-sky-500/10
      rounded-xl p-6
      shadow-[0_0_25px_rgba(56,189,248,0.05)]
      backdrop-blur-sm
      transition-all duration-300
      hover:border-sky-400/30
      hover:shadow-[0_0_30px_rgba(56,189,248,0.10)]
      hover:scale-[1.01]
    ">
      {children}
    </div>
  );
}