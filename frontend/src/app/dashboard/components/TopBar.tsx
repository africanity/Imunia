"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, LogOut, UserCircle2, X, CheckCheck, ArrowRight, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
import Link from "next/link";
import ProfileModal from "./ProfileModal";

interface TopBarProps {
  onMenuClick?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}


export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout, accessToken } = useAuth();
  const { settings } = useSystemSettings();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Erreur récupération notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, API_URL]);

  const fetchUnreadCount = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error("Erreur récupération nombre notifications non lues:", error);
    }
  }, [accessToken, API_URL]);

  useEffect(() => {
    if (accessToken) {
      fetchUnreadCount();
      if (notificationsOpen) {
        fetchNotifications();
      }
    }
  }, [accessToken, notificationsOpen, fetchUnreadCount, fetchNotifications]);

  // Rafraîchir le compteur toutes les 30 secondes
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [accessToken, fetchUnreadCount]);

  const markAsRead = async (notificationId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Erreur marquage notification comme lue:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Erreur marquage toutes notifications comme lues:", error);
    }
  };

  // Fonction pour obtenir le nom de l'entité selon le rôle
  const getEntityLabel = () => {
    if (!user) return "national";
    
    if (user.role === "REGIONAL" && user.regionName) {
      return `Région: ${user.regionName}`;
    }
    
    if (user.role === "DISTRICT" && user.districtName) {
      return `District: ${user.districtName}`;
    }
    
    if (user.role === "AGENT") {
      if (user.healthCenterName) {
        return `Centre: ${user.healthCenterName}`;
      }
      return user.agentLevel === "ADMIN" ? "agent admin" : "agent";
    }
    
    // Pour les autres rôles (NATIONAL, SUPERADMIN), on garde l'ancien comportement
    return user.role.toLowerCase();
  };

  return (
    <header
      className="flex items-center justify-between gap-1.5 md:gap-4 border-b border-slate-200 px-2 md:px-6 py-2 md:py-4 shadow-sm"
      style={{ backgroundColor: "var(--header-color)" }}
    >
      {/* Bouton menu mobile - masqué sur desktop avec CSS */}
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-4 w-4 md:h-5 md:w-5" style={{ color: "var(--header-icon-color)" }} />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] md:text-sm font-medium truncate"
          style={{ color: "var(--header-text-color)" }}
        >
          Bienvenue
        </p>
        <p
          className="text-xs md:text-lg font-semibold truncate"
          style={{ color: "var(--header-text-color)" }}
          title={user ? `${user.email ?? "national@test.com"} - ${getEntityLabel()}` : "national@test.com - national"}
        >
          {user
            ? `${user.email ?? "national@test.com"} - ${getEntityLabel()}`
            : "national@test.com - national"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              if (!notificationsOpen) {
                fetchNotifications();
              }
            }}
            className="relative rounded-full border border-slate-200 bg-white p-1.5 md:p-2 transition hover:border-emerald-300 hover:text-emerald-600"
            aria-label="Notifications"
          >
            <Bell
              className="h-4 w-4 md:h-5 md:w-5"
              style={{ color: "var(--header-icon-color)" }}
            />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-red-500 text-[10px] md:text-xs font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="fixed md:absolute right-2 md:right-0 top-14 md:top-12 z-50 w-[calc(100vw-1rem)] md:w-96 max-w-[calc(100vw-1rem)] md:max-w-none rounded-xl md:rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col max-h-[calc(100vh-4rem)] md:max-h-[500px]">
              <div className="flex items-center justify-between border-b border-slate-200 p-2 md:p-4 flex-shrink-0">
                <h3 className="text-sm md:text-lg font-semibold text-slate-900">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                      title="Tout marquer comme lu"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Tout lire
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Fermer les notifications"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0">
                {loading ? (
                  <div className="p-6 md:p-8 text-center text-sm text-slate-500">
                    Chargement...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 md:p-8 text-center text-sm text-slate-500">
                    Aucune notification
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100">
                      {notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 md:p-4 transition ${
                            !notification.read
                              ? "bg-blue-50/50 hover:bg-blue-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4
                                className={`text-sm font-semibold ${
                                  !notification.read
                                    ? "text-slate-900"
                                    : "text-slate-700"
                                }`}
                              >
                                {notification.title}
                              </h4>
                              <p className="mt-1 text-xs text-slate-600">
                                {notification.message}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {new Date(notification.createdAt).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={() => markAsRead(notification.id)}
                                className="rounded-full p-2.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                                title="Marquer comme lu"
                              >
                                <div className="h-3.5 w-3.5 rounded-full bg-blue-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="border-t border-slate-200 p-2 md:p-3 flex-shrink-0">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Voir tout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-1.5 md:gap-2 rounded-full border border-slate-200 bg-white px-2 md:px-3 py-1.5 md:py-2 transition hover:border-emerald-300 hover:text-emerald-600"
          >
            <UserCircle2 className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-xs md:text-sm font-medium">Profil</span>
          </button>

          {profileOpen && (
            <div className="fixed md:absolute right-2 md:right-0 top-14 md:top-12 w-[calc(100vw-1rem)] md:w-64 max-w-[calc(100vw-1rem)] md:max-w-none rounded-xl md:rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-xl z-50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 truncate flex-1 min-w-0">
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
                  onClick={() => {
                    setProfileOpen(false);
                    setShowProfileModal(true);
                  }}
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

      {/* Modal de profil */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </header>
  );
}

