// How the wallet writes times, rates and counts (English, like the other Zoka apps).

export function plural(n: number, word: string): string {
  return `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;
}

export function formatHashrate(hps: number): string {
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s"];
  let value = hps;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "just now", "5 min ago", "3 h ago", "Nov 2" for a time in seconds. */
export function timeAgo(seconds: number, now = Date.now()): string {
  const diff = Math.max(0, Math.floor(now / 1000 - seconds));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(seconds * 1000).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function dateTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
