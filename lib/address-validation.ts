import type { CheckoutAddress } from "@/lib/checkout-cache";

export type AddressValidationErrors = Partial<Record<keyof CheckoutAddress, string>>;

/**
 * Sanitizes phone input:
 * - Strips all non-digit characters
 * - For +91, handles pasted country codes or leading 0
 * - Restricts to maxDigits
 */
export function sanitizePhoneNumber(value: string, dialCode: string = "+91", maxDigits: number = 10): string {
  let digits = value.replace(/\D/g, "");
  if (dialCode === "+91") {
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
  }
  return digits.slice(0, maxDigits);
}

/**
 * Validates phone numbers dynamically based on country dialing code.
 */
export function isValidPhoneNumber(phone: string, dialCode: string = "+91"): boolean {
  const digits = phone.trim().replace(/\D/g, "");
  if (dialCode === "+91") {
    return /^[6-9]\d{9}$/.test(digits);
  }
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Sanitizes postal code input:
 * - Strips all non-digit characters
 * - Restricts to max 6 digits
 */
export function sanitizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/**
 * Validates 6-digit Indian PIN codes:
 * Exactly 6 digits, first digit between 1-9.
 */
export function isValidIndianPincode(postalCode: string): boolean {
  return /^[1-9]\d{5}$/.test(postalCode.trim());
}

/**
 * Validates full shipping address and returns field-specific error messages.
 */
export function validateShippingAddress(
  address: CheckoutAddress,
  dialCode: string = "+91",
): {
  isValid: boolean;
  errors: AddressValidationErrors;
  firstErrorMessage: string | null;
} {
  const errors: AddressValidationErrors = {};

  const trimmedName = address.fullName.trim();
  if (!trimmedName) {
    errors.fullName = "Please enter your full name";
  } else if (trimmedName.length < 2) {
    errors.fullName = "Name must be at least 2 characters";
  } else if (!/^[a-zA-Z\s.'-]+$/.test(trimmedName)) {
    errors.fullName = "Name can only contain letters and spaces";
  }

  const trimmedPhone = address.phone.trim();
  if (!trimmedPhone) {
    errors.phone = "Please enter your mobile number";
  } else if (!isValidPhoneNumber(trimmedPhone, dialCode)) {
    if (dialCode === "+91") {
      if (trimmedPhone.length !== 10) {
        errors.phone = "Enter a 10-digit mobile number";
      } else {
        errors.phone = "Mobile number must start with 6, 7, 8, or 9";
      }
    } else {
      errors.phone = "Enter a valid mobile number (7–15 digits)";
    }
  }

  if (!address.houseNo.trim()) {
    errors.houseNo = "Enter house / flat number";
  }

  if (!address.locality.trim()) {
    errors.locality = "Enter locality / area";
  }

  const trimmedPostal = address.postalCode.trim();
  if (!trimmedPostal) {
    errors.postalCode = "Enter 6-digit pincode";
  } else if (!isValidIndianPincode(trimmedPostal)) {
    errors.postalCode = "Enter a valid 6-digit PIN code";
  }

  if (!address.city.trim()) {
    errors.city = "Enter city";
  }

  if (!address.state.trim()) {
    errors.state = "Enter state";
  }

  if (!address.country.trim()) {
    errors.country = "Enter country";
  }

  const errorKeys = Object.keys(errors) as (keyof CheckoutAddress)[];
  const isValid = errorKeys.length === 0;
  const firstErrorMessage = errorKeys.length > 0 ? (errors[errorKeys[0]] ?? null) : null;

  return {
    isValid,
    errors,
    firstErrorMessage,
  };
}

