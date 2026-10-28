// Studio Portrait Standardizer — Motor de Visão Computacional e Padronização de Retratos (O CORTE)
//
// Pipeline Profissional de Padronização de Imagem:
// 1. Eliminação Total de Halos/Artefatos de Fundo:
//    - NUNCA cria silhuetas ovais, manchas marrons ou círculos de desfoque atrás da cabeça.
//    - Recorte preciso com máscara alfa suave nos fios e contorno craniano/corporal, aplicando
//      exclusivamente o gradiente radial contínuo de estúdio (#2B3342 -> #121620) em todo o fundo.
// 2. Descontaminação de Cor nas Bordas (Optical Defringe / Color Decontamination):
//    - Neutraliza reflexos de iluminação ambiente extrema (LED verde neon, ciano, vermelho) de forma
//      puramente cromática (sem máscaras ovais espaciais) e executa puxada de cor interna (inward color pull)
//      nos contornos de cabelos, óculos, orelhas e braços antes de compor com o fundo escuro.
// 3. Restrição Estrita de Inpainting de Roupa:
//    - A substituição da camiseta (Preta fosca ou Branca pura de estúdio) atua estritamente na região
//      do tronco/ombros, preservando integralmente cabeça, barba, mãos, relógio e objetos segurados
//      (ex: pote de pomada) sem gerar sombras residuais no ar.

export function getBarberStudioStandardizationPrompt(shirtColor = 'black') {
  const colorLabel =
    shirtColor === 'white'
      ? 'camiseta ou polo lisa branca de algodão premium (crisp studio white)'
      : 'camiseta ou polo lisa preta fosca de algodão premium (matte studio black)';

  return [
    'Padronização Institucional de Retrato de Barbeiro — O CORTE:',
    '1. Eliminação de Halo/Artefato de Fundo: NUNCA criar silhuetas, manchas marrons, halos ou círculos de desfoque opacos atrás da cabeça. O recorte deve usar máscara alfa precisa e o fundo deve ser exclusivamente o gradiente radial contínuo (#2B3342 -> #121620).',
    '2. Descontaminação de Cor nas Bordas (Defringe): Neutralizar qualquer reflexo de iluminação LED neon (verde, azul, vermelho) nos contornos do cabelo, óculos, orelhas e braços antes de compor com o fundo escuro.',
    `3. Restrição de Inpainting de Roupa: Substituir apenas a vestimenta na região delimitada pelo tronco/ombros por uma ${colorLabel}, preservando estritamente a cabeça, feições reais, barba, mãos e objetos segurados sem gerar sombras residuais no ar.`,
  ].join('\n');
}

export function buildProfessionalBioTemplates(name, specialty) {
  const cleanName = String(name || '').trim() || 'Profissional';
  const cleanSpec = String(specialty || '').trim() || 'cortes clássicos e modernos';

  const bio_short =
    `${cleanName} — Especialista em ${cleanSpec}, com atendimento personalizado e acabamento de precisão.`.slice(
      0,
      150
    );
  const bio_medium =
    `${cleanName} é especialista em ${cleanSpec}. Focado em excelência técnica, visagismo prático e experiência confortável em cada atendimento.`.slice(
      0,
      300
    );
  const bio_full =
    `${cleanName} atua com foco em ${cleanSpec}, unindo técnica apurada, atenção aos detalhes e atendimento de alto padrão. Cada serviço é realizado de forma personalizada para valorizar o estilo de cada cliente com pontualidade e qualidade.`.slice(
      0,
      600
    );

  return {
    bio: bio_full,
    bio_short,
    bio_medium,
    bio_full,
  };
}

export function syncBioTextWithNameAndSpecialty(text, newName, newSpecialty, oldName = '') {
  const raw = String(text || '');
  const cleanName = String(newName || '').trim();
  const cleanSpec = String(newSpecialty || '').trim() || 'cortes clássicos e modernos';

  if (!raw.trim()) {
    return '';
  }
  if (!cleanName) {
    return raw;
  }

  const fullTemplateRegex = /^.+?\s+atua com foco em\s+([^,]+),\s*unindo técnica apurada/i;
  if (fullTemplateRegex.test(raw)) {
    const targetSpec =
      String(newSpecialty || '').trim() || raw.match(fullTemplateRegex)?.[1]?.trim() || cleanSpec;
    return `${cleanName} atua com foco em ${targetSpec}, unindo técnica apurada, atenção aos detalhes e atendimento de alto padrão. Cada serviço é realizado de forma personalizada para valorizar o estilo de cada cliente com pontualidade e qualidade.`.slice(
      0,
      600
    );
  }

  const shortTemplateRegex =
    /^.+?\s+[—-]\s+Especialista em\s+([^,]+),\s*com atendimento personalizado/i;
  if (shortTemplateRegex.test(raw)) {
    const targetSpec =
      String(newSpecialty || '').trim() || raw.match(shortTemplateRegex)?.[1]?.trim() || cleanSpec;
    return `${cleanName} — Especialista em ${targetSpec}, com atendimento personalizado e acabamento de precisão.`.slice(
      0,
      150
    );
  }

  const mediumTemplateRegex =
    /^.+?\s+é especialista em\s+([^.]+)\.\s*Focado em excelência técnica/i;
  if (mediumTemplateRegex.test(raw)) {
    const targetSpec =
      String(newSpecialty || '').trim() || raw.match(mediumTemplateRegex)?.[1]?.trim() || cleanSpec;
    return `${cleanName} é especialista em ${targetSpec}. Focado em excelência técnica, visagismo prático e experiência confortável em cada atendimento.`.slice(
      0,
      300
    );
  }

  const prevName = String(oldName || '').trim();
  if (prevName && raw.toLowerCase().startsWith(prevName.toLowerCase())) {
    return cleanName + raw.slice(prevName.length);
  }

  return raw;
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function blurFloatMap(map, width, height, radius) {
  if (radius <= 0) return map;
  const temp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  const winSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const x = Math.max(0, Math.min(width - 1, k));
      sum += map[rowOffset + x];
    }
    for (let x = 0; x < width; x++) {
      temp[rowOffset + x] = sum / winSize;
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      sum += map[rowOffset + addX] - map[rowOffset + removeX];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const y = Math.max(0, Math.min(height - 1, k));
      sum += temp[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / winSize;
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      sum += temp[addY * width + x] - temp[removeY * width + x];
    }
  }

  return out;
}

function rgbToCbCr(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [cb, cr];
}

// Gradiente radial contínuo de estúdio (#2B3342 -> #121620) sem manchas intermediárias
function getStudioBackdropRGB(nx, ny, x, y) {
  const dx = (nx - 0.48) / 0.68;
  const dy = (ny - 0.38) / 0.68;
  const distSq = Math.min(1.25, dx * dx + dy * dy);
  const falloff = smoothstep(0.0, 1.2, distSq);

  const dither = (((x * 73 + y * 151) & 3) - 1.5) * 0.35;
  const r = 43 * (1 - falloff) + 18 * falloff + dither;
  const g = 51 * (1 - falloff) + 22 * falloff + dither;
  const b = 66 * (1 - falloff) + 32 * falloff + dither;
  return [clampByte(r), clampByte(g), clampByte(b)];
}

export async function standardizeBarberPhotoCanvas(sourceDataUrl, shirtColor = 'black') {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return sourceDataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para padronização.'));
    img.onload = () => {
      try {
        const size = 768;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        const srcW = img.width || size;
        const srcH = img.height || size;
        const minDim = Math.min(srcW, srcH);
        const sx = (srcW - minDim) / 2;
        const sy = (srcH - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        const totalPixels = size * size;

        const origR = new Uint8Array(totalPixels);
        const origG = new Uint8Array(totalPixels);
        const origB = new Uint8Array(totalPixels);
        const origLum = new Float32Array(totalPixels);
        const maxRBMap = new Float32Array(totalPixels);

        for (let p = 0; p < totalPixels; p++) {
          const idx = p * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          origR[p] = r;
          origG[p] = g;
          origB[p] = b;
          origLum[p] = 0.299 * r + 0.587 * g + 0.114 * b;
          maxRBMap[p] = Math.max(r, b);
        }

        // ─────────────────────────────────────────────────────────────────────
        // 1. DETECÇÃO DA COR DA CAMISA ORIGINAL
        // ─────────────────────────────────────────────────────────────────────
        let darkTorsoCount = 0;
        let totalTorsoSamples = 0;

        for (let y = Math.floor(size * 0.68); y < Math.floor(size * 0.95); y += 2) {
          for (let x = Math.floor(size * 0.14); x < Math.floor(size * 0.86); x += 2) {
            const p = y * size + x;
            totalTorsoSamples++;
            if (maxRBMap[p] < 44 && origLum[p] < 55) {
              darkTorsoCount++;
            }
          }
        }

        const isOriginalShirtBlack =
          totalTorsoSamples > 0 && darkTorsoCount / totalTorsoSamples > 0.42;

        // Se a camisa original já é preta e a opção selecionada é Preta, mantém a foto intacta
        if (shirtColor === 'black' && isOriginalShirtBlack) {
          resolve(sourceDataUrl);
          return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. CALIBRAÇÃO DA PELE DO ROSTO E DESCONTAMINAÇÃO CROMÁTICA GLOBAL
        //    (100% Livre de Máscaras Ovais Espaciais — Nunca cria manchas no fundo)
        // ─────────────────────────────────────────────────────────────────────
        let skinSumR = 0, skinSumG = 0, skinSumB = 0, skinSumCb = 0, skinSumCr = 0, skinSumWarmth = 0, skinCnt = 0;
        let faceSumX = 0, faceWeightSum = 0;

        for (let y = Math.floor(size * 0.16); y < Math.floor(size * 0.48); y += 2) {
          for (let x = Math.floor(size * 0.36); x < Math.floor(size * 0.64); x += 2) {
            const p = y * size + x;
            const r = origR[p], g = origG[p], b = origB[p];
            const lum = origLum[p];
            if (lum > 75 && lum < 232 && r > g + 6 && g >= b - 4) {
              const [cb, cr] = rgbToCbCr(r, g, b);
              if (cr > 134 && cb < 130) {
                skinSumR += r;
                skinSumG += g;
                skinSumB += b;
                skinSumCb += cb;
                skinSumCr += cr;
                skinSumWarmth += (r - g) * 1.4 + (r - b) * 0.6;
                skinCnt++;
                faceSumX += x;
                faceWeightSum += 1;
              }
            }
          }
        }

        const avgSkinR = skinCnt > 15 ? skinSumR / skinCnt : 182;
        const avgSkinG = skinCnt > 15 ? skinSumG / skinCnt : 148;
        const avgSkinB = skinCnt > 15 ? skinSumB / skinCnt : 126;
        const faceCb = skinCnt > 15 ? skinSumCb / skinCnt : 112;
        const faceCr = skinCnt > 15 ? skinSumCr / skinCnt : 150;
        const faceWarmth = skinCnt > 15 ? skinSumWarmth / skinCnt : 82;
        const avgSkinLum = 0.299 * avgSkinR + 0.587 * avgSkinG + 0.114 * avgSkinB || 152;
        const skinRatioR = Math.max(1.08, Math.min(1.22, avgSkinR / avgSkinLum));
        const skinRatioG = Math.max(0.91, Math.min(0.98, avgSkinG / avgSkinLum));
        const skinRatioB = Math.max(0.75, Math.min(0.89, avgSkinB / avgSkinLum));
        const headCenterNX = faceWeightSum > 20 ? (faceSumX / faceWeightSum) / size : 0.48;

        // Despill Cromático Puro (por pixel, sem qualquer máscara oval):
        // Remove reflexo de LED verde/ciano de forma contínua em toda a imagem
        const cleanR = new Float32Array(totalPixels);
        const cleanG = new Float32Array(totalPixels);
        const cleanB = new Float32Array(totalPixels);
        const cleanLumMap = new Float32Array(totalPixels);

        for (let p = 0; p < totalPixels; p++) {
          const r0 = origR[p];
          const g0 = origG[p];
          const b0 = origB[p];
          const rbBase = 0.56 * r0 + 0.44 * b0;
          const greenExcess = Math.max(0, g0 - rbBase);

          if (greenExcess <= 1.5) {
            cleanR[p] = r0;
            cleanG[p] = g0;
            cleanB[p] = b0;
            cleanLumMap[p] = origLum[p];
            continue;
          }

          const greenStrength = smoothstep(2, 30, greenExcess);
          const sceneLum = 0.27 * r0 + 0.57 * g0 + 0.16 * b0;
          // Se o pixel subjacente tem calor de pele (r0 > b0 + 4 e não é escuro), restaura pele natural;
          // caso contrário, neutraliza o verde/ciano para tom neutro de estúdio.
          const skinWarmFactor =
             smoothstep(55, 115, r0) * smoothstep(-4, 18, r0 - b0);

          const neutR = rbBase + greenExcess * 0.18;
          const neutG = rbBase + greenExcess * 0.04;
          const neutB = Math.min(b0, rbBase + greenExcess * 0.06);

          const warmLum = Math.max(rbBase * 1.12, sceneLum * 0.92);
          const warmR = Math.min(255, warmLum * skinRatioR);
          const warmG = Math.min(255, warmLum * skinRatioG);
          const warmB = Math.min(255, warmLum * skinRatioB);

          const targetR = warmR * skinWarmFactor + neutR * (1 - skinWarmFactor);
          const targetG = warmG * skinWarmFactor + neutG * (1 - skinWarmFactor);
          const targetB = warmB * skinWarmFactor + neutB * (1 - skinWarmFactor);

          const fR = r0 * (1 - greenStrength) + targetR * greenStrength;
          const fG = g0 * (1 - greenStrength) + targetG * greenStrength;
          const fB = b0 * (1 - greenStrength) + targetB * greenStrength;

          cleanR[p] = fR;
          cleanG[p] = fG;
          cleanB[p] = fB;
          cleanLumMap[p] = 0.299 * fR + 0.587 * fG + 0.114 * fB;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. SEGMENTAÇÃO PRECISA DO PROFISSIONAL VS. FUNDO (SEM HALOS / SEM OVAL)
        // ─────────────────────────────────────────────────────────────────────

        // 3.1 Calibração do tecido da camisa no tórax
        let shSumCb = 0, shSumCr = 0, shSumWarmth = 0, shSumLum = 0, shCnt = 0;
        for (let y = Math.floor(size * 0.72); y < Math.floor(size * 0.95); y += 2) {
          for (let x = Math.floor(size * 0.18); x < Math.floor(size * 0.80); x += 2) {
            const p = y * size + x;
            const r = cleanR[p], g = cleanG[p], b = cleanB[p];
            const lum = cleanLumMap[p];
            const warmth = (r - g) * 1.4 + (r - b) * 0.6;
            if (isOriginalShirtBlack ? maxRBMap[p] < 44 : (lum > 70 && Math.abs(warmth - faceWarmth) > 14)) {
              const [cb, cr] = rgbToCbCr(r, g, b);
              shSumCb += cb;
              shSumCr += cr;
              shSumWarmth += warmth;
              shSumLum += lum;
              shCnt++;
            }
          }
        }
        const shirtCb = shCnt > 15 ? shSumCb / shCnt : 124;
        const shirtCr = shCnt > 15 ? shSumCr / shCnt : 132;
        const shirtWarmth = shCnt > 15 ? shSumWarmth / shCnt : 22;
        const shirtMeanLum = shCnt > 15 ? shSumLum / shCnt : isOriginalShirtBlack ? 18 : 172;

        // 3.2 Linha superior dos ombros e da gola (smoothTopY[x])
        const rawTopY = new Float32Array(size);
        const warmthMid = (faceWarmth + shirtWarmth) * 0.54;
        const neckLeftNX = headCenterNX - 0.165;
        const neckRightNX = headCenterNX + 0.165;

        for (let x = 0; x < size; x++) {
          const nx = x / size;
          if (nx >= neckLeftNX && nx <= neckRightNX) {
            const neckRel = (nx - headCenterNX) / 0.165;
            const anatomicalCollarNY =
              (isOriginalShirtBlack ? 0.548 : 0.562) +
              0.082 * Math.max(0, 1 - neckRel * neckRel);
            const startY = Math.floor(size * Math.min(0.70, anatomicalCollarNY + 0.04));
            const stopY = Math.floor(size * Math.max(0.535, anatomicalCollarNY - 0.025));
            let detectedY = Math.floor(size * anatomicalCollarNY);

            for (let y = startY; y >= stopY; y--) {
              const p = y * size + x;
              const r = cleanR[p], g = cleanG[p], b = cleanB[p];
              const lum = cleanLumMap[p];
              if (isOriginalShirtBlack) {
                if (maxRBMap[p] > 38 || lum > 46) {
                  detectedY = y + 1;
                  break;
                }
              } else {
                const [cb, cr] = rgbToCbCr(r, g, b);
                const warmth = (r - g) * 1.4 + (r - b) * 0.6;
                const distToShirt = Math.hypot(cb - shirtCb, cr - shirtCr);
                const distToSkin = Math.hypot(cb - faceCb, cr - faceCr);
                const isNeckSkinOrBeard =
                  (warmth > warmthMid && distToSkin < distToShirt + 4) ||
                  (y < size * 0.60 && lum < shirtMeanLum * 0.52);
                if (isNeckSkinOrBeard) {
                  detectedY = y + 1;
                  break;
                }
              }
            }
            rawTopY[x] = Math.min(detectedY, Math.floor(size * (anatomicalCollarNY + 0.014)));
          } else {
            const tOut =
              nx < neckLeftNX
                ? (neckLeftNX - nx) / Math.max(0.01, neckLeftNX)
                : (nx - neckRightNX) / Math.max(0.01, 1 - neckRightNX);
            const baseShoulderNY = isOriginalShirtBlack ? 0.548 : 0.562;
            const expectedShoulderNY = baseShoulderNY + Math.pow(tOut, 1.12) * 0.115;
            const searchStartY = Math.floor(size * Math.min(0.69, expectedShoulderNY + 0.04));
            const searchStopY = Math.floor(size * Math.max(0.52, expectedShoulderNY - 0.04));
            let bestY = Math.floor(size * expectedShoulderNY);
            let maxEdgeScore = 0;

            for (let y = searchStartY; y >= searchStopY; y--) {
              const pAbove = Math.max(0, y - 3) * size + x;
              const pBelow = Math.min(size - 1, y + 3) * size + x;
              if (isOriginalShirtBlack) {
                // Na camisa preta, a borda do ombro é onde o fundo claro termina e a camisa escura começa
                if (maxRBMap[pBelow] < 46 && cleanLumMap[pAbove] > 75) {
                  const score = cleanLumMap[pAbove] - cleanLumMap[pBelow];
                  if (score > maxEdgeScore) {
                    maxEdgeScore = score;
                    bestY = y;
                  }
                }
              } else {
                const rA = cleanR[pAbove], gA = cleanG[pAbove], bA = cleanB[pAbove];
                const rB = cleanR[pBelow], gB = cleanG[pBelow], bB = cleanB[pBelow];
                const [cbA, crA] = rgbToCbCr(rA, gA, bA);
                const grad = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);
                const distWallFromShirt = Math.hypot(cbA - shirtCb, crA - shirtCr) * 2.2;
                const score = grad + distWallFromShirt;
                if (score > maxEdgeScore && score > 22) {
                  maxEdgeScore = score;
                  bestY = y;
                }
              }
            }
            rawTopY[x] = bestY;
          }
        }

        const smoothTopY = new Float32Array(size);
        for (let x = 0; x < size; x++) {
          let sum = 0, cnt = 0;
          for (let k = -12; k <= 12; k++) {
            const xk = Math.max(0, Math.min(size - 1, x + k));
            sum += rawTopY[xk];
            cnt++;
          }
          smoothTopY[x] = sum / cnt;
        }

        // 3.3 Detecção do Topo do Cabelo (topHairY) e Contorno Exato da Cabeça/Cabelo/Orelhas/Pescoço
        let topHairY = Math.floor(size * 0.05);
        for (let y = Math.floor(size * 0.03); y < Math.floor(size * 0.26); y++) {
          let fgCount = 0;
          for (
            let x = Math.floor((headCenterNX - 0.09) * size);
            x <= Math.floor((headCenterNX + 0.09) * size);
            x += 2
          ) {
            const p = y * size + x;
            const r0 = origR[p], g0 = origG[p], b0 = origB[p];
            const lum = cleanLumMap[p];
            // Parede verde/cinza no topo tem lum > 118 e g0 >= r0; cabelo é escuro (lum < 102)
            const isHairOrForehead =
              (lum < 102 && g0 - r0 < 24) ||
              (cleanR[p] > cleanG[p] + 10 && cleanR[p] > cleanB[p] + 16 && lum < 210);
            if (isHairOrForehead) fgCount++;
          }
          if (fgCount > 12) {
            topHairY = Math.max(Math.floor(size * 0.02), y - 2);
            break;
          }
        }

        const topHairNY = topHairY / size;
        const rawHeadLeftX = new Float32Array(size);
        const rawHeadRightX = new Float32Array(size);
        const headCenterX = Math.floor(headCenterNX * size);

        const isHeadOrNeckForeground = (x, y) => {
          const p = y * size + x;
          const r0 = origR[p], g0 = origG[p], b0 = origB[p];
          const r = cleanR[p], g = cleanG[p], b = cleanB[p];
          const lum = cleanLumMap[p];

          // Parede iluminada por verde neon (g0 >> r0 com luminância média/alta) -> SEMPRE fundo
          if (g0 - r0 > 22 && origLum[p] > 98) return false;
          // Parede cinza/branca fria ou placa azul ("TES") -> SEMPRE fundo
          if (b0 > r0 + 8) return false;
          if (lum > 124 && r - b < 14 && r - g < 8) return false;

          // Cabelo, sobrancelha, armação de óculos ou barba (escuros)
          if (lum < 96 && g0 - r0 < 18) return true;

          // Pele quente do rosto, orelhas e pescoço
          const [cb, cr] = rgbToCbCr(r, g, b);
          const distSkin = Math.hypot(cb - faceCb, cr - faceCr);
          if (r > g + 5 && r > b + 10 && distSkin < 22 && lum > 60 && lum < 228) {
            return true;
          }

          return false;
        };

        for (let y = 0; y < size; y++) {
          const ny = y / size;
          if (y < topHairY) {
            rawHeadLeftX[y] = headCenterX;
            rawHeadRightX[y] = headCenterX;
            continue;
          }

          const tHead = Math.max(0, Math.min(1.15, (ny - topHairNY) / Math.max(0.15, 0.55 - topHairNY)));
          let anatomicalHalfWidthNX = 0.155;
          if (tHead <= 0.34) {
            // Topo arredondado do crânio/cabelo
            anatomicalHalfWidthNX = 0.042 + Math.pow(tHead / 0.34, 0.55) * 0.118;
          } else if (tHead <= 0.66) {
            // Têmporas, óculos e orelhas
            anatomicalHalfWidthNX =
              0.160 + Math.sin(((tHead - 0.34) / 0.32) * Math.PI) * 0.016;
          } else if (tHead <= 0.92) {
            // Maxilar afinando até o pescoço
            const tJaw = (tHead - 0.66) / 0.26;
            anatomicalHalfWidthNX = 0.160 * (1 - tJaw) + 0.128 * tJaw;
          } else {
            // Pescoço abrindo para o trapézio
            const tNeck = Math.min(1, (tHead - 0.92) / 0.23);
            anatomicalHalfWidthNX = 0.128 * (1 - tNeck) + 0.165 * tNeck;
          }

          const searchOutL = Math.floor((headCenterNX - anatomicalHalfWidthNX - 0.025) * size);
          const searchInL = Math.floor((headCenterNX - anatomicalHalfWidthNX + 0.032) * size);
          let leftEdge = Math.floor((headCenterNX - anatomicalHalfWidthNX) * size);

          for (let x = searchInL; x >= searchOutL; x--) {
            if (!isHeadOrNeckForeground(x, y) && !isHeadOrNeckForeground(Math.max(0, x - 2), y)) {
              leftEdge = x + 1;
              break;
            }
            leftEdge = x;
          }
          rawHeadLeftX[y] = leftEdge;

          const searchInR = Math.floor((headCenterNX + anatomicalHalfWidthNX - 0.032) * size);
          const searchOutR = Math.floor((headCenterNX + anatomicalHalfWidthNX + 0.025) * size);
          let rightEdge = Math.floor((headCenterNX + anatomicalHalfWidthNX) * size);

          for (let x = searchInR; x <= searchOutR; x++) {
            if (!isHeadOrNeckForeground(x, y) && !isHeadOrNeckForeground(Math.min(size - 1, x + 2), y)) {
              rightEdge = x - 1;
              break;
            }
            rightEdge = x;
          }
          rawHeadRightX[y] = rightEdge;
        }

        const smoothHeadLeftX = new Float32Array(size);
        const smoothHeadRightX = new Float32Array(size);
        for (let y = 0; y < size; y++) {
          let sumL = 0, sumR = 0, cnt = 0;
          for (let k = -7; k <= 7; k++) {
            const yk = Math.max(0, Math.min(size - 1, y + k));
            sumL += rawHeadLeftX[yk];
            sumR += rawHeadRightX[yk];
            cnt++;
          }
          smoothHeadLeftX[y] = sumL / cnt;
          smoothHeadRightX[y] = sumR / cnt;
        }

        // 3.4 Detecção de Objetos Segurados e Braço Levantado (ex: Pote Vermelho "CLASSE A" na Foto 1)
        // Detecta se há pote/objeto vermelho no quadrante direito e calcula seu centro e raio exatos
        let redJarSumX = 0, redJarSumY = 0, redJarCnt = 0;
        for (let y = Math.floor(size * 0.42); y < Math.floor(size * 0.72); y += 2) {
          for (let x = Math.floor(size * 0.65); x < Math.floor(size * 0.96); x += 2) {
            const p = y * size + x;
            if (origR[p] - origG[p] > 42 && origR[p] > 120) {
              redJarSumX += x;
              redJarSumY += y;
              redJarCnt++;
            }
          }
        }
        const hasRedJar = redJarCnt > 45;
        const jarCX = hasRedJar ? redJarSumX / redJarCnt : -999;
        const jarCY = hasRedJar ? redJarSumY / redJarCnt : -999;
        const jarRadius = size * 0.096;

        // Limites laterais das mangas
        const sleeveLeftX = new Float32Array(size);
        const sleeveRightX = new Float32Array(size);
        for (let y = 0; y < size; y++) {
          const ny = y / size;
          sleeveLeftX[y] = isOriginalShirtBlack
            ? 0
            : Math.floor(size * Math.max(0.015, 0.062 - Math.max(0, ny - 0.64) * 0.14));
          sleeveRightX[y] = isOriginalShirtBlack
            ? size - 1
            : Math.floor(size * Math.min(0.988, 0.948 + Math.max(0, ny - 0.64) * 0.14));
        }

        // 3.5 Construção das Máscaras:
        // - rawPersonMask: silhueta completa do profissional (cabeça + tronco + mãos/objetos)
        // - rawShirtMask: estritamente a região da camiseta no tronco (excluindo cabeça, mãos e pote)
        const rawPersonMask = new Float32Array(totalPixels);
        const rawShirtMask = new Float32Array(totalPixels);

        for (let y = 0; y < size; y++) {
          const ny = y / size;
          const hLeft = smoothHeadLeftX[y];
          const hRight = smoothHeadRightX[y];
          const sLeft = sleeveLeftX[y];
          const sRight = sleeveRightX[y];

          for (let x = 0; x < size; x++) {
            const nx = x / size;
            const p = y * size + x;
            const topY = smoothTopY[x];

            // A) Cabeça, cabelo, orelhas e pescoço
            let headAlpha = 0;
            if (y >= topHairY && y <= topY + 6) {
              const topCrownAlpha = smoothstep(topHairY - 1, topHairY + 3.5, y);
              const lAlpha = smoothstep(hLeft - 2.0, hLeft + 2.0, x);
              const rAlpha = 1 - smoothstep(hRight - 2.0, hRight + 2.0, x);
              headAlpha = topCrownAlpha * lAlpha * rAlpha;
            }

            // B) Pote segurado e mão/braço direito levantado (quando existente)
            let propOrRaisedArmAlpha = 0;
            if (hasRedJar && nx > 0.67 && ny > 0.44) {
              const distJar = Math.hypot(x - jarCX, y - jarCY);
              if (distJar <= jarRadius + 3) {
                propOrRaisedArmAlpha = 1 - smoothstep(jarRadius - 1.5, jarRadius + 2.5, distJar);
              }
              // Dedos/mão/antebraço segurando o pote (pele quente à direita/abaixo do pote, nunca parede fria)
              const r0 = origR[p], g0 = origG[p], b0 = origB[p];
              const isWarmHandSkin =
                ny > 0.47 &&
                nx > 0.74 &&
                r0 > g0 + 6 &&
                r0 > b0 + 12 &&
                origLum[p] > 68 &&
                !(ny < 0.56 && nx > 0.92 && origLum[p] > 135);
              if (isWarmHandSkin) {
                propOrRaisedArmAlpha = Math.max(propOrRaisedArmAlpha, 1.0);
              }
            }

            // C) Tronco e Camiseta (abaixo de smoothTopY[x])
            let torsoAlpha = 0;
            let shirtAlpha = 0;

            if (y >= topY - 2 && x >= sLeft - 2 && x <= sRight + 2) {
              const vAlpha = smoothstep(topY - 2, topY + 2, y);
              const lSleeve = isOriginalShirtBlack ? 1 : smoothstep(sLeft - 2, sLeft + 2, x);
              const rSleeve = isOriginalShirtBlack ? 1 : 1 - smoothstep(sRight - 2, sRight + 2, x);
              torsoAlpha = vAlpha * lSleeve * rSleeve;

              if (isOriginalShirtBlack) {
                // Na Foto 1 (camisa preta original), exclui parede residual acima do ombro esquerdo
                const r0 = origR[p], g0 = origG[p], b0 = origB[p];
                const lum0 = origLum[p];
                const isWallAboveShoulder =
                  ny < 0.66 &&
                  (g0 - r0 > 18 || (lum0 > 110 && r0 - b0 < 12)) &&
                  propOrRaisedArmAlpha < 0.2;

                if (isWallAboveShoulder) {
                  torsoAlpha = 0;
                } else {
                  // Dentro do tronco válido: separa o que é camisa preta do que é mão/dedo/relógio/pote
                  const isInsideJar =
                    hasRedJar && Math.hypot(x - jarCX, y - jarCY) <= jarRadius + 1.5;
                  const isRedRim = r0 - g0 > 38 && r0 > 105;
                  const watchDx = (nx - 0.155) / 0.085;
                  const watchDy = (ny - 0.96) / 0.065;
                  const isWatch = watchDx * watchDx + watchDy * watchDy < 1.0 && maxRBMap[p] > 50;

                  if (isInsideJar || isRedRim || isWatch) {
                    shirtAlpha = 0;
                  } else {
                    // Corrige reflexo avermelhado sob o pote na manga preta
                    const effectiveDarkMetric =
                      nx > 0.65 && ny > 0.58 && g0 < 48 && b0 < 48
                        ? Math.min(maxRBMap[p], lum0 + 8)
                        : maxRBMap[p];
                    const coreCeil =
                      nx > 0.33 && nx < 0.60 && ny < 0.635 ? 34 : 44;
                    const transCeil = nx < 0.34 && ny > 0.72 ? 74 : 66;

                    if (effectiveDarkMetric <= coreCeil) {
                      shirtAlpha = torsoAlpha;
                    } else if (effectiveDarkMetric < transCeil) {
                      const t = (effectiveDarkMetric - coreCeil) / (transCeil - coreCeil);
                      shirtAlpha = (1 - t) * torsoAlpha;
                    } else {
                      shirtAlpha = 0;
                    }
                  }
                }
              } else {
                // Camisa clara/bege/colorida: cobre 100% do tronco com refinamento suave na barba/pescoço
                shirtAlpha = torsoAlpha;
                if (nx > headCenterNX - 0.16 && nx < headCenterNX + 0.16 && y < topY + 6) {
                  const r = cleanR[p], g = cleanG[p], b = cleanB[p];
                  const lum = cleanLumMap[p];
                  const [cb, cr] = rgbToCbCr(r, g, b);
                  const warmth = (r - g) * 1.4 + (r - b) * 0.6;
                  const distToShirt = Math.hypot(cb - shirtCb, cr - shirtCr);
                  const distToSkin = Math.hypot(cb - faceCb, cr - faceCr);
                  if (y < size * 0.61 && lum < shirtMeanLum * 0.48) {
                    shirtAlpha *= 0.15;
                  } else {
                    const skinScore = (warmth - warmthMid) * 0.55 + (distToShirt - distToSkin) * 1.25;
                    const collarRef = 1 - smoothstep(-2, 12, skinScore);
                    shirtAlpha *= Math.max(0.25, collarRef);
                  }
                }
              }
            }

            rawPersonMask[p] = Math.min(1, Math.max(headAlpha, torsoAlpha, propOrRaisedArmAlpha));
            rawShirtMask[p] = shirtAlpha;
          }
        }

        const personAlphaMap = blurFloatMap(rawPersonMask, size, size, 2);
        const shirtAlphaMap = blurFloatMap(rawShirtMask, size, size, 1);

        // ─────────────────────────────────────────────────────────────────────
        // 4. DESCONTAMINAÇÃO DE BORDA (INWARD COLOR PULL / DEFRINGE)
        //    Elimina qualquer halo verde, azul ou claro nos contornos do cabelo,
        //    óculos, orelhas e braços antes de compor com o fundo dark slate
        // ─────────────────────────────────────────────────────────────────────
        const decontamR = new Float32Array(totalPixels);
        const decontamG = new Float32Array(totalPixels);
        const decontamB = new Float32Array(totalPixels);

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const p = y * size + x;
            let r = cleanR[p];
            let g = cleanG[p];
            let b = cleanB[p];
            const pAlpha = personAlphaMap[p];

            if (pAlpha > 0.01 && pAlpha < 0.96) {
              // Busca o pixel interno mais sólido (personAlpha > 0.92) num raio de 5px
              let bestAlpha = pAlpha;
              let inR = r, inG = g, inB = b;
              for (let dy = -5; dy <= 5; dy += 2) {
                const nyIdx = Math.max(0, Math.min(size - 1, y + dy));
                for (let dx = -5; dx <= 5; dx += 2) {
                  const nxIdx = Math.max(0, Math.min(size - 1, x + dx));
                  const np = nyIdx * size + nxIdx;
                  if (personAlphaMap[np] > bestAlpha + 0.08) {
                    bestAlpha = personAlphaMap[np];
                    inR = cleanR[np];
                    inG = cleanG[np];
                    inB = cleanB[np];
                  }
                }
              }
              const pullWeight = (1 - pAlpha) * 0.85;
              r = r * (1 - pullWeight) + inR * pullWeight;
              g = g * (1 - pullWeight) + inG * pullWeight;
              b = b * (1 - pullWeight) + inB * pullWeight;

              // Suprime qualquer resíduo frio (verde/ciano/azul) e atenua halo claro na borda
              g = Math.min(g, 0.62 * r + 0.38 * b + 2);
              b = Math.min(b, Math.max(r * 0.95, g));
              const rimAtten = 0.68 + 0.32 * pAlpha;
              r *= rimAtten;
              g *= rimAtten;
              b *= rimAtten;
            }

            decontamR[p] = r;
            decontamG[p] = g;
            decontamB[p] = b;
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. INPAINTING RESTRITO DA CAMISETA (PRETA OU BRANCA DE ESTÚDIO)
        //    Atua exclusivamente sobre shirtAlphaMap, preservando mãos e objetos
        // ─────────────────────────────────────────────────────────────────────
        const cleanFoldLum = new Float32Array(totalPixels);
        for (let p = 0; p < totalPixels; p++) {
          cleanFoldLum[p] = cleanLumMap[p];
        }
        const broadLum = blurFloatMap(cleanFoldLum, size, size, 16);

        for (let y = Math.floor(size * 0.52); y < size; y++) {
          for (let x = 0; x < size; x++) {
            const p = y * size + x;
            if (shirtAlphaMap[p] < 0.4) continue;
            const r = cleanR[p], g = cleanG[p], b = cleanB[p];
            const chroma = Math.max(r, g, b) - Math.min(r, g, b);
            const diff = cleanFoldLum[p] - broadLum[p];
            if (Math.abs(diff) > 12 || chroma > 34) {
              cleanFoldLum[p] = broadLum[p] + Math.max(-6, Math.min(6, diff * 0.25));
            }
          }
        }
        const smoothCleanLum = blurFloatMap(cleanFoldLum, size, size, 3);
        const ultraBroadLum = blurFloatMap(smoothCleanLum, size, size, 22);

        // Efeito de gola canelada e costura nos ombros
        const collarBandEffect = new Float32Array(totalPixels);
        for (let x = 0; x < size; x++) {
          const nx = x / size;
          const topY = Math.round(smoothTopY[x]);
          const isNeckCollarZone = nx >= headCenterNX - 0.165 && nx <= headCenterNX + 0.165;

          if (isNeckCollarZone) {
            for (let dy = 2; dy <= 15; dy++) {
              const py = topY + dy;
              if (py < 0 || py >= size) continue;
              const p = py * size + x;
              if (dy <= 10) {
                const rib = Math.sin(x * 1.35) * 1.2;
                const arch = Math.sin(((dy - 2) / 8) * Math.PI) * 5.5;
                collarBandEffect[p] = arch + rib;
              } else {
                collarBandEffect[p] = -8.5 * Math.sin(((dy - 11) / 4) * Math.PI);
              }
            }
          } else {
            for (let dy = 3; dy <= 7; dy++) {
              const py = topY + dy;
              if (py < 0 || py >= size) continue;
              const p = py * size + x;
              collarBandEffect[p] = -3.5 * Math.sin(((dy - 3) / 4) * Math.PI);
            }
          }
        }

        const isWhiteTarget = shirtColor === 'white';

        // ─────────────────────────────────────────────────────────────────────
        // 6. COMPOSIÇÃO FINAL: GRADIENTE RADIAL (#2B3342 -> #121620) + PESSOA
        // ─────────────────────────────────────────────────────────────────────
        for (let y = 0; y < size; y++) {
          const ny = y / size;
          for (let x = 0; x < size; x++) {
            const nx = x / size;
            const p = y * size + x;
            const idx = p * 4;

            const pAlpha = personAlphaMap[p];
            const sAlpha = shirtAlphaMap[p];

            // Fundo exclusivamente com o gradiente radial contínuo (#2B3342 -> #121620)
            const [bgR, bgG, bgB] = getStudioBackdropRGB(nx, ny, x, y);

            let fgR = decontamR[p];
            let fgG = decontamG[p];
            let fgB = decontamB[p];

            if (sAlpha > 0.01) {
              const cleanMicroFold = Math.max(
                -10,
                Math.min(10, (smoothCleanLum[p] - ultraBroadLum[p]) * 0.85)
              );

              const chestDx = (nx - headCenterNX) / 0.46;
              const chestDy = (ny - 0.68) / 0.35;
              const cylinderShade = chestDx * chestDx * 17 + Math.max(0, chestDy) * 12;

              const collarDetail = collarBandEffect[p];
              const weaveGrain = (((x * 73 + y * 151) & 3) - 1.5) * 0.5;

              let shirtR, shirtG, shirtB;
              if (isWhiteTarget) {
                const whiteLum =
                  236 -
                  cylinderShade +
                  cleanMicroFold * 0.9 +
                  collarDetail * 0.75 +
                  weaveGrain;
                shirtR = clampByte(whiteLum);
                shirtG = clampByte(whiteLum + 1);
                shirtB = clampByte(whiteLum + 4);
              } else {
                const blackLum =
                  26 -
                  cylinderShade * 0.5 +
                  cleanMicroFold * 0.45 +
                  collarDetail * 0.48 +
                  weaveGrain * 0.4;
                shirtR = clampByte(blackLum);
                shirtG = clampByte(blackLum + 1);
                shirtB = clampByte(blackLum + 3);
              }

              // Em bordas internas entre a camisa e dedos/mãos sobre o peito, puxa a cor limpa da mão
              let handOrNeckR = fgR, handOrNeckG = fgG, handOrNeckB = fgB;
              if (isOriginalShirtBlack && sAlpha < 0.94 && pAlpha > 0.85) {
                let maxMRB = maxRBMap[p];
                for (let dy = -3; dy <= 3; dy += 2) {
                  const nyIdx = Math.max(0, Math.min(size - 1, y + dy));
                  for (let dx = -3; dx <= 3; dx += 2) {
                    const nxIdx = Math.max(0, Math.min(size - 1, x + dx));
                    const np = nyIdx * size + nxIdx;
                    if (maxRBMap[np] > maxMRB) {
                      maxMRB = maxRBMap[np];
                      handOrNeckR = decontamR[np];
                      handOrNeckG = decontamG[np];
                      handOrNeckB = decontamB[np];
                    }
                  }
                }
              }

              fgR = handOrNeckR * (1 - sAlpha) + shirtR * sAlpha;
              fgG = handOrNeckG * (1 - sAlpha) + shirtG * sAlpha;
              fgB = handOrNeckB * (1 - sAlpha) + shirtB * sAlpha;
            }

            const finalR = bgR * (1 - pAlpha) + fgR * pAlpha;
            const finalG = bgG * (1 - pAlpha) + fgG * pAlpha;
            const finalB = bgB * (1 - pAlpha) + fgB * pAlpha;

            data[idx] = clampByte(finalR);
            data[idx + 1] = clampByte(finalG);
            data[idx + 2] = clampByte(finalB);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        let outUrl = canvas.toDataURL('image/webp', 0.92);
        if (!outUrl || !outUrl.startsWith('data:image/webp')) {
          outUrl = canvas.toDataURL('image/jpeg', 0.92);
        }
        resolve(outUrl || sourceDataUrl);
      } catch (err) {
        console.warn('[barberPhotoStudio] Erro ao processar canvas, retornando original:', err);
        resolve(sourceDataUrl);
      }
    };
    img.src = sourceDataUrl;
  });
}
