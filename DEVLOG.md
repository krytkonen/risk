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

### Iter 3 — Maan relief-materiaali
- PLAN: anna maalle materiaalintuntu (kohotettu maasto) litteän väripaperin
  sijaan. Reunaehto: yksi suodatin, maskattu maahan, kytketään pois
  panoroinnin ja lite-tilan ajaksi; reunat pysyvät terävinä.
- EXECUTE: #land-relief-suodatin (yksi fraktaalikohina → vaaleat huiput +
  tummat rotkot feMergellä). #land-mask valkoisista mannerkopioista → tekstuuri
  vain maalla. Yksi maskattu rect gRegionsin PÄÄLLE, gBevelin ALLE (reunat
  terävinä). CSS: `.land-relief` pois `#map.interacting`- ja `body.lite`-tilassa.
- REVIEW (iter3.png): iso parannus — maa näyttää maastolta/materiaalilta, ei
  litteältä täytöltä. Reunat terävät, meri koskematon, värit yhä kirkkaat. Ei
  PAGE ERR, testit vihreät.
- LESSONS: (1) Yksi maskattu+suodatettu rect on halpa ja kattaa koko maan —
  per-region-gradientteja ei tarvita. (2) feMerge (vaalea+tumma samasta
  kohinasta) antaa uskottavan kohokuvion ilman kallista feDiffuseLightingia.
  (3) CSS-portitus (interacting/lite) on vakiokuvio jokaiselle uudelle
  suodattimelle — lisää se AINA samalla kun suodatin luodaan, ei jälkikäteen.
  (4) Silmukka on kypsä: PLAN→EXECUTE→screenshot-REVIEW→LESSONS toimii
  luotettavasti. Graafinen taso on nyt "mahtava" — hyvä hetki koota APK.

### Iter 4 — Rannikon syvän veden varjo (kohotettu manner)
- PLAN: saa mantereet lukemaan kohotettuina laattoina veden päällä. Reunaehto:
  ei suodatinta, ei animaatiota.
- EXECUTE: 3 leveää tummaa vetoa mantereen polusta gContin ALIMMAISENA (leveä
  30px/haalea → kapea 12px/tummin rannan lähellä). Aluetäyttö peittää
  sisäpuoliskon → varjo näkyy vain ympäröivässä vedessä. Vaalea vaahto sen
  päällä = rannikkovalo. Yhdessä: valo ranta → tummeneva syvä vesi.
- REVIEW (iter4.png): selvä parannus — mantereet "kelluvat", 3D-tuntu paljon
  vahvempi. Ei PAGE ERR, 89 testiä vihreää.
- LESSONS: (1) "Piirrä alle, anna täytön leikata" on halpa tapa tehdä
  suunnattua syvyyttä ilman suodatinta/maskia — sama tekniikka kuin vaahdolla,
  vain käänteinen sävy ja leveämpi. (2) Kerrostettu leveä→kapea + haalea→tumma
  antaa pehmeän gradientin ilman feGaussianBlurria.

### Iter 5 — Yhteysviivat purjehdusreiteiksi (kotelo + ydin + satamat)
- PLAN: naapuruusviivat lukevat reitteinä, eivät kirkkaina palkkeina jotka
  halkovat alueita. Säilytä luettavuus (viivat kertovat pelattavan naapuruuden).
- EXECUTE: lyhyt maayhteys = tumma kotelo (#06131f, 4px) + vaalea ydin
  (#d7e8f6, 1.6px) → syvyys. Merireitit saivat pienet satamapisteet (r2.4)
  päihinsä → reitti "kiinnittyy" maahan. Ei suodattimia, kaikki vetoja/ympyröitä.
- REVIEW (iter5.png): viivat integroituvat lautaan siistimmin; kotelo erottaa
  ne aluevärista ilman että ne katoavat. Ei PAGE ERR, 89 testiä vihreää.
- LESSONS: (1) Kotelo+ydin (tumma leveä alla + vaalea kapea päällä) on sama
  syvyystemppu kuin rannikkovarjossa — toimiva yleiskuvio viivoille. (2) Hienovarainen
  polish: ero on pieni mutta oikeaan suuntaan. Seuraavaksi isompi hyppy:
  mannerlabelien päällekkäisyys nappien kanssa (Etelä-Aasia/Oseania piiloutuvat).

### Iter 6 — Mannerlabelien sijoittelu (luettavuus)
- PLAN: labelit eivät piiloudu nappien taakse eivätkä leikkaudu kehykseen.
  Iso UX-hyppy: aiemmin Pohjois-/Etelä-Amerikka, Itä-Aasia, Oseania menivät
  osin piiloon.
- EXECUTE: 7 ehdokaspaikkaa (mereen ylä/ala ensin, sitten nappien yli/ali,
  reunat) + pisteytys: nappiosuma ×10, label–label-osuma ×100, prioriteettisakko
  (mereen 0 → reunat 1 → bounds-yläreuna 2), klamppaussakko (takertuu kehykseen)
  + pieni etäisyyssakko keskeltä. `placedLabels` estää label–label-päällekkäisyyden.
  clampX/Y pidetty neatline-kehyksen (18/20) sisällä.
- REVIEW (2 karttaa × screenshot, 2 hienosäätökierrosta): 1) reunasakko 3 liian
  kova → Sydänmetsä takertui kehykseen; klamppaussakko korjasi. 2) Itä-Aasia
  meni reunasakolla nappien sekaan → laskettu reunasakko 1. Lopputulos: lähes
  kaikki labelit selkeästi luettavissa molemmilla kartoilla; vain tiheän
  Itä-Aasian label osin napin takana (manner ympäröity napeilla joka suunnalta).
- LESSONS: (1) Sijoittelun pisteytys tarvitsi KAKSI screenshot-kierrosta eri
  kartoilla — yhden kartan optimi rikkoi toisen. **Testaa aina ≥2 karttaa
  layout-muutoksissa.** Silmukan parannus: review-vaiheeseen vakiona 2 karttaa.
  (2) Pehmeät sakot (painotettu summa) > kova prioriteettijärjestys: sallii
  "vähiten huono" -valinnan kun täydellistä paikkaa ei ole.

### Iter 7 — Suunnattu maavalaistus (aurinko luoteesta)
- PLAN: mantereille suurmuotoista tilavuutta yhtenäisellä valonsuunnalla.
  Reunaehto: muut kiillot ovat pystyakselilla → käytä VINOA akselia ettei
  duplikoi. Ei suodatinta.
- EXECUTE: #land-light vino linearGradient (lämmin valo NW → viileä varjo SE),
  maskattu maahan (#land-mask), relief-kerroksen päälle. Yksi rect, halpa.
- REVIEW (iter7.png): hienovarainen mutta yhtenäinen — lauta tuntuu valaistulta
  yhdestä suunnasta, lämpöä ylävasemmalle. Ei luettavuushaittaa. 89 vihreää.
- LESSONS: (1) Kun samansuuntaisia valokiiltoja on jo, uusi valo kannattaa
  laittaa ERI akselille (vino vs pysty) → lisää muotoa duplikoimatta. (2)
  #land-mask on nyt uudelleenkäytetty 2× (relief + valo) — maski kerran, monta
  kerrosta = kannattava investointi.

### Iter 8 — Silmukan parannus: PELITILANTEEN review-työkalu
- PLAN: tähän asti review näki vain staattisen aloituslaudan. Halutaan nähdä
  myös PELIN aikaiset visuaalit (valinta/kohdehighlightit, hyökkäyskameran
  zoom) — juuri niitä osia joita käyttäjä pyysi ("more zoom in", ux). Silmukan
  itsensä kehitys: uusi review-kyky.
- EXECUTE: `tools/shot-play.mjs` ajaa pelin selaimessa `window.__risk`-API:n
  kautta: sijoittaa vahvistukset, siirtyy hyökkäykseen, valitsee hyökkääjän
  (→ highlightit), valitsee kohteen, painaa "Nopat" (→ cameraFocusIn zoom).
  Kaappaa <prefix>-select.png ja <prefix>-zoom.png.
- REVIEW (play-select/zoom.png): **in-play-visuaalit ovat vahvat.**
  Hyökkääjä = kulta rengas, kohde = kirkkaan punainen rengas + katkoviivanuoli,
  kelvolliset kohteet = koralli renkaat. Taistelubanneri (nopat + tulos) selkeä.
  **Hyökkäyskameran zoom on iso ja toimiva** — täyttää ruudun taistelualueella,
  grafiikat (relief, nappulat, rannikkovarjo) kestävät lähikuvassa. Ei PAGE ERR.
  Varmistettu myös: halojen perus-stroke-opacity asetetaan inline (0.8–1.0),
  animaatio vain pulssaa päälle → kohteet näkyvät myös reduced-motion/lite-
  tilassa (ei näkymättömyysbugia).
- LESSONS: (1) Legit iteraatio voi olla SILMUKAN kyvyn parannus, ei pelin
  muutos — review ilman ajokelpoista työkalua on sokea. (2) `window.__risk`
  (getState/adj/getUi) on kriittinen testattavuuden kannalta — pidä se auki.
  (3) UI-vuorovaikutus muuttui e2e:n ajoista (nappaus VALITSEE, +N-nappi
  sijoittaa) → työkalut on pidettävä ajan tasalla oikean flow'n kanssa.
  (4) Silmukan review kattaa nyt: staattinen lauta (≥2 karttaa) + pelitilanne
  (valinta + zoom). Seuraavat iteraatiot voivat kohdistua in-play-UX:ään.

### Iter 9 — Aluetason valintakorostus (in-play UX)
- PLAN: valinta/kohde/kelvolliset kohteet erottuvat myös koko laudan mitassa,
  ei vain pieni nappirengas. Uuden pelitila-työkalun (Iter 8) mahdollistama
  in-play-parannus.
- EXECUTE: LÖYTÖ — .region-selected/-target/-valid-luokat toggletettiin JS:ssä
  mutta niillä ei ollut LAINKAAN CSS:ää (vain nappihalo korosti). Lisätty
  kirkkaat ääriviivat: kulta (valittu 3.5px), punainen (kohde 4.5px), koralli
  (kelvollinen 3px + hengittävä pulssi reduced-motionissa gated). Pelkkä stroke
  → ei suodatinta, halpa.
- REVIEW (play9-select/zoom.png): selkeä UX-voitto. Valittu alue hehkuu
  kullalla, kohde punaisella + nuoli, hyökättävät korallilla — hyökkäys-
  vaihtoehdot luettavissa yhdellä silmäyksellä sekä täys- että lähikuvassa.
  89 testiä vihreää.
- LESSONS: (1) **Kuollut koodi paljastui vasta oikeassa selain-reviewissä**:
  luokkia togglettiin turhaan ilman CSS:ää kuukausia. Työkalu (Iter 8) maksoi
  itsensä heti takaisin. (2) Rengashalo (nappi) + aluerengas (region) yhdessä =
  redundanttinen korostus joka toimii sekä lähellä että kaukana. (3) Silmukan
  malli toimii: uusi review-kyky → uusi löytö → konkreettinen parannus.

### Iter 10 — Valloitusdialogin kuolleet kontrollit pois
- PLAN: laajenna pelitila-työkalu kaappaamaan valloitusdialogi; korjaa mitä
  löytyy.
- EXECUTE (työkalu): shot-play.mjs ajaa nyt myös ison ylivoiman hyökkäyksen
  (Blitz/Nopat) → kaappaa `-conquest.png`. Vahvistus ohjattiin RAJARUUTUUN
  (oma alue jolla vihollisnaapuri) → syntyy hyökkäyskelpoinen stack.
- REVIEW-LÖYTÖ (p10-conquest.png): dialogi näytti "Siirrä 3–3 armeijaa" +
  liukusäätimen JOKA EI LIIKU (min===max). Tämä sattuu JOKA valloituksessa
  4-stackista (erittäin yleistä) → kuolleet kontrollit.
- EXECUTE (korjaus): openConquest merkitsee dialogin `.forced`-luokalla kun
  minMove>=maxMove; CSS piilottaa liukusäätimen + Min/Max + toiston. Teksti:
  "N armeijaa siirtyy alueelle." Kun valinnanvaraa on, säädin näkyy normaalisti.
- REVIEW (p10e-conquest.png): ei-pakotettu tapaus (3–6) näyttää säätimen oikein,
  ei regressiota. Pakotettu tapaus piilottaa kuolleet kontrollit (mekaaninen
  display:none luokan mukaan; sama 3–3-tapaus jonka bugina näin ennen korjausta).
  89 testiä vihreää.
- LESSONS: (1) "Kuollut kontrolli" (säädin jonka rajat ovat samat) on helppo
  jättää huomaamatta koodissa — näkyy vain kun sen oikeasti näkee. (2) Työkalun
  determinismi: ohjaa vahvistus rajaruutuun → luotettava valloitus reviewiin.

### Iter 11 — Sama korjaus linnoitusdialogiin
- PLAN: laajenna työkalu kaappaamaan linnoitusdialogi; sama kuollut säädin
  todennäköisesti myös siellä (2-armeijan alueesta siirto pakottaa 1).
- EXECUTE (työkalu): shot-play.mjs päättää hyökkäyksen, siirtyy linnoitukseen,
  valitsee oma alue ≥2 armeijaa → viereinen oma → kaappaa `-fortify.png`.
- REVIEW-LÖYTÖ: kyllä, openFortify asetti min=1, max=armeijat−1; kun armeijoita
  on 2, max=1 → sama kuollut säädin. Korjattu samalla `.forced`-kuviolla
  (piilota #fortify-range + .range-val, teksti "Siirrä 1 armeija: A → B").
- REVIEW (p11-fortify.png): ei-pakotettu tapaus (max 4) näyttää säätimen
  oikein, ei regressiota; dialogi yhtenäinen valloitusdialogin kanssa.
  89 testiä vihreää.
- LESSONS: (1) Sama bugikuvio toistui rinnakkaisessa dialogissa — kun korjaat
  yhden, ETSI sisarukset (grep `range` / `.min =`). (2) Työkalu kattaa nyt koko
  ihmisvuoron kaaren: vahvistus → hyökkäys (valinta/zoom) → valloitus → linnoitus.

### Iter 12 — Lite-tilan varmistus + linnoitussiirron visualisointi
- PLAN: (a) varmista että kevyt grafiikkatila (perf-fallback) näyttää eheältä
  uusien kerrosten kanssa; (b) toteuta linnoitussiirron visualisointi.
- EXECUTE (a): screenshot.mjs LITE=1-lippu (body.lite pakotettuna).
  REVIEW (lite.png): eheä — relief katoaa oikein (gated), halvat kerrokset
  (maavalaistus, rannikkovarjo, aluekorostus) jäävät → maltillinen mutta
  siisti degradaatio. Ei rikki.
- EXECUTE (b): LÖYTÖ — hyökkäyksillä on tracer/nuoli, linnoitussiirrolla ei
  mitään. Nuoli dialogin aikana olisi hyödytön (dialogi himmentää+blurraa
  kartan). Ratkaisu: kun linnoitus SUORITETAAN (dialogi kiinni), ammu
  porrastettu sarja kultaisia tracereita lähteestä kohteeseen (sama mekanismi
  kuin hyökkäys, fireTracer). "Joukot virtaavat" näkyy kartalla.
- REVIEW (p12-fortmove.png): kultainen tracer näkyy saapumassa kohteeseen
  (Alaska). Toimii. 89 testiä vihreää.
- LESSONS: (1) Visualisoinnin AJOITUS ratkaisee: dialogin PÄÄLLE piirtäminen on
  turhaa (blur peittää); tee se dialogin JÄLKEEN kartalla. (2) Työkalu kaappaa
  nyt myös transientit animaatiot ajoitetulla wait+screenshotilla. (3) Lite-
  tilan tarkistus kuuluu jokaiseen kerros-lisäykseen — nyt osa vakiota reviewiä.

### Iter 13 — Aloitusruudun tunnelma (ensivaikutelma)
- PLAN: kaappaa aloitusruutu (ensimmäinen mitä käyttäjä näkee) ja paranna.
- EXECUTE (työkalu): screenshot.mjs NOSTART=1 → kaappaa modal-setup ilman
  pelin aloitusta.
- REVIEW-LÖYTÖ (setup.png): dialogi kellui TASAISEN MUSTAN päällä — laudalla on
  rikas syvänmeren tunnelma, mutta ensinäkymä oli litteä. Myös HUD kuulsi läpi.
- EXECUTE (korjaus): #modal-setup sai läpinäkymättömän syvänmeren gradienttipinon
  (keskusglow + syvyys alhaalla + laudan paletti) + inset-vinjetti. Peittää
  myös HUD-läpikuultavuuden.
- REVIEW (setup2.png): selvä parannus — premium, yhtenäinen laudan kanssa,
  HUD-haamu poissa. Ei suodatinta (pelkkä CSS-gradientti).
- LESSONS: (1) Ensivaikutelma (setup) jäi katveeseen koko ajan koska review
  alkoi aina pelin aloituksesta — NOSTART-lippu paljasti sen. **Katso myös
  ne näkymät joita et normaalisti aja läpi.** (2) Tunnelma kannattaa viedä
  KAIKKIIN ruutuihin, ei vain pelilautaan — johdonmukaisuus tekee premiumin.

### Iter 14 — Pelimoodien tarkistus + jäisemmät myrskyalueet
- PLAN: kaappaa sumu- ja lumimyrskytila (ei nähty aiemmin); paranna mitä löytyy.
- EXECUTE (työkalu): screenshot.mjs MODE=fog|blizzard → kytkee moodin ennen
  aloitusta.
- REVIEW: SUMU (fog.png) hyvä — ajautuva murk peittää näkymättömät, "?"-tokenit
  tunnetuille mutta piilossa oleville, oma alue kirkkaana. LUMIMYRSKY
  (blizzard.png) toimiva mutta jäätyneet alueet olivat litteän HARMAITA.
- EXECUTE (korjaus): region-grad-blizzard kylmemmäksi/kylläisemmäksi — kirkas
  sinivalkoinen huippu → syvä jäätikkösini pohja (3 stopia).
- REVIEW (blizzard2.png): jäätyneet alueet lukevat nyt JÄÄNÄ (kirkas glacial-
  sini) eikä kuolleena harmaana — teemallisempi, premium. 89 testiä vihreää.
- LESSONS: (1) Pelimoodit/variantit on kaapattava erikseen — ne eivät näy
  oletusreviewissä. Työkalulippu per moodi = halpa kattavuus. (2) "Neutraali/
  inaktiivinen" ei tarkoita "harmaa" — teemaväri (jää=sini) viestii tilan
  paremmin ja näyttää paremmalta.

### Iter 15 — HUD:n pelaajatilastojen ikonit (luotettavuus)
- PLAN: kaappaa koko sivu (HUD + kartta) ja tarkista aina näkyvä yläpalkki.
- EXECUTE (työkalu): screenshot.mjs FULLPAGE=1 → kaappaa koko sivun.
- REVIEW-LÖYTÖ (hud.png): pelaajatilastot käyttivät `🂠` (U+1F0A0 pelikortin
  selkä) korttien ikonina → renderöityi TOFUNA (▯) — glyfi on huonosti tuettu
  monilla alustoilla. Myös `⚔` putosi tekstitilaan (✗).
- EXECUTE (korjaus): `🂠`→`🃏` (hyvin tuettu, sama jonka sovellus käyttää
  muualla) ja `⚔`→`⚔️` (FE0F pakottaa emoji-esityksen). Alueet `⬢` ok.
- REVIEW (hud2.png): kortti-ikoni renderöityy nyt (ei tofua), miekat selvemmät.
  Oikeilla laitteilla (iOS/Android) väriemojit. node --check ok.
- LESSONS: (1) Aina näkyvä HUD ansaitsee oman reviewin — se jäi katveeseen
  koska kaappasin vain #map-wrapin. FULLPAGE-lippu paljasti sen. (2) Obskuurit
  Unicode-glyfit (pelikortit, harvinaiset symbolit) = tofuriski; suosi hyvin
  tuettuja emojeja + FE0F-variaatiovalitsinta kun haluat emoji-esityksen.
- HUOM: silmukka on nyt kattanut koko sovelluksen (setup → lauta → in-play →
  dialogit → moodit → HUD). Perusviimeistely valmis; jatko kohdistuu
  yksityiskohtiin ja uusiin ominaisuuksiin.

### Iter 16 — Loput kartat + valikko/säännöt + labelpillerin luettavuus
- PLAN: kaappaa näkymät joita EI ollut vielä tarkistettu: 4 muuta karttaa,
  valikko, säännöt, loppuruutu.
- EXECUTE (työkalu): OPEN="#sel,#sel2" -lippu screenshot.mjs:ään (avaa
  overlayt esim. valikko/säännöt); shot-endgame.mjs (aja peli loppuun).
- REVIEW:
  - Valikko + Säännöt: siistit, yhtenäiset, ei vikaa.
  - Loppuruutu: shot-endgame liian hidas (~90s/vuoro selaimessa, ei käytännöllinen
    koko pelin ajoon) → koodikatselmoitu: pokaali + voittoteksti + tilastotaulu
    (valloitukset/taistelut/sarjat/pudotukset/vuorot) + konfetti. Rakenne kunnossa.
  - Kartat: Maailma (klassinen), Eurooppa, Antiikin — labelit siistit. **LÖYTÖ:
    Eurooppa 2025** (tiheä kartta) — mannerlabelit (Itämeren rannikko, Suomi,
    Ukraina, Venäjä) osuvat nappien päälle ja läpikuultava pilleri (0.55) päästi
    napin läpi → huono luettavuus.
- EXECUTE (korjaus): labelpillerin fill-opacity 0.55→0.82, stroke 0.55→0.7 →
  nimi luettavissa vaikka pilleri osuisi napin päälle.
- REVIEW (eur2025b + classicb): Eurooppa 2025 labelit selvästi luettavampia;
  klassinen kartta ei regressoinut (jopa premiumimpi). 89 testiä vihreää.
- LESSONS: (1) TIHEÄT kartat paljastavat layout-ongelmat joita harvat eivät —
  tarkista aina myös tihein tapaus. (2) Kun täydellistä sijoittelua ei ole,
  tee elementti LUETTAVAKSI päällekkäisyydestä huolimatta (opaakki tausta) sen
  sijaan että jahtaa mahdotonta ei-päällekkäisyyttä. (3) Kaikki 6 karttaa nyt
  visuaalisesti tarkistettu.

### Iter 17 — Karttakattavuuden viimeistely + tilannearvio
- PLAN: tarkista viimeiset kartat (Antiikin maailma, Eurooppa) ja varmista
  Iter 16:n pillerikorjaus.
- REVIEW:
  - Antiikin maailma: EPÄILY — mannerlegenda näytti leikkautuvan vasemmasta
    reunasta pystykaappauksessa. LEVEÄ kaappaus (1400×1000, kartan oma
    kuvasuhde) paljasti: legenda on EHJÄ (väripalat + "+2/+3/+3/+3/+4"). Ei
    bugia — letterbox-skaalaus vain teki siitä ahtaan näköisen pystyssä.
  - Eurooppa: labelit siistit. "VAHVISTUS" keskellä = ohimenevä vaihebanneri
    (reduced-motion-gated), ei vika.
- LESSONS: (1) **Letterbox voi valehdella** — jos elementti näyttää leikatulta
  pystykaappauksessa, tarkista kartan omalla kuvasuhteella ennen "korjausta".
  Olisin melkein korjannut ei-bugin. (2) Kaikki 6 karttaa + kaikki näkymät nyt
  tarkistettu.
- TILANNEARVIO: 17 iteraatiota. Silmukka on kattanut koko sovelluksen ja löydöt
  ovat kutistuneet isoista (paletti, relief, letterbox, in-play-UX) marginaali-
  siin/ei-bugeiksi. **Perusviimeistely on valmis.** Jatko kannattaa suunnata
  kohdennettuun kehitykseen (uudet ominaisuudet/sisältö) avoimen "jatka"-
  silmukan sijaan — muuten riskinä on arvoa tuottamaton churn. Silmukka teki
  tehtävänsä; se osaa nyt myös TUNNISTAA kun on valmis.

### Iter 18 — Viimeiset maksunäkymät (loppuruutu + korttienvaihto)
- PLAN: kaappaa 2 viimeistä tarkistamatonta näkymää oikealla pelisimulaatiolla.
- EXECUTE (työkalu): shot-endgame.mjs klikit force+lyhyt timeout (aiempi
  hitaus johtui ei-force-klikkien 30s retry:stä → nyt ~sekunti/vuoro).
  TRADE=1-lippu avaa korttienvaihdon kun ihmisellä ≥3 korttia.
- REVIEW:
  - Loppuruutu: 2-pelaajan peli JUMIUTUI (ihminen linnoittautui 3 alueeseen
    paksuilla armeijoilla, TÄ ei murtanut, ihminen ei laajentanut → vuorot
    31–40 tasan). Ei voittajaa 40 vuorossa → ei kaappausta. Loppuruutu jää
    koodikatselmoiduksi (rakenne kunnossa: pokaali + teksti + tilastotaulu +
    konfetti). HAVAINTO: aggressiivinen-sitten-saarrettu pelaaja voi turtata;
    ei bugi mutta pelidynamiikan reunatapaus.
  - Korttienvaihto (eg-trade.png): SIISTI — korttiruudut tyyppiemojilla
    (🎯 tykistö, 🐎 ratsuväki, 🪖 jalkaväki) + lähtöalue, selkeä pakko-vaihto-
    viesti "Seuraava sarja: +6", auto-vaihto, oikein himmennetty disabloitu nappi.
    Ei vikaa. Emojit renderöityvät.
- LESSONS: (1) Kaikki näkymät nyt tarkistettu — korttienvaihto ja loppuruutu
  olivat viimeiset, molemmat hyvin rakennettu. (2) Simulaation determinismi:
  force+lyhyt-timeout-klikit ovat välttämättömiä; ei-force-klikki jumittaa
  30s jos modaali peittää. (3) Peli voi jumiutua 2 pelaajalla (turtle) —
  mahdollinen jatkokehityskohde (esim. pehmeä vuororaja/pistevoitto).

## Tilanne: perusviimeistely valmis (18 iteraatiota)
Silmukka on käynyt läpi KOKO sovelluksen — 6 karttaa (full+lite), aloitusruutu,
koko ihmisvuoro, kaikki dialogit (valloitus/linnoitus/kortit), sumu+lumimyrsky,
HUD, valikko, säännöt, loppuruutu. Löydöt kutistuivat isoista (paletti, relief,
letterbox, in-play-UX, luettavuus) marginaalisiin ja lopulta ei-bugeiksi.
Seuraava arvo on KOHDENNETUSSA kehityksessä (uudet ominaisuudet / sisältö /
tasapaino), ei avoimessa graafisessa silmukassa.

## Kohdennettu kehitys (käyttäjän pyyntö: kaikki 1–4)

### A) Pelidynamiikka — pehmeä vuororaja + pistevoitto (#2)
- Ongelma (Iter 18 havainto): peli voi juuttua (turtle) → ei pääty. LÖYTÖ oli
  aito ei-bugi mutta pelidynamiikan puute.
- Ratkaisu: options.maxTurns (oletus 50). Kun raja ylittyy eikä kukaan ole
  voittanut, voittaja ratkaistaan pisteillä (alueet ensin, armeijat tasapeliin).
  Serialisointi + palautus päivitetty; game-over-teksti kertoo pistevoitosta.
- Testit: 2 uutta (pistevoitto rajalla; maxTurns 0 = ei rajaa). 91/91 vihreä.

### B) Tasapaino & tekoäly (#3)
- Työkalu: tools/balance.mjs — N kaikki-TÄ-peliä/kartta, raportoi seat-voitto%,
  herruus/pistevoitto, ka. vuorot. Moottori suoraan (ei selain) → nopea.
- Tulos (40 peliä/kartta, 3 pelaajaa): KAIKKI kartat päättyvät herruuteen
  (40/0), ka. 10–20 vuoroa → uusi vuororaja on turvaverkko joka EI häiritse
  normaalia peliä. Seat-voitto% klusteroituu ~33% tuntumaan (klassisella lievä
  ensipaikan etu 43%); ei vakavaa vinoumaa (±7% otantakohina 40 pelillä).
  → Kartat tasapainossa, TÄ pelaa päättäväisesti. Ei kiireellistä säätötarvetta.

## Sumun (fog-of-war) visuaalinen uudistus (käyttäjän tarkastuspyyntö)
- Tarkastus (kuvakaappaus, fog): 2 heikkoutta — (1) paljastus oli KUPLAMAINEN
  (kiinteä 70px ympyrä per alue, ei myötäillyt rajoja), (2) yleishäive tummensi
  näkyviäkin alueita → hiotut värit hukkuivat.
- Korjaus: sumumaski paljastaa nyt alueen OMALLA muodolla (regionEls[id] 'd')
  leveällä mustalla vedolla (rannikkomarginaali) + yhteinen #fog-feather-blur
  reunan pehmennykseen. updateMap togglaa paljastuksen opacityllä (ei säteellä).
- REVIEW (fog_new + fog_new_full, 2 karttaa): iso parannus — sumu myötäilee
  rannikoita orgaanisesti, näkyvät alueet TÄYSVÄRISIÄ (ei häivettä), piilossa
  olevat siistissä tummassa sumussa "?"-merkein. 91 testiä vihreää, ei PAGE ERR.
  Panorointi-gate (#g-fog hidden) säilyy → suorituskyky ok.
- LESSON: paljastus KOHTEEN OMALLA MUODOLLA (ei kiinteä primitiivi) on avain
  orgaaniseen fog-of-wariin; yksi jaettu blur riittää reunan pehmennykseen.

## 3 iteraation kierros (käyttäjä: "next iteration loops 3x")
### Loop-iter 1 — Sumun "?"-nappulat verhotuiksi
- Viileä sumuorbi-gradientti + läpikuultavuus (0.8) → tuntematon "häämöttää"
  sumussa eikä ole kiinteä musta pallo. Review: fog_q.png. 91 vihreää.
### Loop-iter 2 — Vahvistuksen sijoituskorostus
- Omat alueet saavat vahvistusvaiheessa hillityn hengittävän kultaääriviivan
  (.region-placeable, reduced-motion-gated) → pelaaja näkee mihin napauttaa.
  Review: reinforce_cue.png.
### Loop-iter 3 — Mannersiluettien realismihionta (käyttäjän valinta #2)
- Kysymys: pitäisikö kartat esittää oikeita mannermuotoja? Vastaus: kevyt
  siluettihionta, ei geometrian remonttia.
- LÖYTÖ: continentOutline käytti KONVEKSIA peitettä (convex hull + säteispush)
  → mantereet olivat pyöreitä möykkyjä (ei niemekkeitä/lahtia).
- Ratkaisu: kulmapyyhkäisy — N=42 sektoria, kussakin uloin alue → ääriviiva
  MYÖTÄILEE alueita (niemekkeet ulos, lahdet sisään). Alueet ovat jo
  maantieteellisesti aseteltuja, joten tunnistettavuus paranee. Konkaavius
  pidetty LOIVANA (naapurivaikutus 0.9, tyhjien interpolointi 0.82) ettei
  Voronoi-puolitasoleikkaus riko soluja. Solut täyttyvät automaattisesti (ne
  leikataan samasta ääriviivasta).
- REVIEW (KAIKKI 6 karttaa, leveä kuvasuhde): iso parannus — Etelä-Amerikka
  kapenee Argentiinaan, Afrikka pullistuu länteen & kapenee etelään, Italia
  saapasmainen, Iberia niemeke, Kamtšatka/Intia niemekkeitä. EI soluglitchejä
  yhdelläkään kartalla. 91 vihreää.
- LESSON: kun alueet ovat valmiiksi oikein aseteltuja, ääriviivan kulmapyyhkäisy
  (ei konveksi hull) tuo geografian esiin ILMAN aluegeometrian uusintaa —
  halpa, iso vaikutus. Geometriamuutos = tarkista KAIKKI kartat.

## Mannersiluetit v2 — voimakkaampi (käyttäjä: "muutos oli pieni, vie pidemmälle")
- Edellinen versio kapitoi konkaaviuden liikaa (interpolointi 0.82, pad 40) →
  muutos jäi hienovaraiseksi.
- v2: kulmapyyhkäisy N=60, RANNIKKOALUEIDEN VÄLI lineaari-interpoloidaan (suora
  rannikko, ei valelahtia), AITO lahti vain isoon tyhjään sektoriin (syvyys
  kasvaa raon mukaan, sini-profiili, jopa -55 %). Pad 40→22 (tiukka myötäily).
  Rannikko monimittakaavainen: karkeat niemet/lahdet (~4 pisteen välein) + hieno
  rosoisuus. Säde radiaalinen → polygoni yksinkertainen (ei pinch) → solut ehjät
  syvälläkin konkaaviudella.
- REVIEW (KAIKKI 6 karttaa): iso parannus — Pohjois-Amerikka kapenee Keski-
  Amerikan kannakseen, Etelä-Amerikka kärkeen (Argentiina), Afrikka pullistuu
  pohjoiseen & kapenee etelään + Madagaskar erillinen, Aasia niemekkeineen
  (Intia/Kamtšatka/Kaukoitä), Iberia & Italia niemekkeitä. Rannikot rosoiset.
  EI soluglitchejä millään kartalla (myös tiheä Eurooppa 2025 & erillis-
  saariset Taruvaltakunnat ehjiä). 91 testiä vihreää.
- LESSON: lineaari-interp rannikkoalueiden VÄLILLÄ (ei radiuksen vaimennus) +
  lahti vain isoon rakoon = coast myötäilee alueita luonnollisesti. Radiaalinen
  r(θ) takaa pinch-vapaan polygonin → syväkin konkaavius on solu-turvallinen.

## Maasillat — Eurooppa–Aasia ei enää merisaukkoa (käyttäjän havainto)
- Ongelma: tiukat siluetit avasivat merisaukon Euroopan ja Aasian väliin —
  mutta ne ovat yhtä maamassaa (Euraasia), maaraja ei saa näyttää mereltä.
- LÖYTÖ: etäisyys EI erottele maata merestä (Australian saarihypyt 116 ja
  Välimeri 127 menevät päällekkäin aitojen maarajojen 90–121 kanssa) → ei
  luotettavaa kynnystä. Tarvitaan semanttinen data.
- Ratkaisu: `landBridges` per kartta (classic + suurmaailma) — lista MAAYHTEYS-
  mannerpareista (Euraasia, Panama, Siinai). continentOutline ulottaa rannikon
  naapuria kohti (56 % → limitys) VAIN näille pareille → mantereet koskettavat.
  Merirajat (Atlantti/Välimeri/Bering/saaristot) eivät ole listalla → jäävät auki.
- VARMISTUS (ohjelmallinen, ei kuvaa — kertyneet kuvat ylittävät 32MB-pyyntörajan):
  luokittelu oikein — africa|asia, asia|europe, north-america|south-america =
  SILTA; africa|europe, *|australia, *bering*, atlantit = meri. Geometria:
  molemmat mantereet ulottuvat 56 % → 12 % limitys → koskettavat varmasti.
  91 testiä vihreää (render-savutesti rakentaa kaikki kartat ilman kaatumista).
- LESSON: maa/meri-semantiikkaa ei voi päätellä etäisyydestä; se on dataa.
  Mannerpari-taso (ei per-yhteys) riittää ja on vähän dataa.
- HUOM: kuvakaappaus-review ei onnistunut (32MB pyyntöraja kertyneistä kuvista)
  → varmistettu ohjelmallisesti + testeillä; pyydä käyttäjää katsomaan live.

## 3 kierrosta (kuva-review estynyt: kertyneet kuvat > 32MB pyyntöraja → verifiointi testeillä + ohjelmallisesti + käyttäjä livenä)
### Loop 1 — landBridges kaikille aluekartoille
- Laajennettu maasilta-korjaus (Eurooppa/Eurooppa 2025/Antiikki). Manner-Eurooppa,
  Baltia, Venäjä yhtenäisiä; Brittein saaret & Välimeren/Itämeren ylitykset auki.
  Luokittelu tulostettu ja tarkistettu; käyttäjä vahvistaa livenä.
### Loop 2 — landBridges-eheystesti
- Uusi testi: jokainen landBridge-avain viittaa OLEMASSA OLEVIIN, VIEREKKÄISIIN
  mannerpareihin, aakkosjärjestyksessä, ei duplikaatteja. Suojaa "sokkona"
  kirjoitettua dataa (ei kuva-reviewiä). 92 testiä vihreää.
### Loop 3 — AI:n mannerbonustietoisuus
- bestAttack suosii nyt valtausta joka VIIMEISTELEE mantereen (+4 pisteytys) →
  AI nappaa mannerbonukset = fiksumpi vastustaja. Paino maltillinen (4, ei 6)
  ettei liikaa lumipalloa. VERIFIOINTI: (a) yksikkötesti todistaa että AI
  valitsee viimeistelevän valtauksen isommankin raa'an ylivoiman ohi; (b)
  balance-simulaatio — pelit yhä ratkeavat päättäväisesti (10–22 vuoroa, ei
  kaatumisia). 93 testiä vihreää.
- LESSON: ilman kuva-reviewiä paras verifiointi on OBJEKTIIVINEN yksikkötesti
  (ei "tuntuu paremmalta"). Testin rakentaminen paljasti oman virheen (kaikki
  omalle → joka valtaus "viimeistelee") → testi pakotti oikean setupin.

## Maasiltojen KUVA-verifiointi (kuva-review palautui: pieni DSF=1 alle 32MB)
- PLAN: verifioida SILMÄLLÄ edellisen session sokkona kirjoittama landBridges-
  data kolmella aluekartalla (Eurooppa / Eurooppa 2025 / Antiikin maailma).
  Aiemmin review oli estynyt 32MB-pyyntörajalla; nyt DSF=1 + ~1500px kuvat
  mahtuvat → oikea silmävarmennus onnistuu.
- TYÖKALU: screenshot.mjs sai WAIT=ms-lipun (ohittaa ohimenevän "VAHVISTUS"-
  vaihebannerin ennen kaappausta) → puhtaat lautakuvat.
- MENETELMÄ: enumeroitiin jokaisen kartan MANNERTENVÄLISET särmät (skripti) ja
  luokiteltiin jokainen pari maa/meri-semantiikan mukaan (todelliset rajat),
  sitten VERRATTIIN landBridges-dataan + tarkistettiin kuvasta.
- LÖYTÖ 1 (Eurooppa): `east|nordic` merkitty maasillaksi, mutta sen AINOAT
  särmät ovat baltics–sweden (Itämeri) ja baltics–finland (Suomenlahti) — molemmat
  MERIYLITYKSIÄ, ei yhtään maasärmää. Sulki Suomenlahden jonka tehtävä listaa
  nimenomaan AUKI pidettäväksi. Manner-Eurooppa pysyy yhtenäisenä ilman sitä
  (Pohjola kiinni Tanska–Saksa-kannaksella, Itä-Eurooppa Puola–Baltia-rajalla).
  KORJAUS: poistettu `east|nordic`. KUVA: Itämeri/Suomenlahti aukeaa siististi
  Skandinavian ja Baltian väliin; Skandinavia pysyy niemenä kiinni Tanskasta.
- LÖYTÖ 2 (Eurooppa 2025): `itameri|lansi` merkitty MEREKSI (kommentti jopa
  "avoin Itämeri"), mutta sen ainoa särmä on puola–saksa = Puola–Saksa, ISO
  MAARAJA. KORJAUS: lisätty `itameri|lansi`. KUVA: Puola ja Saksa koskettavat;
  Suomenlahti (Suomi–Viro) ja avoin Itämeri (Ruotsi–Puola) pysyvät auki,
  Britannia pysyy saarena.
- ANTIIKIN MAAILMA: `gallia|iberia` (Pyreneet) + `gallia|italia` (Alpit) täsmää
  aiottuun; muut parit (Adrianmeri, Egeanmeri, Pohjois-Afrikan hajautus) ovat
  Välimeri-suunnittelua → EI muutosta. KUVA vahvisti: Iberia kiinni Galliaan,
  Gallia kiinni Italiaan, merirajat auki.
- REVIEW: 93 testiä vihreää (eheystesti hyväksyy uudet avaimet); molemmat
  korjaukset todennettu kuvakaappauksella ennen/jälkeen. Ei PAGE ERR.
- LESSON: (1) maa/meri-luokittelu kannattaa johtaa MANNERTENVÄLISISTÄ SÄRMISTÄ,
  ei kommenteista — kaksi bugia oli juuri siellä, missä kommentti sanoi yhtä ja
  särmä (puola–saksa / baltics–finland) toista. (2) Kun pari-avaimessa on VAIN
  meriylityksiä eikä yhtään maasärmää, se ei kuulu maasiltoihin — toisin kuin
  parit joissa on edes yksi maasärmä (esim. central|east: poland–ukraine oikeuttaa
  sillan Italia–Balkan-merisärmästä huolimatta). (3) DSF=1 + ~1500px pitää kuvat
  alle 32MB → kuva-review toimii taas; se löysi datan jonka testit hyväksyivät.

## Silmukan jatkokehitelmä: +VERIFY-vaihe (adversariaalinen falsifiointi)
PLAN → EXECUTE → REVIEW → **VERIFY** → LESSONS → JUMP. VERIFY rakentaa
objektiivisen kokeen joka YRITTÄÄ todistaa muutoksen rikki (ei "näyttää hyvältä").
Peli-logiikalle = simulaatio; UI:lle = ennen/jälkeen-kuva + PAGE ERR.

### Kohdennettu 3-iteraation kierros (käyttäjä: "tee pelistä paljon parempi")
#### Iter A — Tekoälyn vaikeustasot (Helppo / Normaali / Vaikea)
- PLAN: skaalaa haaste. Kriteeri: mitattava voimasuhde Vaikea > Normaali > Helppo;
  Normaalin pelityyli ENNALLAAN (ei regressiota). Reunaehto: rajapinta säilyy.
- EXECUTE: per-pelaaja `difficulty` (game.js options + players + restore).
  ai.js difficulty-tietoiseksi:
  - Helppo: hajottaa vahvistukset kaikille rajoille (ei kärkeä), hyökkää vain
    ylivoimalla ≥3, ei mannerbonustietoisuutta → heikko, voitettava.
  - Normaali: ennallaan (keskitetty kärki, ylivoima ≥1, mannerbonus +4).
  - Vaikea: kärki painottaa MANNERPROGRESSIA (lumipallo), varaa puolustusreservin
    uhatuimmalle rajalle, hyökkää voittotodennäköisyydellä (wp≥0.4, skippaa
    huonot kertoimet), painottaa viimeistelyä (+8) ja ELIMINOINTIA (+5).
  UI: "Tekoälyn taso" -valitsin aloitusruutuun (oletus Normaali).
- REVIEW: 96 testiä vihreää (3 uutta: hyökkäyskuri 3-portainen, vahvistuksen
  hajonta vs keskitys, oletus+serialisointi). Kuva setup_diff.png: valitsin
  renderöityy siististi muiden pickereiden tyylillä.
- VERIFY (tools/ai-duel.mjs, 320 peliä/matchup, molemmat seatit): Vaikea voittaa
  Helpon 87 %, Normaalin 56.3 % (~2.3σ yli 50 %, tilastollisesti merkitsevä),
  Normaali Helpon 82 %. → järjestys todistettu. Balanssi (normaali all-AI)
  ennallaan (normaalin koodipolku bittitarkka).
- LESSON: 2p-simulaatiossa pelkkä "kuri" (skippaa huonot hyökkäykset) EI erottunut
  Normaalista (tasan 50.0 % = identtinen peli) — vahvuusero tarvitsi KOMPOUNDAAVAN
  edun (mannerbonusten lumipallo). Adversariaalinen simulaatio paljasti tämän heti;
  ilman VERIFYä "Vaikea" olisi ollut vain Normaali eri nimellä.

#### Iter B — Taistelun voitto-osuus hyökkäyspaneeliin (päätöspalaute)
- PLAN: muuta sokkohyökkäys tietoon perustuvaksi. Kriteeri: paneeli näyttää
  koko taistelun voittotod. hyökkääjä+kohde valittuna; luku EI saa yliarvioida.
- EXECUTE: addWinProb() → 🎯-merkki (calcBlitzWinProb), väri riskin mukaan
  (≥65 % vihreä / 40–65 % keltainen / <40 % punainen). CSS .win-prob. Sääntöteksti.
- REVIEW: play-panel.png — "Alaska(5)→Luoteisterritorio(3)  🎯 64%" keltaisena,
  vastaa calcBlitzWinProb(5,3). Ei PAGE ERR. 99 testiä vihreää.
- VERIFY (tests/winprob.test.mjs): (1) näytetty% vs REILUJEN noppien toteutunut
  valloitus (4000 otosta/tapaus) ±3 %-yks. → merkki ei valehtele. (2) Blitz
  valloittaa VÄHINTÄÄN näytetyn verran → merkki on konservatiivinen kummassakin
  tilassa. LÖYTÖ: tasapainotettu Blitz vuotaa ~4 %-yks. hyökkääjän eduksi (ei
  reilu näyte) → siksi merkki näyttää REILUT nopat (rehellinen molemmille tiloille).
- LESSON: kun kaksi satunnaislähdettä (reilut nopat vs vinoutettu blitz) antavat
  eri jakauman, näytä KONSERVATIIVISEMPI → merkki ei koskaan lupaa liikaa.

#### Iter C — "Kenraali"-taso (käyttäjän strategiaehdotukset)
- PLAN: uusi vahvin taso joka pelaa kuin asiantuntija. Käyttäjän ideat:
  (1) suosi PUOLUSTETTAVINTA mannerta (vähän kapeikkoja → keskitä joukot pienelle
  alueelle), (2) tapa kortillinen pelaaja jos hän on voitettavissa vuorossa
  (korttisaalis), (3) LUMIMYRSKY muuttaa puolustettavuutta (suljetut rajat).
- EXECUTE (ai.js): difficulty 'kenraali'.
  - continentChokes(state,c): mantereen ELÄVÄT kapeikot (blizzard-tietoinen:
    suljettu alue/naapuri ei ole elävä raja) → puolustettavuus = bonus/kapeikot.
  - pickTargetContinent: puolustettavin manner johon on jalansija; rakenna kärki
    sen viholliseen, pidä pinoamalla uhatuin kapeikko (varaa vain tarpeen, LOPUT
    laajennukseen → ei turtlaa).
  - pickKillTarget: elossa oleva kortillinen vastustaja jonka kaikki alueet
    voi uskottavasti vallata tänä vuorona (rajan ylivoima ≥ hänen armeijat+alueet).
    Vahvistus ja hyökkäys keskittyvät häneen (bestAttack +6 kohteelle).
  - Hyökkäys jakaa Vaikean kertoimet+eliminoinnin; linnoitus keskittää puolustuksen
    uhatuimpaan kapeikkoon (myös matalapaineinen reuna lähteeksi → hylkää turvaton).
  UI: "🎖 Kenraali"-vaihtoehto. (Käyttäjän pyynnöstä Vaikea → 😎.)
- REVIEW: 103 testiä vihreää (4 uutta kenraali-mikrotestiä: korttisaalis-priorisointi,
  kerroinkuri, lumimyrsky-portti, validius). Kuva setup_4tiers.png: 4 tasoa siististi.
- VERIFY (tools/ai-duel.mjs): 2p-tikapuut Vaikea>Normaali>Helppo (57/87/83 %).
  KENRAALIN oikea koeympäristö = FFA (moninpeli, jossa ylilaajentuminen rankaistaan):
  3p 41.7 % (reilu 33 %), 4p 34.9 % (reilu 25 %), 4p+MYRSKY 32.6 % → kenraali on
  selvästi vahvin moninpelissä, myös lumimyrskyllä (validoi blizzard-tietoiset
  kapeikot). 2p vs Vaikea ≈ 50 % (odotettu: strategia ei ole 2p-etu).
- LESSON: strategian VAHVUUS RIIPPUU KONTEKSTISTA. Puolustettavuus/kapeikko-peli
  ei erotu 2p-duellissa (ei kolmatta rankaisemassa aggressoria) mutta loistaa
  FFA:ssa. Adversariaalinen VERIFY paljasti tämän (2p kenraali 47 % < Vaikea) ja
  ohjasi mittaamaan OIKEASSA ympäristössä (FFA) — muuten olisi "korjattu" väärää
  asiaa tai julistettu taso vahvemmaksi kuin se 2p:ssä on.

## Tilanne: 3 kohdennettua iteraatiota (vaikeustasot, voitto-osuus, Kenraali)
Peli on nyt merkittävästi syvempi: 4 AI-tasoa (Helppo→Kenraali), taistelun
voitto-osuus-palaute, ja asiantuntija-AI joka hahmottaa puolustettavuuden,
kapeikot, korttisaaliin ja lumimyrskyn. Kaikki todennettu FFA-simulaatiolla +
kuvakaappauksilla. 103 testiä vihreää.

## Jatko: "tee kaikki ehdottamasi ideat" (D: hienosäätö, E: missiot, F: kartta)
### Iter D — Kenraalin FFA-hienosäätö (kohdemanner-fokus)
- PLAN: nosta Kenraalin FFA-voitto% rikkomatta 2p-tasapainoa. Hypoteesi:
  avaa liikaa rintamia → pitäisi TURVATA kohdemanner ennen laajentumista.
- EXECUTE: state._kenraaliTarget (kohdemanner per vuoro). bestAttackissa: kunnes
  kohdemanner on kokonaan omani, +8 sen alueille ja −4 muille → keskitys.
  PORTTI: vain kun ≥3 elossa (2p:ssä yksi rintama → lumipallo parempi).
- VERIFY (ai-duel, N=40): FFA 3p 43.1 %, 4p 36.1 %, 4p+myrsky 34.1 % (ylös
  baseline 41.7/34.9/32.6:sta, johdonmukaisesti). 2p vs Vaikea 46.9 % (≈ tasan,
  ei romahdusta). 2p-tikapuut ennallaan. 103 testiä vihreää.
- LESSON: FFA-optimointi HEIKENSI 2p:tä (44 %) — portitus elossa olevien määrään
  ratkaisi. Strategiaheuristiikat kannattaa kytkeä KONTEKSTIIN (pelaajamäärä),
  ei soveltaa universaalisti. Sim-kohina ±3 % (N=24) → päätökset N≥40:llä.

### Iter E — Salaiset tavoitteet (missiot) omana moodinaan
- PLAN: valinnainen moodi jossa jokaisella pelaajalla oma salainen voittotavoite;
  voitto tavoitteella TAI herruudella. Kriteeri: kaikki tavoitteet LAUDASTA
  johdettavissa (ei erillistä seurantaa), pelit päättyvät aina, serialisoituu.
- EXECUTE (game.js): options.missions. assignMissions arpoo siemennetysti:
  continents (2 nimettyä), anyContinents (N), territories (K), territoriesArmed
  (K alueella ≥2). missionComplete() + missionText(). Missiovoitto checkWinissä
  (valloituksen jälkeen) JA endTurnissa (armeijapohjaiset). Herruus toimii yhä.
  UI (main.js/index.html/css): "🎯 Salaiset tavoitteet" -kytkin, aloitustoast +
  valikon "Oma tavoite", loppuruudun paljastus (kaikkien tavoitteet + ✓/✗).
- REVIEW: 111 testiä vihreää (8 uutta: arvonta, kaikkien tyyppien tunnistus,
  missiovoitto, herruus-yhteensopivuus, teksti, serialisointi). Kuva
  setup_missions.png: kytkin renderöityy siististi.
- VERIFY (all-AI 4p missiopelit, 120 peliä/6 karttaa): 120/120 päättyi, kaikki
  missiovoittoon (0 kesken) → tavoitteet toimivat oikeassa pelissä ja pelit
  päättyvät. Missiot ovat herruutta nopeampi voittopolku (odotettua).
- LESSON: laudasta-johdettavat tavoitteet (ei eliminointi-fallbackia) välttävät
  hauraat reunatapaukset ja ovat triviaalisti testattavia; win-tarkistus PITÄÄ
  laittaa BÅDE valloituksen jälkeen ETTÄ vuoron lopussa (armeijapohjaiset täyttyvät
  vahvistus/linnoitusvaiheessa, ei valloituksessa).

### Iter F — Kenraalin vahvistus (KÄYTTÄJÄN PLAYTEST-PALAUTE)
- PALAUTE: "Kenraali ei ole vaikea — voitin helposti. Lähes jokaisessa alueessa
  vain 1 joukko." + "hyödynnä PULLONKAULOJA, keskeytä valtaus pullonkaulaan" +
  "estä vastustajaa omistamasta kokonaista mannerta".
- LÖYTÖ: FFA-sim EI paljastanut tätä (kaikki AI:t yhtä hauraita → ihminen
  hyödyntää 1-joukon rajat, sim ei). → uusi mittari tarvittiin.
- EXECUTE (ai.js):
  1) GARRISON: vahvistus nostaa JOKAISEN 1-joukon rajan ≥2 (poistaa ilmaiset
     läpimurrot) ennen kärkeä.
  2) VAROVAINEN HYÖKKÄYS: Kenraali wp≥0.55 (ei vuoda pinoja tasaväkisiin) →
     pysähtyy luonnostaan puolustettuihin kapeikkoihin.
  3) PULLONKAULA-DOKTRIINI (pehmeä): valtaa VAHVASTI kohti puolustettavaa
     laajennuskohdetta (+8) ja rankaise sprawlausta avoimeen (−4) → harva, vahva
     raja MUTTA laajenee yhä (ei turtlaa). Poikkeukset: bonuksen kielto, korttisaalis.
  4) KIELLÄ MANNERBONUS: +7 jos valtaus rikkoo vihollisen KOKO mantereen.
  5) Valloitussiirto jättää kapeikkovaruskunnan (vahvin viereinen vihollispino).
- VERIFY (uusi mittari + FFA, N=40): 1-JOUKON RAJAT 60 %→**15.4 %** (Vaikea 50.3 %)
  → ei enää ilmaisia läpimurtoja. FFA 3p 45.8 %, 4p 37.2 %, 4p+myrsky 31.7 %
  (vahvin, ei romahtanut). Kenraali pitää KOMPAKTIN mutta LAAJENEVAN valtakunnan.
  113 testiä vihreää (2 uutta: garrison, mannerbonuksen kielto).
- LESSON: (1) sim-VERIFY sokea "hauras ihmistä vastaan" -heikkoudelle koska kaikki
  AI:t jakavat sen → tarvittiin KOHDENNETTU mittari (1-joukon rajojen %). Ihmisen
  playtest löysi sen minkä 1000 sim-peliä eivät. (2) KOVA portti (valtaa vain
  kohdemanner) teki AI:sta liian passiivisen (FFA romahti 22 %) — "joskus pysähdy"
  = PEHMEÄ preferenssi, ei absoluutti. Pisteytys+kynnys yhdessä → oikea tasapaino.

### Iter G — Uusi kartta: Afrikka
- PLAN: uusi sisältökartta selkein kapeikoin (näyttää Kenraalin puolustuspelin).
- EXECUTE: js/data/maps/africa.js — 20 aluetta, 5 alueryhmää (Pohjois/Länsi/Keski/
  Itä/Etelä-Afrikka), yhtenäinen maamassa → kaikki vierekkäisparit maasiltoja.
  Rekisteröity territories.js:ään (picker + kaikki testit kattavat auto­maattisesti).
- REVIEW (kuva africa.png): tunnistettava Afrikan muoto (länsipullistuma,
  Somalian sarvi, kapeneva etelä), 5 väritettyä ryhmää, selkeät kapeikot
  (Sudan pohjoinen↔itä, Kongo keskushubi), ei solu­glitchejä, yksi maamassa
  (ei virhemeriä). 117 testiä vihreää (eheystesti hyväksyy uuden kartan).
- VERIFY (balance.mjs, 40 peliä): kaikki pelit päättyvät herruuteen, ka. 9 vuoroa;
  seat-voitto% [25 30 45] — lievä viimeisen paikan etu (~1.5σ, klassisen luokkaa),
  ei vakavaa vinoumaa. Kartta pelattava ja tasapainossa.
- LESSON: yhtenäisen maamassan kartalla landBridges = KAIKKI vierekkäisparit
  (ei merirajoja) → siluetit sulautuvat yhdeksi mantereeksi kuten pitääkin.

## Kenraalin voitto-% -optimointi (käyttäjä: ≥45% moodeissa enemmistöllä kartoista)
Työkalu: tools/kenraali-bench.mjs — 1 kenraali vs (P−1) vaikea, KAIKKI kartat ×
KAIKKI moodit (normaali/sumu/myrsky/kiinteä), istumapaikka kierrätettynä. Sumu = AI
ei käytä sumua (täysi info) → sama kuin normaali (varmistus). Reunaehto: strategia
ANALYSOI karttaa (puolustettavuus/kapeikot/koko), EI karttakohtaisia sääntöjä.
- LÄHTÖ 35 % → LOPPU ~51.5 % (FFA 4p). Iteratiivinen mittaus­pohjainen tuning:
  1) DIAGNOOSI: Kenraali hävisi lähes aina ELIMINOITUNA (ei pisteissä) → liian
     passiivinen; aggressiiviset Vaikeat lumipalloavat sen yli.
  2) ISO KORJAUS: vahvistus KOHDISTETTU samaan laajennuskohteeseen kuin hyökkäys
     (olivat eri mantereita → voima hajaantui) → keskitetty voima viimeistelee
     mantereen. +4 %-yks.
  3) DOKTRIINI: yksi aggressiivinen linja (ei passiivista vaihetta joka söi voittoja);
     kevyt garrison (0.2, vaihe-1 nostaa 1-joukon rajat halvalla) → jättää silti
     laajennukseen voimaa; pehmeä pullonkaula-fokus (+10 kohdemanner, −2 sprawl) →
     lumipallo mutta ei sprawlaa; halvin-viimeisteltävä kohdemanner (karttaa
     analysoiden); korttitalous (kortti joka vuoro); eliminointi + mannerbonuksen
     kielto. LUMIMYRSKY: kohdemanner ei saa olla suljettu (ei viimeisteltävissä),
     sprawl-sakko kevyempi.
- VERIFY (kenraali-bench, N=24, 2688 peliä): kokonais-FFA ~51.5 %. Kartta­keskiarvot
  (kaikki moodit): 5/7 karttaa ≥45 % (Maailma 66, Eur2025 60, Suuri 62, Taru 48,
  Eurooppa 45; Antiikki 36, Afrikka 43). Moodeittain ≥45 %: normaali/sumu 6/7,
  kiinteä 5/7, LUMIMYRSKY 3/7 (isot kartat ≥55 %, pienet 20-alue-kartat 32–41 %:
  myrsky lisää varianssia joka syö taitoedun pienillä kartoilla). ai-duel: 2p 58 %
  (Kenraali voittaa nyt Vaikean myös 2p:ssä), 3p 66 %, 4p 52 %, 4p+myrsky 46.5 %.
- LESSON: (1) VAHVISTUS JA HYÖKKÄYS ON KOHDISTETTAVA SAMAAN — hajautunut voima on
  ison luokan bugi joka ei näy testeissä, vain simulaatiossa. (2) Aggressiokäyrä
  litteä ~40 %:ssa; mannerbonusten KESKITETTY lumipallo mursi katon 51 %:iin.
  (3) Lumimyrsky pienillä kartoilla = varianssikatto (~40 %), ei parametrikysymys;
  isot kartat kestävät myrskyn. (4) 20.9 % 1-joukon rajoja (Vaikea 57.5 %) → yhä
  selvästi vaikeampi ihmiselle kuin aggressiivinen perus-AI.

## Yhteenveto: laaja kohdennettu kehityskierros
Session lisäsi: 4 AI-tasoa (Helppo/Normaali/Vaikea/Kenraali), taistelun voitto-
osuus, salaiset tavoitteet -moodi, ja uuden Afrikka-kartan. Kenraali kehittyi
käyttäjän playtest-palautteen mukaan asiantuntijamaiseksi (kapeikot, ei ilmaisia
läpimurtoja, mannerbonuksen kielto, korttisaalis, lumimyrsky-tietoisuus).
117 testiä vihreää; kaikki AI-muutokset todennettu FFA- + puolustus­mittari­
simulaatioilla, UI kuvakaappauksilla.

## Moniagenttipaneeli → 3 kehitysiteraatiota (käyttäjä: roolit + vastaväitteet, ei äänestystä)
Paneeli (24 agenttia, monirooli: aloittelija/UX/saavutettavuus/retentio/skeptikko).
Ideat käsiteltiin VASTAVÄITTEIDEN kautta — isot piirteet (uudet moodit, moninpeli-
verkko, tekoälyn selitykset) kaatuivat rebuttaliin (skooppi/ylläpito); pienet,
korkean tuoton parannukset selvisivät. Kolme kärkeä toteutettu:
- IT1 ONBOARDING: maybePhaseBanner näyttää KERTALUONTOISEN MITÄ+MIKSI-valmennus-
  vihjeen kun ihminen astuu vaiheeseen 1. kertaa (localStorage-portitus
  risk-coach-*), + "Aloittelijan opas" sääntömodaaliin (tavoite, vaiheet,
  mannerbonukset, kortit, voitto-%). Ei erillistä opastusmoottoria.
- IT2 VÄRISOKEUSTURVALLINEN PALETTI: vanha puna/vihreä-pari oli klassinen
  sekaannus. Okabe-Ito-johdannainen paletti (PLAYER_COLORS + dark/light +
  gradientit). VERIFY tools/cvd-sim.mjs: pienin pareittainen ΔE (normaali +
  protan/deuteran/tritanopia) nousi ~5.9 → ~16.1 (yli JND:n joka tilassa).
  Muotopipit hoitavat silti pahimman tapauksen.
- IT3 NIMETYT TALLENNUSPAIKAT: 3 paikallista slottia (autosaven lisäksi),
  korvaussuoja (täysi paikka → "Korvaa?"-toinen napautus), lataus/tyhjennys.
  Hiljainen kiintiövirhe → näkyvä toast (ei enää hiljaista datahävikkiä).
  VERIFY: tallenna→korvaussuoja→lataa-kierros headless-selaimessa, 0 konsolivirhettä.
- LESSON: (1) Vastaväite-ensin-paneeli suodattaa "kiiltävät" isot piirteet ja
  nostaa halvat korkean tuoton korjaukset (onboarding, saavutettavuus) — sama
  kuin adversariaalinen VERIFY, mutta suunnitteluvaiheessa. (2) Saavutettavuutta
  EI arvata: CVD-simulaatio antoi määrällisen ΔE-mittarin paletin valintaan.
  117 testiä vihreää; UI todennettu kuvakaappauksin + headless-round-trip.

## Moniagenttipaneeli #2 → 3 mobiili-kosketusiteraatiota (vastaväitteet, ei äänestystä)
Paneeli (25 agenttia, 6 roolia: aloittelija/kilpapelaaja/mobiili-UX/saavutettavuus/
retentio/skeptikko). 18 ideaa → jokainen adversariaalisen vastaväitteen läpi →
synteesi priorisoi. Kärki oli yksiselitteisesti MOBIILIN KOSKETUSKORREKTIUS (halvin,
tihein, korkein päivittäistaajuus). Kolme itsenäisesti julkaistavaa iteraatiota:
- IT1 HYÖKKÄYSPALKIN JAKO: kuusi kontrollia yhdellä rivillä → peruuttamaton
  "Lopeta →" oli toistettavan "Blitz ⚡":n vieressä (vahinkolopetus). Jaettu
  kahteen riviin (tieto: vihje+voitto-osuus / toiminnot) + .bar-spacer erottaa
  Lopetan hyökkäysnapeista. VERIFY (headless, hyökkäysvaiheeseen ajettu): 2 riviä,
  Blitz→Lopeta väli ~34 px (pysty) / ~32 px (vaaka), ei leikkaudu kummassakaan.
- IT2 PANOROINNIN RAJAUS: yhden käden heitto työnsi kartan pois ruudulta (tyhjä
  meri). clampView() pitää näkymän KESKIPISTEEN aina kartan sisällä → karttaa ei
  voi hukata, mutta jokainen reuna-alue panoroituu keskelle. Portitettu !_camActive
  + view.rot (ei koske hyökkäyskameraa). VERIFY: kaikki 42 aluetta saavutettavissa
  maksimizoomilla (pysty+vaaka), nurkkaan-heitto pitää kartan näkyvissä (kuvattu),
  reset toimii. mapBounds(pad) jaettu resetView'n kanssa.
- IT3 HAAMUNAPAUTUKSEN ESTO + 2 niputettua turvakorjausta: gestureActive-lippu
  nielaisee pinchin jälkeisen synteettisen clickin (ei vahinkovalintaa); tuore
  kosketussarja nollaa lipun (deliberaatti napautus toimii). VERIFY (headless):
  pinch→click nielaistu, puhdas napautus valitsee. + aiReinforce palautuu jos 0
  aluetta (helppo-haaran while-jumin/PWA-jäätymisen esto, regressiotesti 117→118).
  + pagehide/visibilitychange → saveGame-huuhtelu (iOS tappaa tausta-PWA:n).
- LESSON: (1) Vastaväite-ensin-paneeli konvergoi taas halpoihin korkean tuoton
  korjauksiin ja karsi isot piirteet (medaljit, uramatriisi, AI-liittoutuminen
  kenraali-benchin riskinä). (2) flex:1-napit reflowaavat koko rivin — erottelu
  vaatii kiinteän välikkeen, ei pelkkää järjestystä (sama oppi kuin Kumoa-napissa).
  (3) Kuva-review ratkaisi kiistan: tiukka "alue-keskipiste ruudussa" -mittari näytti
  vääriä nollia letterbox-artefaktista, mutta kuvakaappaus todisti kartan pysyvän
  näkyvissä. 118 testiä vihreää; kaikki UI todennettu headless-ajolla + kuvin.

## Visuaalinen ohjelma (RGD-inspiroitu, oma tyyli säilyttäen) + karttojen naapuruus-review
Käyttäjä: "Risk: Global Domination näyttää paremmalta — paranna, älä kopioi."
+ "jotkut näennäisesti vierekkäiset alueet eivät ole yhteydessä; kartat selkeämmiksi."
- KARTTA-REVIEW (kaikki 7 karttaa, ohjelmallisesti): Type A (vierekkäisiä mutta
  solut eivät kosketa) = 0 kaikilla → ei "vierekkäinen mutta näyttää erilliseltä"
  -databugia. Ongelma oli käänteinen (Type B): monet Voronoi-solut koskettavat
  mutta EIVÄT ole pelinaapureita.
- SELKEYS: korvattiin ei-naapureiden jaettu raja MERISALMELLA (syvä vesi +
  rantavaahto molemmin puolin) vuoriston sijaan → alueet lukevat ERILLISINÄ
  rannikkoina. Piirretään vain ei-adj Voronoi-naapureille (adj-tarkistus ennallaan)
  → yhdistettyjä alueita ei voi vahingossa erottaa. Todennettu zoomaten.
- VAAKUNAT: roosterin/HUD:in litteä väripiste → pyöreä mitali pelaajan värillä +
  hänen pip-muotonsa (sama kuin kartan tokeneissa). Puhdas SVG+CSS, ei ulkoista
  grafiikkaa. Todennettu koko sivun kuvalla.
- MAASTO: laajennettiin olemassa oleva land-relief-kohina (matalampi taajuus, 4
  oktaavia, opacity 0.42→0.5) → maalattu maastontuntu. SAMA jo-portitettu suodatin
  (piilossa panoroitaessa + pois lite-tilassa; todennettu display:none litessä).
- SUMU: sumuisempi orbigradientti (valoisa ydin → syvä reuna).
- Havainto: monta RGD:n vahvuutta oli JO meillä (kaarevat merireitit + satamat,
  mannerten fake-3D-jalusta + syvän veden varjo + rantavaahto). "Paranna, älä
  kopioi" tarkoitti tässä myös "älä rakenna uudelleen mitä on jo hyvää" → keskitys
  aitoihin puutteisiin (selkeys, vaakunat, maasto). 118 testiä vihreää; SW v16→v19.

## Aidot mannermuodot kaikille tosielämän kartoille (RGD-tyyli, oma teema)
Käyttäjä: "Miten maailmankartat voisi näyttää oikeilta mantereilta (kuten RGD)?
Kaikki tosielämän kartat, pushaa valmiina."
- ONGELMA: continentOutline piirsi säde­pyyhkäisyllä TÄHTIKUPEROJA blob-siluetteja
  (valittu tessellaation robustiuden vuoksi) → ei tunnistettavia mantereita.
- RATKAISU (putki): käsin piirretty AITO rannikko (REAL_OUTLINES, avain
  `mapId:contId`) siluetiksi; Voronoi tessellöidään KONVEKSILLA työpolygonilla
  ja jokainen solu LEIKATAAN aitoon rannikkoon (clip-path). → rannikkoalueet
  myötäilevät oikeaa rantaviivaa, sisärajat pysyvät automaattisina, syvät lahdet
  eivät riko tessellaatiota. Mantereet ilman ääriviivaa käyttävät ennallaan
  säde­polkua (taaksepäin yhteensopiva).
- MONIOSAISET ÄÄRIVIIVAT: saaret omina osina (Islanti, Brittein saaret,
  Sisilia, Mauretania jne.) → siluetti/jalusta/varjo/vaahto/clip rakennetaan
  osista.
- LIMITYS: samalla maamassalla olevat osiot (esim. Suuren maailman Aasia jaettu
  kolmeen; aluekarttojen osiot) piirretään lievästi limittäin → ei merirakoja.
- TEHTY: classic (6 mannerta), suurmaailma (8), afrikka (5), eurooppa (5,
  saaret), eurooppa2025 (7, Britannia-saari), antiquity (5, Välimeren maailma).
  Taruvaltakunnat (fantasia) jää tyylitellyksi. 118 testiä vihreää joka kartalla,
  0 konsolivirhettä, todennettu kuvakaappauksin karttakohtaisesti. SW v19→v26.

## Kartat rakennettu uudelleen AIDOLLE maantieteelliselle pohjalle (Natural Earth)
Käyttäjän vertailu RGD:hen oli reilu: käsin approksimoidut blobit ~3-4/10.
Uusi arkkitehtuuri (RGD:n tapa):
- tools/geo.mjs: Natural Earth 110m/50m GeoJSON → Miller-projektio ikkunaan →
  Douglas-Peucker-yksinkertaistus → committoitu js/data/geo/*.js (ei ajonaikaista
  verkkoriippuvuutta; SW esilataa).
- GEO-renderöinti: maailma piirretään YHTENÄ aitona maamassana; mantereet ovat
  VÄRIVYÖHYKKEITÄ sen päällä (vyöhyke ∩ maa sisäkkäisin clip-polyin). Vyöhykkeet
  kartan datassa; tarkkoja vain maaylityksissä (Panama, Ural/Kaukasus,
  Suez/Punainenmeri, Malakka, Suomi–Venäjä...). Solut yhä auto-Voronoi,
  leikattuna aitoon rantaan. Pelialueen ulkopuolinen maa jää neutraaliksi
  (Uusi-Seelanti classicissa, Venäjä/Anatolia Euroopassa, barbaricum antiikissa,
  Madagaskar/Arabia Afrikassa) — RGD:n harmaa.
- KAIKKI alueet siirretty AIDOILLE projisoiduille lat/long-sijainneille;
  tiheissä ryppäissä (Eurooppa, Baltia, Ukraina) minimisiirrot niin että joka
  token-pari ≥42 px ja joka labelrivi irti naapuritokeneista (rivi×token-
  leikkaustesti käsin joka parille).
- Maalla kulkeva ei-yhteys piirtyy VUORISTONA (maantieteellisesti rehellinen),
  merellä aito vesi näkyy leikkauksen läpi (ei keinosalmia geo-tilassa).
- TEHTY: classic, suurmaailma, africa, europe, eurooppa2025 (nato.js), antiquity.
  Taruvaltakunnat (fantasia) pitää tyylitellyn sädepolun; REAL_OUTLINES-käsidata
  poistettu kuolleena. 118 testiä vihreää joka kartalla; kaikki moodit (sumu/
  myrsky/lite) todennettu; SW v27→v32.
- LESSON: (1) Tarkkuuden katto on POHJADATA — käsin piirtämällä ei ylitä ~4/10;
  aito data + projektio nostaa ~9/10 samalla rendausputkella. (2) "Manner =
  vyöhyke ∩ maa" -leikkaus­arkkitehtuuri erottaa geometrian (data) ja tyylin
  (rendaus) — uusi kartta = ikkuna + solmut + vyöhykkeet, ei piirtämistä.
  (3) Tiheiden karttojen labelit ovat oma geometriaongelmansa: rivi×token-
  törmäystesti kannattaa tehdä systemaattisesti, ei silmällä.

## Neljä uutta karttaa + Taruvaltakuntien fantasiapäivitys (A+D)
Käyttäjän tilaus: Taruvaltakunnat uusiksi sommiteltuna fantasiamaailmana +
fantasiateemoitus, ja 4 uutta suurehkoa karttaa vapaalla tyylillä.
- tools/islands.mjs: seedattu saarisommittelija (sin-harmoninen sädekohina)
  → fantasiakartat saavat saman geo-arkkitehtuurin kuin aidot kartat.
  Taruvaltakunnat: 18 käsin sommiteltua polygonia (gen-taru.mjs), 6 teema-
  vyöhykettä, merikäärme-dekoraatiot + "Täällä lohikäärmeitä" (fantasy: true).
- UUDET KARTAT: Aasia (40 aluetta, 9 mannerta; Himalaja/Ural vyöhykerajoina),
  Amerikat (39 aluetta; Alaskasta Patagoniaan, Karibia 2 alueen mantereena),
  Tyynimeri (33 aluetta; Kaakkois-Aasia→Fidži, puhdas saaristokartta:
  landBridges tyhjä, reittiviivat kantavat), Saaristomaailma (41 aluetta;
  fantasia-arkkipelagi: 7 teemaryhmää + iso Sumusaari-keskusmanner,
  gen-saaristo.mjs).
- TYÖKALUT jotka tekivät tiheät kartat mahdollisiksi: tools/mapcheck.mjs
  (token-etäisyydet, label×token-geometria, solmu-vyöhykkeessä/maalla —
  exit 1 ongelmista) ja tools/mapfix.mjs (ahne mäenkiipeily-optimoija;
  löyhä ankkuri 0.35 + laajat säteet 60px asti → tiheät ryppäät konvergoivat
  globaalisti). Työnkulku: geo/gen → mapcheck → mapfix → screenshot-review.
- 134 testiä vihreää (10 karttaa × moodit); SW v33→v36.
- LESSON: (1) Saaristokartoissa vyöhykerajat kulkevat salmissa — aidot salmet
  (Makassar, Ombai, Torres) ovat 3-14 px tässä mittakaavassa, joten rajapisteet
  lasketaan projisoiduista referenssipisteistä (PTS), ei silmällä. (2) Yhden
  solmun käsisiirto tiheässä ryppäässä rikkoo naapurin — optimoijan globaali
  kierros voittaa aina näpertelyn. (3) Fantasiakartta = sama putki, vain
  maadata generoidaan (islands.mjs) — "geometria datana" kantaa tänne asti.

## Suomi — pelin suurin kartta (53 aluetta)
Käyttäjän tilaus: Suomi-kartta, suurempi kuin tähänastinen suurin (Saaristo­maailma 41).
- tools/geo.mjs: Natural Earth 50m, ikkuna lon 19..32, lat 59.5..70.2. Miller-
  projektion sisäänrakennettu vaakakatto (scaleX ≤ 2× scaleY) venytti kapean,
  korkean maan täyttämään kankaan → Suomi näkyy leveänä eikä tikkuna. Ruotsi,
  Norja ja Venäjä jäävät ikkunaan pelin ulkopuolisena neutraalina harmaana.
- 53 aluetta aidoilla projisoiduilla kaupunkisijainneilla, 9 suuraluetta
  (Lappi, Pohjanmaa, Kainuu, Keski-Suomi, Savo, Karjala, Länsi-Suomi,
  Lounais-Suomi, Uusimaa). Ahvenanmaa (Maarianhamina) on meren takana →
  reittiyhteys Turkuun. Suuralueet kytketään toisiinsa kapeikoilla.
- Vyöhykepartitiointi (9 palaa) validointiin mapcheckillä (solmu omassa
  vyöhykkeessä + maalla) ja mapfixillä; kolme rannikkosolmua (Meri-Lappi,
  Pietarsaari, Helsinki) napsautettiin yksinkertaistetulle rannalle.
- 138 testiä vihreää; SW v36→v37.
- LESSON: (1) Yksittäisen maan kartta on kapea ja korkea — projektion vaaka-
  katto (×2) täyttää kankaan ilman erillistä venytysparametria. (2) Tiheä etelä
  (Uusimaa/Lounais-Suomi) on kartan raskain kohta: 7 pientä label-limitystä jäi
  optimoinnin jälkeen, mutta pilleritaustat pitävät nimet luettavina — visuaali-
  tarkistus on tässä lopullinen tuomari, ei pelkkä mapcheck-nollatoleranssi.
