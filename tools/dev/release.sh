#!/bin/bash
# Kullanım: rel.sh 1.22.0 "Başlık" "Notlar (satır satır)" "README eklentisi" ÖNCEKİ_ETİKET
set -e
cd /c/Users/dkara/turbo-tayfa
VER="$1"; TITLE="$2"; NOTES="$3"; README_ADD="$4"; PREV="$5"
PREV_SHA=$(git rev-parse --short "$PREV")
python - "$VER" "$README_ADD" <<'EOF'
import sys, re
ver, add = sys.argv[1], sys.argv[2]
p = 'package.json'
s = open(p, encoding='utf-8').read()
s = re.sub(r'"version": "[^"]+"', '"version": "%s"' % ver, s, 1)
open(p, 'w', encoding='utf-8', newline='').write(s)
if add:
    p = 'README.md'
    s = open(p, encoding='utf-8').read()
    key = '- ⛰️ **Eğim fiziği (tüm pistler):**'
    i = s.index(key)
    j = s.index('\n', i)
    s = s[:j] + ' ' + add + s[j:]
    open(p, 'w', encoding='utf-8', newline='').write(s)
EOF
npx vite build 2>&1 | tail -1
git add -A
git commit -q -m "v$VER: $TITLE

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git tag "v$VER"
GH_PUSH=(-c credential.helper= -c "credential.helper=!gh auth git-credential")
timeout 120 git "${GH_PUSH[@]}" push origin main 2>&1 | tail -1
timeout 120 git "${GH_PUSH[@]}" push origin "v$VER" 2>&1 | tail -1
printf '%s\n\n- Geri dönüş: %s (%s)\n' "$NOTES" "$PREV" "$PREV_SHA" > /tmp/relnotes.md
gh release create "v$VER" --title "v$VER — $TITLE" --notes-file /tmp/relnotes.md 2>&1 | tail -1
timeout 60 git "${GH_PUSH[@]}" ls-remote origin "refs/tags/v$VER" | cut -c1-12
# Cloudflare'e de yayınla (derleme yukarıda yapıldı). Hata olursa sürüm yine de çıkmış sayılır, Render etkilenmez.
timeout 240 npx --yes wrangler deploy 2>&1 | grep -E "https://|Uploaded|ERROR|rror" | head -4 || echo "Cloudflare yayını başarısız (npx wrangler login gerekebilir)"
