"""
Location Service
Detects user location and provides currency information
"""
import requests
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Country to Currency mapping
COUNTRY_CURRENCY_MAP = {
    "US": "USD", "IN": "INR", "GB": "GBP", "CA": "CAD", "AU": "AUD",
    "DE": "EUR", "FR": "EUR", "IT": "EUR", "ES": "EUR", "NL": "EUR",
    "JP": "JPY", "CN": "CNY", "KR": "KRW", "SG": "SGD", "MY": "MYR",
    "TH": "THB", "ID": "IDR", "PH": "PHP", "VN": "VND", "AE": "AED",
    "SA": "SAR", "ZA": "ZAR", "BR": "BRL", "MX": "MXN", "AR": "ARS",
    "CL": "CLP", "CO": "COP", "PE": "PEN", "NZ": "NZD", "CH": "CHF",
    "NO": "NOK", "SE": "SEK", "DK": "DKK", "PL": "PLN", "TR": "TRY",
    "RU": "RUB", "EG": "EGP", "NG": "NGN", "KE": "KES", "GH": "GHS"
}

# Currency symbols
CURRENCY_SYMBOLS = {
    "USD": "$", "INR": "₹", "GBP": "£", "EUR": "€", "JPY": "¥",
    "CAD": "C$", "AUD": "A$", "CNY": "¥", "KRW": "₩", "SGD": "S$",
    "MYR": "RM", "THB": "฿", "IDR": "Rp", "PHP": "₱", "VND": "₫",
    "AED": "د.إ", "SAR": "﷼", "ZAR": "R", "BRL": "R$", "MXN": "$",
    "ARS": "$", "CLP": "$", "COP": "$", "PEN": "S/", "NZD": "NZ$",
    "CHF": "CHF", "NOK": "kr", "SEK": "kr", "DKK": "kr", "PLN": "zł",
    "TRY": "₺", "RUB": "₽", "EGP": "E£", "NGN": "₦", "KES": "KSh", "GHS": "₵"
}


def detect_location_from_ip(ip_address: Optional[str] = None) -> Dict[str, str]:
    """
    Detect user location from IP address.
    Returns country code and currency.
    """
    try:
        # Use free IP geolocation service
        if ip_address:
            url = f"http://ip-api.com/json/{ip_address}?fields=status,countryCode,currency"
        else:
            url = "http://ip-api.com/json/?fields=status,countryCode,currency"
        
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                country_code = data.get("countryCode", "US")
                currency = data.get("currency") or COUNTRY_CURRENCY_MAP.get(country_code, "USD")
                return {
                    "country_code": country_code,
                    "currency": currency,
                    "country": data.get("country", "United States")
                }
    except Exception as e:
        logger.warning(f"Error detecting location from IP: {e}")
    
    # Default fallback
    return {
        "country_code": "US",
        "currency": "USD",
        "country": "United States"
    }


def get_currency_for_country(country_code: str) -> str:
    """Get currency code for a country."""
    return COUNTRY_CURRENCY_MAP.get(country_code.upper(), "USD")


def get_currency_symbol(currency_code: str) -> str:
    """Get currency symbol for display."""
    return CURRENCY_SYMBOLS.get(currency_code, currency_code)


def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """
    Convert currency amount.
    Uses free exchange rate API.
    """
    if from_currency == to_currency:
        return amount
    
    try:
        # Use free exchange rate API
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            rate = data.get("rates", {}).get(to_currency)
            if rate:
                return round(amount * rate, 2)
    except Exception as e:
        logger.warning(f"Error converting currency: {e}")
    
    # Fallback: return original amount if conversion fails
    return amount

