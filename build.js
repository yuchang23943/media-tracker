// 简单构建脚本：把静态文件复制到 dist/
// Cloudflare Pages 需要明确的输出目录，纯静态站也需要这个
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// 清空旧的 dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 需要复制的文件/目录
const toCopy = [
  'index.html',
  'manifest.json',
  'icon.svg',
  'sw.js',
  'functions',  // Cloudflare Pages Functions 自动识别
];

function copyItem(name) {
  const src = path.join(__dirname, name);
  const dest = path.join(distDir, name);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  [DIR] ${name}/`);
  } else {
    fs.copyFileSync(src, dest);
    console.log(`  [FILE] ${name}`);
  }
}

console.log('Building dist...');
toCopy.forEach(copyItem);
console.log('Build complete. Output: dist/');
