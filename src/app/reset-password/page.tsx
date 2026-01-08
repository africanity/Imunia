"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Key, Save, CheckCircle } from "lucide-react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import AuthInput from "@/app/components/auth/AuthInput";
import AuthButton from "@/app/components/auth/AuthButton";
import AuthAlert from "@/app/components/auth/AuthAlert";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!resetToken) {
      router.push("/forgot-password");
    }
  }, [resetToken, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!resetToken) {
      setError("Token de réinitialisation manquant.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/password-reset/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Impossible de mettre à jour le mot de passe.");
      }

      setSuccess(true);

      // Rediriger vers la page de login après 2 secondes
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur est survenue lors de la mise à jour.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Mot de passe mis à jour"
        subtitle="Votre mot de passe a été modifié avec succès"
        showHelpSection={false}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>
          <AuthAlert
            type="success"
            message="Mot de passe mis à jour avec succès ! Vous allez être redirigé vers la page de connexion."
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Définissez votre nouveau mot de passe"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          label="Nouveau mot de passe"
          icon={Key}
          required
        />

        <AuthInput
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={setConfirmPassword}
          label="Confirmer le mot de passe"
          icon={Key}
          required
        />

        {error && <AuthAlert type="error" message={error} />}

        <AuthButton
          type="submit"
          loading={loading}
          loadingText="Mise à jour en cours..."
          icon={Save}
          disabled={loading || !password || !confirmPassword}
        >
          Mettre à jour le mot de passe
        </AuthButton>

        <div className="text-center text-sm text-slate-600">
          Le mot de passe doit contenir au moins 6 caractères.
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-medium text-emerald-600 transition-colors duration-200 hover:text-emerald-700 hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
