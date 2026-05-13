FROM node:20-alpine

WORKDIR /app

# Paket bağımlılıklarını kopyala
COPY package.json package-lock.json ./

# Bağımlılıkları yükle
RUN npm install

# Kaynak kodları kopyala
COPY . .

# Vite'in dinleyeceği portu dışa aç (development için)
EXPOSE 5173

# Container ayağa kalkarken çalışacak komut (--host dışarıdan erişime izin verir)
CMD ["npm", "run", "dev", "--", "--host"]
