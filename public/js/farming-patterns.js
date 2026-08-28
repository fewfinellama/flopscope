export const FARMING_PATTERNS_VERSION = '1.0.0';

const BOILERPLATE_REGEXES = [
  /^test$/i,
  /^hello( world)?!?$/i,
  /check[- ]?in/i,
  /heartbeat/i,
  /flop[- ]?testnet/i,
  /standing by for (the )?(flop )?(testnet )?faucet/i,
  /faucet/i,
  /didfarm/i,
  /^ping$/i,
  /gm/i,
  /gn/i,
  /^bot (online|ready|starting)/i,
  /just testing/i,
  /^hi$/i,
  /^agent (started|online|ready)/i,
  /^alive$/i,
  /LFG/i,
  /WAGMI/i,
  /^here$/i
];

export function isBoilerplate(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim();
  if (clean.length < 2) return true; // Single characters are usually noise
  
  for (const regex of BOILERPLATE_REGEXES) {
    if (regex.test(clean)) {
      return true;
    }
  }
  return false;
}
