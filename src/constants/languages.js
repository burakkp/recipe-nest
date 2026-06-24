export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Dutch' },
  { code: 'de', label: 'German' },
  { code: 'tr', label: 'Turkish' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
];

export function getLanguageLabel(code) {
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
  return match ? match.label : code;
}
