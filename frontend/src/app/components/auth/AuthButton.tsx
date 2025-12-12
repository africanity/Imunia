"use client";

import { Loader2, type LucideIcon } from "lucide-react";

type Props = {
  type?: "submit" | "button";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  loadingText?: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  className?: string;
};

export default function AuthButton({
  type = "submit",
  loading = false,
  disabled = false,
  onClick,
  children,
  loadingText = "Chargement...",
  icon: Icon,
  variant = "primary",
  className = "",
}: Props) {
  const base =
    "w-full px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2";

  const variants: Record<NonNullable<Props["variant"]>, string> = {
    primary: loading || disabled
      ? "bg-slate-400 text-white cursor-not-allowed"
      : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-500/25 hover:scale-105 active:scale-95",
    secondary: loading || disabled
      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {children}
          {Icon && <Icon className="h-5 w-5" />}
        </>
      )}
    </button>
  );
}









