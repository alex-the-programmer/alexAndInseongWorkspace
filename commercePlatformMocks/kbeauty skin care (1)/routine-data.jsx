// Mock product + routine data
const CATEGORIES = [
  { id: 'cleanser', label: 'Cleanser', icon: 'Cleanser' },
  { id: 'toner', label: 'Toner', icon: 'Toner' },
  { id: 'essence', label: 'Essence', icon: 'Toner' },
  { id: 'serum', label: 'Serum', icon: 'Serum' },
  { id: 'eye', label: 'Eye cream', icon: 'Eye' },
  { id: 'moisturizer', label: 'Moisturizer', icon: 'Moisturizer' },
  { id: 'spf', label: 'Sunscreen', icon: 'SPF' },
  { id: 'mask', label: 'Mask', icon: 'Mask' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Mock product catalog
const PRODUCTS = {
  p1: { id: 'p1', brand: 'COSRX',           name: 'Low pH Good Morning Gel Cleanser',     cat: 'cleanser',   color: '#A8C4A8', price: 14 },
  p2: { id: 'p2', brand: 'Anua',            name: 'Heartleaf 77% Soothing Toner',         cat: 'toner',      color: '#D1E2C8', price: 22 },
  p3: { id: 'p3', brand: 'Beauty of Joseon', name: 'Glow Serum (Propolis + Niacinamide)',  cat: 'serum',      color: '#F4D9A8', price: 17 },
  p4: { id: 'p4', brand: 'Laneige',         name: 'Cream Skin Refiner Moisturizer',       cat: 'moisturizer',color: '#E6E1DA', price: 36 },
  p5: { id: 'p5', brand: 'Beauty of Joseon', name: 'Relief Sun Rice + Probiotics SPF 50+', cat: 'spf',        color: '#FBE6C2', price: 18 },
  p6: { id: 'p6', brand: 'Banila Co',       name: 'Clean It Zero Cleansing Balm',         cat: 'cleanser',   color: '#FFD6D6', price: 19 },
  p7: { id: 'p7', brand: 'COSRX',           name: 'Advanced Snail 96 Mucin Power Essence',cat: 'essence',    color: '#DCE7F0', price: 25 },
  p8: { id: 'p8', brand: 'The Ordinary',    name: 'Retinal 0.2% Emulsion',                cat: 'serum',      color: '#E7DAFF', price: 12 },
  p9: { id: 'p9', brand: 'Innisfree',       name: 'Retinol Cica Repair Cream',            cat: 'moisturizer',color: '#D8E2D8', price: 30 },
  // Recommendations (alternates)
  r1: { id: 'r1', brand: 'Heimish',         name: 'All Clean Balm Cleansing Balm',         cat: 'cleanser',   color: '#FFE0E0', price: 22, prevPrice: 26 },
  r2: { id: 'r2', brand: 'iUnik',           name: 'Centella Calming Daily Toner',          cat: 'toner',      color: '#CFE5D2', price: 18 },
  r3: { id: 'r3', brand: 'Anua',            name: 'Niacinamide 10 + TXA 4 Serum',          cat: 'serum',      color: '#F3E1A8', price: 24 },
  r4: { id: 'r4', brand: 'Round Lab',       name: '1025 Dokdo Lotion (Barrier)',           cat: 'moisturizer',color: '#D9E7F0', price: 27, prevPrice: 32 },
  r5: { id: 'r5', brand: 'Numbuzin',        name: 'No.5 Vitamin Brightening Eye Cream',    cat: 'eye',        color: '#F5D8C0', price: 32 },
};

// Default sample routine — what we show after onboarding completes
const SAMPLE_ROUTINE = {
  morning: ['p1', 'p2', 'p3', 'p4', 'p5'],
  evening: ['p6', 'p7', 'p8', 'p9'],
};

// What the AI recommends after the quiz — diff against current
// type: 'keep' | 'swap' | 'new' | 'remove'
const SAMPLE_RECS = {
  morning: [
    { type: 'keep', currentId: 'p1', recId: 'p1', reason: 'Gentle low-pH cleanser pairs well with your barrier-repair focus.' },
    { type: 'swap', currentId: 'p2', recId: 'r2', reason: 'Centella adds anti-redness without the alcohol in your current toner.' },
    { type: 'keep', currentId: 'p3', recId: 'p3' },
    { type: 'swap', currentId: 'p4', recId: 'r4', reason: 'A thinner barrier-first moisturizer for layering under SPF.' },
    { type: 'keep', currentId: 'p5', recId: 'p5' },
  ],
  evening: [
    { type: 'swap', currentId: 'p6', recId: 'r1', reason: 'Higher comedogenic safety rating; melts mascara faster.' },
    { type: 'keep', currentId: 'p7', recId: 'p7' },
    { type: 'swap', currentId: 'p8', recId: 'r3', reason: 'Lower irritation potential for your sensitivity rating; you can ease into retinal later.' },
    { type: 'new',  currentId: null,  recId: 'r5', reason: 'You flagged dark circles — gentle vitamin C in an eye-safe vehicle.' },
    { type: 'keep', currentId: 'p9', recId: 'p9' },
  ],
};

Object.assign(window, { CATEGORIES, CAT, PRODUCTS, SAMPLE_ROUTINE, SAMPLE_RECS });

// ===== Pricing helpers =====
// Source prices are in USD; converted on the fly per tweak.
const CURRENCIES = {
  USD: { symbol: '$',  suffix: '',   rate: 1,     locale: 'en-US' },
  KRW: { symbol: '₩',  suffix: '',   rate: 1380,  locale: 'ko-KR' },
  EUR: { symbol: '€',  suffix: '',   rate: 0.92,  locale: 'de-DE' },
  GBP: { symbol: '£',  suffix: '',   rate: 0.79,  locale: 'en-GB' },
};
function fmtPrice(usd, code = 'USD') {
  if (usd == null) return '';
  const c = CURRENCIES[code] || CURRENCIES.USD;
  const v = usd * c.rate;
  if (code === 'KRW') return c.symbol + Math.round(v / 100) * 100;
  return c.symbol + v.toFixed(2);
}
function sumRoutinePrice(routine) {
  let total = 0;
  for (const s of ['morning','evening']) for (const id of routine[s]) total += (PRODUCTS[id]?.price || 0);
  return total;
}
Object.assign(window, { CURRENCIES, fmtPrice, sumRoutinePrice });
