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
