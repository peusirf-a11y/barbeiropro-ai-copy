/**
 * botSignals.js — Detecção de bot/automação no navegador.
 *
 * Coleta sinais passivos e ativos de automação sem impacto perceptível no UX.
 * Retorna botProbability (0-100) e lista de sinais detectados.
 *
 * USO: apenas no frontend. Resultado enviado ao backend para scoring.
 */

/**
 * Coleta sinais de automação do navegador.
 * @returns {{ botProbability: number, signals: string[], isBot: boolean }}
 */
export function collectBotSignals() {
  if (typeof navigator === 'undefined') {
    return { botProbability: 0, signals: [], isBot: false };
  }

  const signals = [];
  let score = 0;

  const nav = navigator;
  const win = window;

  // 1) WebDriver detectável
  if (nav.webdriver === true) { signals.push('webdriver'); score += 40; }

  // 2) Propriedades injetadas por automação
  if ('__webdriver_script_fn' in document || '__webdriver_evaluate' in window) {
    signals.push('webdriver_evaluate'); score += 35;
  }
  if ('__nightmare' in window) { signals.push('nightmare'); score += 40; }
  if ('callPhantom' in window || '_phantom' in window) { signals.push('phantomjs'); score += 40; }
  if ('__puppeteer_evaluation_script__' in window) { signals.push('puppeteer'); score += 40; }
  if (win.domAutomation || win.domAutomationController) { signals.push('dom_automation'); score += 35; }

  // 3) Plugins ausentes (headless chrome geralmente não tem plugins)
  if (nav.plugins && nav.plugins.length === 0 && !/firefox/i.test(nav.userAgent)) {
    signals.push('no_plugins'); score += 15;
  }

  // 4) User-agent com indicadores óbvios de headless
  const ua = nav.userAgent || '';
  if (/HeadlessChrome/i.test(ua)) { signals.push('headless_chrome_ua'); score += 40; }
  if (/PhantomJS/i.test(ua)) { signals.push('phantomjs_ua'); score += 40; }
  if (/Selenium/i.test(ua)) { signals.push('selenium_ua'); score += 40; }

  // 5) Ausência de idiomas no navigator
  if (!nav.languages || nav.languages.length === 0) {
    signals.push('no_languages'); score += 20;
  }

  // 6) Chrome sem chrome object (headless)
  if (/Chrome/i.test(ua) && !win.chrome) {
    signals.push('chrome_no_runtime'); score += 20;
  }

  // 7) Ausência de outerWidth/Height (telas headless)
  if (win.outerWidth === 0 && win.outerHeight === 0) {
    signals.push('zero_outer_dimensions'); score += 15;
  }

  // 8) Permissions API inconsistente (headless tem comportamento diferente)
  if (nav.permissions) {
    try {
      // Apenas testa se a API existe — não bloqueia
      if (typeof nav.permissions.query !== 'function') {
        signals.push('permissions_api_missing'); score += 10;
      }
    } catch { /* silencioso */ }
  }

  // 9) Inconsistência de timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === 'Etc/Unknown') { signals.push('no_timezone'); score += 10; }
  } catch { signals.push('timezone_error'); score += 10; }

  // 10) Connection API ausente em browsers reais (mobile/desktop sempre tem)
  if (!nav.connection && !nav.mozConnection && !nav.webkitConnection && !/safari/i.test(ua)) {
    signals.push('no_connection_api'); score += 5;
  }

  const botProbability = Math.min(100, score);
  const isBot = botProbability >= 60;

  return { botProbability, signals, isBot };
}

/**
 * Honeypot timing check — detecta preenchimento instantâneo (bot).
 * @param {number} fillTimeMs - Tempo em ms que o form levou para ser preenchido
 * @returns {{ isBot: boolean, reason: string|null }}
 */
export function checkFormFillTiming(fillTimeMs) {
  if (fillTimeMs < 800) {
    return { isBot: true, reason: `Form preenchido em ${fillTimeMs}ms (suspeito de automação)` };
  }
  return { isBot: false, reason: null };
}

/**
 * Retorna threshold de captcha baseado no botProbability.
 * @param {number} botProbability
 * @returns {'none'|'invisible'|'checkbox'|'challenge'}
 */
export function getCaptchaMode(botProbability, riskScore = 'low') {
  if (botProbability >= 70 || riskScore === 'critical') return 'challenge';
  if (botProbability >= 40 || riskScore === 'high') return 'checkbox';
  if (botProbability >= 20 || riskScore === 'medium') return 'invisible';
  return 'none';
}