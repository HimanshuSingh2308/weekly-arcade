/**
 * Generate og-image.png for Weekly Arcade
 * Run: node scripts/generate-og-image.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Dimensions for Open Graph image
const WIDTH = 1200;
const HEIGHT = 630;

// Colors
const colors = {
  bgPrimary: '#0f0f1a',
  bgSecondary: '#1a1a2e',
  bgCard: '#16213e',
  accent: '#e94560',
  accentLight: '#ff6b6b',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  border: '#2a2a4a'
};

// Create canvas
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Background gradient
const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bgGradient.addColorStop(0, colors.bgPrimary);
bgGradient.addColorStop(1, colors.bgSecondary);
ctx.fillStyle = bgGradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Decorative circles
ctx.strokeStyle = 'rgba(233, 69, 96, 0.1)';
ctx.lineWidth = 2;

ctx.beginPath();
ctx.arc(100, 100, 200, 0, Math.PI * 2);
ctx.stroke();

ctx.beginPath();
ctx.arc(1100, 530, 250, 0, Math.PI * 2);
ctx.stroke();

// Grid lines (decorative)
ctx.strokeStyle = 'rgba(233, 69, 96, 0.05)';
ctx.lineWidth = 1;

ctx.beginPath();
ctx.moveTo(0, 0);
ctx.lineTo(WIDTH, HEIGHT);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(WIDTH, 0);
ctx.lineTo(0, HEIGHT);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(WIDTH / 2, 0);
ctx.lineTo(WIDTH / 2, HEIGHT);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(0, HEIGHT / 2);
ctx.lineTo(WIDTH, HEIGHT / 2);
ctx.stroke();

// Game controller emoji placeholder (using text)
ctx.font = 'bold 100px Arial';
ctx.fillStyle = colors.accent;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('🎮', WIDTH / 2, 180);

// Title with gradient effect
ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const titleGradient = ctx.createLinearGradient(300, 0, 900, 0);
titleGradient.addColorStop(0, colors.accent);
titleGradient.addColorStop(1, colors.accentLight);
ctx.fillStyle = titleGradient;
ctx.fillText('Weekly Arcade', WIDTH / 2, 300);

// Tagline
ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ctx.fillStyle = colors.textPrimary;
ctx.fillText('New Free Browser Games Every Week', WIDTH / 2, 370);

// Subtitle
ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ctx.fillStyle = colors.textSecondary;
ctx.fillText('No downloads required • Play instantly', WIDTH / 2, 420);

// Game badges
const badges = [
  { text: '🔤 Wordle', accent: false },
  { text: '🐍 Snake', accent: false },
  { text: '🔢 2048', accent: false },
  { text: '+ More', accent: true }
];

const badgeWidth = 140;
const badgeHeight = 50;
const badgeGap = 20;
const totalBadgesWidth = badges.length * badgeWidth + (badges.length - 1) * badgeGap;
let badgeX = (WIDTH - totalBadgesWidth) / 2;
const badgeY = 500;

badges.forEach(badge => {
  // Badge background
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 25);

  if (badge.accent) {
    const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY);
    badgeGradient.addColorStop(0, colors.accent);
    badgeGradient.addColorStop(1, '#c73e54');
    ctx.fillStyle = badgeGradient;
  } else {
    ctx.fillStyle = colors.bgCard;
  }
  ctx.fill();

  // Badge border
  ctx.strokeStyle = badge.accent ? colors.accent : colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Badge text
  ctx.font = badge.accent ? 'bold 20px Arial' : '20px Arial';
  ctx.fillStyle = colors.textPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge.text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

  badgeX += badgeWidth + badgeGap;
});

// Bottom accent bar
const accentGradient = ctx.createLinearGradient(0, HEIGHT - 8, WIDTH, HEIGHT - 8);
accentGradient.addColorStop(0, colors.accent);
accentGradient.addColorStop(1, colors.accentLight);
ctx.fillStyle = accentGradient;
ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);

// Save the image
const outputPath = path.join(__dirname, '..', 'apps', 'web', 'src', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ og-image.png generated successfully!`);
console.log(`📁 Saved to: ${outputPath}`);
console.log(`📐 Dimensions: ${WIDTH}x${HEIGHT}px`);
