// Smoke tests para lib/whatsappCompose.js
// Cobre os 6 cenários pedidos: telefone inválido, interpolation,
// encode correto, link wa.me válido, cliente sem telefone, normalização BR.

import { describe, it, expect } from 'vitest';
import {
  normalizeWhatsAppNumber,
  buildWhatsAppLink,
  interpolateTemplate,
  buildConfirmationMessage,
  buildPostAppointmentMessage,
  buildReminderMessage,
  buildReactivationMessage,
  buildReschedulingMessage,
} from '../../../lib/whatsappCompose.js';

describe('normalizeWhatsAppNumber', () => {
  it('adiciona DDI 55 quando telefone vem sem ele', () => {
    expect(normalizeWhatsAppNumber('11987654321')).toBe('5511987654321');
  });
  it('mantém DDI quando já presente', () => {
    expect(normalizeWhatsAppNumber('5511987654321')).toBe('5511987654321');
  });
  it('remove parênteses, hífens e espaços', () => {
    expect(normalizeWhatsAppNumber('(11) 98765-4321')).toBe('5511987654321');
  });
  it('retorna string vazia para entrada inválida', () => {
    expect(normalizeWhatsAppNumber('')).toBe('');
    expect(normalizeWhatsAppNumber(null)).toBe('');
    expect(normalizeWhatsAppNumber('abc')).toBe('');
  });
});

describe('buildWhatsAppLink', () => {
  it('gera wa.me com texto encodado', () => {
    const url = buildWhatsAppLink('11987654321', 'Olá tudo bem?');
    expect(url).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%20tudo%20bem%3F');
  });
  it('encoda quebras de linha e emojis', () => {
    const url = buildWhatsAppLink('11987654321', 'Linha 1\nLinha 2 🙌');
    expect(url).toContain('%0A');                // \n encodado
    expect(url).toContain('%F0%9F%99%8C');       // 🙌 encodado
  });
  it('retorna null sem telefone válido', () => {
    expect(buildWhatsAppLink('', 'oi')).toBeNull();
    expect(buildWhatsAppLink('xxx', 'oi')).toBeNull();
  });
});

describe('interpolateTemplate', () => {
  it('substitui placeholders no formato {nome}', () => {
    const r = interpolateTemplate('Olá {nome}, sua hora é {hora}!', { nome: 'João', hora: '14:30' });
    expect(r).toBe('Olá João, sua hora é 14:30!');
  });
  it('substitui placeholders no formato {{first_name}} (compat com pedido)', () => {
    const r = interpolateTemplate('Hi {{first_name}}', { first_name: 'João' });
    expect(r).toBe('Hi João');
  });
  it('valores undefined viram string vazia', () => {
    expect(interpolateTemplate('A{x}B', { x: undefined })).toBe('AB');
  });
  it('placeholders sem valor permanecem na string', () => {
    expect(interpolateTemplate('A{x}B', {})).toBe('A{x}B');
  });
});

describe('buildConfirmationMessage', () => {
  const company = { name: 'Barbearia X', whatsapp_settings: {} };
  const appointment = {
    customer_name: 'João Silva',
    scheduled_at: '2026-05-15T14:30:00.000Z',
  };
  it('usa template default quando whatsapp_settings.msg_confirmation está vazio', () => {
    const msg = buildConfirmationMessage({ company, appointment });
    expect(msg).toContain('João');
    expect(msg).toContain('Barbearia X');
  });
  it('respeita template customizado do dono', () => {
    const custom = {
      ...company,
      whatsapp_settings: { msg_confirmation: 'Oi {nome}, dia {data}.' },
    };
    const msg = buildConfirmationMessage({ company: custom, appointment });
    expect(msg).toMatch(/^Oi João, dia /);
  });
});

describe('buildPostAppointmentMessage', () => {
  it('injeta link_avaliacao no template', () => {
    const msg = buildPostAppointmentMessage({
      company: { name: 'X', whatsapp_settings: {} },
      appointment: { customer_name: 'Ana' },
      reviewLink: 'https://app.com/avaliar/abc',
    });
    expect(msg).toContain('https://app.com/avaliar/abc');
    expect(msg).toContain('Ana');
  });
});

describe('buildReminderMessage', () => {
  const company = { name: 'X', whatsapp_settings: {} };
  const appointment = { customer_name: 'Ana', scheduled_at: '2026-05-15T14:30:00.000Z' };
  it('default usa variant 2h', () => {
    const msg = buildReminderMessage({ company, appointment });
    expect(msg).toContain('Ana');
    expect(msg).toContain('14:30');
  });
  it('variant 24h também funciona', () => {
    const msg = buildReminderMessage({ company, appointment, variant: '24h' });
    expect(msg).toContain('Ana');
  });
});

describe('buildReactivationMessage / buildReschedulingMessage', () => {
  it('reativação usa nome do customer', () => {
    const msg = buildReactivationMessage({
      company: { name: 'X', whatsapp_settings: {} },
      customer: { name: 'Pedro Alves' },
    });
    expect(msg).toContain('Pedro');
  });
  it('reagendamento independe de whatsapp_settings', () => {
    const msg = buildReschedulingMessage({
      company: { name: 'X' },
      customer: { name: 'Pedro' },
    });
    expect(msg).toContain('Pedro');
    expect(msg).toContain('reagendar');
  });
});