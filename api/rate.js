export default async function handler(req, res) {
  try {
    const url = 'https://www.binance.com/bapi/c2c/v1/public/c2c/agent/quote-price?fiat=EGP&asset=USDT&tradeType=BUY';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
    const d = await r.json();
    const data = d?.data || d;
    const buy = Number(data?.price ?? data?.buyPrice ?? data?.referencePrice ?? data?.quotePrice);
    if (!Number.isFinite(buy) || buy <= 0) throw new Error('No valid Binance P2P quote');
    res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=30');
    res.status(200).json({ buy, source:'Binance P2P', pair:'USDT/EGP', updatedAt:new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error:'Unable to fetch live Binance P2P rate' });
  }
}