#!/usr/bin/env node
/**
 * Script para generar iconos desde build/icon.svg
 * Requiere: npm install -g sharp-cli o usar Inkscape/ImageMagick
 *
 * Con ImageMagick (Windows/Mac/Linux):
 *   magick build/icon.svg -resize 256x256 build/icon.png
 *   magick build/icon.png build/icon.ico
 *
 * Con sharp-cli:
 *   sharp -i build/icon.svg -o build/icon.png resize 256
 *
 * Para Mac .icns:
 *   npm install -g png2icons
 *   png2icons build/icon.png build/icon -icns
 *
 * Para desarrollo rápido, electron-builder puede usar icon.png directamente.
 * Renombrar icon.svg a icon.png como fallback:
 */

const fs = require('fs')
const path = require('path')

// Copia el SVG con extensión .png como fallback temporal
const src = path.join(__dirname, 'icon.svg')
const dst = path.join(__dirname, 'icon.png')
if (!fs.existsSync(dst)) {
  fs.copyFileSync(src, dst)
  console.log('Created icon.png (SVG copy — replace with real PNG for production)')
}
console.log('Run: magick build/icon.svg -resize 256x256 build/icon.png')
console.log('Then: magick build/icon.png build/icon.ico')
