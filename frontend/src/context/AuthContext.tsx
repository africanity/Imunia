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
    return path.startsWith("/activate") || path.startsWith("/reset-password");
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
          logout();
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
    [logout, persistUser, user],
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

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const decoded = jwtDecode<JwtPayload>(accessToken);
      if (decoded?.exp) {
        const expiresAt = decoded.exp * 1000;
        const delay = expiresAt - Date.now();

        if (delay <= 0) {
          logout();
        } else {
          timeout = setTimeout(() => logout(), delay);
        }
      }
    } catch (error) {
      console.error("Token invalide ou expiré:", error);
      logout();
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [accessToken, logout, pathname, router, isInitializing]);

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

