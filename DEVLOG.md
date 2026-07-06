# Risk — jatkuvan kehityksen silmukka (Continuous Development Loop)

Tavoite: nostaa peli graafisesti vaikuttavaksi UX:ää ja suorituskykyä
unohtamatta. Kehitys etenee **do-loopissa**, jonka jokainen kierros
tuottaa mitattavan parannuksen ja opit seuraavalle kierrokselle. Silmukka
itsessään on kehityksen kohde — sen puutteet kirjataan ja korjataan.

## Silmukan vaiheet

1. **PLAN** — valitse yksi korkean vaikutuksen parannus. Kirjaa konkreettinen
   tavoite ja hyväksymiskriteerit (mitä pitää nähdä/mitata). Nimeä
   reunaehdot: ei uusia raskaita SVG-suodattimia, ei jatkuvia animaatioita
   ilman reduced-motion-porttia, kevyt-tila pysyy sulavana, rajapinta
   (buildMap/updateMap/nodeRefs) ennallaan.
2. **EXECUTE** — toteuta (itse tai subagentti tarkalla art-direktiolla).
3. **REVIEW** — todenna:
   - `npm test` vihreä; render-savutesti puhdas (kaikki kartat × moodit).
   - Ei uusia suodattimia/SMIL-looppeja (grep).
   - **Visuaalinen tarkistus kuvakaappauksella** (`node tools/screenshot.mjs`),
     jonka arvioin silmällä art-directorina. Tämä on silmukan tärkein
     lisä: arvio perustuu näkyvään lopputulokseen, ei pelkkiin testeihin.
4. **LESSONS LEARNED** — kirjaa mikä toimi/ei, ja **paranna silmukkaa itseään**
   (esim. lisää tarkistus, paranna review-työkalua, tarkenna art-direktiota).
5. **JUMP** — palaa vaiheeseen 1 seuraavalla parannuksella.

## Työkalut
- `node tools/screenshot.mjs "<Kartan nimi>" <ulos.png> <w> <h>` — kaappaa
  kartta-alueen Chromiumilla. Käytä review-vaiheessa.
- Render-savutesti (DOM-shim) — nopea rakennettavuus/NaN-tarkistus.

## Iteraatiot

### Iter 0 — Silmukan pystytys + zoom
- PLAN: mahdollista visuaalinen review; suurenna hyökkäyszoomia.
- EXECUTE: playwright-core + `tools/screenshot.mjs`; DEVLOG; hyökkäyskamera
  ZOOM_FACTOR 1.6→2.4, THRESHOLD 1.25→1.7.
- REVIEW: kuvakaappaus "Suuri maailma" — peli näyttää pätevältä mutta:
  omistusvärit sameita tummaa merta vasten (fill mix 0.45 hukkaa kylläisyyden),
  isot tyhjät merialueet ylä-/alareunassa, nappulat "tarramaisia", katkoviiva-
  renkaat levottomia, maalla vähän materiaalituntua.
- LESSONS: (1) Kuvakaappaus-review on välttämätön — testit eivät kerro miltä
  näyttää. (2) Suurin heikkous on väri/kontrasti ja maan materiaali, ei
  puuttuvat elementit. Seuraavat iteraatiot: väripaletti + maan pinta +
  nappuladesign. (3) Silmukan parannus: ota kuvat sekä puhelin- (900×1500)
  että työpöytäleveydellä, ja sekä vapaa peli että keskellä-peliä.

### Iter 1 — Väri & kontrasti + nappuladesign
- PLAN: nosta omistuksen luettavuus (pois sameus) ja tee nappuloista premium.
- EXECUTE (agentti): per-omistaja pystygradientit regioneille (#region-grad-*),
  kirkas mutta syvä; nappulat enameli-medaljongeiksi (tiukennettu spekulaari,
  2-sävyinen metallireunus); levottomat katkoviivarenkaat pois → tilalle
  pieni värisokeuspipetti, jonka MUOTO vaihtelee pelaajittain (ympyrä/neliö/
  kolmio/vinoneliö/viisikulmio/tähti); vahvempi vinjetti + board-sheen.
- REVIEW (kuvakaappaus): iso parannus — värit kirkkaat ja erottuvat,
  nappulat siistit. BUGI: pipetti käytti state.territories[id] (owner/armies)
  koordinaatteina → NaN-polku selaimessa. Korjattu → TERRITORIES[id].
- LESSONS: (1) DOM-shim-savutesti EI nappaa NaN:ia kun getBBox on stub ja
  koordinaatit tulevat väärästä lähteestä — **oikea selain-review (screenshot)
  löysi bugin jota testit eivät**. Silmukan parannus: aja screenshot aina
  osana reviewiä ja tarkista PAGE ERR -tuloste. (2) Suurin jäljellä oleva
  heikkous: letterbox-tyhjä ylä/alareunassa (SVG viewBox 1000×700 mahtuu
  pystyruutuun jättäen kaistaleet) + maan litteä materiaali.

### Iter 2 — Letterbox-tyhjän täyttö (syvä meri)
- PLAN: poista musta tyhjä ylä/alareunasta niin että se lukeutuu tarkoituksena
  (syvä valtameri) eikä rikkinäisenä bändinä. Reunaehto: ei uusia suodattimia.
- EXECUTE: buildMap:iin iso "bleed"-meririkti (x-800 y-900 w2600 h2500) heti
  #sea-riktin ALLE — se ei ole #g-map:n sisällä joten se ei skaalaudu/pannaa
  vaan peittää letterbox-kaistaleet. Väri lämpöportettu (mix #06121f). CSS
  #map-wrap taustaväri radial-gradientistä tasaiseksi #06121f → sauma katoaa.
- REVIEW (kuvakaappaus iter2.png): onnistui — ylä/alakaistaleet ovat nyt
  yhtenäistä syvää merta + vinjetti, ei mustaa aukkoa. Ei PAGE ERR.
- LESSONS: (1) SVG-lapsi #g-map:n ULKOPUOLELLA on oikea tapa täyttää
  transform-riippumaton tausta — halvempi kuin fit-scalen kasvatus joka
  leikkaisi karttaa. (2) Portrait-ruudussa maisemakartta jää aina letterboxiin;
  ratkaisu on tehdä tyhjästä tunnelmallista, ei poistaa sitä. (3) Seuraava:
  maan materiaali/relief — regionit ovat vielä litteää väripaperia.
