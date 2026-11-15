#!/usr/bin/env bash
set -e

ZIP_FILE="${1:-technicol-web-optimized-portfolio.zip}"

echo "=========================================================="
echo " TechNicol Productions LLC — Portfolio Deployment Script"
echo "=========================================================="

if [ ! -f "$ZIP_FILE" ]; then
  echo "❌ Error: Cannot find '$ZIP_FILE' in the current directory."
  echo "Please place $ZIP_FILE in $(pwd) and try again."
  exit 1
fi

# 1. Protect your newly edited index.html from being overwritten by the zip
if [ -f "index.html" ]; then
  echo "🔒 Backing up your updated index.html..."
  cp -f index.html index.html.updated.bak
fi

# 2. Extract the web-optimized portfolio zip
echo "📦 Extracting $ZIP_FILE..."
unzip -o "$ZIP_FILE"

# 3. Restore your updated index.html with the Page 4 biography edits
if [ -f "index.html.updated.bak" ]; then
  echo "✅ Restoring your updated index.html..."
  mv -f index.html.updated.bak index.html
fi

# 4. Move any root MP4 files into their proper asset directories
mkdir -p assets/videos/op-ed
for vid in op-ed-*.mp4; do
  if [ -f "$vid" ]; then
    echo "🎬 Moving $vid -> assets/videos/op-ed/"
    mv -f "$vid" assets/videos/op-ed/
  fi
done

if [ -f "TP LLC 3D Video Logo.mp4" ]; then
  mkdir -p assets/videos
  echo "🎬 Moving TP LLC 3D Video Logo.mp4 -> assets/videos/"
  mv -f "TP LLC 3D Video Logo.mp4" assets/videos/
fi

# 5. Stage, commit, and push to GitHub
echo "🚀 Staging all portfolio assets and updated index.html..."
git add index.html assets/

echo "📝 Committing changes..."
git commit -m "Deploy 7-page TechNicol portfolio, 408 WebP photos, and updated Page 4 biography" || echo "ℹ️ No new changes to commit."

echo "🌐 Pushing to GitHub (origin main)..."
git push origin main

echo "=========================================================="
echo " 🎉 DEPLOYMENT COMPLETE! Netlify/GitHub Pages will update"
echo "    shortly with your live 7-page portfolio."
echo "=========================================================="