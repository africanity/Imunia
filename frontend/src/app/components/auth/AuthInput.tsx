"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  name?: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  icon: LucideIcon;
  required?: boolean;
  maxLength?: number;
  className?: string;
};

export default function AuthInput({
  name,
  type,
  placeholder,
  value,
  onChange,
  label,
  icon: Icon,
  required = false,
  maxLength,
  className = "",
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`space-y-2 transition-transform duration-300 ${
        focused ? "scale-[1.02]" : ""
      } ${className}`}
    >
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon className="h-4 w-4" />
        {label}
      </label>
      <div className="relative">
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          maxLength={maxLength}
          className={`w-full rounded-xl border-2 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all duration-300 focus:outline-none ${
            focused
              ? "border-emerald-500 bg-white shadow-lg shadow-emerald-500/20"
              : "border-slate-200 bg-white/50 hover:border-slate-300"
          } ${
            type === "password" && maxLength === 6
              ? "text-center text-2xl font-mono tracking-widest"
              : ""
          }`}
        />
      </div>
    </div>
  );
}


