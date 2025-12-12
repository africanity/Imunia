"use client";

import { AlertCircle, CheckCircle, Info } from "lucide-react";

type Props = {
  type: "error" | "success" | "info";
  message: string;
  className?: string;
};

const config = {
  error: {
    icon: AlertCircle,
    container: "bg-red-50/80 border-red-200 text-red-700",
    iconColor: "text-red-600",
  },
  success: {
    icon: CheckCircle,
    container: "bg-green-50/80 border-green-200 text-green-700",
    iconColor: "text-green-600",
  },
  info: {
    icon: Info,
    container: "bg-blue-50/80 border-blue-200 text-blue-700",
    iconColor: "text-blue-600",
  },
} as const;

export default function AuthAlert({ type, message, className = "" }: Props) {
  const cfg = config[type];
  const Icon = cfg.icon;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 backdrop-blur-sm ${cfg.container} ${className}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${cfg.iconColor}`} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}









