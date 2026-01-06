"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight } from "lucide-react";
import AuthLayout from "@/app/components/auth/AuthLayout";
import AuthInput from "@/app/components/auth/AuthInput";
import AuthButton from "@/app/components/auth/AuthButton";
import AuthAlert from "@/app/components/auth/AuthAlert";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Une erreur est survenue.");
      }

      setSuccess(true);
      // Rediriger vers la page de vérification du code avec l'email
      setTimeout(() => {
        router.push(`/verify-reset-code?email=${encodeURIComponent(email.trim())}`);
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Impossible de contacter le serveur.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Entrez votre adresse email pour recevoir un code de réinitialisation">
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

        {error && <AuthAlert type="error" message={error} />}
        {success && (
          <AuthAlert
            type="success"
            message="Si cet email existe, un code de réinitialisation a été envoyé. Redirection en cours..."
          />
        )}

        <AuthButton
          type="submit"
          loading={loading}
          loadingText="Envoi en cours..."
          icon={ArrowRight}
          disabled={loading || success}
        >
          Envoyer le code
        </AuthButton>

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
