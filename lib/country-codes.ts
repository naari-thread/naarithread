export type CountryCodeOption = {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  formatHint: string;
  maxDigits: number;
};

export const DEFAULT_COUNTRY_CODE: CountryCodeOption = {
  name: "India",
  code: "IN",
  dialCode: "+91",
  flag: "🇮🇳",
  formatHint: "10 digits",
  maxDigits: 10,
};

export const POPULAR_COUNTRY_CODES: CountryCodeOption[] = [
  DEFAULT_COUNTRY_CODE,
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸", formatHint: "10 digits", maxDigits: 10 },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧", formatHint: "10-11 digits", maxDigits: 11 },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪", formatHint: "9 digits", maxDigits: 9 },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦", formatHint: "10 digits", maxDigits: 10 },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺", formatHint: "9 digits", maxDigits: 9 },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬", formatHint: "8 digits", maxDigits: 8 },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦", formatHint: "9 digits", maxDigits: 9 },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪", formatHint: "10-11 digits", maxDigits: 11 },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷", formatHint: "9 digits", maxDigits: 9 },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿", formatHint: "9-10 digits", maxDigits: 10 },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾", formatHint: "9-10 digits", maxDigits: 10 },
  { name: "Kuwait", code: "KW", dialCode: "+965", flag: "🇰🇼", formatHint: "8 digits", maxDigits: 8 },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦", formatHint: "8 digits", maxDigits: 8 },
  { name: "Oman", code: "OM", dialCode: "+968", flag: "🇴🇲", formatHint: "8 digits", maxDigits: 8 },
  { name: "Bahrain", code: "BH", dialCode: "+973", flag: "🇧🇭", formatHint: "8 digits", maxDigits: 8 },
];
