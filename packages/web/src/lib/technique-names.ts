const TECHNIQUE_NAMES: Record<string, string> = {
  "T1566.004": "Phishing: Spearphishing Voice",
  "T1133": "External Remote Services",
  "T1003.003": "OS Credential Dumping: NTDS",
  "T1486": "Data Encrypted for Impact",
  "T1041": "Exfiltration Over C2 Channel",
};

export function techniqueDisplayName(id: string): string {
  return TECHNIQUE_NAMES[id] ?? id;
}
