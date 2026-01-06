"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import LogoPreview from "@/app/components/LogoPreview";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

type Props = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showHelpSection?: boolean;
};

export default function AuthLayout({
  children,
  title,
  subtitle = "Plateforme de gestion de vaccination",
  showHelpSection = true,
}: Props) {
  const { settings } = useSystemSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50">
      <div className="w-full max-w-md px-4">
        <div
          className={`transition-all duration-700 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="mb-8 text-center">
            <div className="mb-6">
              <LogoPreview size="lg" />
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-slate-900">
              {settings.appName ?? "Imunia"}
            </h1>
            <p className="text-sm font-medium text-slate-600">
              {subtitle ?? settings.appSubtitle}
            </p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            </div>
            {children}
          </div>

          {showHelpSection && (
            <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 backdrop-blur-sm">
              <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
              <p className="text-sm font-medium text-blue-700">
                Besoin d&apos;aide ? Contactez votre administrateur système
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









