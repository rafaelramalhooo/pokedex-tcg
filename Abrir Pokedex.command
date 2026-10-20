#!/bin/bash
# Abre o Pokédex TCG no navegador.
# Deixe a janela preta aberta enquanto usa o app. Para encerrar, feche a janela.

cd "$(dirname "$0")" || exit 1
PORT=8080
URL="http://localhost:$PORT/"

# Se o app já estiver rodando, só abre o navegador.
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "O app já parece estar rodando. Abrindo o navegador..."
  open "$URL"
  exit 0
fi

PY="$(command -v python3)"
if [ -z "$PY" ]; then
  echo "Não encontrei o Python 3 neste Mac."
  echo "Abra o arquivo docs/COMO-ABRIR-O-APP.md e veja a parte 'Se der erro'."
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
  exit 1
fi

echo "Pokédex TCG rodando em $URL"
echo "Deixe esta janela aberta enquanto usa o app. Para encerrar, feche-a."
(sleep 1; open "$URL") &
exec "$PY" -m http.server $PORT --bind 127.0.0.1
