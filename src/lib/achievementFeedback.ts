import { toast } from "sonner";
import { soundEngine } from "./soundEngine";

type AchievementFeedback = {
  completed: Array<{ achievementId: string; title: string; xp: number; gems: number; icon: string }>;
  reminders: Array<{ achievementId: string; title: string; remaining: number; icon: string }>;
};

export function showAchievementFeedback(result: AchievementFeedback): void {
  for (const item of result.completed) {
    soundEngine.play("achievement");
    toast.success(`${item.icon} 🏆 ${item.title}`, {
      description: `+${item.xp} XP · +${item.gems} gems`,
    });
    if (["yoruba-master-500", "marathon-365", "polyglotte-12"].includes(item.achievementId)) {
      toast.success("🎁 Avatar exclusif débloqué !", {
        description: "Découvre ta récompense dans Mon espace.",
      });
    }
  }
  for (const item of result.reminders) {
    toast.info(`${item.icon} Plus que ${item.remaining} pour ${item.title}`);
  }
}
