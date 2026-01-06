"use client";

import { AuthProvider } from "@/context/AuthContext";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SystemSettingsProvider>
      <AuthProvider>{children}</AuthProvider>
    </SystemSettingsProvider>
  );
}









