const SHORT_WEEKDAYS_ES: Record<string, string> = {
  Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié",
  Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
};

const MONTHS_ES: Record<string, string> = {
  January: "Ene", February: "Feb", March: "Mar", April: "Abr",
  May: "May", June: "Jun", July: "Jul", August: "Ago",
  September: "Sep", October: "Oct", November: "Nov", December: "Dic",
};

export function formatMatchDate(utcDate: string): string {
  const date = new Date(utcDate);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${SHORT_WEEKDAYS_ES[weekday] ?? weekday.slice(0, 3)} ${day} ${MONTHS_ES[month] ?? month.slice(0, 3)} · ${time}`;
}
