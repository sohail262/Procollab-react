/**
 * download-earth-textures.mjs
 * Downloads NASA Earth map textures locally to public/images/
 * so they are served directly from the app domain without third-party network overhead.
 */
import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imagesDir = path.join(__dirname, '..', 'public', 'images')

const textures = [
  { url: 'https://unpkg.com/three-globe/example/img/earth-night.jpg', filename: 'earth-night.jpg' },
  { url: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', filename: 'earth-blue-marble.jpg' }
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = new URL(response.headers.location, url).toString()
        file.close()
        return downloadFile(redirectUrl, dest).then(resolve).catch(reject)
      }
      if (response.statusCode !== 200) {
        file.close()
        return reject(new Error(`HTTP ${response.statusCode}`))
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function run() {
  console.log('🌍 Downloading Earth textures locally...')
  for (const tex of textures) {
    const dest = path.join(imagesDir, tex.filename)
    try {
      await downloadFile(tex.url, dest)
      console.log(`✅ Saved ${tex.filename} to public/images/`)
    } catch (err) {
      console.error(`❌ Failed to download ${tex.filename}:`, err.message)
    }
  }
}

run()
