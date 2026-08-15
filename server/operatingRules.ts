export type BusinessHour = { day: number; start: string; end: string };

export const defaultBusinessHours: BusinessHour[] = [
  { day: 1, start: "09:00", end: "18:00" }, { day: 2, start: "09:00", end: "18:00" }, { day: 3, start: "09:00", end: "18:00" }, { day: 4, start: "09:00", end: "18:00" }, { day: 5, start: "09:00", end: "18:00" },
];

export function normalizeBusinessHours(value: unknown): BusinessHour[] {
  if (!Array.isArray(value)) return defaultBusinessHours;
  const valid = value.filter((item): item is BusinessHour => Boolean(item) && typeof item === "object" && typeof (item as BusinessHour).day === "number" && /^([01]\d|2[0-3]):[0-5]\d$/.test((item as BusinessHour).start) && /^([01]\d|2[0-3]):[0-5]\d$/.test((item as BusinessHour).end));
  return valid.length ? valid : defaultBusinessHours;
}

export function isWithinBusinessHours(now: Date, timezone: string, businessHours: BusinessHour[]) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[values.weekday]; const minutes = Number(values.hour) * 60 + Number(values.minute);
  return businessHours.some(item => {
    if (item.day !== day) return false;
    const [startHour, startMinute] = item.start.split(":").map(Number); const [endHour, endMinute] = item.end.split(":").map(Number);
    const start = startHour * 60 + startMinute; const end = endHour * 60 + endMinute;
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  });
}

export function decideInboundRouting(input: { isEnabled: boolean; inboundRouting: "ai_first" | "human_first"; handoffOutsideBusinessHours: boolean; timezone: string; businessHours: BusinessHour[] }, now = new Date()) {
  if (!input.isEnabled) return "ai" as const;
  if (input.inboundRouting === "human_first") return "human" as const;
  if (input.handoffOutsideBusinessHours && !isWithinBusinessHours(now, input.timezone, input.businessHours)) return "human" as const;
  return "ai" as const;
}

export function describeOperatingRule(input: { isEnabled: boolean; firstResponseSlaMinutes: number; inboundRouting: "ai_first" | "human_first"; handoffOutsideBusinessHours: boolean; autoEscalateUnassigned: boolean }) {
  if (!input.isEnabled) return "Regras pausadas; o Flow One mantém somente os alertas padrões do tenant.";
  const parts = [`SLA de primeira resposta em ${input.firstResponseSlaMinutes} min`, input.inboundRouting === "human_first" ? "entrada direto na fila humana" : "IA como primeiro atendimento"];
  if (input.handoffOutsideBusinessHours) parts.push("handoff fora do horário comercial");
  if (input.autoEscalateUnassigned) parts.push("escalonamento de conversas sem responsável");
  return parts.join(" · ");
}
