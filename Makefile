# ============================================
# LoanGuard - Makefile
# ============================================
# Kısayol komutları: make <hedef>
# ============================================

.PHONY: install eda api streamlit docker test lint clean

# Bağımlılıkları yükle
install:
	pip install -r requirements.txt

# Jupyter Notebook başlat
notebook:
	jupyter notebook notebooks/

# FastAPI sunucusu başlat
api:
	uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Streamlit arayüzü başlat
streamlit:
	streamlit run src/app.py

# Docker ile çalıştır
docker:
	docker-compose up --build

# Testleri çalıştır
test:
	pytest tests/ -v

# Kod kalitesi kontrolü
lint:
	flake8 src/ tests/
	black --check src/ tests/

# Kod formatla
format:
	black src/ tests/

# Geçici dosyaları temizle
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache/ 2>/dev/null || true
