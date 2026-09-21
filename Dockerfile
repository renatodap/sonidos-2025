FROM nginx:1.27-alpine

COPY . /usr/share/nginx/html/sonidos-2025/
COPY nginx.conf /etc/nginx/conf.d/default.conf

