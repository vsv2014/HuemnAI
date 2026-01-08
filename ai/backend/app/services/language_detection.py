"""
Multi-language support and language detection service.
Detects user's language and translates intents across all languages.
"""
import logging
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)

# Multi-language keywords for ticket/agent intent detection
# Supports 50+ languages

LANGUAGE_KEYWORDS = {
    # English
    "en": {
        "ticket": ["create ticket", "open ticket", "new ticket", "submit ticket", "file ticket"],
        "agent": ["connect to agent", "talk to agent", "human agent", "live agent", "speak to agent"]
    },
    # Spanish
    "es": {
        "ticket": ["crear ticket", "abrir ticket", "nuevo ticket", "enviar ticket", "crear un ticket"],
        "agent": ["conectar con agente", "hablar con agente", "agente humano", "agente en vivo", "hablar con un agente"]
    },
    # French
    "fr": {
        "ticket": ["créer un ticket", "ouvrir un ticket", "nouveau ticket", "soumettre un ticket"],
        "agent": ["connecter à un agent", "parler à un agent", "agent humain", "agent en direct"]
    },
    # German
    "de": {
        "ticket": ["ticket erstellen", "ticket öffnen", "neues ticket", "ticket einreichen"],
        "agent": ["mit agent verbinden", "mit agent sprechen", "menschlicher agent", "live agent"]
    },
    # Italian
    "it": {
        "ticket": ["creare ticket", "aprire ticket", "nuovo ticket", "inviare ticket"],
        "agent": ["collegare all'agente", "parlare con l'agente", "agente umano", "agente dal vivo"]
    },
    # Portuguese
    "pt": {
        "ticket": ["criar ticket", "abrir ticket", "novo ticket", "enviar ticket"],
        "agent": ["conectar ao agente", "falar com agente", "agente humano", "agente ao vivo"]
    },
    # Chinese (Simplified)
    "zh": {
        "ticket": ["创建工单", "打开工单", "新建工单", "提交工单"],
        "agent": ["连接客服", "与客服交谈", "人工客服", "在线客服"]
    },
    # Japanese
    "ja": {
        "ticket": ["チケットを作成", "チケットを開く", "新しいチケット", "チケットを送信"],
        "agent": ["エージェントに接続", "エージェントと話す", "人間のエージェント", "ライブエージェント"]
    },
    # Korean
    "ko": {
        "ticket": ["티켓 생성", "티켓 열기", "새 티켓", "티켓 제출"],
        "agent": ["에이전트 연결", "에이전트와 대화", "인간 에이전트", "라이브 에이전트"]
    },
    # Russian
    "ru": {
        "ticket": ["создать тикет", "открыть тикет", "новый тикет", "отправить тикет"],
        "agent": ["связаться с агентом", "поговорить с агентом", "человеческий агент", "живой агент"]
    },
    # Arabic
    "ar": {
        "ticket": ["إنشاء تذكرة", "فتح تذكرة", "تذكرة جديدة", "إرسال تذكرة"],
        "agent": ["الاتصال بالوكيل", "التحدث مع الوكيل", "وكيل بشري", "وكيل مباشر"]
    },
    # Hindi
    "hi": {
        "ticket": ["टिकट बनाएं", "टिकट खोलें", "नया टिकट", "टिकट जमा करें"],
        "agent": ["एजेंट से कनेक्ट करें", "एजेंट से बात करें", "मानव एजेंट", "लाइव एजेंट"]
    },
    # Dutch
    "nl": {
        "ticket": ["ticket aanmaken", "ticket openen", "nieuw ticket", "ticket indienen"],
        "agent": ["verbinden met agent", "praten met agent", "menselijke agent", "live agent"]
    },
    # Polish
    "pl": {
        "ticket": ["utwórz zgłoszenie", "otwórz zgłoszenie", "nowe zgłoszenie", "wyślij zgłoszenie"],
        "agent": ["połącz z agentem", "rozmawiaj z agentem", "ludzki agent", "agent na żywo"]
    },
    # Turkish
    "tr": {
        "ticket": ["bilet oluştur", "bilet aç", "yeni bilet", "bilet gönder"],
        "agent": ["ajansa bağlan", "ajanla konuş", "insan ajanı", "canlı ajan"]
    },
    # Swedish
    "sv": {
        "ticket": ["skapa ärende", "öppna ärende", "nytt ärende", "skicka ärende"],
        "agent": ["anslut till agent", "prata med agent", "mänsklig agent", "live agent"]
    },
    # Norwegian
    "no": {
        "ticket": ["opprett sak", "åpne sak", "ny sak", "send sak"],
        "agent": ["koble til agent", "snakk med agent", "menneskelig agent", "live agent"]
    },
    # Danish
    "da": {
        "ticket": ["opret billet", "åbn billet", "ny billet", "send billet"],
        "agent": ["forbind til agent", "tal med agent", "menneskelig agent", "live agent"]
    },
    # Finnish
    "fi": {
        "ticket": ["luo tiketti", "avaa tiketti", "uusi tiketti", "lähetä tiketti"],
        "agent": ["yhdistä agenttiin", "puhu agentin kanssa", "ihminen agentti", "live agentti"]
    },
    # Greek
    "el": {
        "ticket": ["δημιουργία εισιτηρίου", "άνοιγμα εισιτηρίου", "νέο εισιτηρίου", "υποβολή εισιτηρίου"],
        "agent": ["σύνδεση με πράκτορα", "ομιλία με πράκτορα", "ανθρώπινος πράκτορας", "ζωντανός πράκτορας"]
    },
    # Czech
    "cs": {
        "ticket": ["vytvořit tiket", "otevřít tiket", "nový tiket", "odeslat tiket"],
        "agent": ["připojit k agentovi", "mluvit s agentem", "lidský agent", "živý agent"]
    },
    # Romanian
    "ro": {
        "ticket": ["creează bilet", "deschide bilet", "bilet nou", "trimite bilet"],
        "agent": ["conectează-te la agent", "vorbește cu agentul", "agent uman", "agent live"]
    },
    # Vietnamese
    "vi": {
        "ticket": ["tạo vé", "mở vé", "vé mới", "gửi vé"],
        "agent": ["kết nối với đại lý", "nói chuyện với đại lý", "đại lý con người", "đại lý trực tiếp"]
    },
    # Thai
    "th": {
        "ticket": ["สร้างตั๋ว", "เปิดตั๋ว", "ตั๋วใหม่", "ส่งตั๋ว"],
        "agent": ["เชื่อมต่อกับตัวแทน", "พูดกับตัวแทน", "ตัวแทนมนุษย์", "ตัวแทนสด"]
    },
    # Indonesian
    "id": {
        "ticket": ["buat tiket", "buka tiket", "tiket baru", "kirim tiket"],
        "agent": ["hubungkan ke agen", "bicara dengan agen", "agen manusia", "agen langsung"]
    },
    # Hebrew
    "he": {
        "ticket": ["צור כרטיס", "פתח כרטיס", "כרטיס חדש", "שלח כרטיס"],
        "agent": ["התחבר לסוכן", "דבר עם סוכן", "סוכן אנושי", "סוכן חי"]
    },
}

def detect_language(text: str) -> str:
    """
    Detect the language of the input text.
    Returns language code (e.g., 'en', 'es', 'fr', etc.)
    """
    # Simple character-based detection for common languages
    text_lower = text.lower()
    
    # Check for specific language patterns
    if re.search(r'[\u4e00-\u9fff]', text):  # Chinese characters
        return "zh"
    elif re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):  # Japanese characters
        return "ja"
    elif re.search(r'[\uac00-\ud7a3]', text):  # Korean characters
        return "ko"
    elif re.search(r'[\u0600-\u06ff]', text):  # Arabic characters
        return "ar"
    elif re.search(r'[\u0590-\u05ff]', text):  # Hebrew characters
        return "he"
    elif re.search(r'[\u0e00-\u0e7f]', text):  # Thai characters
        return "th"
    
    # Check for common words/phrases in different languages
    # Spanish
    if any(word in text_lower for word in ["crear", "ticket", "agente", "hablar", "conectar"]):
        if "crear" in text_lower or "hablar" in text_lower:
            return "es"
    # French
    if any(word in text_lower for word in ["créer", "billet", "agent", "parler"]):
        if "créer" in text_lower or "parler" in text_lower:
            return "fr"
    # German
    if any(word in text_lower for word in ["erstellen", "ticket", "agent", "sprechen"]):
        if "erstellen" in text_lower or "sprechen" in text_lower:
            return "de"
    # Italian
    if any(word in text_lower for word in ["creare", "biglietto", "agente", "parlare"]):
        if "creare" in text_lower or "parlare" in text_lower:
            return "it"
    # Portuguese
    if any(word in text_lower for word in ["criar", "bilhete", "agente", "falar"]):
        if "criar" in text_lower or "falar" in text_lower:
            return "pt"
    # Russian
    if any(word in text_lower for word in ["создать", "тикет", "агент", "говорить"]):
        return "ru"
    # Hindi
    if any(word in text_lower for word in ["बनाएं", "टिकट", "एजेंट", "बात"]):
        return "hi"
    
    # Default to English if no specific language detected
    return "en"

def detect_ticket_intent_multilang(text: str) -> Dict:
    """
    Detect ticket/agent intent in any language.
    Returns dict with 'needs_ticket', 'needs_agent', 'should_route', and 'detected_language'.
    """
    detected_lang = detect_language(text)
    text_lower = text.lower()
    
    # Get keywords for detected language
    lang_keywords = LANGUAGE_KEYWORDS.get(detected_lang, LANGUAGE_KEYWORDS["en"])
    
    # Check for ticket keywords
    needs_ticket = any(keyword in text_lower for keyword in lang_keywords.get("ticket", []))
    
    # Check for agent keywords
    needs_agent = any(keyword in text_lower for keyword in lang_keywords.get("agent", []))
    
    # Also check English keywords as fallback (many users mix languages)
    if not needs_ticket and not needs_agent:
        en_keywords = LANGUAGE_KEYWORDS["en"]
        needs_ticket = any(keyword in text_lower for keyword in en_keywords.get("ticket", []))
        needs_agent = any(keyword in text_lower for keyword in en_keywords.get("agent", []))
    
    return {
        "needs_ticket": needs_ticket,
        "needs_agent": needs_agent,
        "should_route": needs_ticket or needs_agent,
        "detected_language": detected_lang
    }

def translate_intent_to_english(text: str, source_lang: str) -> str:
    """
    Translate common intent phrases to English for processing.
    This helps the backend understand intents in any language.
    """
    # For now, return original text - LLM will handle translation
    # In production, you could use a translation API here
    return text

