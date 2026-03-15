/**
 * Genera icon-192.png e icon-512.png en public/icons/ para la PWA.
 * Ejecutar: node scripts/generate-icons.js
 * Requiere: npm install sharp --save-dev
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public', 'icons')

const color = '#0d9488' // theme teal

async function createPng(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${color}"/>
      <text x="50%" y="50%" font-family="Arial,sans-serif" font-size="${size * 0.2}" font-weight="bold" fill="white" text-anchor="middle" dy=".35em">TLN</text>
    </svg>
  `
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const size of [192, 512]) {
    const buf = await createPng(size)
    const file = path.join(outDir, `icon-${size}.png`)
    await writeFile(file, buf)
    console.log('Written', file)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
