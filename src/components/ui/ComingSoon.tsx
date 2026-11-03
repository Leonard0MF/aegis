import type { ReactNode } from "react";

/** Cabeçalho + estado vazio para seções ainda não implementadas. */
export default function ComingSoon({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <main className="px-4 py-5 md:px-8 md:py-6">
      <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="text-sm text-muted mt-0.5">{description}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-panel/60 px-6 py-16 text-center">
        <p className="text-sm text-fg">Em construção</p>
        <p className="text-xs text-dim mt-1">{children ?? "Esta seção ainda não foi implementada."}</p>
      </div>
    </main>
  );
}
