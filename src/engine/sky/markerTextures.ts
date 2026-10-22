import * as THREE from 'three';

function createCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  return [canvas, context];
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSunMarkerTexture(): THREE.Texture {
  const [canvas, context] = createCanvas();
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 126);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,246,200,1)');
  gradient.addColorStop(0.28, 'rgba(255,206,90,0.98)');
  gradient.addColorStop(0.55, 'rgba(255,150,40,0.32)');
  gradient.addColorStop(1, 'rgba(255,120,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return finish(canvas);
}

export function createMoonMarkerTexture(): THREE.Texture {
  const [canvas, context] = createCanvas();
  context.clearRect(0, 0, 256, 256);
  const glow = context.createRadialGradient(128, 128, 30, 128, 128, 118);
  glow.addColorStop(0, 'rgba(225,229,240,0.18)');
  glow.addColorStop(0.7, 'rgba(200,208,228,0.07)');
  glow.addColorStop(1, 'rgba(200,208,228,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);

  const disc = context.createRadialGradient(104, 102, 6, 128, 128, 80);
  disc.addColorStop(0, '#f3f4f7');
  disc.addColorStop(0.55, '#cdd2dc');
  disc.addColorStop(0.9, '#8d939f');
  disc.addColorStop(1, '#6f7580');
  context.beginPath();
  context.arc(128, 128, 77, 0, Math.PI * 2);
  context.fillStyle = disc;
  context.fill();

  const craters: Array<[number, number, number]> = [
    [100, 100, 12],
    [148, 90, 8],
    [160, 146, 15],
    [108, 158, 10],
    [132, 128, 7],
    [84, 132, 6],
  ];
  context.fillStyle = 'rgba(90,96,108,0.32)';
  for (const [x, y, radius] of craters) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  return finish(canvas);
}

export function createMarsMarkerTexture(): THREE.Texture {
  const [canvas, context] = createCanvas();
  const glow = context.createRadialGradient(128, 128, 40, 128, 128, 124);
  glow.addColorStop(0, 'rgba(237,120,78,0.2)');
  glow.addColorStop(1, 'rgba(237,120,78,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);

  const disc = context.createRadialGradient(108, 104, 8, 128, 128, 72);
  disc.addColorStop(0, '#f09a74');
  disc.addColorStop(0.6, '#c65d3c');
  disc.addColorStop(1, '#7c3222');
  context.beginPath();
  context.arc(128, 128, 66, 0, Math.PI * 2);
  context.fillStyle = disc;
  context.fill();
  return finish(canvas);
}

export function createStarMarkerTexture(): THREE.Texture {
  const [canvas, context] = createCanvas(128);
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(230,240,255,0.95)');
  gradient.addColorStop(0.55, 'rgba(180,205,255,0.22)');
  gradient.addColorStop(1, 'rgba(160,190,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return finish(canvas);
}
