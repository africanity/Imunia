"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Key, ArrowRight, RefreshCw, Mail } from "lucide-react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import AuthInput from "@/app/components/auth/AuthInput";
import AuthButton from "@/app/components/auth/AuthButton";
import AuthAlert from "@/app/components/auth/AuthAlert";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function VerifyResetCodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    if (!emailParam) {
      router.push("/forgot-password");
    }
  }, [emailParam, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setRemainingAttempts(null);

    if (!email.trim() || !code.trim()) {
      setError("Veuillez saisir votre email et le code.");
      return;
    }

    if (code.trim().length !== 6) {
      setError("Le code doit contenir 6 chiffres.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/password-reset/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        if (data.expired) {
          setError("Le code a expiré. Veuillez demander un nouveau code.");
          setTimeout(() => {
            router.push("/forgot-password");
          }, 3000);
          return;
        }
        if (data.maxAttemptsReached) {
          setError("Nombre maximum de tentatives atteint. Veuillez demander un nouveau code.");
          setTimeout(() => {
            router.push("/forgot-password");
          }, 3000);
          return;
        }
        throw new Error(data?.message ?? "Code incorrect.");
      }

      // Code vérifié, rediriger vers la page de mise à jour du mot de passe
      router.push(`/reset-password?token=${encodeURIComponent(data.resetToken)}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Veuillez saisir votre email.");
      return;
    }

    try {
      setResending(true);
      setError(null);
      setRemainingAttempts(null);
      setCode("");

      const response = await fetch(`${API_URL}/api/auth/password-reset/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Une erreur est survenue.");
      }

      setError(null);
      // Afficher un message de succès temporaire
      const successMsg = "Un nouveau code a été envoyé à votre adresse email.";
      setError(successMsg);
      setTimeout(() => setError(null), 5000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Impossible de renvoyer le code.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Vérification du code"
      subtitle="Entrez le code à 6 chiffres reçu par email"
    >
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
          disabled={!!emailParam}
        />

        <AuthInput
          name="code"
          type="text"
          placeholder="000000"
          value={code}
          onChange={(value) => {
            // Ne garder que les chiffres et limiter à 6
            const digits = value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
          }}
          label="Code de réinitialisation"
          icon={Key}
          required
          maxLength={6}
        />

        {error && (
          <AuthAlert
            type={error.includes("envoyé") ? "success" : "error"}
            message={error}
          />
        )}
        {remainingAttempts !== null && remainingAttempts > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
            Il vous reste {remainingAttempts} tentative{remainingAttempts > 1 ? "s" : ""}.
          </div>
        )}

        <div className="space-y-3">
          <AuthButton
            type="submit"
            loading={loading}
            loadingText="Vérification..."
            icon={ArrowRight}
            disabled={loading || resending || code.length !== 6}
          >
            Vérifier le code
          </AuthButton>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Envoi..." : "Renvoyer le code"}
          </button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push("/forgot-password")}
            className="text-sm font-medium text-emerald-600 transition-colors duration-200 hover:text-emerald-700 hover:underline"
          >
            Retour
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

