# ============================================================
# LoanGuard Backend — Dockerfile
# Python 3.11 slim — multi-stage değil, dev odaklı tek aşama
# ============================================================

FROM python:3.11-slim

# Sistem bağımlılıkları (asyncpg için libpq, shap için gcc gerekli)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Önce sadece requirements kopyala → pip layer cache'i koru
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kaynak kodu kopyala (build context = ./backend)
COPY . .

EXPOSE 8000

# Uvicorn: 0.0.0.0 → container dışından erişilebilir
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
