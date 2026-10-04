import { ECOBOT } from "@/config";

export type EcoBotMode = "off" | "preview" | "on";

/** ECO_BOT: off (the default), preview (decides and drafts, costs AI and research credits) or on (posts). */
export function ecoBotMode(): EcoBotMode {
  const v = process.env[ECOBOT.env]?.trim().toLowerCase();
  return v === "preview" || v === "on" ? v : "off";
}
