"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Key, ArrowRight } from "lucide-react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import AuthInput from "@/app/components/auth/AuthInput";
import AuthButton from "@/app/components/auth/AuthButton";
import AuthAlert from "@/app/components/auth/AuthAlert";
import { useAuth } from "@/context/AuthContext";
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
  role: string;
};

type RoleOption = {
  role: string;
  agentLevel?: string | null;
  region?: { id: string; name: string } | null;
  district?: { id: string; name: string } | null;
  healthCenter?: { id: string; name: string } | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);

  const formatRoleLabel = (option: RoleOption) => {
    switch (option.role) {
      case "NATIONAL":
        return "Interface nationale";
      case "REGIONAL":
        return option.region
          ? `Région : ${option.region.name}`
          : "Interface régionale";
      case "DISTRICT":
        return option.district
          ? `District : ${option.district.name}`
          : "Interface district";
      case "AGENT":
        if (option.healthCenter) {
          return `${option.agentLevel === "ADMIN" ? "Admin" : "Staff"} · ${
            option.healthCenter.name
          }`;
        }
        return "Interface agent";
      default:
        return option.role;
    }
  };

  const performLogin = async (
    emailValue: string,
    passwordValue: string,
    selectedRole?: string,
  ) => {
    setLoading(true);
    setError(null);
    setRoleOptions([]);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          password: passwordValue,
          ...(selectedRole ? { role: selectedRole } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.message ?? "Identifiants invalides.");
        return;
      }

      if (data?.requiresRoleSelection && Array.isArray(data.roles)) {
        setRoleOptions(data.roles as RoleOption[]);
        return;
      }

      if (!data?.accessToken || !data?.refreshToken) {
        setError("Réponse invalide du serveur.");
        return;
      }

      let role: string | null = null;
      try {
        const decoded = jwtDecode<JwtPayload>(data.accessToken);
        role = decoded?.role ?? null;
      } catch {
        // ignore
      }

      login(
        {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
        { email: emailValue },
      );

      if (!role) {
        router.push("/dashboard");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Erreur login frontend:", err);
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const emailValue = (formData.get("email") ?? "").toString();
    const passwordValue = (formData.get("password") ?? "").toString();

    setEmail(emailValue);
    setPassword(passwordValue);
    await performLogin(emailValue, passwordValue);
  };

  const handleRoleSelection = async (role: string) => {
    if (!email || !password) {
      setError("Veuillez saisir vos identifiants.");
      return;
    }
    await performLogin(email, password, role);
  };

  return (
    <AuthLayout title="Connexion">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          name="email"
          type="email"
          placeholder="nom@exemple.com"
          value={email}
          onChange={setEmail}
          label="Email professionnel"
          icon={Mail}
          required
        />

        <AuthInput
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          label="Mot de passe"
          icon={Key}
          required
        />

        {error && <AuthAlert type="error" message={error} />}
        {roleOptions.length > 1 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900">
            <p className="font-semibold">
              Sélectionnez l&apos;interface que vous souhaitez ouvrir :
            </p>
            <div className="mt-3 space-y-3">
              {roleOptions.map((option) => (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => handleRoleSelection(option.role)}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-900">
                      {option.role}
                    </span>
                    <span className="text-xs text-emerald-600">
                      {option.agentLevel}
                    </span>
                  </div>
                  <p className="text-[13px] text-emerald-700">
                    {formatRoleLabel(option)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <AuthButton
          type="submit"
          loading={loading}
          loadingText="Connexion en cours..."
          icon={ArrowRight}
          disabled={loading}
        >
          Se connecter
        </AuthButton>

        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-emerald-600 transition-colors duration-200 hover:text-emerald-700 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

