function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function gerarPixQRCode(
  chave: string,
  nome: string = "GoTaxi Pro",
  cidade: string = "Brasil",
  valor?: number
): string {
  const merchantAccount =
    emv("26",
      emv("00", "BR.GOV.BCB.PIX") +
      emv("01", chave)
    );

  const descricao = emv("62", emv("05", "***"));

  let payload =
    emv("00", "01") +
    merchantAccount +
    emv("52", "0000") +
    emv("53", "986") +
    (valor != null && valor > 0
      ? emv("54", valor.toFixed(2))
      : "") +
    emv("58", "BR") +
    emv("59", nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25)) +
    emv("60", cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15)) +
    descricao +
    "6304";

  return payload + crc16(payload);
}
