import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BrandLink } from "@/components/brand/Logo";
import { clearRememberedReferral, readRememberedReferral } from "@/lib/shareEngine";
import { ArrowRight, Flame, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/app",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const trackReferral = useMutation(api.referrals.trackReferral);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Le query string est prioritaire, mais il disparait au retour OAuth : on
  // retombe sur le code mémorisé à la première visite du lien d'invitation.
  const referralCode = searchParams.get("ref") ?? readRememberedReferral();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    const finishAuthentication = async () => {
      if (referralCode) {
        await trackReferral({ refCode: referralCode })
          .then((result) => { if (result.ok) clearRememberedReferral(); })
          .catch(() => undefined);
      }
      if (active) navigate(redirect);
    };
    void finishAuthentication();
    return () => { active = false; };
  }, [authLoading, isAuthenticated, navigate, redirect, referralCode, trackReferral]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le code. Réessaie.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      if (referralCode) {
        await trackReferral({ refCode: referralCode })
          .then((result) => { if (result.ok) clearRememberedReferral(); })
          .catch(() => undefined);
      }
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Le code de vérification est incorrect.");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      if (referralCode) {
        await trackReferral({ refCode: referralCode })
          .then((result) => { if (result.ok) clearRememberedReferral(); })
          .catch(() => undefined);
      }
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      setError("Connexion invité impossible pour le moment. Réessaie dans un instant.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-noir text-ink">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gold/10 blur-[130px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="ln-noise absolute inset-0 opacity-[0.04]" />
      </div>

      {/* brand */}
      <div className="relative z-10 flex items-center justify-center pt-14">
        <BrandLink to="/" size="lg" />
      </div>

      {/* card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {step === "signIn" ? (
            <>
              <div className="text-center">
                <h1 className="font-display text-3xl font-semibold">
                  Entre dans le mouvement
                </h1>
                <p className="mt-2 text-sm text-ink-2">
                  Ta progression, ta mémoire et tes contenus t'attendent.
                  Watch it. Hear it. Get it.
                </p>
              </div>

              <form
                onSubmit={handleEmailSubmit}
                className="mt-8 rounded-2xl border border-white/10 bg-noir-2/90 p-6 shadow-[0_16px_32px_rgba(0,0,0,0.6)]"
              >
                <label className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                  Email
                </label>
                <div className="relative mt-2">
                  <Mail className="absolute top-3 left-3 size-4 text-ink-3" />
                  <Input
                    name="email"
                    placeholder="name@example.com"
                    type="email"
                    className="border-white/10 bg-noir-3/60 pl-9 text-ink placeholder:text-ink-3 focus-visible:border-gold/50 focus-visible:ring-gold/20"
                    disabled={isLoading}
                    required
                  />
                </div>

                {error && (
                  <p className="mt-3 text-sm text-red-400">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="ln-glow mt-5 h-11 w-full gap-2 bg-gradient-to-r from-gold to-gold-soft font-semibold text-noir hover:opacity-90"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Recevoir mon code
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                <div className="relative mt-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-noir-2 px-3 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                      ou
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-11 w-full border-white/15 bg-transparent text-ink hover:bg-white/5 hover:text-ink"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="mr-2 size-4" />
                  Continuer en invité
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                  <Flame className="size-6 text-gold" />
                </div>
                <h1 className="mt-5 font-display text-3xl font-semibold">
                  Vérifie ta boîte mail
                </h1>
                <p className="mt-2 text-sm text-ink-2">
                  Code envoyé à{" "}
                  <span className="text-gold">{step.email}</span>
                </p>
              </div>

              <form
                onSubmit={handleOtpSubmit}
                className="mt-8 rounded-2xl border border-white/10 bg-noir-2/90 p-6 shadow-[0_16px_32px_rgba(0,0,0,0.6)]"
              >
                <input type="hidden" name="email" value={step.email} />
                <input type="hidden" name="code" value={otp} />

                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        otp.length === 6 &&
                        !isLoading
                      ) {
                        const form = (e.target as HTMLElement).closest("form");
                        if (form) form.requestSubmit();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="mt-4 text-center text-sm text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="ln-glow mt-6 h-11 w-full bg-gradient-to-r from-gold to-gold-soft font-semibold text-noir hover:opacity-90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Vérification…
                    </>
                  ) : (
                    "Vérifier le code"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("signIn")}
                  disabled={isLoading}
                  className="mt-4 w-full text-center text-sm text-ink-3 hover:text-ink-2"
                >
                  Utiliser une autre adresse
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            <Link to="/" className="hover:text-gold">
              ← Retour à l'accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-noir">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      }
    >
      <Auth {...props} />
    </Suspense>
  );
}
