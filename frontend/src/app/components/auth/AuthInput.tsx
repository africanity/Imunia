"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";
  const isPin = isPassword && maxLength === 6;
  const inputType = isPassword && !isPin && showPassword ? "text" : type;

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
          type={inputType}
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
            isPin
              ? "text-center text-2xl font-mono tracking-widest"
              : isPassword && !isPin
                ? "pr-12"
                : ""
          }`}
        />
        {isPassword && !isPin && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}


