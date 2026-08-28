FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data uploads/profiles uploads/lostfound /data /data/uploads/profiles /data/uploads/lostfound
EXPOSE 3000
ENV PORT=3000
# DATA_DIR/UPLOAD_DIR 환경변수로 영구 디스크 경로 지정 가능 (Fly: /data, Render: /opt/render/...)
CMD ["node", "server.js"]
