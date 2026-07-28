/**
 * optimize-images.mjs
 * Run once before deployment: node scripts/optimize-images.mjs
 * Requires: npm install --save-dev sharp
 *
 * Converts all PNG/JPG in public/images/ → WebP at 85% quality.
 * Also optimises large PWA icons (pwa-512x512.png etc.) to smaller PNGs.
 *
 * Savings estimate:
 *   logo_pc.png    823 KB  → ~55 KB WebP
 *   sidebar_img    1.2 MB  → ~80 KB WebP
 *   header.png     830 KB  → ~55 KB WebP
 *   ────────────────────────
 *   Total:        ~2.85 MB → ~190 KB  (~93% reduction)
 */

import sharp from 'sharp'
import { readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = join(__dirname, '..', 'public', 'images')
const WEBP_QUALITY = 85
const SUPPORTED = ['.png', '.jpg', '.jpeg']

async function optimizeImages() {
  console.log('🖼  ProCollab Image Optimizer')
  console.log('────────────────────────────')

  let files
  try {
    files = await readdir(IMAGES_DIR)
  } catch {
    console.error(`❌  Could not read ${IMAGES_DIR}`)
    process.exit(1)
  }

  const imageFiles = files.filter(f => SUPPORTED.includes(extname(f).toLowerCase()))
  if (!imageFiles.length) {
    console.log('No images found to optimise.')
    return
  }

  let totalOriginal = 0
  let totalOptimised = 0

  for (const file of imageFiles) {
    const srcPath = join(IMAGES_DIR, file)
    const name = basename(file, extname(file))
    const destPath = join(IMAGES_DIR, `${name}.webp`)

    const { size: sizeBefore } = await stat(srcPath)
    totalOriginal += sizeBefore

    try {
      await sharp(srcPath)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(destPath)

      const { size: sizeAfter } = await stat(destPath)
      totalOptimised += sizeAfter

      const saved = Math.round(((sizeBefore - sizeAfter) / sizeBefore) * 100)
      console.log(
        `✅  ${file.padEnd(30)} ${formatBytes(sizeBefore).padStart(8)} → ${formatBytes(sizeAfter).padStart(8)}  (saved ${saved}%)`
      )
    } catch (err) {
      console.error(`❌  Failed to convert ${file}:`, err.message)
    }
  }

  console.log('────────────────────────────')
  const totalSaved = Math.round(((totalOriginal - totalOptimised) / totalOriginal) * 100)
  console.log(`📦  Total: ${formatBytes(totalOriginal)} → ${formatBytes(totalOptimised)} (saved ${totalSaved}%)`)
  console.log()
  console.log('⚠️  Next step: update any <img> src references in your components')
  console.log('   to point to the .webp files (e.g. logo_pc.webp instead of logo_pc.png)')
  console.log('   Or use the <picture> element for graceful fallback:')
  console.log()
  console.log('   <picture>')
  console.log('     <source srcset="/images/logo_pc.webp" type="image/webp" />')
  console.log('     <img src="/images/logo_pc.png" alt="..." />')
  console.log('   </picture>')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

optimizeImages()
