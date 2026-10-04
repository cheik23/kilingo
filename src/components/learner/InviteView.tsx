import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import QRCode from "qrcode";
import { Copy, Gift, Link2, Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { copyText, inviteFriend } from "@/lib/shareEngine";

export function InviteView() {
  const { t } = useI18n();
  const referrals = useQuery(api.referrals.getMyReferrals);
  const link = inviteFriend(referrals?.inviteCode ?? "");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setQrUrl(null);
    void QRCode.toDataURL(link, { width: 360, margin: 2, color: { dark: "#0A0A0A", light: "#D4A574" } }).then((url) => { if (active) setQrUrl(url); });
    return () => { active = false; };
  }, [link]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl border border-gold/20 bg-noir-2 p-6 sm:p-8">
        <p className="font-mono text-[0.625rem] uppercase tracking-[.25em] text-gold">{t("invite.eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{t("invite.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">{t("invite.subtitle")}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="ln-card p-6">
          <h2 className="flex items-center gap-2 font-display text-xl"><Link2 className="size-5 text-gold" />{t("invite.yourLink")}</h2>
          <div className="mt-4 flex flex-wrap gap-2"><input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-gold/20 bg-noir/60 px-3 text-sm text-ink" /><Button className="shrink-0" onClick={() => void copyText(link).then(() => toast.success(t("share.copied")))}><Copy />{t("share.copyLink")}</Button></div>
          <div className="ln-gap-fluid mt-6 grid grid-cols-3 gap-3">
            <Stat icon={Users} value={referrals?.totalFriends ?? 0} label={t("invite.friends")} />
            <Stat icon={Gift} value={referrals?.rewardedFriends ?? 0} label={t("invite.rewarded")} />
            <Stat icon={Copy} value={referrals?.gemsEarned ?? 0} label={t("invite.gems")} />
          </div>
          <h3 className="mt-7 font-display text-lg">{t("invite.list")}</h3>
          <div className="mt-3 space-y-2">
            {(referrals?.friends ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-3">{t("invite.empty")}</p> : referrals!.friends.map((friend) => <div key={friend.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-noir/60 p-3"><span className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-lg">👤</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{friend.name}</p><p className="truncate text-xs text-ink-3">{friend.email}</p></div><span className="ms-auto text-xs text-gold">{friend.rewarded ? `+500 💎` : t("invite.pending")}</span></div>)}
          </div>
        </section>
        <aside className="ln-card flex flex-col items-center justify-center p-6 text-center">
          <p className="font-mono text-[0.5625rem] uppercase tracking-[.2em] text-gold">{t("invite.scan")}</p>
          {qrUrl ? <img src={qrUrl} alt={t("invite.qrAlt")} width={256} height={256} className="mt-4 size-64 rounded-2xl bg-gold p-3" /> : <div className="mt-4 size-64 animate-shimmer rounded-2xl" />}
          <p className="mt-4 text-xs text-ink-3">{t("invite.qrHint")}</p>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) { return <div className="rounded-2xl border border-gold/15 bg-gold/5 p-4 text-center"><Icon className="mx-auto size-4 text-gold" /><p className="mt-2 font-display text-2xl font-bold text-gold">{value}</p><p className="text-[0.625rem] text-ink-3">{label}</p></div>; }
