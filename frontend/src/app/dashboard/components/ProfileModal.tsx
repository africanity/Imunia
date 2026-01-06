"use client";

import { useState, useEffect } from "react";
import { UserCircle2, X, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, accessToken } = useAuth();
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  
  // États pour le formulaire de profil
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // États pour la vérification d'email
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  
  // États pour la vérification de mot de passe
  const [passwordCode, setPasswordCode] = useState("");
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordVerifying, setPasswordVerifying] = useState(false);
  const [passwordChangeStep, setPasswordChangeStep] = useState<"request" | "verify" | "change">("request");

  // Charger les données du profil quand la modal s'ouvre
  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setNewEmail("");
      setEmailCode("");
      setEmailCodeSent(false);
      setPasswordCode("");
      setPasswordCodeSent(false);
      setPasswordChangeStep("request");
      setNewPassword("");
      setConfirmPassword("");
      setProfileError(null);
      setProfileSuccess(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-800">Mon profil</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setProfileError(null);
              setProfileSuccess(null);
            }}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {profileError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileSuccess}
            </div>
          )}

          <div className="space-y-6">
            {/* Informations personnelles */}
            <div>
              <h4 className="mb-4 text-base font-semibold text-slate-800">Informations personnelles</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <h4 className="mb-4 text-base font-semibold text-slate-800">Email</h4>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Email actuel</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500"
                  />
                </div>
                {!emailCodeSent ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Nouvel email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="nouveau@email.com"
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newEmail || newEmail === email) {
                            setProfileError("Veuillez entrer un nouvel email différent de l'actuel");
                            return;
                          }
                          try {
                            setProfileLoading(true);
                            setProfileError(null);
                            const response = await fetch(`${API_URL}/api/users/me/request-email-change`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                              },
                              body: JSON.stringify({ newEmail }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.message || "Erreur lors de l'envoi du code");
                            }
                            setEmailCodeSent(true);
                            setProfileSuccess("Code de vérification envoyé au nouvel email");
                          } catch (err) {
                            setProfileError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code");
                          } finally {
                            setProfileLoading(false);
                          }
                        }}
                        disabled={profileLoading || !newEmail || newEmail === email}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le code"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Code de vérification</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm text-center text-lg tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!emailCode || emailCode.length !== 6) {
                            setProfileError("Veuillez entrer le code à 6 chiffres");
                            return;
                          }
                          try {
                            setEmailVerifying(true);
                            setProfileError(null);
                            const response = await fetch(`${API_URL}/api/users/me/verify-email-change`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                              },
                              body: JSON.stringify({ code: emailCode, newEmail }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.message || "Code invalide");
                            }
                            setProfileSuccess("Email modifié avec succès");
                            setEmailCodeSent(false);
                            setEmailCode("");
                            setNewEmail("");
                            // Recharger les données utilisateur
                            if (user) {
                              setEmail(newEmail);
                            }
                          } catch (err) {
                            setProfileError(err instanceof Error ? err.message : "Code invalide");
                          } finally {
                            setEmailVerifying(false);
                          }
                        }}
                        disabled={emailVerifying || !emailCode || emailCode.length !== 6}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {emailVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailCodeSent(false);
                        setEmailCode("");
                        setProfileError(null);
                      }}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <h4 className="mb-4 text-base font-semibold text-slate-800">Mot de passe</h4>
              {passwordChangeStep === "request" && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setProfileLoading(true);
                      setProfileError(null);
                      const response = await fetch(`${API_URL}/api/users/me/request-password-change`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${accessToken}`,
                        },
                      });
                      const data = await response.json();
                      if (!response.ok) {
                        throw new Error(data.message || "Erreur lors de l'envoi du code");
                      }
                      setPasswordCodeSent(true);
                      setPasswordChangeStep("verify");
                      setProfileSuccess("Code de vérification envoyé à votre email");
                    } catch (err) {
                      setProfileError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code");
                    } finally {
                      setProfileLoading(false);
                    }
                  }}
                  disabled={profileLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {profileLoading ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    "Changer le mot de passe"
                  )}
                </button>
              )}

              {passwordChangeStep === "verify" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Code de vérification</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={passwordCode}
                        onChange={(e) => setPasswordCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm text-center text-lg tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!passwordCode || passwordCode.length !== 6) {
                            setProfileError("Veuillez entrer le code à 6 chiffres");
                            return;
                          }
                          try {
                            setPasswordVerifying(true);
                            setProfileError(null);
                            const response = await fetch(`${API_URL}/api/users/me/verify-password-code`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                              },
                              body: JSON.stringify({ code: passwordCode }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw new Error(data.message || "Code invalide");
                            }
                            setPasswordChangeStep("change");
                            setPasswordCode("");
                            setProfileSuccess("Code vérifié. Vous pouvez maintenant définir un nouveau mot de passe");
                          } catch (err) {
                            setProfileError(err instanceof Error ? err.message : "Code invalide");
                          } finally {
                            setPasswordVerifying(false);
                          }
                        }}
                        disabled={passwordVerifying || !passwordCode || passwordCode.length !== 6}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {passwordVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordChangeStep("request");
                        setPasswordCode("");
                        setPasswordCodeSent(false);
                        setProfileError(null);
                      }}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-800"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {passwordChangeStep === "change" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newPassword || newPassword.length < 6) {
                          setProfileError("Le mot de passe doit contenir au moins 6 caractères");
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          setProfileError("Les mots de passe ne correspondent pas");
                          return;
                        }
                        try {
                          setProfileLoading(true);
                          setProfileError(null);
                          const response = await fetch(`${API_URL}/api/users/me/change-password`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({ newPassword }),
                          });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data.message || "Erreur lors du changement de mot de passe");
                          }
                          setProfileSuccess("Mot de passe modifié avec succès");
                          setPasswordChangeStep("request");
                          setNewPassword("");
                          setConfirmPassword("");
                        } catch (err) {
                          setProfileError(err instanceof Error ? err.message : "Erreur lors du changement de mot de passe");
                        } finally {
                          setProfileLoading(false);
                        }
                      }}
                      disabled={profileLoading || !newPassword || !confirmPassword}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {profileLoading ? (
                        <>
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                          Modification...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 inline h-4 w-4" />
                          Enregistrer
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordChangeStep("request");
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordCode("");
                        setPasswordCodeSent(false);
                        setProfileError(null);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                setProfileError(null);
                setProfileSuccess(null);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!firstName || !lastName) {
                  setProfileError("Le prénom et le nom sont obligatoires");
                  return;
                }
                try {
                  setProfileLoading(true);
                  setProfileError(null);
                  const response = await fetch(`${API_URL}/api/users/me`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ firstName, lastName }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.message || "Erreur lors de la mise à jour");
                  }
                  setProfileSuccess("Profil mis à jour avec succès");
                } catch (err) {
                  setProfileError(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
                } finally {
                  setProfileLoading(false);
                }
              }}
              disabled={profileLoading}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {profileLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

