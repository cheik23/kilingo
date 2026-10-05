import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Image, Loader2, MessageCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { copyText, downloadShareImage, inviteFriend } from "@/lib/shareEngine";

export type ShareGenerator = () => Promise<string>;

export function ShareModal({ open, onOpenChange, generate, filename, userId }: { open: boolean; onOpenChange: (open: boolean) => void; generate: ShareGenerator; filename: string; userId: string }) {
  const { t } = useI18n();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const invite = inviteFriend(userId || "kilingo");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    generate().then(setImage).catch(() => toast.error(t("share.error"))).finally(() => setLoading(false));
  }, [generate, open, t]);

  const shareUrl = (network: "twitter" | "whatsapp" | "instagram") => {
    const text = encodeURIComponent(t("share.cardText"));
    const url = encodeURIComponent(invite);
    if (network === "twitter") return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    if (network === "whatsapp") return `https://wa.me/?text=${text}%20${url}`;
    return `https://www.instagram.com/?igsh=${encodeURIComponent("stories")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] border-gold/25 bg-noir-2 text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl"><Share2 className="size-5 text-gold" />{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gold/20 bg-noir">
          {loading ? <div className="flex aspect-[4/5] items-center justify-center"><Loader2 className="size-8 animate-spin text-gold" /></div> : image ? <img src={image} alt={t("share.preview")} width={1080} height={1350} className="h-auto w-full" /> : <div className="flex aspect-[4/5] items-center justify-center text-sm text-ink-3">{t("share.error")}</div>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button disabled={!image} onClick={() => image && downloadShareImage(image, `${filename}.png`)} className="bg-gradient-to-r from-gold-strong to-gold text-noir"><Download />{t("share.download")}</Button>
          <Button variant="outline" onClick={() => void copyText(invite).then(() => toast.success(t("share.copied")))}><Copy />{t("share.copyLink")}</Button>
          <Button variant="outline" onClick={() => window.open(shareUrl("twitter"), "_blank", "noopener,noreferrer")}><Send />Twitter</Button>
          <Button variant="outline" onClick={() => window.open(shareUrl("whatsapp"), "_blank", "noopener,noreferrer")}><MessageCircle />WhatsApp</Button>
          <Button variant="outline" onClick={() => window.open(shareUrl("instagram"), "_blank", "noopener,noreferrer")}><Image />Instagram</Button>
          <Button variant="outline" onClick={async () => { if (image && navigator.share) { try { const blob = await (await fetch(image)).blob(); await navigator.share({ files: [new File([blob], `${filename}.png`, { type: "image/png" })], title: t("share.title"), url: invite }); } catch { /* canceled */ } } else await copyText(invite); }}><ExternalLink />{t("share.more")}</Button>
        </div>
        <p className="flex items-center justify-center gap-1 text-center text-[0.625rem] text-ink-3"><Check className="size-3 text-gold" />{t("share.privacy")}</p>
      </DialogContent>
    </Dialog>
  );
}
