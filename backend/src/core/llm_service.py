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

# Model configurations
# We'll try to use flash for cost efficiency and speed. 
# You can customize these constraints if needed.
GENERATION_CONFIG = {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "max_output_tokens": 4096,
}

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

def get_model():
    return genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=GENERATION_CONFIG,
        safety_settings=SAFETY_SETTINGS,
    )


async def generate_credit_explanation(analysis_data: dict) -> str:
    """
    Generates an explanation for a credit analysis result using Gemini.
    """
    model = get_model()
    
    # Format the variables for the prompt
    probability = round(analysis_data.get("approval_probability", 0.0) * 100, 2)
    approved = "Onaylandı" if probability >= 50 else "Reddedildi"
    
    # Safely convert SHAP and Counterfactual data to readable string
    shap_factors = json.dumps(analysis_data.get("shap_factors", {}), ensure_ascii=False, indent=2)
    counterfactuals = json.dumps(analysis_data.get("counterfactuals", {}), ensure_ascii=False, indent=2)

    prompt = f"""Sen LoanGuard'ın finansal danışmanısın.
Kullanıcıya kredi analizi sonucunu sade Türkçeyle açıkla. Jargon kullanma.

Analiz Sonucu:
- Onaylanma ihtimali: {probability}%
- Karar: {approved}
- En etkili faktörler: {shap_factors}
- Öneriler: {counterfactuals}

Kullanıcıya şunları söyle:
1. Sonucu sade dille açıkla
2. Neden bu sonucu aldığını anlat
3. Ne yapması gerektiğini söyle
"""
    try:
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Error generating credit explanation: {e}")
        return "Sistemde bir hata oluştu ve analiziniz yapay zeka tarafından şu an açıklanamıyor. Lütfen daha sonra tekrar deneyin."


async def generate_financial_advice(user_data: dict, user_message: str, chat_history: list[dict] = None) -> str:
    """
    Generates personal financial advice using Gemini.
    """
    model = get_model()
    
    age = user_data.get("age", "Bilinmiyor")
    city = user_data.get("city", "Bilinmiyor")
    income = user_data.get("income", 0.0)
    expense = user_data.get("expense", 0.0)
    savings_rate = user_data.get("savings_rate", 0.0)
    health_score = user_data.get("health_score", 0.0)
    goals = user_data.get("goals", "Belirtilmemiş")
    risk_level = user_data.get("risk_level", "Bilinmiyor")
    
    system_prompt = f"""Sen LoanGuard'ın kişisel finansal danışmanısın.
Kullanıcının verilerine göre kişisel tavsiye ver. Genel tavsiye verme, sadece bu kişiye özel konuş.

Kullanıcı Profili:
- Yaş: {age}, Şehir: {city}
- Gelir: {income} TL, Gider: {expense} TL
- Tasarruf oranı: %{savings_rate}
- Finansal sağlık skoru: {health_score}/100
- Hedefler: {goals}
- Yatırım profili: {risk_level}
"""
    
    try:
        # Build contents from history to maintain context
        contents = [{"role": "user", "parts": [system_prompt]}]
        
        # If there is chat history, add it
        if chat_history:
            for msg in chat_history:
                # Map role: 'assistant' -> 'model', 'user' -> 'user'
                role = "model" if msg.get("role") == "assistant" else "user"
                # Skip system messages or invalid ones
                if role in ["model", "user"]:
                    contents.append({"role": role, "parts": [msg.get("content", "")]})
        
        # Add the current message
        contents.append({"role": "user", "parts": [user_message]})
        
        response = await model.generate_content_async(contents)
        return response.text
    except Exception as e:
        logger.error(f"Error generating financial advice: {e}")
        return "Üzgünüm, şu an finansal analizimi tamamlayamıyorum. Lütfen daha sonra tekrar sorun."
