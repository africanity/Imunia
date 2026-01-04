"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { usePathname, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Role = "NATIONAL" | "REGIONAL" | "DISTRICT" | "AGENT" | string;

type AuthUser = {
  id: string;
  role: Role;
  email?: string | null;
  agentLevel?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  districtId?: string | null;
  districtName?: string | null;
  healthCenterId?: string | null;
  healthCenterName?: string | null;
};

type AuthContextShape = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (
    tokens: { accessToken: string; refreshToken: string },
    meta?: { email?: string | null }
  ) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

type JwtPayload = {
  sub: string;
  role: Role;
  agentLevel?: string | null;
  exp?: number;
};

const ACCESS_TOKEN_KEY = "vax_access_token";
const REFRESH_TOKEN_KEY = "vax_refresh_token";
const USER_KEY = "vax_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    try {
      const storedAccess = Cookies.get(ACCESS_TOKEN_KEY) ?? null;
      const storedRefresh = Cookies.get(REFRESH_TOKEN_KEY) ?? null;
      const storedUser = Cookies.get(USER_KEY);

      if (storedAccess && storedRefresh && storedUser) {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setAccessToken(storedAccess);
        setRefreshToken(storedRefresh);
        setUser(parsedUser);
        setProfileLoaded(false);
      }
    } catch {
      // ignore corrupted cookies
      Cookies.remove(ACCESS_TOKEN_KEY);
      Cookies.remove(REFRESH_TOKEN_KEY);
      Cookies.remove(USER_KEY);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const login = (
    {
      accessToken: newAccess,
      refreshToken: newRefresh,
    }: {
      accessToken: string;
      refreshToken: string;
    },
    meta?: { email?: string | null }
  ) => {
    try {
      const decoded = jwtDecode<JwtPayload>(newAccess);
      if (!decoded?.sub || !decoded?.role) {
        throw new Error("Token invalide");
      }

      const authUser: AuthUser = {
        id: decoded.sub,
        role: decoded.role,
        email: meta?.email ?? null,
        agentLevel: decoded.agentLevel ?? null,
      };

      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      setUser(authUser);
      setProfileLoaded(false);

      Cookies.set(ACCESS_TOKEN_KEY, newAccess, { sameSite: "strict" });
      Cookies.set(REFRESH_TOKEN_KEY, newRefresh, { sameSite: "strict" });
      Cookies.set(USER_KEY, JSON.stringify(authUser), {
        sameSite: "strict",
      });
    } catch (error) {
      console.error("Erreur décodage token:", error);
      logout();
      throw error;
    }
  };

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const currentRefreshToken = refreshToken || Cookies.get(REFRESH_TOKEN_KEY);
    
    if (!currentRefreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data;

      if (!newAccessToken || !newRefreshToken) {
        return false;
      }

      // Décoder le nouveau token pour mettre à jour l'utilisateur
      const decoded = jwtDecode<JwtPayload>(newAccessToken);
      if (!decoded?.sub || !decoded?.role) {
        return false;
      }

      const authUser: AuthUser = {
        id: decoded.sub,
        role: decoded.role,
        email: user?.email ?? null,
        agentLevel: decoded.agentLevel ?? null,
      };

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(authUser);

      Cookies.set(ACCESS_TOKEN_KEY, newAccessToken, { sameSite: "strict" });
      Cookies.set(REFRESH_TOKEN_KEY, newRefreshToken, { sameSite: "strict" });
      Cookies.set(USER_KEY, JSON.stringify(authUser), {
        sameSite: "strict",
      });

      return true;
    } catch (error) {
      console.error("Erreur rafraîchissement token:", error);
      return false;
    }
  }, [refreshToken, user]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setProfileLoaded(false);
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
    Cookies.remove(USER_KEY);
    router.push("/login");
  }, [router]);

  const isPublicPath = (path: string | null) => {
    if (!path) return false;
    return (
      path.startsWith("/activate") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/verify-reset-code") ||
      path === "/login"
    );
  };

  const persistUser = useCallback((value: AuthUser) => {
    setUser(value);
    Cookies.set(USER_KEY, JSON.stringify(value), {
      sameSite: "strict",
    });
  }, []);

  const fetchProfile = useCallback(
    async (token: string, base?: AuthUser | null) => {
      try {
        const response = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 401) {
          // Essayer de rafraîchir le token avant de déconnecter
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            logout();
            return;
          }
          // Réessayer la requête avec le nouveau token
          const newToken = Cookies.get(ACCESS_TOKEN_KEY);
          if (!newToken) {
            logout();
            return;
          }
          const retryResponse = await fetch(`${API_URL}/api/users/me`, {
            headers: {
              Authorization: `Bearer ${newToken}`,
              "Content-Type": "application/json",
            },
          });
          if (retryResponse.status === 401) {
            logout();
            return;
          }
          if (!retryResponse.ok) {
            const payload = await retryResponse.json().catch(() => null);
            throw new Error(payload?.message ?? `status ${retryResponse.status}`);
          }
          const profile = await retryResponse.json();
          // Continuer avec le traitement du profil...
          const enriched: AuthUser = {
            ...(base ?? user ?? {
              id: profile.id,
              role: profile.role,
            }),
            id: (base ?? user)?.id ?? profile.id,
            role: (base ?? user)?.role ?? profile.role,
            email: profile.email ?? (base ?? user)?.email ?? null,
            agentLevel: profile.agentLevel ?? (base ?? user)?.agentLevel ?? null,
            firstName: profile.firstName ?? (base ?? user)?.firstName ?? null,
            lastName: profile.lastName ?? (base ?? user)?.lastName ?? null,
            regionId: profile.regionId ?? (base ?? user)?.regionId ?? null,
            regionName: profile.regionName ?? (base ?? user)?.regionName ?? null,
            districtId: profile.districtId ?? (base ?? user)?.districtId ?? null,
            districtName:
              profile.districtName ?? (base ?? user)?.districtName ?? null,
            healthCenterId:
              profile.healthCenterId ?? (base ?? user)?.healthCenterId ?? null,
            healthCenterName:
              profile.healthCenterName ??
              (base ?? user)?.healthCenterName ??
              null,
          };
          persistUser(enriched);
          return;
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        const profile = await response.json();

        const enriched: AuthUser = {
          ...(base ?? user ?? {
            id: profile.id,
            role: profile.role,
          }),
          id: (base ?? user)?.id ?? profile.id,
          role: (base ?? user)?.role ?? profile.role,
          email: profile.email ?? (base ?? user)?.email ?? null,
          agentLevel: profile.agentLevel ?? (base ?? user)?.agentLevel ?? null,
          firstName: profile.firstName ?? (base ?? user)?.firstName ?? null,
          lastName: profile.lastName ?? (base ?? user)?.lastName ?? null,
          regionId: profile.regionId ?? (base ?? user)?.regionId ?? null,
          regionName: profile.regionName ?? (base ?? user)?.regionName ?? null,
          districtId: profile.districtId ?? (base ?? user)?.districtId ?? null,
          districtName:
            profile.districtName ?? (base ?? user)?.districtName ?? null,
          healthCenterId:
            profile.healthCenterId ?? (base ?? user)?.healthCenterId ?? null,
          healthCenterName:
            profile.healthCenterName ??
            (base ?? user)?.healthCenterName ??
            null,
        };

        persistUser(enriched);
      } catch (error) {
        console.error("Erreur chargement profil:", error);
      } finally {
        setProfileLoaded(true);
      }
    },
    [logout, persistUser, user, refreshAccessToken],
  );

  useEffect(() => {
    // Ne pas rediriger pendant l'initialisation
    if (isInitializing) {
      return;
    }

    if (!accessToken) {
      setProfileLoaded(false);
      if (!isPublicPath(pathname) && pathname !== "/login") {
        router.push("/login");
      }
      return;
    }

    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let logoutTimeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const decoded = jwtDecode<JwtPayload>(accessToken);
      if (decoded?.exp) {
        const expiresAt = decoded.exp * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Rafraîchir 5 minutes avant l'expiration (300000 ms)
        const refreshDelay = timeUntilExpiry - 5 * 60 * 1000;

        if (timeUntilExpiry <= 0) {
          // Token déjà expiré, essayer de rafraîchir immédiatement
          refreshAccessToken().then((success) => {
            if (!success) {
              logout();
            }
          });
        } else if (refreshDelay > 0) {
          // Programmer le rafraîchissement 5 minutes avant l'expiration
          refreshTimeout = setTimeout(async () => {
            const success = await refreshAccessToken();
            if (!success) {
              logout();
            }
          }, refreshDelay);
        } else {
          // Moins de 5 minutes restantes, rafraîchir immédiatement
          refreshAccessToken().then((success) => {
            if (!success) {
              logout();
            }
          });
        }

        // Programmer la déconnexion à l'expiration si le rafraîchissement échoue
        logoutTimeout = setTimeout(() => {
          logout();
        }, timeUntilExpiry);
      }
    } catch (error) {
      console.error("Token invalide ou expiré:", error);
      logout();
    }

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      if (logoutTimeout) {
        clearTimeout(logoutTimeout);
      }
    };
  }, [accessToken, logout, pathname, router, isInitializing, refreshAccessToken]);

  useEffect(() => {
    if (accessToken && !profileLoaded) {
      setProfileLoaded(true);
      fetchProfile(accessToken, user);
    }
  }, [accessToken, fetchProfile, profileLoaded, user]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, refreshToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}

