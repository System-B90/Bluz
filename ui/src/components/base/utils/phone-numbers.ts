/**
 * Formats a local Israeli mobile number to 0XX-XXX-XXXX.
 * @param value - The raw phone number string.
 * @returns The formatted phone number.
 */
function formatIsraeliStyleLocalMobileNumber(value: string): string
{
    return value.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
}

/**
 * Formats an international Israeli mobile number to +972-XX-XXX-XXXX.
 * @param value - The raw phone number string.
 * @returns The formatted phone number.
 */
function formatIsraeliStyleInternationalMobileNumber(value: string): string
{
    return value
        .replace(/\D/g, "")
        .replace(/972(\d{2})(\d{3})(\d{4})/, "+972-$1-$2-$3");
}

/**
 * Formats Israeli landline numbers to (0A) XXX-XXXX or international format +972-A-XXX-XXXX.
 * Note: Handles both domestic local format and international format based on input.
 * @param value - The raw phone number string.
 * @returns The formatted phone number.
 */
function formatIsraeliLandlineNumber(value: string): string
{
    const digits = value.replace(/\D/g, "");

    // International format: +972-A-XXX-XXXX (Total 11 digits: 972 + 1 area + 7 subscriber)
    if (digits.startsWith("972") && digits.length === 11)
    {
        return digits.replace(/972(\d)(\d{3})(\d{4})/, "+972-$1-$2-$3");
    }

    // Local format: (0A) XXX-XXXX (Total 9 digits: 0 + 1 area + 7 subscriber)
    return digits.replace(/(\d{2})(\d{3})(\d{4})/, "($1) $2-$3");
}

/**
 * Formats a string into an Israeli phone number format based on identified patterns.
 * @param value - The raw input string.
 * @returns The formatted phone number or original value if no pattern matches.
 */
export function formatPhoneNumber(value: string): string
{
    // Matches local mobile (05X-XXX-XXXX)
    if (/^05\d{8}$/.test(value.replace(/\D/g, "")))
    {
        return formatIsraeliStyleLocalMobileNumber(value);
    }

    // Matches international mobile (+9725XXXXXXXX)
    if (/^9725\d{8}$/.test(value.replace(/\D/g, "")))
    {
        return formatIsraeliStyleInternationalMobileNumber(value);
    }

    // Matches landlines: Domestic (0X-XXX-XXXX) or International (972-X-XXX-XXXX)
    if (/^(0[23489]\d{7}|972[23489]\d{7})$/.test(value.replace(/\D/g, "")))
    {
        return formatIsraeliLandlineNumber(value);
    }

    return value;
}
