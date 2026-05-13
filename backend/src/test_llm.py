import asyncio
import os
import json
import google.generativeai as genai
from src.core.llm_service import generate_credit_explanation

async def test_explanation():
    data = {
        "approval_probability": 0.2185,
        "shap_factors": [
            {"feature_tr": "Yaş", "direction": "+", "shap_value": 0.5, "impact_label": "Olumsuz"},
            {"feature_tr": "Kredi Tutarı", "direction": "+", "shap_value": 0.4, "impact_label": "Olumsuz"}
        ],
        "counterfactuals": [
            {"changes": {"LoanAmount": {"from": 100000, "to": 50000}}}
        ]
    }
    
    print("Generating...")
    explanation = await generate_credit_explanation(data)
    print("--- RESULT ---")
    print(explanation)

if __name__ == "__main__":
    asyncio.run(test_explanation())
