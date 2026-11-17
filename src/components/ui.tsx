"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "section", ...rest }: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "form";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`min-w-0 rounded-2xl border border-line bg-panel ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`m-0 text-xs font-semibold text-muted ${className}`}>
      {children}
    </h2>
  );
}

export function Titre({ children, id, sub }: { children: ReactNode; id?: string; sub?: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="m-0 font-display text-[15px] font-semibold">{children}</h2>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function GrosChiffre({ children, className = "", size = "lg" }: { children: ReactNode; className?: string; size?: "md" | "lg" | "xl" }) {
  const t = size === "xl" ? "text-[44px]" : size === "lg" ? "text-[34px]" : "text-[26px]";
  return <div className={`font-display font-bold leading-tight tracking-[-0.03em] ${t} ${className}`}>{children}</div>;
}

export function Segmented<T extends string>({
  value, options, onChange, label, size = "sm",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-[10px] border border-line bg-bar p-[3px]">
      {options.map((o) => {
        const actif = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap rounded-[7px] px-3 text-xs transition-colors ${size === "md" ? "min-h-9" : "py-[7px]"} ${
              actif ? "bg-[#262b38] font-semibold text-txt" : "font-medium text-muted hover:text-txt"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pastille({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} />;
}

export function BoutonSecondaire({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-line-strong bg-panel-2 px-3 text-xs font-medium text-txt transition-colors hover:bg-chip disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const IconeCheck = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconeRefresh = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const IconeLogo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B0D12" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12l4 6-10 12L2 9z" />
  </svg>
);
