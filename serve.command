#!/bin/bash
# ESP32 Web IDE - yerel baslatici (cift tikla calistir, macOS)
cd "$(dirname "$0")"
PORT=8765
URL="http://localhost:$PORT"
echo "ESP32 Web IDE -> $URL"
echo "Durdurmak icin: Ctrl-C"
# Chrome'da ac (yoksa varsayilan tarayici)
( sleep 1; open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" ) &
python3 -m http.server "$PORT"
