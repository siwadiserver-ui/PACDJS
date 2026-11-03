/**
 * Universal Concessionaire Auto-Fill Engine
 * Magagamit sa Service Request, Reconnection, Disconnection, at Transfer
 */
async function lookupConcessionaire(part1, part3) {
  if (!part1 || !part3) return null;

  try {
    const res = await fetch(`/api/commercial/excel/search-customer?part1=${encodeURIComponent(part1)}&part3=${encodeURIComponent(part3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      return data.customer;
    }
    return null;
  } catch (err) {
    console.error('Universal lookup error:', err);
    return null;
  }
}