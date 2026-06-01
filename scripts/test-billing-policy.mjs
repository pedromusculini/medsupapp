/**
 * Testes da política de cobrança (sem Jest).
 * Uso: node scripts/test-billing-policy.mjs
 */

function isBoleto(t) {
  return t === 'BOLETO';
}

function shouldActivate(event, billingType, hasFirstPayment) {
  if (event === 'PAYMENT_RECEIVED') return true;
  if (event === 'PAYMENT_CONFIRMED') {
    if (isBoleto(billingType) && !hasFirstPayment) return false;
    return true;
  }
  return false;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString();
}

function grace(dueDate, billingType, isFirst) {
  if (isFirst || !isBoleto(billingType) || !dueDate) return null;
  return addDays(dueDate, 3);
}

function assert(cond, msg) {
  if (!cond) {
    console.error('❌', msg);
    process.exit(1);
  }
}

assert(!shouldActivate('PAYMENT_CONFIRMED', 'BOLETO', false), 'boleto 1º CONFIRMED');
assert(shouldActivate('PAYMENT_RECEIVED', 'BOLETO', false), 'boleto 1º RECEIVED');
assert(shouldActivate('PAYMENT_CONFIRMED', 'BOLETO', true), 'boleto renov CONFIRMED');
assert(shouldActivate('PAYMENT_CONFIRMED', 'CREDIT_CARD', false), 'cartão 1º CONFIRMED');

const g = grace('2026-06-01', 'BOLETO', false);
assert(g && g.startsWith('2026-06-04'), 'grace +3');
assert(grace('2026-06-01', 'BOLETO', true) === null, '1º sem grace');

console.log('✅ test-billing-policy OK');
