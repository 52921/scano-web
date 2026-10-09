import { Point, FilterType, CardPreset } from '../types';

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export function orderCorners(pts: Point[]): [Point, Point, Point, Point] {
  const sortedByY = [...pts].sort((a, b) => a.y - b.y);
  const topTwo = [sortedByY[0], sortedByY[1]].sort((a, b) => a.x - b.x);
  const bottomTwo = [sortedByY[2], sortedByY[3]].sort((a, b) => a.x - b.x);
  return [topTwo[0], topTwo[1], bottomTwo[1], bottomTwo[0]];
}

export function detectDocumentCorners(
  img: HTMLImageElement,
  fallbackMarginPercent = 0.08
): [Point, Point, Point, Point] {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const maxDim = 400;
  const scale = Math.min(maxDim / origW, maxDim / origH, 1);
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return getFallbackCorners(origW, origH, fallbackMarginPercent);

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const blurred = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      blurred[idx] =
        0.075 * gray[idx - w - 1] + 0.125 * gray[idx - w] + 0.075 * gray[idx - w + 1] +
        0.125 * gray[idx - 1] + 0.200 * gray[idx] + 0.125 * gray[idx + 1] +
        0.075 * gray[idx + w - 1] + 0.125 * gray[idx + w] + 0.075 * gray[idx + w + 1];
    }
  }

  const edges = new Float32Array(w * h);
  let maxEdge = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -1 * blurred[(y - 1) * w + (x - 1)] + 1 * blurred[(y - 1) * w + (x + 1)] +
        -2 * blurred[y * w + (x - 1)] + 2 * blurred[y * w + (x + 1)] +
        -1 * blurred[(y + 1) * w + (x - 1)] + 1 * blurred[(y + 1) * w + (x + 1)];

      const gy =
        -1 * blurred[(y - 1) * w + (x - 1)] - 2 * blurred[(y - 1) * w + x] - 1 * blurred[(y - 1) * w + (x + 1)] +
        1 * blurred[(y + 1) * w + (x - 1)] + 2 * blurred[(y + 1) * w + x] + 1 * blurred[(y + 1) * w + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * w + x] = mag;
      if (mag > maxEdge) maxEdge = mag;
    }
  }

  const edgeThreshold = Math.max(maxEdge * 0.22, 28);
  const binaryEdges = new Uint8Array(w * h);
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > edgeThreshold) binaryEdges[i] = 1;
  }

  const minXByY = new Int32Array(h).fill(-1);
  const maxXByY = new Int32Array(h).fill(-1);
  const minYByX = new Int32Array(w).fill(-1);
  const maxYByX = new Int32Array(w).fill(-1);

  const marginX = Math.floor(w * 0.03);
  const marginY = Math.floor(h * 0.03);

  for (let y = marginY; y < h - marginY; y++) {
    for (let x = marginX; x < w - marginX; x++) {
      if (binaryEdges[y * w + x]) {
        if (minXByY[y] === -1) minXByY[y] = x;
        maxXByY[y] = x;
      }
    }
  }

  for (let x = marginX; x < w - marginX; x++) {
    for (let y = marginY; y < h - marginY; y++) {
      if (binaryEdges[y * w + x]) {
        if (minYByX[x] === -1) minYByX[x] = y;
        maxYByX[x] = y;
      }
    }
  }

  const candidatePoints: Point[] = [];
  for (let y = marginY; y < h - marginY; y += 4) {
    if (minXByY[y] !== -1 && minXByY[y] < w * 0.45) candidatePoints.push({ x: minXByY[y], y });
    if (maxXByY[y] !== -1 && maxXByY[y] > w * 0.55) candidatePoints.push({ x: maxXByY[y], y });
  }
  for (let x = marginX; x < w - marginX; x += 4) {
    if (minYByX[x] !== -1 && minYByX[x] < h * 0.45) candidatePoints.push({ x, y: minYByX[x] });
    if (maxYByX[x] !== -1 && maxYByX[x] > h * 0.55) candidatePoints.push({ x, y: maxYByX[x] });
  }

  if (candidatePoints.length < 20) return getFallbackCorners(origW, origH, fallbackMarginPercent);

  let bestTL = candidatePoints[0], minSum = bestTL.x + bestTL.y;
  let bestBR = candidatePoints[0], maxSum = bestBR.x + bestBR.y;
  let bestTR = candidatePoints[0], maxDiff = bestTR.x - bestTR.y;
  let bestBL = candidatePoints[0], minDiff = bestBL.x - bestBL.y;

  for (const pt of candidatePoints) {
    const sum = pt.x + pt.y;
    const diff = pt.x - pt.y;
    if (sum < minSum) { minSum = sum; bestTL = pt; }
    if (sum > maxSum) { maxSum = sum; bestBR = pt; }
    if (diff > maxDiff) { maxDiff = diff; bestTR = pt; }
    if (diff < minDiff) { minDiff = diff; bestBL = pt; }
  }

  const detectedCorners: [Point, Point, Point, Point] = [
    { x: Math.max(0, Math.min(origW, bestTL.x / scale)), y: Math.max(0, Math.min(origH, bestTL.y / scale)) },
    { x: Math.max(0, Math.min(origW, bestTR.x / scale)), y: Math.max(0, Math.min(origH, bestTR.y / scale)) },
    { x: Math.max(0, Math.min(origW, bestBR.x / scale)), y: Math.max(0, Math.min(origH, bestBR.y / scale)) },
    { x: Math.max(0, Math.min(origW, bestBL.x / scale)), y: Math.max(0, Math.min(origH, bestBL.y / scale)) },
  ];

  const topW = distance(detectedCorners[0], detectedCorners[1]);
  const bottomW = distance(detectedCorners[3], detectedCorners[2]);
  const leftH = distance(detectedCorners[0], detectedCorners[3]);
  const rightH = distance(detectedCorners[1], detectedCorners[2]);
  const avgWidth = (topW + bottomW) / 2;
  const avgHeight = (leftH + rightH) / 2;

  if (avgWidth < origW * 0.25 || avgHeight < origH * 0.25) {
    return getFallbackCorners(origW, origH, fallbackMarginPercent);
  }

  return orderCorners(detectedCorners);
}

export function getFallbackCorners(w: number, h: number, margin = 0.08): [Point, Point, Point, Point] {
  const mx = w * margin, my = h * margin;
  return [
    { x: Math.round(mx), y: Math.round(my) },
    { x: Math.round(w - mx), y: Math.round(my) },
    { x: Math.round(w - mx), y: Math.round(h - my) },
    { x: Math.round(mx), y: Math.round(h - my) },
  ];
}

export function rectifyPerspective(
  img: HTMLImageElement,
  corners: [Point, Point, Point, Point],
  preset: CardPreset = 'custom'
): HTMLCanvasElement {
  const [p0, p1, p2, p3] = orderCorners(corners);
  const widthTop = distance(p0, p1);
  const widthBottom = distance(p3, p2);
  const heightLeft = distance(p0, p3);
  const heightRight = distance(p1, p2);

  let targetWidth = Math.round(Math.max(widthTop, widthBottom));
  let targetHeight = Math.round(Math.max(heightLeft, heightRight));
  const isLandscape = targetWidth >= targetHeight;

  if (preset === 'aadhaar' || preset === 'pan' || preset === 'voter') {
    const idRatio = 85.6 / 53.98;
    if (isLandscape) {
      targetWidth = Math.max(targetWidth, 900);
      targetHeight = Math.round(targetWidth / idRatio);
    } else {
      targetHeight = Math.max(targetHeight, 900);
      targetWidth = Math.round(targetHeight / idRatio);
    }
  } else if (preset === 'a4_doc') {
    const a4Ratio = 1.4142;
    if (isLandscape) {
      targetWidth = Math.max(targetWidth, 1200);
      targetHeight = Math.round(targetWidth / a4Ratio);
    } else {
      targetHeight = Math.max(targetHeight, 1400);
      targetWidth = Math.round(targetHeight / a4Ratio);
    }
  } else {
    const maxDimension = 2000;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const scale = maxDimension / Math.max(targetWidth, targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }
  }

  targetWidth = Math.max(200, targetWidth);
  targetHeight = Math.max(200, targetHeight);

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
  srcCtx.drawImage(img, 0, 0, srcW, srcH);
  const srcPixels = srcCtx.getImageData(0, 0, srcW, srcH).data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext('2d')!;
  const dstImgData = dstCtx.createImageData(targetWidth, targetHeight);
  const dstPixels = dstImgData.data;

  const x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a00: number, a01: number, a02: number;
  let a10: number, a11: number, a12: number;
  let a20: number, a21: number;

  if (Math.abs(dx3) < 1e-6 && Math.abs(dy3) < 1e-6) {
    a00 = x1 - x0; a01 = x3 - x0; a02 = x0;
    a10 = y1 - y0; a11 = y3 - y0; a12 = y0;
    a20 = 0; a21 = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    a20 = (dx3 * dy2 - dx2 * dy3) / (Math.abs(det) < 1e-6 ? 1e-6 : det);
    a21 = (dx1 * dy3 - dx3 * dy1) / (Math.abs(det) < 1e-6 ? 1e-6 : det);
    a00 = x1 - x0 + a20 * x1;
    a01 = x3 - x0 + a21 * x3;
    a02 = x0;
    a10 = y1 - y0 + a20 * y1;
    a11 = y3 - y0 + a21 * y3;
    a12 = y0;
  }

  const m00 = a00 / targetWidth, m01 = a01 / targetHeight, m02 = a02;
  const m10 = a10 / targetWidth, m11 = a11 / targetHeight, m12 = a12;
  const m20 = a20 / targetWidth, m21 = a21 / targetHeight, m22 = 1.0;

  let dstIdx = 0;
  for (let v = 0; v < targetHeight; v++) {
    const v_m01 = v * m01;
    const v_m11 = v * m11;
    const v_m21 = v * m21;

    for (let u = 0; u < targetWidth; u++) {
      const z = u * m20 + v_m21 + m22;
      const invZ = 1.0 / z;
      const sx = (u * m00 + v_m01 + m02) * invZ;
      const sy = (u * m10 + v_m11 + m12) * invZ;

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        const x0f = Math.floor(sx), y0f = Math.floor(sy);
        const x1f = x0f + 1, y1f = y0f + 1;
        const fx = sx - x0f, fy = sy - y0f;
        const f00 = (1 - fx) * (1 - fy), f10 = fx * (1 - fy), f01 = (1 - fx) * fy, f11 = fx * fy;
        const idx00 = (y0f * srcW + x0f) * 4;
        const idx10 = (y0f * srcW + x1f) * 4;
        const idx01 = (y1f * srcW + x0f) * 4;
        const idx11 = (y1f * srcW + x1f) * 4;

        dstPixels[dstIdx] = Math.round(f00 * srcPixels[idx00] + f10 * srcPixels[idx10] + f01 * srcPixels[idx01] + f11 * srcPixels[idx11]);
        dstPixels[dstIdx + 1] = Math.round(f00 * srcPixels[idx00 + 1] + f10 * srcPixels[idx10 + 1] + f01 * srcPixels[idx01 + 1] + f11 * srcPixels[idx11 + 1]);
        dstPixels[dstIdx + 2] = Math.round(f00 * srcPixels[idx00 + 2] + f10 * srcPixels[idx10 + 2] + f01 * srcPixels[idx01 + 2] + f11 * srcPixels[idx11 + 2]);
        dstPixels[dstIdx + 3] = 255;
      } else {
        dstPixels[dstIdx] = 255;
        dstPixels[dstIdx + 1] = 255;
        dstPixels[dstIdx + 2] = 255;
        dstPixels[dstIdx + 3] = 255;
      }
      dstIdx += 4;
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

export function applyImageFilters(
  inputCanvas: HTMLCanvasElement,
  filter: FilterType,
  brightness = 0,
  contrast = 0
): HTMLCanvasElement {
  const w = inputCanvas.width, h = inputCanvas.height;
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = w; outputCanvas.height = h;
  const ctx = outputCanvas.getContext('2d')!;
  ctx.drawImage(inputCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const cFactor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
  const bAdd = brightness * 2.55;

  if (filter === 'original') {
    if (brightness !== 0 || contrast !== 0) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, cFactor * (data[i] - 128) + 128 + bAdd));
        data[i + 1] = Math.max(0, Math.min(255, cFactor * (data[i + 1] - 128) + 128 + bAdd));
        data[i + 2] = Math.max(0, Math.min(255, cFactor * (data[i + 2] - 128) + 128 + bAdd));
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return outputCanvas;
  }

  if (filter === 'magic_color') {
    let minLum = 255, maxLum = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    const lumFactor = 255 / Math.max(maxLum - minLum, 40);

    for (let i = 0; i < data.length; i += 4) {
      let r = (data[i] - minLum * 0.7) * lumFactor;
      let g = (data[i + 1] - minLum * 0.7) * lumFactor;
      let b = (data[i + 2] - minLum * 0.7) * lumFactor;
      r = Math.pow(Math.max(0, Math.min(255, r)) / 255, 0.9) * 255;
      g = Math.pow(Math.max(0, Math.min(255, g)) / 255, 0.9) * 255;
      b = Math.pow(Math.max(0, Math.min(255, b)) / 255, 0.9) * 255;
      data[i] = Math.max(0, Math.min(255, cFactor * (r - 128) + 128 + bAdd));
      data[i + 1] = Math.max(0, Math.min(255, cFactor * (g - 128) + 128 + bAdd));
      data[i + 2] = Math.max(0, Math.min(255, cFactor * (b - 128) + 128 + bAdd));
    }
    ctx.putImageData(imgData, 0, 0);
    return outputCanvas;
  }

  if (filter === 'bw_photocopy') {
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let val = lum > 140 ? 210 + (lum - 140) * (45 / 115) : lum * 0.75;
      if (val > 250) val = 255;
      val = Math.max(0, Math.min(255, cFactor * (val - 128) + 128 + bAdd));
      data[i] = val; data[i + 1] = val; data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return outputCanvas;
  }

  if (filter === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      lum = Math.max(0, Math.min(255, cFactor * (lum - 128) + 128 + bAdd));
      data[i] = lum; data[i + 1] = lum; data[i + 2] = lum;
    }
    ctx.putImageData(imgData, 0, 0);
    return outputCanvas;
  }

  if (filter === 'brighten') {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, cFactor * (Math.pow(data[i] / 255, 0.75) * 255 - 128) + 128 + bAdd + 15));
      data[i + 1] = Math.max(0, Math.min(255, cFactor * (Math.pow(data[i + 1] / 255, 0.75) * 255 - 128) + 128 + bAdd + 15));
      data[i + 2] = Math.max(0, Math.min(255, cFactor * (Math.pow(data[i + 2] / 255, 0.75) * 255 - 128) + 128 + bAdd + 15));
    }
    ctx.putImageData(imgData, 0, 0);
    return outputCanvas;
  }

  return outputCanvas;
}

export function rotateCanvas(inputCanvas: HTMLCanvasElement, angleDegrees: number): HTMLCanvasElement {
  const normAngle = ((angleDegrees % 360) + 360) % 360;
  if (normAngle === 0) return inputCanvas;
  const w = inputCanvas.width, h = inputCanvas.height;
  const outCanvas = document.createElement('canvas');
  if (normAngle === 90 || normAngle === 270) {
    outCanvas.width = h; outCanvas.height = w;
  } else {
    outCanvas.width = w; outCanvas.height = h;
  }
  const ctx = outCanvas.getContext('2d')!;
  ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
  ctx.rotate((normAngle * Math.PI) / 180);
  ctx.drawImage(inputCanvas, -w / 2, -h / 2);
  return outCanvas;
}
