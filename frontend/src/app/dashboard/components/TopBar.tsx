"use client";

import { useState } from "react";
import { Bell, LogOut, UserCircle2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { settings } = useSystemSettings();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 shadow-sm"
      style={{ backgroundColor: "var(--header-color)" }}
    >
      <div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--header-text-color)" }}
        >
          Bienvenue
        </p>
        <p
          className="text-lg font-semibold"
          style={{ color: "var(--header-text-color)" }}
        >
          {user
            ? `${user.email ?? "national@test.com"} - ${
                user.role === "AGENT" && user.agentLevel === "ADMIN"
                  ? "agent admin"
                  : user.role.toLowerCase()
              }`
            : "national@test.com - national"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white p-2 transition hover:border-emerald-300 hover:text-emerald-600"
          aria-label="Notifications"
        >
          <Bell
            className="h-5 w-5"
            style={{ color: "var(--header-icon-color)" }}
          />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 transition hover:border-emerald-300 hover:text-emerald-600"
          >
            <UserCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Profil</span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  {user?.email ?? "national@test.com"}
                </span>
                <button
                  type="button"
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setProfileOpen(false)}
                  aria-label="Fermer le menu profil"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <UserCircle2 className="h-4 w-4" />
                  Voir mon profil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

