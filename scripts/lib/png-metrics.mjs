import { inflateSync } from "node:zlib";
export function decodePNG(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Screenshot is not PNG');
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0)
        throw new Error(`Unsupported screenshot PNG: bit depth ${data[8]}, color type ${data[9]}, interlace ${data[12]}`);
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  if (!width || !height || !channels) throw new Error('Missing PNG dimensions');
  const packed = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let source = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[source++];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const up = y ? pixels[index - stride] : 0;
      const upperLeft = y && x >= channels ? pixels[index - stride - channels] : 0;
      const predictors = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)];
      if (filter > 4) throw new Error(`Invalid PNG filter ${filter}`);
      pixels[index] = (packed[source++] + predictors[filter]) & 255;
    }
  }
  return { width, height, channels, pixels };
}

export function samplePNG(buffer) {
  const { width, height, channels, pixels } = decodePNG(buffer);
  const sample = [];
  let sum = 0, sumSquares = 0;
  const colors = new Set();
  for (let gy = 0; gy < 72; gy++) {
    const y = Math.min(height - 1, Math.floor((gy + 0.5) * height / 72));
    for (let gx = 0; gx < 96; gx++) {
      const x = Math.min(width - 1, Math.floor((gx + 0.5) * width / 96));
      const index = (y * width + x) * channels;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      sample.push(r, g, b);
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
      sum += luminance; sumSquares += luminance ** 2;
      colors.add(`${r >> 3},${g >> 3},${b >> 3}`);
    }
  }
  const count = sample.length / 3;
  return { width, height, sample, mean: sum / count,
    variance: Math.max(0, sumSquares / count - (sum / count) ** 2), quantizedColors: colors.size };
}

export function difference(a, b, pixelThreshold = 15) {
  if (a.length !== b.length) return { meanAbsolute: Infinity, changedFraction: 1 };
  let sum = 0, changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    sum += delta;
    if (delta > pixelThreshold) changed++;
  }
  return { meanAbsolute: sum / a.length, changedFraction: changed / (a.length / 3) };
}
