import json
import os
import sys
import warnings

# 'src' modülünü bulabilmesi için ana dizini Python yoluna ekle
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.predictor import LoanGuardPredictor
from src.explainability.dice_explainer import DiceExplainer

# Uyarıları temiz bir konsol çıktısı için susturalım
warnings.filterwarnings("ignore")

def run_demo():
    print("\n" + "="*50)
    print(" 🚀 LOANGUARD İNTERAKTİF MODEL TESTİ ")
    print("="*50)
    
    print("\n[1] Modeller Yükleniyor... (Lütfen bekleyin)")
    predictor = LoanGuardPredictor()
    dice = DiceExplainer()
    print("✅ Modeller başarıyla yüklendi!\n")

    # Varsayılan (Riskli bir başvuru) şablonu
    user_data = {
        "Age": 24,
        "Income": 35000,
        "LoanAmount": 50000,
        "CreditScore": 450,
        "MonthsEmployed": 4,
        "NumCreditLines": 1,
        "InterestRate": 18.5,
        "LoanTerm": 60,
        "DTIRatio": 0.85,
        "Education": "High School",
        "EmploymentType": "Part-time",
        "MaritalStatus": "Single",
        "HasMortgage": "No",
        "HasDependents": "No",
        "LoanPurpose": "Other",
        "HasCoSigner": "No"
    }

    print("Riskli bir müşteri profili yüklendi (Düşük skor, Part-time çalışan, Yüksek Borç Oranı).")
    print("Bazı kritik değerleri değiştirebilirsiniz (Varsayılanı korumak için direkt ENTER'a basın):")
    
    # Kullanıcıdan interaktif input al (Boş geçilirse varsayılanı kullanır)
    income_input = input(f"Yıllık Gelir (Income) [{user_data['Income']}]: ")
    if income_input.strip(): user_data["Income"] = int(income_input)

    loan_input = input(f"İstenen Kredi (LoanAmount) [{user_data['LoanAmount']}]: ")
    if loan_input.strip(): user_data["LoanAmount"] = int(loan_input)

    score_input = input(f"Kredi Skoru (CreditScore) [{user_data['CreditScore']}]: ")
    if score_input.strip(): user_data["CreditScore"] = int(score_input)

    print("\n[2] Model Tahmini Yapılıyor...\n")
    
    # Tahmin çalıştır
    result = predictor.predict(user_data)
    
    # Eğer reddedildiyse DiCE'ı çalıştır
    if result["decision"] == "rejected":
        print("💡 Karar RED olduğu için alternatif senaryolar aranıyor (DiCE)...")
        result["counterfactuals"] = dice.generate_counterfactuals(user_data)

    # Sonuçları ekrana yazdır
    print("="*50)
    print(" 📊 BAŞVURU SONUCU ")
    print("="*50)
    print(f"Anomali Tespit Edildi Mi? : {'Evet ⚠️' if result['anomaly_flag'] else 'Hayır ✅'}")
    print(f"Risk Skoru                : %{result['risk_score'] * 100:.2f}")
    
    decision_text = "ONAYLANDI ✅" if result["decision"] == "approved" else "REDDEDİLDİ ❌"
    print(f"Modelin Kararı            : {decision_text}")
    
    if result["interest_rate"]:
        print(f"Önerilen Faiz Oranı       : %{result['interest_rate']}")

    print("\n🧐 Kararın En Önemli 3 Nedeni (SHAP):")
    for shap in result["shap_top3"]:
        etki = "Yükseltti (Olumsuz)" if shap["direction"] == "+" else "Düşürdü (Olumlu)"
        print(f"  - {shap['feature']:<15} : Riski {etki}")

    if result.get("counterfactuals"):
        print("\n✨ Nasıl Onaylanabilirdi? (Alternatif Senaryolar):")
        for i, cf in enumerate(result["counterfactuals"], 1):
            degisimler = []
            for feat, vals in cf["changes"].items():
                degisimler.append(f"{feat} ({vals['from']} -> {vals['to']})")
            print(f"  Senaryo {i}: {', '.join(degisimler)} olsaydı onaylanırdı.")

    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    run_demo()
