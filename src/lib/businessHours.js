// src/lib/businessHours.js — Utilitário central para formatação HH:mm, normalização de business_hours/opening_hours e geração de slots

export const BUSINESS_DAYS = [
  { key: 'seg', label: 'Segunda', dayIndex: 1 },
  { key: 'ter', label: 'Terça', dayIndex: 2 },
  { key: 'qua', label: 'Quarta', dayIndex: 3 },
  { key: 'qui', label: 'Quinta', dayIndex: 4 },
  { key: 'sex', label: 'Sexta', dayIndex: 5 },
  { key: 'sab', label: 'Sábado', dayIndex: 6 },
  { key: 'dom', label: 'Domingo', dayIndex: 0 },
];

export const DAY_INDEX_TO_KEY = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
};

const DAY_ALIASES = {
  seg: ['seg', 'segunda', 'segunda-feira', 'segunda_feira', 'mon', 'monday', '1'],
  ter: ['ter', 'terca', 'terça', 'terca-feira', 'terça-feira', 'tue', 'tuesday', '2'],
  qua: ['qua', 'quarta', 'quarta-feira', 'quarta_feira', 'wed', 'wednesday', '3'],
  qui: ['qui', 'quinta', 'quinta-feira', 'quinta_feira', 'thu', 'thursday', '4'],
  sex: ['sex', 'sexta', 'sexta-feira', 'sexta_feira', 'fri', 'friday', '5'],
  sab: ['sab', 'sabado', 'sábado', 'sat', 'saturday', '6'],
  dom: ['dom', 'domingo', 'sun', 'sunday', '0'],
};

/**
 * Converte qualquer valor de hora (ex: '07:0', '22:0', '7:5', '07:00:00', '7')
 * para o formato padrão 'HH:mm' (ex: '07:00', '22:00').
 */
export function formatTimeHHMM(val, fallback = '09:00') {
  if (val === undefined || val === null || val === '') return fallback;
  const raw = String(val).trim();
  if (!raw) return fallback;

  if (raw.includes(':')) {
    const parts = raw.split(':');
    const hRaw = (parts[0] || '').replace(/\D/g, '');
    const mRaw = (parts[1] || '').replace(/\D/g, '');
    let h = parseInt(hRaw, 10);
    let m = parseInt(mRaw, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      h = parseInt(fallback.split(':')[0], 10) || 9;
    }
    if (isNaN(m) || m < 0 || m > 59) {
      m = 0;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return fallback;

  if (digits.length <= 2) {
    let h = parseInt(digits, 10);
    if (isNaN(h) || h < 0 || h > 23) return fallback;
    return `${String(h).padStart(2, '0')}:00`;
  }

  const hPart = digits.slice(0, 2);
  const mPart = digits.slice(2, 4);
  let h = parseInt(hPart, 10);
  let m = parseInt(mPart, 10);
  if (isNaN(h) || h < 0 || h > 23) h = parseInt(fallback.split(':')[0], 10) || 9;
  if (isNaN(m) || m < 0 || m > 59) m = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Aplica máscara dinâmica de hora 'HH:mm' enquanto o usuário digita em campo texto/hora.
 */
export function maskTimeInput(rawVal) {
  const digits = String(rawVal || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function getDefaultBusinessHours() {
  return Object.fromEntries(
    BUSINESS_DAYS.map(({ key }) => [
      key,
      {
        open: '08:00',
        close: '20:00',
        active: key !== 'dom',
      },
    ])
  );
}

export function normalizeDayHours(rawDay, dayKey = 'seg') {
  const defaultActive = dayKey !== 'dom';
  if (!rawDay || typeof rawDay !== 'object') {
    const isBool = typeof rawDay === 'boolean';
    return {
      open: '08:00',
      close: '20:00',
      active: isBool ? rawDay : defaultActive,
    };
  }

  const rawOpen = rawDay.open ?? rawDay.start ?? rawDay.open_time ?? rawDay.abre ?? '08:00';
  const rawClose = rawDay.close ?? rawDay.end ?? rawDay.close_time ?? rawDay.fecha ?? '20:00';

  const open = formatTimeHHMM(rawOpen, '08:00');
  let close = formatTimeHHMM(rawClose, '20:00');

  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  if (closeMin <= openMin && close !== '00:00') {
    close = openMin < 22 * 60 ? '22:00' : '23:59';
  }

  let active = defaultActive;
  if (rawDay.active !== undefined) active = Boolean(rawDay.active);
  else if (rawDay.is_open !== undefined) active = Boolean(rawDay.is_open);
  else if (rawDay.isOpen !== undefined) active = Boolean(rawDay.isOpen);
  else if (rawDay.enabled !== undefined) active = Boolean(rawDay.enabled);
  else if (rawDay.closed !== undefined) active = !Boolean(rawDay.closed);

  return { open, close, active };
}

/**
 * Normaliza 'business_hours' ou 'opening_hours' (ou o objeto company inteiro)
 * garantindo que todos os 7 dias ('seg'..'dom') tenham { open: 'HH:mm', close: 'HH:mm', active: boolean }.
 */
export function normalizeBusinessHours(source) {
  const defaults = getDefaultBusinessHours();
  if (!source) return defaults;

  let raw = source;
  // Se recebeu o objeto company, extrai business_hours ou opening_hours
  if (
    typeof source === 'object' &&
    !Array.isArray(source) &&
    ('business_hours' in source || 'opening_hours' in source)
  ) {
    const bh = source.business_hours;
    const oh = source.opening_hours;
    const hasBh = bh && (typeof bh === 'string' ? bh.trim().length > 2 : Object.keys(bh).length > 0);
    raw = hasBh ? bh : oh;
  }

  if (!raw) return defaults;

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }

  if (typeof raw !== 'object' || raw === null) {
    return defaults;
  }

  const normalized = {};
  const rawKeys = Object.keys(raw);

  for (const { key } of BUSINESS_DAYS) {
    const aliases = DAY_ALIASES[key] || [key];
    let matchedEntry = undefined;

    for (const alias of aliases) {
      if (raw[alias] !== undefined) {
        matchedEntry = raw[alias];
        break;
      }
      const foundKey = rawKeys.find(k => k.toLowerCase().trim() === alias);
      if (foundKey && raw[foundKey] !== undefined) {
        matchedEntry = raw[foundKey];
        break;
      }
    }

    normalized[key] = matchedEntry !== undefined
      ? normalizeDayHours(matchedEntry, key)
      : defaults[key];
  }

  return normalized;
}

/**
 * Gera lista de horários (slots) dentro do expediente (ex: '07:00' às '22:00')
 * quebrados em blocos conforme a duração do serviço (ex: 30 min -> 07:00, 07:30, 08:00...).
 */
export function generateSlotsForDay(openTime, closeTime, durationMinutes = 30) {
  const slots = [];
  const normOpen = formatTimeHHMM(openTime, '08:00');
  const normClose = formatTimeHHMM(closeTime, '20:00');

  const [oh, om] = normOpen.split(':').map(Number);
  const [ch, cm] = normClose.split(':').map(Number);

  let current = (Number(oh) || 0) * 60 + (Number(om) || 0);
  let end = (Number(ch) || 0) * 60 + (Number(cm) || 0);

  if (end === 0 && ch === 0 && cm === 0) {
    end = 24 * 60;
  }
  if (end <= current) {
    end = Math.max(current + 60, 22 * 60);
  }

  const step = Math.max(5, Number(durationMinutes) || 30);

  while (current + step <= end) {
    const h = String(Math.floor(current / 60)).padStart(2, '0');
    const m = String(current % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += step;
  }

  return slots;
}

/**
 * Extrai ano, mês e dia no fuso de Brasília (UTC-3), imune a shifts UTC do browser/servidor.
 */
function extractBrasiliaYMD(dateInput) {
  if (typeof dateInput === 'string') {
    const clean = dateInput.split('T')[0].trim();
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return { y: parts[0], m: parts[1].padStart(2, '0'), d: parts[2].padStart(2, '0') };
    }
  }
  const dt = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
  if (isNaN(dt.getTime())) {
    const now = new Date();
    return {
      y: String(now.getFullYear()),
      m: String(now.getMonth() + 1).padStart(2, '0'),
      d: String(now.getDate()).padStart(2, '0'),
    };
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
    const formatted = fmt.format(dt);
    const parts = formatted.split('-');
    if (parts.length === 3) {
      return { y: parts[0], m: parts[1].padStart(2, '0'), d: parts[2].padStart(2, '0') };
    }
  } catch (_) {}
  return {
    y: String(dt.getFullYear()),
    m: String(dt.getMonth() + 1).padStart(2, '0'),
    d: String(dt.getDate()).padStart(2, '0'),
  };
}

/**
 * Converte data e hora para timestamp milissegundos considerando o fuso de Brasília (UTC-3).
 */
export function parseBrasiliaDateTime(dateVal, timeVal) {
  if (!dateVal) return null;

  if (typeof dateVal === 'number' && !isNaN(dateVal)) {
    return dateVal;
  }

  if (timeVal && typeof timeVal === 'string') {
    const { y, m, d } = extractBrasiliaYMD(dateVal);
    const [h, min] = timeVal.split(':');
    const hh = String(parseInt(h, 10) || 0).padStart(2, '0');
    const mm = String(parseInt(min, 10) || 0).padStart(2, '0');
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`).getTime();
  }

  if (dateVal instanceof Date) {
    return dateVal.getTime();
  }

  const str = String(dateVal).trim();
  if (str.includes('T') && (str.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(str))) {
    const t = new Date(str).getTime();
    if (!isNaN(t)) return t;
  }

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`).getTime();
  }

  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(`${y}-${m}-${d}T09:00:00-03:00`).getTime();
  }

  const parsed = new Date(str).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extrai componentes de data e hora com offset explícito de Brasília (-03:00).
 */
export function toBrasiliaDateParts(dateInput, timeStr = '09:00') {
  const { y, m, d } = extractBrasiliaYMD(dateInput);

  const [hStr, minStr] = (timeStr || '09:00').split(':');
  const hh = String(parseInt(hStr, 10) || 0).padStart(2, '0');
  const mm = String(parseInt(minStr, 10) || 0).padStart(2, '0');

  const dateStr = `${y}-${m}-${d}`;
  const timeFormatted = `${hh}:${mm}`;
  const isoBrasilia = `${dateStr}T${timeFormatted}:00-03:00`;
  const timestamp = new Date(isoBrasilia).getTime();

  // Dia da semana local de Brasília (0=Dom, 1=Seg, ..., 6=Sáb)
  const [yNum, mNum, dNum] = [parseInt(y, 10), parseInt(m, 10), parseInt(d, 10)];
  const dayOfWeek = new Date(Date.UTC(yNum, mNum - 1, dNum, 12, 0, 0)).getUTCDay();

  return {
    dateStr,
    timeFormatted,
    isoBrasilia,
    timestamp,
    dayOfWeek,
  };
}

const WEEKDAY_TOKEN_MAP = [
  { day: 0, regex: /\b(domingo|domingos|dom)\b/i },
  { day: 1, regex: /\b(segunda(?:-feira)?|segundas(?:-feiras)?|seg)\b/i },
  { day: 2, regex: /\b(terca(?:-feira)?|tercas(?:-feiras)?|ter)\b/i },
  { day: 3, regex: /\b(quarta(?:-feira)?|quartas(?:-feiras)?|qua)\b/i },
  { day: 4, regex: /\b(quinta(?:-feira)?|quintas(?:-feiras)?|qui)\b/i },
  { day: 5, regex: /\b(sexta(?:-feira)?|sextas(?:-feiras)?|sex)\b/i },
  { day: 6, regex: /\b(sabado|sabados|sab)\b/i },
];

/**
 * Extrai dias da semana (0=Dom..6=Sáb) mencionados no nome ou descrição de um plano
 * (ex: "Plano Off-Peak Terça e Quarta", "Ter-Qua", "Segunda a Quarta").
 */
export function parseWeekdaysFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const norm = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const found = new Set();

  // Suporte a intervalos do tipo "segunda a quarta" ou "seg a qua"
  const dayNamesPattern =
    '(domingo|dom|segunda(?:-feira)?|seg|terca(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sabado|sab)';
  const rangeRegex = new RegExp(`\\b${dayNamesPattern}\\s+(?:a|ate)\\s+${dayNamesPattern}\\b`, 'gi');

  const resolveTokenToDay = (token) => {
    for (const item of WEEKDAY_TOKEN_MAP) {
      if (item.regex.test(token)) return item.day;
    }
    return null;
  };

  let match;
  while ((match = rangeRegex.exec(norm)) !== null) {
    const startDay = resolveTokenToDay(match[1]);
    const endDay = resolveTokenToDay(match[2]);
    if (startDay !== null && endDay !== null && startDay <= endDay) {
      for (let d = startDay; d <= endDay; d++) {
        found.add(d);
      }
    }
  }

  for (const item of WEEKDAY_TOKEN_MAP) {
    if (item.regex.test(norm)) {
      found.add(item.day);
    }
  }

  return Array.from(found).sort((a, b) => a - b);
}

function sanitizeWeekdaysArray(arr) {
  if (!Array.isArray(arr)) return [];
  const valid = arr
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}

/**
 * Identifica os dias da semana permitidos (0=Dom .. 6=Sáb) para um plano de cliente ou assinatura.
 * Retorna um array ordenado de dias permitidos (ex: [2, 3] para Terça e Quarta) ou null se todos os dias forem permitidos.
 */
export function resolvePlanAllowedWeekdays(plan = null, subscription = null) {
  const meta =
    (plan?.limits && typeof plan.limits === 'object' && plan.limits._customer_plan_meta) || {};

  // 1. Verifica campos explícitos de restrição (allowed_weekdays, days_of_week, valid_days)
  const explicitCandidates = [
    plan?.allowed_weekdays,
    plan?.days_of_week,
    plan?.valid_days,
    meta?.allowed_weekdays,
    meta?.days_of_week,
    meta?.valid_days,
    subscription?.allowed_weekdays,
    subscription?.days_of_week,
    subscription?.valid_days,
  ];

  // 2. Verifica menção explícita de dias no título/descrição do plano ou snapshot da assinatura
  const combinedText = [
    plan?.name,
    plan?.description,
    subscription?.plan_name,
    subscription?.plan_name_snapshot,
  ]
    .filter(Boolean)
    .join(' ');
  const parsedFromText = parseWeekdaysFromText(combinedText);

  for (const cand of explicitCandidates) {
    const clean = sanitizeWeekdaysArray(cand);
    if (clean.length > 0 && clean.length < 7) {
      const isDefaultMonFri =
        clean.length === 5 && clean.every((d, idx) => d === idx + 1);
      if (isDefaultMonFri && parsedFromText.length > 0 && parsedFromText.length < 5) {
        return parsedFromText;
      }
      return clean;
    }
  }

  // 3. Verifica off_peak_weekdays e texto do plano
  const isOffPeak = Boolean(
    plan?.off_peak ||
      plan?.off_peak_enabled ||
      meta?.off_peak ||
      meta?.off_peak_enabled ||
      subscription?.off_peak ||
      subscription?.off_peak_enabled ||
      /off[\s-]?peak/i.test(combinedText)
  );

  const offPeakDays = sanitizeWeekdaysArray(
    plan?.off_peak_weekdays ||
      meta?.off_peak_weekdays ||
      subscription?.off_peak_weekdays
  );

  if (parsedFromText.length > 0 && parsedFromText.length < 7) {
    const isDefaultMonFri =
      offPeakDays.length === 5 && offPeakDays.every((d, idx) => d === idx + 1);
    if (offPeakDays.length > 0 && offPeakDays.length < 7 && !isDefaultMonFri) {
      return offPeakDays;
    }
    return parsedFromText;
  }

  if (isOffPeak) {
    if (offPeakDays.length > 0 && offPeakDays.length < 7) {
      return offPeakDays;
    }
    return [2, 3];
  }

  return null;
}

const WEEKDAY_PLURAL_LABELS = {
  0: { text: 'domingos', masc: true },
  1: { text: 'segundas', masc: false },
  2: { text: 'terças', masc: false },
  3: { text: 'quartas', masc: false },
  4: { text: 'quintas', masc: false },
  5: { text: 'sextas', masc: false },
  6: { text: 'sábados', masc: true },
};

const WEEKDAY_SHORT_LABELS = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

/**
 * Formata a mensagem de erro oficial de restrição de dias do plano:
 * Ex para [2, 3]: "O seu plano só permite agendamentos às terças e quartas-feiras."
 */
export function formatAllowedWeekdaysError(allowedWeekdays) {
  const clean = sanitizeWeekdaysArray(allowedWeekdays);
  if (clean.length === 0 || clean.length >= 7) {
    return 'Dia não disponível para o seu plano.';
  }

  const allFem = clean.every((d) => !WEEKDAY_PLURAL_LABELS[d]?.masc);
  const allMasc = clean.every((d) => WEEKDAY_PLURAL_LABELS[d]?.masc);

  if (allFem) {
    const names = clean.map((d, idx) => {
      const base = WEEKDAY_PLURAL_LABELS[d].text;
      return idx === clean.length - 1 ? `${base}-feiras` : base;
    });
    const joined =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
    return `O seu plano só permite agendamentos às ${joined}.`;
  }

  if (allMasc) {
    const names = clean.map((d) => WEEKDAY_PLURAL_LABELS[d].text);
    const joined =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
    return `O seu plano só permite agendamentos aos ${joined}.`;
  }

  const names = clean.map((d) => {
    const info = WEEKDAY_PLURAL_LABELS[d];
    return info.masc ? info.text : `${info.text}-feiras`;
  });
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `O seu plano só permite agendamentos em: ${joined}.`;
}

export function formatAllowedWeekdaysShort(allowedWeekdays) {
  const clean = sanitizeWeekdaysArray(allowedWeekdays);
  if (clean.length === 0 || clean.length >= 7) return '';
  return clean.map((d) => WEEKDAY_SHORT_LABELS[d]).join(', ');
}

export function isDateAllowedByPlan(dateInput, allowedWeekdays) {
  const clean = sanitizeWeekdaysArray(allowedWeekdays);
  if (clean.length === 0 || clean.length >= 7) return true;
  if (!dateInput) return false;
  const { dayOfWeek } = toBrasiliaDateParts(dateInput);
  return clean.includes(dayOfWeek);
}


