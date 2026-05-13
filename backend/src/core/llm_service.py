import json
import logging
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from src.core.config import settings

logger = logging.getLogger(__name__)

# Configure Gemini API
if hasattr(settings, "GEMINI_API") and settings.GEMINI_API:
    genai.configure(api_key=settings.GEMINI_API)
else:
    logger.warning("GEMINI_API key is not set in environment variables.")

GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "max_output_tokens": 4096,  # Daha detaylı yanıtlar için sınır artırıldı
}

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

def get_model(system_instruction: str = None):
    kwargs = {
        "model_name": "gemini-2.5-flash",
        "generation_config": GENERATION_CONFIG,
        "safety_settings": SAFETY_SETTINGS,
    }
    if system_instruction:
        kwargs["system_instruction"] = system_instruction
    return genai.GenerativeModel(**kwargs)


async def generate_credit_explanation(analysis_data: dict) -> str:
    """
    Kredi analiz sonucunu sade Türkçeyle açıklar.
    Kesinlikle markdown formatı kullanmaz (**, *, # vb.).
    """
    system_instruction = "Sen yetkin bir LoanGuard finansal danışmanısın. Cevaplarını her zaman doğal ve akıcı bir paragrafla, tam olarak tamamlanmış cümlelerle bitir."
    model = get_model(system_instruction=system_instruction)

    probability = round(analysis_data.get("approval_probability", 0.0) * 100, 2)
    approved = "Onaylanabilir" if probability >= 50 else "Reddedilebilir"

    shap_factors = json.dumps(analysis_data.get("shap_factors", {}), ensure_ascii=False)
    counterfactuals = json.dumps(analysis_data.get("counterfactuals", {}), ensure_ascii=False)

    prompt = f"""Kredi analiz sonucunu kullanıcıya sade ve anlaşılır bir Türkçeyle açıkla.

Kurallar:
- Basit ve düz metin kullan. Vurgular için büyük harf veya basit tire (-) ile liste yapabilirsin.
- Jargon kullanmadan samimi bir dil tercih et.

Veri:
- Onaylanma ihtimali: %{probability} ({approved})
- Etkili faktörler: {shap_factors}
- Öneriler: {counterfactuals}
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error generating credit explanation: {e}")
        return "Şu an açıklama oluşturulamıyor. Lütfen daha sonra tekrar deneyin."


async def generate_financial_advice(user_data: dict, user_message: str, chat_history: list[dict] = None) -> str:
    """
    Kişisel finansal tavsiye üretir. Sade, markdown içermeyen yanıtlar.
    """
    has_budget = user_data.get("has_budget", False)

    if not has_budget:
        system_prompt = (
            "Sen LoanGuard finansal danışmanısın. "
            "Kullanıcı henüz bütçe girmemiş. "
            "Onu bütçe girmeye yönlendir. "
            "Sade ve anlaşılır bir dil kullan."
        )
    else:
        system_prompt = f"""Sen LoanGuard finansal danışmanısın.

Kullanıcı Verileri:
- Profil: {user_data.get('profile_summary')}
- Gelir: {user_data.get('income')} TL, Gider: {user_data.get('expense')} TL
- Tasarruf oranı: %{user_data.get('savings_rate')}, Sağlık skoru: {user_data.get('health_score')}/100
- Hedefler: {user_data.get('goals')}
- Uyarılar: {user_data.get('alerts')}

Yanıt kuralları:
- Basit ve anlaşılır bir düz metin kullan, gerekirse maddeler için tire (-) kullanabilirsin.
- Kullanıcıya doğal, açıklayıcı ve yardımsever bir şekilde yanıt ver. 
- Bu kişiye özel konuş, genel tavsiye verme.
- Samimi ve net ol."""

    model = get_model(system_instruction=system_prompt)

    try:
        contents = []

        if chat_history:
            for msg in chat_history:
                role = "model" if msg.get("role") == "assistant" else "user"
                content_text = msg.get("content", "").strip()
                if not content_text:
                    continue
                
                # Combine consecutive roles to avoid Gemini's InvalidArgument exception
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"][0] += f"\n{content_text}"
                else:
                    contents.append({"role": role, "parts": [content_text]})

        # Add user_message only if it's not already at the end of the combined history
        if not contents or user_message.strip() not in contents[-1]["parts"][0]:
            if contents and contents[-1]["role"] == "user":
                contents[-1]["parts"][0] += f"\n{user_message}"
            else:
                contents.append({"role": "user", "parts": [user_message]})

        response = await model.generate_content_async(contents)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error generating financial advice: {e}")
        return "Şu an yanıt veremiyorum. Lütfen daha sonra tekrar sorun."
