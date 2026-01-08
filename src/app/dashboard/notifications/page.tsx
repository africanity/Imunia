"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Trash2, CheckCheck, Filter, X } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

type FilterType = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingRead, setDeletingRead] = useState(false);

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
  }, [accessToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.read;
    if (filter === "read") return notification.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const handleDelete = async (notificationId: string) => {
    if (!accessToken) return;
    try {
      setDeleting(notificationId);
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (error) {
      console.error("Erreur suppression notification:", error);
      alert("Erreur lors de la suppression de la notification");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!accessToken) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer toutes les notifications ?")) return;
    try {
      setDeletingAll(true);
      const response = await fetch(`${API_URL}/api/notifications/all`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Erreur suppression toutes notifications:", error);
      alert("Erreur lors de la suppression des notifications");
    } finally {
      setDeletingAll(false);
    }
  };

  const handleDeleteRead = async () => {
    if (!accessToken) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer toutes les notifications lues ?")) return;
    try {
      setDeletingRead(true);
      const response = await fetch(`${API_URL}/api/notifications/read/all`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => !n.read));
      }
    } catch (error) {
      console.error("Erreur suppression notifications lues:", error);
      alert("Erreur lors de la suppression des notifications lues");
    } finally {
      setDeletingRead(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.error("Erreur marquage notification comme lue:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
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
      }
    } catch (error) {
      console.error("Erreur marquage toutes notifications comme lues:", error);
    }
  };

  return (
    <DashboardShell active="/dashboard/notifications">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">
              Gérez toutes vos notifications ({notifications.length} au total)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                <CheckCheck className="h-4 w-4" />
                Tout marquer comme lu
              </button>
            )}
            {readCount > 0 && (
              <button
                type="button"
                onClick={handleDeleteRead}
                disabled={deletingRead}
                className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingRead ? "Suppression..." : "Supprimer les lues"}
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingAll ? "Suppression..." : "Tout supprimer"}
              </button>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filtrer :</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === "all"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === "unread"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Non lues ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("read")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filter === "read"
                    ? "bg-slate-200 text-slate-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Lues ({readCount})
              </button>
            </div>
          </div>
        </div>

        {/* Liste des notifications */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Bell className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4">Chargement des notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Bell className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4">
                {filter === "all"
                  ? "Aucune notification"
                  : filter === "unread"
                    ? "Aucune notification non lue"
                    : "Aucune notification lue"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 transition ${
                    !notification.read
                      ? "bg-blue-50/50 hover:bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        {!notification.read && (
                          <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                        )}
                        <div className="flex-1">
                          <h3
                            className={`text-base font-semibold ${
                              !notification.read ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(notification.createdAt).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                          title="Marquer comme lu"
                        >
                          <CheckCheck className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(notification.id)}
                        disabled={deleting === notification.id}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deleting === notification.id ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        ) : (
                          <Trash2 className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

