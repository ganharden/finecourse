const fs = require('fs');
const { createCanvas } = require('canvas');

// 创建渐变背景图标
function createIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1e3a5f');
  gradient.addColorStop(1, '#667eea');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // 圆角矩形
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.roundRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7, radius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  
  // 书本图标简化版
  ctx.fillStyle = '#fff';
  const bookW = size * 0.35;
  const bookH = size * 0.4;
  const bookX = (size - bookW) / 2;
  const bookY = (size - bookH) / 2;
  
  // 书本封面
  ctx.fillRect(bookX, bookY, bookW, bookH);
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(bookX + bookW * 0.1, bookY + bookH * 0.1, bookW * 0.8, bookH * 0.8);
  
  // 文字线条
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(bookX + bookW * 0.2, bookY + bookH * (0.25 + i * 0.15), bookW * 0.6, bookH * 0.08);
  }
  
  fs.writeFileSync(filename, canvas.toBuffer('image/png'));
  console.log(`Generated ${filename}`);
}

createIcon(192, 'icon-192.png');
createIcon(512, 'icon-512.png');
console.log('Icons generated successfully!');
