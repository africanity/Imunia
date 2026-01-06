"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Key, Save } from "lucide-react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import AuthInput from "@/app/components/auth/AuthInput";
import AuthButton from "@/app/components/auth/AuthButton";
import AuthAlert from "@/app/components/auth/AuthAlert";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function ActivateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userId = searchParams.get("id");
  const activationToken = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!userId || !activationToken) {
      setError("Lien d'activation invalide ou incomplet.");
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

      const response = await fetch(`${API_URL}/api/users/${userId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activationToken, password, confirmPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible d'activer le compte.");
      }

      setSuccess(true);

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erreur inattendue lors de l'activation.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Compte activé"
        subtitle="Votre mot de passe a été enregistré avec succès"
        showHelpSection={false}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>
          <AuthAlert
            type="success"
            message="Activation réussie ! Vous allez être redirigé vers la page de connexion."
          />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Activer votre compte"
      subtitle="Définissez un mot de passe pour accéder à la plateforme"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          type="password"
          value={password}
          onChange={setPassword}
          label="Nouveau mot de passe"
          icon={Key}
          required
        />

        <AuthInput
          type="password"
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
          loadingText="Activation en cours..."
          icon={Save}
        >
          Activer mon compte
        </AuthButton>

        <div className="text-center text-sm text-slate-600">
          Le mot de passe doit contenir au moins 6 caractères.
        </div>
      </form>
    </AuthLayout>
  );
}








