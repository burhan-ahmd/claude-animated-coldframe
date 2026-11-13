#!/usr/bin/env bash
# One-time setup for the cartoon 3D shorts skill (macOS / Linux). Run from this folder: bash setup.sh
set -e
here="$(cd "$(dirname "$0")" && pwd)"

bad=0
need() { if command -v "$1" >/dev/null 2>&1; then echo "ok  $1"; else echo "MISSING: $1  ->  $2"; bad=1; fi; }
need node    "install Node.js LTS from nodejs.org (or: brew install node)"
need python3 "install Python 3 (or: brew install python)"
need ffmpeg  "brew install ffmpeg  /  sudo apt install ffmpeg"
[ "$bad" = 1 ] && { echo "Install the missing tools, then run setup.sh again."; exit 1; }

echo; echo "1/4  Python packages (numpy, scipy) for the sound"
python3 -m pip install --quiet --user numpy scipy || python3 -m pip install --quiet --user --break-system-packages numpy scipy

echo; echo "2/4  npm packages (Remotion, three.js)"
cd "$here/studio" && npm install --no-audit --no-fund

echo; echo "3/4  Free Kenney 3D models (CC0)"
node scripts/get-models.mjs

echo; echo "4/4  Render temp folder"
tmp="${REMOTION_TMP:-$HOME/remotion-tmp}"
mkdir -p "$tmp"
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  [ -f "$rc" ] && ! grep -q REMOTION_TMP "$rc" && echo "export REMOTION_TMP=\"$tmp\"" >> "$rc"
done
echo "REMOTION_TMP = $tmp  (move it to a big drive if this one has less than 20 GB free)"

mkdir -p "$HOME/.claude/skills"
[ -e "$HOME/.claude/skills/cartoon-3d-short" ] || { ln -s "$here" "$HOME/.claude/skills/cartoon-3d-short"; echo "Skill linked into ~/.claude/skills"; }

echo; echo "Done. Open Claude Code in this folder and say:"
echo "  Use the cartoon short skill and make a short about ..."
