import React, { useState, useEffect, useMemo } from "react";
import {
    parsePhoneNumberFromString,
    AsYouType,
    CountryCode,
    getCountryCallingCode,
    MetadataJson
} from "libphonenumber-js";
import { ChevronDown, Check, AlertCircle } from "lucide-react";
import { cn } from "./ui/utils";

interface Country {
    code: CountryCode;
    name: string;
    flag: string;
    dialCode: string;
}

// Common countries list (subset for brevity, real apps might use more)
const countries: Country[] = [
    { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
    { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
    { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
    { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
    { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "+234" },
    { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91" },
    { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "+27" },
    { code: "IE", name: "Ireland", flag: "🇮🇪", dialCode: "+353" },
    { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
];

interface InternationalPhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function InternationalPhoneInput({ value, onChange, className }: InternationalPhoneInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
    const [isValid, setIsValid] = useState(true);
    const [displayValue, setDisplayValue] = useState(value);

    // Auto-detect country based on prefix
    useEffect(() => {
        const asYouType = new AsYouType();
        asYouType.input(value);
        const countryCode = asYouType.getCountry();

        if (countryCode) {
            const found = countries.find(c => c.code === countryCode);
            if (found && found.code !== selectedCountry.code) {
                setSelectedCountry(found);
            }
        }

        // Validate
        const phoneNumber = parsePhoneNumberFromString(value);
        if (value && value.length > 5) {
            setIsValid(phoneNumber?.isValid() ?? false);
        } else {
            setIsValid(true);
        }
    }, [value, selectedCountry.code]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // Ensure it starts with + if not already
        if (input && !input.startsWith("+")) {
            input = "+" + input.replace(/\D/g, "");
        }

        // Format as you type
        const asYouType = new AsYouType();
        const formatted = asYouType.input(input);

        setDisplayValue(formatted);
        onChange(input);
    };

    const selectCountry = (country: Country) => {
        setSelectedCountry(country);
        setIsOpen(false);

        // If input is empty or just +, set to country dial code
        if (!value || value === "+") {
            const newVal = country.dialCode;
            setDisplayValue(newVal);
            onChange(newVal);
        } else {
            // Try to replace existing dial code or just prepend?
            // For simplicity, if they select a country, we just update the selected flag/validity
            // but don't force change the input unless it's empty.
        }
    };

    return (
        <div className={cn("relative", className)}>
            <div className="flex">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 border border-r-0 border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                    <span className="text-xl">{selectedCountry.flag}</span>
                    <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
                </button>
                <div className="relative flex-grow">
                    <input
                        type="tel"
                        value={displayValue}
                        onChange={handleInputChange}
                        placeholder="+1 234 567 8900"
                        className={cn(
                            "w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors",
                            !isValid && value.length > 5 && "border-red-500 focus:border-red-500"
                        )}
                    />
                    {!isValid && value.length > 5 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                    )}
                </div>
            </div>

            {!isValid && value.length > 5 && (
                <p className="text-xs text-red-500 mt-1">Please enter a valid phone number for {selectedCountry.name}.</p>
            )}

            {isOpen && (
                <div className="absolute top-full left-0 z-50 w-64 mt-1 bg-white border border-neutral-200 shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {(countries as Country[]).map((country) => (
                        <button
                            key={country.code}
                            type="button"
                            onClick={() => selectCountry(country)}
                            className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
                        >
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-lg">{country.flag}</span>
                                <span>{country.name}</span>
                                <span className="text-neutral-400">({country.dialCode})</span>
                            </div>
                            {selectedCountry.code === country.code && <Check className="w-4 h-4 text-black" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
