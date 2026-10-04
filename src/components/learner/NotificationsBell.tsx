import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bell, Check } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MascotSprite } from "@/components/three/MascotSprite";

function relativeTime(ts: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** Jabari commente chaque notification : sa tête change selon le ton. */
function KindIcon({ kind }: { kind: "streak" | "loot" | "record" | "achievement" }) {
  const state = kind === "streak" ? "nag" : "celebrate";
  return <MascotSprite state={state} className="size-7" />;
}

export function NotificationsBell() {
  const { t } = useI18n();
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const unread = (notifications ?? []).filter((n) => n.readAt == null);

  // Push navigateur : uniquement permission déjà accordée, jamais de demande.
  useEffect(() => {
    if (unread.length === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const item of unread) {
      const key = `ln.push.${item._id}`;
      try {
        if (localStorage.getItem(key)) continue;
        const notification = new Notification(item.title, { body: item.body });
        notification.onclick = () => self.focus();
        localStorage.setItem(key, "1");
      } catch {
        // Le drawer in-app reste disponible si le navigateur refuse le push.
      }
    }
  }, [unread]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" aria-label={t("notif.title")} className="relative rounded-lg border border-white/10 p-2 text-ink-2 transition-colors hover:border-gold/40 hover:text-gold">
          <Bell className="size-4" />
          {unread.length > 0 && <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold font-mono text-[0.5625rem] font-bold text-noir">{unread.length > 9 ? "9+" : unread.length}</span>}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm border-white/10 bg-noir-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <SheetTitle className="flex items-center gap-2 font-display text-lg"><Bell className="size-4 text-gold" />{t("notif.title")}</SheetTitle>
          <button type="button" disabled={unread.length === 0} onClick={() => void markAllRead({})} className="text-xs text-gold disabled:opacity-40">{t("notif.markAll")}</button>
        </div>
        <div className="mt-5 space-y-2">
          {notifications === undefined && <div className="h-20 animate-shimmer rounded-xl bg-white/5" />}
          {notifications?.length === 0 && <p className="py-10 text-center text-sm text-ink-3">{t("notif.empty")}</p>}
          {notifications?.map((item) => {
            const isUnread = item.readAt == null;
            return <button key={item._id} type="button" onClick={() => { if (isUnread) void markRead({ notificationId: item._id }); }} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors", isUnread ? "border-gold/25 bg-gold/[0.06]" : "border-white/5 bg-black/10 opacity-70 hover:opacity-100")}><span className="mt-0.5"><KindIcon kind={item.kind} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-ink">{item.title}{isUnread && <span className="size-1.5 shrink-0 rounded-full bg-gold" />}</span><span className="mt-1 block text-xs leading-relaxed text-ink-2">{item.body}</span><span className="mt-2 block font-mono text-[0.625rem] text-ink-3">{relativeTime(item.createdAt)}</span></span>{isUnread && <Check className="mt-1 size-3.5 text-gold/50" />}</button>;
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
