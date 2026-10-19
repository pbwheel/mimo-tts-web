#!/usr/bin/env bash
# 重新下载前端第三方依赖（wavesurfer.js 波形库）
# 来源：https://wavesurfer.xyz（npm: wavesurfer.js）
# 注意：核心库必须先于 hover 插件加载（index.html 中 script 顺序不可颠倒，
#       核心 UMD 会整体覆盖 window.WaveSurfer，先加载插件会被抹掉）
set -euo pipefail

VERSION="8.0.2"
BASE_URL="https://cdn.jsdelivr.net/npm/wavesurfer.js@${VERSION}/dist"
DEST="$(cd "$(dirname "$0")/.." && pwd)/static/vendor/wavesurfer"

mkdir -p "${DEST}"
curl -sfL --retry 3 "${BASE_URL}/wavesurfer.min.js" -o "${DEST}/wavesurfer.min.js"
curl -sfL --retry 3 "${BASE_URL}/plugins/hover.min.js" -o "${DEST}/hover.min.js"

echo "wavesurfer.js@${VERSION} -> ${DEST}"
