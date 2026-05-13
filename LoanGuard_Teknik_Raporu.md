# LoanGuard Teknik Analiz ve Yapay Zeka Mimari Raporu

Bu belge, **LoanGuard** projesinin ne amaçladığını, nasıl çalıştığını, mimarisini, veri akışını ve özellikle *Yapay Zeka (AI)* ile *Makine Öğrenmesi (ML)* modellerinin nasıl eğitilip entegre edildiğini detaylandıran kapsamlı bir teknik rapordur.

---

## 1. Proje Özeti ve Amacı

**LoanGuard**, modern makine öğrenmesi tekniklerini ve Büyük Dil Modellerini (LLM) kullanarak kullanıcıların finansal sağlıklarını takip etmelerini sağlayan ve adil, şeffaf kredi değerlendirmeleri sunan bir "Akıllı Finans ve Karar Destek Platformu"dur.

**Temel Amaçları:**
* **Adil Kredi Puanlaması:** Geleneksel bankacılığın kara kutu (black-box) kredi skorlama sistemleri yerine, veriye dayalı ve kararların *neden* verildiğini açıklayabilen bir yapay zeka altyapısı kurmak.
* **Finansal Okuryazarlık:** Kullanıcının bütçesini, gelir/gider dengesini analiz ederek "Nasıl daha iyi bir finansal duruma gelirim?" sorusuna yanıt verebilmek.
* **Şeffaflık (XAI):** Kredi reddedildiğinde veya onaylandığında, arka planda çalışan XAI (Explainable AI) teknikleri sayesinde (SHAP ve DiCE) kullanıcıya anlaşılır sebepler sunmak.

*(Görsel Önerisi: Projenin ana ekranı (Dashboard) veya genel amacını yansıtan bir giriş görseli.)*  
`[BURAYA EKLENECEK GÖRSEL: Uygulamanın Dashboard veya Hoşgeldiniz ekran görüntüsü]`

---

## 2. Sistem Nasıl Çalışıyor? (Genel Akış)

Sistem üç ana ayaktan oluşur:
1. **Veri Toplama (Frontend):** Kullanıcı arayüz üzerinden profil bilgilerini, aylık gelir/gider kalemlerini, hedeflerini (budget) sisteme girer.
2. **Kredi Başvurusu ve ML Değerlendirmesi (Backend + ML Pipeline):** Kullanıcı bir kredi simülasyonu çalıştırdığında, frontend backend'e istek atar. Backend veriyi ön işlemlerden (preprocessing) geçirip **Isolation Forest** (Anomali Tespiti) ve **XGBoost** (Risk Skoru) modellerine besler. Karar onay ise dinamik faiz hesaplanır. Red ise düzeltici adımlar (Counterfactuals) oluşturulur.
3. **Akıllı Danışmanlık (LLM):** Sistem kullanıcının tüm finansal bağlamını toplayıp Gemini modeline iletir ve kişiselleştirilmiş finansal tavsiyeler üretir.

*(Görsel Önerisi: Sistem mimarisi veya veri akış diyagramı.)*  
`[BURAYA EKLENECEK GÖRSEL: Projenin genel veri akışını gösteren bir mimari diyagram (Frontend -> Backend API -> ML Models / DB)]`

---

## 3. Yapay Zeka Modelleri ve Eğitim Süreci (Yapay Zeka Odaklı Analiz)

Projenin yapay zeka kısmı, Jupyter Notebooks (`notebooks/` dizini) üzerinden adım adım eğitilmiş, sonrasında üretim (production) ortamında kullanılmak üzere `.joblib` dosyaları olarak dışa aktarılmıştır. Model eğitim süreçleri aşağıdaki gibidir:

### 3.1. Veri Seti ve Ön İşleme (Preprocessing)
Eğitimde yaklaşık 255.347 satırlık kredi başvuru verisi (`Loan_default.csv`) kullanılmıştır. Verilerdeki dengesizlik (Default/Batar oranı ~%11.6) dikkate alınarak özel stratejiler izlenmiştir.
* **Label Encoding:** 7 farklı kategorik özellik sayısal değerlere dönüştürüldü.
* **Feature Engineering (Özellik Mühendisliği):** Modele sadece ham veri değil; uzman görüşünü yansıtan oranlar eklendi: `LoanToIncome` (Kredi/Gelir), `PaymentToIncome` (Taksit/Gelir), `TotalDebtBurden` gibi. Toplam özellik sayısı 20'ye çıkartıldı.
* **Standartlaştırma:** Tüm sayısal özellikler `StandardScaler` ile ölçeklendirildi.

### 3.2. Anomali Tespiti: Isolation Forest
Kredi başvurularında hileli (fraud) veya veri girişi hatalı durumları tespit etmek için denetimsiz öğrenme (unsupervised learning) modeli olan **Isolation Forest** kullanıldı.
* Model `contamination=0.05` hiperparametresi ile eğitildi (Verinin %5'i anomali kabul edilerek ağaç izolasyon mantığı uygulandı). 
* Test verisinde normalin dışında kalan (uç değerlere sahip) başvurular anında "anomali" bayrağı ile işaretlendi.

*(Görsel Önerisi: Isolation Forest sonuçlarını veya anomali dağılımını gösteren grafik)*  
`[BURAYA EKLENECEK GÖRSEL: notebooks/reports/figures/ dizinindeki if_* (Isolation Forest) grafiklerinden biri]`

### 3.3. Risk Skoru Tahmini: XGBoost Sınıflandırıcısı
Ana karar verici mekanizma olan risk analizi, **XGBoost Classifier** ile yapıldı. Bankacılık ve finans verilerinde tablo (tabular) formatlı veriler için en yüksek başarıyı veren modellerden biridir.
* **Dengesiz Veri Çözümü:** Negatif/Pozitif sınıf dengesizliğini çözmek için modelde `scale_pos_weight=7.6` kullanıldı. Bu sayede modelin azınlık olan "Temerrüt (Default)" sınıfını daha iyi öğrenmesi sağlandı.
* **Model Performansı:** Modelin ayırt edicilik gücünü gösteren ROC-AUC (Eğri Altında Kalan Alan) değeri **0.7595** olarak gerçekleşti.
* **Eşik Değeri (Threshold):** Precision-Recall takası incelenerek en optimum karar eşiği `0.4885` olarak belirlendi. Skor bu değerin altındaysa "Onay", üstündeyse "Red" (Riskli) kararı üretilir.

*(Görsel Önerisi: XGBoost AUC-ROC eğrisi veya Model Feature Importance grafiği)*  
`[BURAYA EKLENECEK GÖRSEL: notebooks/reports/figures/ dizinindeki xgb_* prefixli ROC eğrisi veya özellik önem grafiği]`

### 3.4. Açıklanabilir Yapay Zeka (Explainable AI - XAI)
Kullanıcıya "Neden reddedildim?" cevabını verebilmek adına gelişmiş makine öğrenmesi yorumlayıcıları entegre edildi:
* **SHAP (SHapley Additive exPlanations):** Oyun teorisine dayalı bu teknik, XGBoost'un verdiği kararda hangi özelliğin (örneğin aylık gelirin veya yaşın) ne kadar olumlu/olumsuz etki ettiğini hesaplar. Model canlı çalışırken (inference) o anki başvuru için lokal (local) olarak hesaplanır ve kullanıcı arayüzüne en çok etki eden 3 faktör yansıtılır.
* **DiCE (Diverse Counterfactual Explanations):** Karşıolgusal XAI kütüphanesi olan DiCE-ML, kullanıcı onay alamadığında "Kredi tutarı 10.000 TL daha az olsaydı onaylanırdı" tarzı aksiyona dönüştürülebilir "Ne olsaydı?" senaryoları üretir.

*(Görsel Önerisi: Kredi Onay/Ret ekranındaki SHAP grafiği veya DiCE açıklamalarının UI üzerindeki görünümü)*  
`[BURAYA EKLENECEK GÖRSEL: Uygulamadaki Kredi Simülatörü sayfasında SHAP faktörlerinin veya tavsiyelerin göründüğü ekran görüntüsü]`

---

## 4. Büyük Dil Modeli (LLM) Entegrasyonu: Akıllı Finansal Danışman

Sadece sayısal modellerle (XGBoost) yetinilmeyip platforma entegre bir yapay zeka asistanı eklenmiştir. 

**Nasıl Çalışır?**
* **Model:** Google Gemini API entegrasyonu (Veya ortam değişkenlerine bağlı olarak OpenAI/Claude) kullanılmıştır.
* **RAG / Bağlam Entegrasyonu:** Sistemin "Chat" modülü sıradan bir sohbet botu değildir. Kullanıcı sohbete başladığında backend; kullanıcının veritabanındaki yaşını, gelirini, giderlerini, finansal hedeflerini ve ML tarafında hesaplanan risk skorunu alır.
* Bu veriler temiz bir JSON / Metin bağlamına (Context) dönüştürülüp sistem komutu (System Prompt) olarak LLM'e enjekte edilir.
* Böylece LLM, kullanıcının güncel durumunu bilerek: *"Taksit/Gelir oranınız şu an sınırda, bu yüzden kredi kartı borçlarınızı yapılandırmanızı öneririm"* gibi tam isabetli, hiper-kişiselleştirilmiş yanıtlar verir.

*(Görsel Önerisi: LLM destekli AI Chatbot arayüzünden finansal bir soruya verilen yanıt)*  
`[BURAYA EKLENECEK GÖRSEL: ChatPage ekran görüntüsü. Kullanıcı ve AI asistan arasındaki finansal bir diyalog]`

---

## 5. Uygulama Modülleri ve Sayfaların Amacı

Projenin sunduğu özellikler ve yapay zeka analizlerinin sağlıklı çalışabilmesi için farklı veri giriş sayfaları ve modüller tasarlanmıştır. Her bir sayfanın temel varlık sebebi şudur:

1. **Dashboard (Ana Gösterge Paneli):** Kullanıcının finansal durumunun kuş bakışı görünümünü sunar. Toplam gelir, gider, bütçe durumu ve yaklaşan hedeflerin özet metrikleri burada gösterilir.
2. **Profile (Kullanıcı Profili):** Makine öğrenmesi modeli için kritik olan temel demografik verilerin (yaş, eğitim durumu, medeni hal, risk toleransı) toplandığı sayfadır. ML tahmini buradaki verilerle başlar.
3. **Budget (Bütçe Yönetimi):** Sistemin en hayati veri besleme noktasıdır. Kullanıcı aylık gelirini ve sabit/değişken giderlerini (kira, faturalar, mevcut kredi taksitleri vb.) buraya girer. Yapay zeka modeli kredi kararını verirken kullandığı DTI (Borç/Gelir Oranı) gibi finansal oranları (Feature Engineering) tamamen bu tablodaki verilerden hesaplar.
4. **Credit Analysis & Simulator (Kredi Simülatörü):** Platformun ana kalbidir. Kullanıcı almak istediği kredi miktarını ve vadesini girer. Sistem, Profile ve Budget sayfalarındaki geçmiş verileri toplayıp **XGBoost** modelini anlık çalıştırır. Sonuç olarak; kredinin onaylanıp onaylanmayacağı, risk skoru, faiz oranı ve şeffaflık grafikleri (**SHAP / DiCE**) bu ekranda gösterilir.
5. **Goals (Finansal Hedefler):** Tatil, araç alma, acil durum fonu gibi tasarruf hedeflerinin tanımlandığı bölümdür. Kullanıcının tasarruf potansiyelini anlamaya ve onu motive etmeye yarar.
6. **Alerts (Akıllı Uyarılar):** Girilen bütçe verilerine göre sistemin otomatik ürettiği önleyici uyarılardır (Örn: "Sabit giderleriniz gelirinizin %60'ını aşıyor" gibi).
7. **Report (Aylık Karne):** Kullanıcının tüm o aya ait verilerinin analiz edilip bir sağlık skoru ile birlikte özetlendiği sayfadır.
8. **Chat (Yapay Zeka Asistanı):** Kullanıcının finansal durumu hakkında interaktif sorular sorabildiği Gemini destekli danışmanlık asistanıdır.
9. **Investment (Yatırım Profili):** Kullanıcının risk anketini çözerek risk iştahının (agresif/muhafazakar) belirlendiği ve buna göre yatırım önerileri aldığı modüldür.

*(Görsel Önerisi: Yukarıda anlatılan modüllerden en az ikisinin (Örn: Bütçe yönetimi tablosu ve Kredi Simülatörü sonuç ekranı) yan yana ekran görüntüsü)*  
`[BURAYA EKLENECEK GÖRSEL: BudgetPage ve SimulatorPage ekran görüntüleri]`

---

## 6. Teknoloji Yığını ve Veritabanı Mimarisi

* **Frontend:** React, TypeScript, Vite. Hızlı, bileşen bazlı (component-driven) modern bir kullanıcı deneyimi sağlar.
* **Backend:** Python tabanlı **FastAPI**. Asenkron yapısı sayesinde yüksek performans gösterir. Makine öğrenmesi modellerinin (`.joblib`) bellek üzerinde canlı (lifespan event'leriyle) tutularak hızlı tahminde (inference) bulunmasına imkan tanır.
* **Veritabanı:** PostgreSQL (`asyncpg` ile bağlanır). 

**Ana Veritabanı Tabloları:**
* `users` & `profiles`: Temel kimlik ve demografik veriler.
* `financial_periods` & `financial_entries`: Bütçe, gelir/gider kalemleri.
* `credit_analyses`: XGBoost onay skorlarının, SHAP değerlerinin ve DiCE karşıolgusal sonuçlarının saklandığı ML çıktı tablosu.
* `chat_history`: Çoklu oturumlu LLM sohbetlerinin saklandığı NLP tablosu.

*(Görsel Önerisi: Veritabanı şeması veya DBeaver'dan tablo görünümleri)*  
`[BURAYA EKLENECEK GÖRSEL: Veritabanı tabloları arası ilişkileri gösteren ER (Entity-Relationship) Diyagramı]`

---

## 7. Projenin Ayağa Kaldırılması (Deployment)

Dağıtım süreci **Docker Compose** kullanılarak tamamen izole edilmiş kapsayıcılar (containers) üzerinde gerçekleşir:
1. `docker-compose.yml` içerisinde `db` (PostgreSQL), `api` (FastAPI) ve `frontend` (React) olmak üzere üç mikro servis tanımlanmıştır.
2. `schema.sql` veritabanı ilk başladığında otomatik kurularak tabloları hazır eder.
3. FastAPI ayağa kalktığında `models/` dizinindeki `.joblib` ML modellerini (LabelEncoder, XGBoost, StandardScaler) RAM'e yükleyerek (warm-up) 8000 portunda dinlemeye başlar.
4. React frontend ise 5173 portundan kullanıcılara arayüzü sunar.

*(Görsel Önerisi: Terminal üzerinde Docker Compose Up sonrası servislerin çalıştığını gösteren çıktı)*  
`[BURAYA EKLENECEK GÖRSEL: Terminal ekranında loanguard_api, loanguard_frontend, ve loanguard_db'nin "Running" konumunda olduğunu gösteren bir ekran görüntüsü]`

---

## 8. Özet Sonuç
LoanGuard projesi, Yapay Zeka'nın "Karar Verme" (XGBoost), "Anomali Tespiti" (Isolation Forest), "Açıklanabilirlik" (SHAP/DiCE) ve "Doğal Dil İşleme / Tavsiye" (LLM/Gemini) olmak üzere tam dört farklı disiplinini uçtan uca modern bir web uygulaması mimarisinde harmanlayan bir mühendislik örneğidir. Hem teorik model eğitimleri jupyter tarafında bilimsel yöntemlerle yapılmış, hem de FastAPI ve React üzerinden son kullanıcının faydasına sunulacak canlı bir ürüne dönüştürülmüştür.
