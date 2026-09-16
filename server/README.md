# Server: PeerJS + nginx (docker compose)

Собственный сервер сигналинга PeerJS за nginx с HTTPS.
Клиент использует его только для установки P2P-соединения,
игровой трафик идёт напрямую между браузерами.

## Запуск

```sh
cd server
cp .env.example .env
# заполнить DOMAIN и LETSENCRYPT_DIR в .env
docker compose up -d
```

Проверка: `https://$DOMAIN:$HTTPS_PORT$PEER_PATH` должен вернуть JSON
PeerServer (поля name, description, website).

Порт PeerServer (9000) наружу не публикуется — доступен только внутри
docker-сети через nginx (HTTP → `$HTTP_PORT`, по умолчанию 9000;
HTTPS → `$HTTPS_PORT`, по умолчанию 9002).

## Режим без HTTPS

Если `DOMAIN` не задан или сертификаты для него отсутствуют
в `LETSENCRYPT_DIR/live/$DOMAIN/`, entrypoint-скрипт nginx
(`nginx/entrypoint.sh`) генерирует plain HTTP конфиг: PeerServer
доступен по `http://<хост>:$HTTP_PORT$PEER_PATH` без SSL.
В этом случае `LETSENCRYPT_DIR` можно оставить пустым, а в клиенте
выключить SSL (тумблер «🔓 без SSL» в Lobby или `VITE_PEER_SECURE=false`).

> ⚠️ Без HTTPS браузерный WebRTC может не работать на не-localhost
> адресах (нужен secure context). Для локальной разработки используйте
> `localhost`, для продакшена — полноценный HTTPS через Let's Encrypt.

## Переменные `.env`

| Переменная      | Назначение                                              |
| --------------- | ------------------------------------------------------- |
| `DOMAIN`        | Домен; должен совпадать с каталогом в `/etc/letsencrypt/live/` на хосте |
| `LETSENCRYPT_DIR` | Папка Let's Encrypt на хосте; монтируется read-only как `/etc/letsencrypt` |
| `PEER_PATH`     | Путь PeerServer; должен совпадать с `path` в клиенте    |
| `PEER_KEY`      | Ключ PeerServer; должен совпадать с `key` в клиенте     |
| `HTTP_PORT` / `HTTPS_PORT` | Публикуемые порты nginx                          |

## Клиент

По умолчанию клиент использует публичный брокер PeerJS.
Свой сервер задаётся либо переменными окружения сборки
(`VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`,
`VITE_PEER_KEY`, `VITE_PEER_SECURE` — см. корневой `.env.example`),
либо вручную в Lobby («Сервер соединения», сохраняется в localStorage
и имеет приоритет над env).
