// ── PIX BR Code (EMV) helper ─────────────────────────────────────────────────
// Builds a "Copia e Cola" PIX payload (EMV BR Code).
function _emv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}
function _crc16(payload: string) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
// Remove diacritics (acentos) — PIX exige ASCII em nome/cidade.
function _ascii(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}
export function buildPixBrCode(opts: {
  chave: string; nomeBeneficiario: string; cidade?: string;
  valor?: number; txid?: string; descricao?: string;
}) {
  const chave = _ascii((opts.chave || "").trim());
  const nome = _ascii((opts.nomeBeneficiario || "GOTAXI")).substring(0, 25).toUpperCase();
  const cidade = _ascii((opts.cidade || "BRASIL")).substring(0, 15).toUpperCase();
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").substring(0, 25) || "***";
  const merchantAccountInfo =
    _emv("00", "br.gov.bcb.pix") +
    _emv("01", chave) +
    (opts.descricao ? _emv("02", String(opts.descricao).substring(0, 50)) : "");
  const additionalData = _emv("05", txid);
  let payload =
    _emv("00", "01") + // payload format
    _emv("26", merchantAccountInfo) +
    _emv("52", "0000") + // merchant category code
    _emv("53", "986") +  // BRL
    (opts.valor && opts.valor > 0 ? _emv("54", opts.valor.toFixed(2)) : "") +
    _emv("58", "BR") +
    _emv("59", nome) +
    _emv("60", cidade) +
    _emv("62", additionalData) +
    "6304";
  return payload + _crc16(payload);
}
