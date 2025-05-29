const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function convertIcon() {
    const sizes = [16, 48, 128];
    for (const size of sizes) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const img = await loadImage('icon.svg');
        ctx.drawImage(img, 0, 0, size, size);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`icon${size}.png`, buffer);
    }
}

convertIcon().catch(console.error); 