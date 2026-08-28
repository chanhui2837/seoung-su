FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
ENV PORT=3000
# MONGODB_URI(환경변수)로 MongoDB Atlas에 연결 -> 재배포에도 데이터 유지
CMD ["node", "server.js"]