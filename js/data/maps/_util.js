// Apufunktio karttojen rakentamiseen särmälistasta. Takaa että naapuruus-
// suhteet ovat symmetrisiä (jokainen särmä lisätään molempiin suuntiin).

/**
 * Rakentaa territories-olion, jossa adj-listat on johdettu särmälistasta.
 * @param {Record<string,{name:string,gen:string,continent:string,x:number,y:number}>} base
 * @param {[string,string][]} edges naapuruusparit
 * @returns {Record<string, object>}
 */
export function fromEdges(base, edges) {
  const territories = {};
  for (const id of Object.keys(base)) {
    territories[id] = { id, ...base[id], adj: [] };
  }
  const add = (a, b) => {
    if (!territories[a]) throw new Error(`Tuntematon alue särmässä: ${a}`);
    if (!territories[b]) throw new Error(`Tuntematon alue särmässä: ${b}`);
    if (!territories[a].adj.includes(b)) territories[a].adj.push(b);
  };
  for (const [a, b] of edges) { add(a, b); add(b, a); }
  return territories;
}
