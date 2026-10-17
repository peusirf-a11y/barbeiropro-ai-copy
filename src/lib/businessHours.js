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
