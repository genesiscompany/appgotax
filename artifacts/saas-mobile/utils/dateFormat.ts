const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const normalized = String(iso).trim().replace(" ", "T");
  const d = new Date(normalized.endsWith("Z") || normalized.includes("+") ? normalized : normalized + "Z");
  return isNaN(d.getTime()) ? null : d;
}

export function fmtHora(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function fmtData(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtDataCurta(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  const dd = d.getDate().toString().padStart(2, "0");
  const mes = MESES_CURTOS[d.getMonth()];
  return `${dd} ${mes}`;
}

export function fmtDataLonga(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  const dia = DIAS_CURTOS[d.getDay()];
  const dd = d.getDate().toString().padStart(2, "0");
  const mes = MESES_LONGOS[d.getMonth()];
  return `${dia}, ${dd} de ${mes}`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  return `${fmtData(iso)} às ${fmtHora(iso)}`;
}

export function fmtDataCurtaHora(iso: string | null | undefined): string {
  const d = safeDate(iso);
  if (!d) return "";
  return `${fmtDataCurta(iso)} · ${fmtHora(iso)}`;
}

export function fmtBRL(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100);
  const intPart = Math.floor(cents / 100);
  const decPart = (cents % 100).toString().padStart(2, "0");
  const intFormatted = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}R$ ${intFormatted},${decPart}`;
}
