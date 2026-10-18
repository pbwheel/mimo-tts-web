#!/usr/bin/env bash
# 从小米 MiMo 官网重新下载预置音色试听音频
# 来源：https://mimo.xiaomi.com/mimo-v2-5-tts 页面内嵌播放器（aistudio-cdn.xiaomimimo.com）
# 注意：官方仅提供 8 个音色的试听，mimo_default 无官方样例（保留本地生成版本）
set -euo pipefail

BASE_URL="https://aistudio-cdn.xiaomimimo.com/xiaomimimo-static/blog/tts-2-5"
DEST="$(cd "$(dirname "$0")/.." && pwd)/static/assets/previews"

# 格式：官方文件名|本地音色名（兼容 macOS 自带 bash 3.2，不用关联数组）
VOICE_LIST="
voice-preview-1-bingtang|冰糖
voice-preview-2-moli|茉莉
voice-preview-3-suda|苏打
voice-preview-4-baihua|白桦
voice-preview-5-mia|Mia
voice-preview-6-chloe|Chloe
voice-preview-7-milo|Milo
voice-preview-8-dean|Dean
"

mkdir -p "$DEST"
while IFS='|' read -r src name; do
  [ -z "$src" ] && continue
  echo "下载 ${name} <- ${src}.wav"
  curl -sfL --retry 3 "${BASE_URL}/${src}.wav" -o "${DEST}/${name}.wav"
done <<< "$VOICE_LIST"

echo "完成：$(ls "$DEST" | wc -l | tr -d ' ') 个文件位于 $DEST"
