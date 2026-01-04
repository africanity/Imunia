"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type SystemSettings = {
  appName: string;
  appSubtitle: string;
  logoUrl: string;
};

type SystemSettingsContextShape = {
  settings: SystemSettings;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
};

const defaultSettings: SystemSettings = {
  appName: "Imunia",
  appSubtitle: "Plateforme de gestion de vaccination",
  logoUrl: "/logo.png",
};

const SystemSettingsContext = createContext<
  SystemSettingsContextShape | undefined
>(undefined);

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";
      const res = await fetch(`${apiUrl}/api/systemSettings`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setSettings({
        appName: data.appName ?? defaultSettings.appName,
        appSubtitle: data.appSubtitle ?? defaultSettings.appSubtitle,
        logoUrl: data.logoUrl ?? defaultSettings.logoUrl,
      });
    } catch (err) {
      console.warn("System settings fetch failed, fallback defaults.", err);
      setError(err instanceof Error ? err.message : "unknown error");
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SystemSettingsContext.Provider
      value={{ settings, loading, error, refreshSettings }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const ctx = useContext(SystemSettingsContext);
  if (!ctx) {
    throw new Error(
      "useSystemSettings must be used inside a SystemSettingsProvider",
    );
  }
  return ctx;
}









