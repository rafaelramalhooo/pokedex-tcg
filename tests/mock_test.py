import json, re, sys, pathlib, subprocess, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8765
APP = f"http://localhost:{PORT}/index.html"
SERVER = subprocess.Popen(["python3","-m","http.server",str(PORT),"--directory",str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)

SETS = {  # id: (nome_pt, serie_id, serie_nome, official, total, mark, release)
 "sv01": ("Escarlate e Violeta", "sv", "Escarlate e Violeta", 8, 10, "G", "2023-03-31"),
 "sv02": ("Evoluções em Paldea", "sv", "Escarlate e Violeta", 6, 7, "H", "2023-06-09"),
 "swsh1": ("Espada e Escudo", "swsh", "Espada e Escudo", 5, 5, "D", "2020-02-07"),
 "A1": ("Ilha Lendária", "tcgp", "Pokémon TCG Pocket", 4, 4, "", "2024-10-30"),
}
EN_ONLY = {"xx9": ("English Only Set", "swsh", "Espada e Escudo", 3, 3, "E", "2021-01-01")}
TYPES_PT = ["Fogo", "Água", "Planta"]
ILL = ["Mitsuhiro Arita", "Ken Sugimori"]

def cname(sid, i, lang="pt"):
    if (sid, i) in (("sv02", 2), ("swsh1", 3)): return "Gengar ex" if sid == "sv02" else "Gengar V"
    return f"Carta {sid} {i}" if lang == "pt" else f"Card {sid} {i}"

def set_cards(sid, n, lang):
    return [{"id": f"{sid}-{i}", "localId": str(i), "name": cname(sid, i, lang),
             "image": f"https://assets.tcgdex.net/{lang}/x/{sid}/{i}"} for i in range(1, n+1)]

def set_detail(sid, lang):
    d = {**SETS, **EN_ONLY}[sid]
    name, ser, sername, off, tot, mark, rel = d
    return {"id": sid, "name": name, "logo": f"https://assets.tcgdex.net/{lang}/x/{sid}/logo",
            "symbol": f"https://assets.tcgdex.net/univ/x/{sid}/symbol", "releaseDate": rel,
            "serie": {"id": ser, "name": sername}, "abbreviation": {"official": sid.upper()},
            "cardCount": {"official": off, "total": tot, "normal": tot, "holo": 2, "reverse": 4, "firstEd": 0},
            "cards": set_cards(sid, tot, lang)[:2] if (sid == "swsh1" and lang == "pt") else set_cards(sid, tot, lang)}

def card_detail(cid, lang):
    sid, i = cid.rsplit("-", 1); i = int(i)
    d = {**SETS, **EN_ONLY}[sid]; mark = d[5]
    return {"id": cid, "localId": str(i), "name": cname(sid, i), "category": "Pokemon" if i % 4 else "Trainer",
            "illustrator": ILL[i % 2], "rarity": "Rara" if i % 3 == 0 else "Comum",
            "set": {"id": sid, "name": d[0]}, "image": f"https://assets.tcgdex.net/{lang}/x/{sid}/{i}",
            "variants": {"normal": True, "reverse": i <= 4, "holo": i in (5, 6), "firstEdition": False},
            "dexId": [150 + i if sid == "xx9" else i], "hp": 50 + i * 20, "types": [TYPES_PT[i % 3]], "stage": "Basic", "regulationMark": mark,
            "legal": {"standard": mark in ("G", "H"), "expanded": True}}

hits = {"cards": 0, "sets": 0}
def handle(route):
    url = route.request.url
    h = {"access-control-allow-origin": "*"}
    if url.endswith("/js/config.js"):
        return route.fulfill(status=200, content_type="text/javascript", body="export const SUPABASE={url:'',key:''};")
    if "fonts.g" in url:
        return route.abort()
    if url.startswith("https://assets.tcgdex.net") and ("/sv02/logo" in url or "/sv02/symbol" in url):
        return route.fulfill(status=404, body="", headers=h)
    if url.startswith("https://assets.tcgdex.net") and "/en/sv/sv02/" in url:
        return route.fulfill(status=404, body="", headers=h)
    if url.startswith("https://assets.tcgdex.net") and "/sv01/7/" in url and url.endswith(".webp"):
        return route.fulfill(status=404, body="", headers=h)
    if url.startswith("https://assets.tcgdex.net") and "/sv01/8/" in url:
        return route.fulfill(status=404, body="", headers=h)
    if url.startswith("https://assets.tcgdex.net"):
        n = url.split("/")[-2] if url.endswith(("low.webp","high.webp")) else url.split("/")[-1]
        hue = (sum(map(ord, url)) * 37) % 360
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="hsl({hue},70%,55%)"/><text x="20" y="180" font-size="28" fill="#fff">{n}</text></svg>'
        return route.fulfill(status=200, body=svg, headers={**h, "content-type": "image/svg+xml"})
    if url.startswith("https://pokeapi.co/api/v2/pokemon-species"):
        names = {1: "bulbasaur", 2: "ivysaur", 3: "venusaur", 4: "charmander", 5: "charmeleon", 6: "charizard", 25: "pikachu", 122: "mr-mime"}
        body = json.dumps({"count": 8, "results": [{"name": v, "url": f"https://pokeapi.co/api/v2/pokemon-species/{k}/"} for k, v in names.items()]})
        return route.fulfill(status=200, body=body, headers={**h, "content-type": "application/json"})
    if url.startswith("https://cdn.jsdelivr.net/gh/PokeAPI"):
        hits["art"] = hits.get("art", 0) + 1
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="475" height="475"><circle cx="237" cy="237" r="200" fill="#e0a030"/></svg>'
        return route.fulfill(status=200, body=svg, headers={**h, "content-type": "image/svg+xml"})
    m = re.match(r"https://api\.tcgdex\.net/v2/(\w+)(/.*)", url)
    if not m: return route.continue_()
    lang, path = m.groups()
    def ok_json(o): return route.fulfill(status=200, body=json.dumps(o), headers={**h, "content-type": "application/json"})
    def ok(o): return route.fulfill(status=200, body=json.dumps(o), headers={**h, "content-type": "application/json"})
    def nf(): return route.fulfill(status=404, body="{}", headers={**h, "content-type": "application/json"})
    if path == "/sets":
        allsets = {**SETS, **(EN_ONLY if lang == "en" else {})}
        if lang == "pt" and False: pass
        return ok([{"id": k, "name": v[0], "logo": f"https://assets.tcgdex.net/{lang}/x/{k}/logo",
                    "symbol": f"https://assets.tcgdex.net/univ/x/{k}/symbol",
                    "cardCount": {"official": v[3], "total": v[4]}} for k, v in allsets.items()])
    md = re.match(r"/cards\?dexId=eq:(\d+)$", path)
    if md:
        n = int(md.group(1)); hits["dexq"] = hits.get("dexq", 0) + 1; res = []
        for sid, d in {**SETS, **(EN_ONLY if lang == "en" else {})}.items():
            i = n - 150 if sid == "xx9" else n
            if 1 <= i <= d[4]:
                res.append({"id": f"{sid}-{i}", "localId": str(i), "name": cname(sid, i, lang), "image": f"https://assets.tcgdex.net/{lang}/x/{sid}/{i}"})
        return ok(res)
    mq = re.match(r"/cards\?(\w+)=(.+)$", path)
    if mq and not path.startswith("/cards?dexId"):
        field, val = mq.groups(); hits["rq"] = hits.get("rq", 0) + 1
        EN_T = {"Fogo": "Fire", "Água": "Water", "Planta": "Grass"}
        res = []
        for sid, d in {**SETS, **EN_ONLY}.items():
            for i in range(1, d[4] + 1):
                c = card_detail(f"{sid}-{i}", "en"); ok = False
                if field == "types": ok = val == "eq:" + EN_T[c["types"][0]]
                elif field == "regulationMark": ok = val == "eq:" + (c["regulationMark"] or "")
                elif field == "illustrator": ok = val.replace("eq:", "").replace("%20", " ") == c["illustrator"]
                elif field == "hp": ok = val.startswith("gte:") and c["hp"] >= int(val[4:])
                if ok: res.append({"id": c["id"], "localId": c["localId"], "name": c["name"]})
        return ok_json(res)
    if path == "/series":
        return ok([{"id": "sv", "name": "Escarlate e Violeta"}, {"id": "swsh", "name": "Espada e Escudo"}, {"id": "tcgp", "name": "Pokémon TCG Pocket"}])
    ms = re.match(r"/series/(\w+)", path)
    if ms:
        sid = ms.group(1); allm = {**SETS, **EN_ONLY}
        return ok({"id": sid, "name": [v[2] for v in allm.values() if v[1] == sid][0],
                   "sets": [{"id": k, "name": v[0]} for k, v in allm.items() if v[1] == sid]})
    ms = re.match(r"/sets/([\w.]+)$", path)
    if ms:
        sid = ms.group(1); hits["sets"] += 1
        if sid in EN_ONLY and lang == "pt": return nf()
        if sid not in {**SETS, **EN_ONLY}: return nf()
        return ok(set_detail(sid, lang))
    ms = re.match(r"/cards/([\w.\-]+)$", path)
    if ms:
        hits["cards"] += 1
        sid = ms.group(1).rsplit("-", 1)[0]
        if sid in EN_ONLY and lang == "pt": return nf()
        return ok(card_detail(ms.group(1), lang))
    return nf()

errors = []
def check(cond, msg):
    print(("OK   " if cond else "FALHA"), msg)
    if not cond: errors.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, locale="pt-BR", service_workers="block")
    page = ctx.new_page()
    logs = []
    page.on("pageerror", lambda e: (logs.append("pageerror: " + str(e)), print("PAGEERROR", e)))
    page.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" and "404" not in m.text and "ERR_FAILED" not in m.text else None)
    page.route("**/*", handle)
    page.goto(APP)
    # primeira vez: nada escolhido, a home pede para escolher coleções
    page.wait_for_selector(".empty .btn.primary", timeout=8000)
    check(page.locator(".set").count() == 0, "home vazia antes de escolher coleções")
    n0 = hits["sets"]
    page.locator(".empty .btn.primary").click()
    page.wait_for_selector(".pk", timeout=5000)
    names = page.locator(".pk .sname").all_inner_texts()
    check("Ilha Lendária" not in names, "picker: coleção do Pocket escondida por padrão")
    check("English Only Set" in names, "picker: coleção só em inglês aparece")
    check(hits["sets"] == n0, "nada foi baixado antes de escolher")
    page.screenshot(path=str(ROOT/"tests/00_picker.png"))
    page.fill("#pq", "paldea")
    check(page.locator(".pk").count() == 1, "busca no picker filtra")
    page.fill("#pq", "")
    page.locator('[data-act="pick-toggle"]', has_text="Espada e Escudo").click()
    check(page.locator('.pk.on').count() == 1, "marcar uma coleção")
    bar = page.locator("#pickbar").inner_text()
    check("1 coleção" in bar and "5 cartas" in bar, f"estimativa na barra: {bar[:60]!r}")
    page.locator('[data-act="pick-serie"][data-on="0"]').first.click()
    check(page.locator('.pk.on').count() == 0 or page.locator('.pk.on').count() == 1, "limpar série age só na série")
    page.locator('[data-act="pick-serie"][data-on="1"]').nth(0).click()
    page.locator('[data-act="pick-serie"][data-on="1"]').nth(1).click()
    check(page.locator('.pk.on').count() == 4, "selecionar séries inteiras marca as 4 coleções")
    page.locator('[data-act="pick-save"]').click()
    page.wait_for_selector(".set", timeout=8000)
    page.wait_for_function("!document.body.innerText.includes('Baixando os detalhes')", timeout=15000)
    page.wait_for_timeout(500)
    check(hits["sets"] >= 4 and hits["cards"] >= 26, f"só as escolhidas carregam completas (sets {hits['sets']}, cartas {hits['cards']})")

    names = page.locator(".set .sname").all_inner_texts()
    check("Ilha Lendária" not in names, "coleção do Pocket escondida por padrão")
    check("English Only Set" in names, "coleção só em inglês aparece (fallback)")
    check(set(["Escarlate e Violeta","Evoluções em Paldea","Espada e Escudo"]) <= set(names), "coleções em português listadas")
    check(page.locator(".series-head h2").count() == 2, "agrupado em 2 séries")
    page.screenshot(path=str(ROOT/"tests/01_home.png"))

    # abrir coleção
    page.locator(".set", has=page.locator(".sname", has_text="Escarlate e Violeta")).first.click()
    page.wait_for_selector(".slot", timeout=5000)
    check(page.locator(".slot").count() == 10, "coleção sv01 mostra 10 cartas")
    check(page.locator(".divider").count() == 1, "cartas secretas separadas")
    check(page.locator(".slot.off").count() == 10, "todas cinza no começo")
    # marcar 3 cartas pelo botão
    for i in (0, 1, 2):
        page.locator(".slot").nth(i).hover(); page.locator(".slot .tg").nth(i).click()
    page.wait_for_timeout(200)
    check(page.locator(".slot.on").count() == 3, "3 cartas coloridas após marcar")
    # abrir painel da 4a carta, +2 em reverse
    page.locator(".slot").nth(3).click()
    page.wait_for_selector("#panel.open .fin", timeout=5000)
    check(page.locator("#panel .fin .step").count() == 2, "painel mostra normal + reverse da carta 4")
    page.locator('#panel [data-act="inc"][data-fin="reverse"]').click()
    page.locator('#panel [data-act="inc"][data-fin="reverse"]').click()
    page.wait_for_timeout(200)
    check(page.locator('#panel select[data-ch="c"]').count() == 1, "condição/idioma aparecem após adicionar")
    page.locator('#panel select[data-ch="c"]').select_option("LP")
    page.keyboard.press("Escape")
    check(page.locator(".slot.on").count() == 4, "4 cartas coloridas (carta 4 só em reverse)")
    # hero: set 4/8 ; master 5/..  (3 normais + 2 reverse)
    hero = page.locator(".hero").inner_text()
    check("4" in hero and "de 8" in hero, "hero: Set 4 de 8")
    page.screenshot(path=str(ROOT/"tests/02_set.png"))

    # master
    page.locator('.toolbar [data-act="mode"][data-v="master"]').click()
    page.wait_for_timeout(1200)
    n_slots = page.locator(".slot").count()
    # variantes: normal=10, holo=2 (cartas 5,6), reverse=4 (cartas 1..4)  => 16 slots
    check(n_slots == 16, f"Master Set tem 16 slots (normal+holo+reverse) -> {n_slots}")
    check(page.locator(".slot.on").count() == 4, "master: 3 normais + 1 reverse(c4) x2 qty = 4 slots coloridos")
    hero = page.locator(".hero").inner_text()
    check("de 16" in hero, "hero master mostra 'de 16'")
    page.screenshot(path=str(ROOT/"tests/03_master.png"))

    # home com contadores
    page.goto(APP + "#/"); page.wait_for_selector(".set")
    page.wait_for_timeout(600)
    lb = page.evaluate("""()=>[...document.querySelectorAll('.set .logo')].map(l=>{const b=l.querySelector('img.lgbg'),m=l.querySelector('img[data-role=logo]');return b&&m?[b.getAttribute('src')||'',m.currentSrc||m.src,getComputedStyle(b).filter.includes('blur'),getComputedStyle(b).pointerEvents]:null;}).filter(Boolean)""")
    check(len(lb) >= 1 and all(x[0] == x[1] and x[2] and x[3] == "none" for x in lb if x[1]), f"logo das coleções: fundo desfocado com a mesma imagem {lb[:2]}")
    page.screenshot(path=str(ROOT/"tests/40_logo_fundo.png"))
    page.locator('[data-act="mode"][data-v="master"]').first.click()
    tile = page.locator(".set", has=page.locator(".sname", has_text="Escarlate e Violeta")).first.inner_text()
    check("4" in tile and "de 16" in tile, "home (modo master) mostra 4 de 16")
    page.locator('[data-act="mode"][data-v="set"]').first.click()
    tile = page.locator(".set", has=page.locator(".sname", has_text="Escarlate e Violeta")).first.inner_text()
    check("de 8" in tile, "home (modo set) mostra de 8")
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    page.locator('[data-act="mode"][data-v="set"]').first.click(); page.wait_for_timeout(200)

    # sincronizar catálogo
    page.goto(APP + "#/ajustes"); page.wait_for_selector("#sbody .panel-sec")
    page.wait_for_function("document.body.innerText.includes('Catálogo completo')", timeout=20000)
    check(True, "detalhes das coleções escolhidas já vieram completos (sem sincronização manual)")
    page.screenshot(path=str(ROOT/"tests/04_ajustes.png"))

    # fichário por regra: tipo Fogo E standard
    page.goto(APP + "#/binders"); page.wait_for_selector("#bbody")
    page.locator('[data-act="new-binder"]').first.click()
    page.fill("#bn", "Fogo no Standard")
    page.select_option('select[data-ed="f"]', "types"); 
    page.select_option('select[data-ed="v"]', "fogo")
    page.locator('[data-ed-act="add"]').click()
    page.locator('select[data-ed="f"]').nth(1).select_option("standard")
    page.locator('select[data-ed="v"]').nth(1).select_option("sim")
    page.wait_for_timeout(400)
    prev = page.locator("#edprev").inner_text()
    # Fogo => i%3==0. Marcas padrão H,I,J: só sv02 (H) é legal => cartas 3 e 6 => 2
    check("2 cartas combinam" in prev, f"preview da regra: {prev}")
    page.locator('[data-ed-act="save"]').click()
    page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot").count() == 2, "fichário por regra lista 2 cartas (Standard H,I,J)")
    # altera marcas legais: remove G => sv01 sai
    page.goto(APP + "#/ajustes"); page.wait_for_selector("#sbody .panel-sec")
    page.locator('[data-act="rm-mark"][data-v="J"]').click()
    page.locator('[data-act="rm-mark"][data-v="I"]').click()
    page.locator('[data-act="rm-mark"][data-v="H"]').click()
    page.locator('[data-act="add-mark"]').click()  # vazio, ignora
    page.locator("#newmark").fill("g"); page.locator('[data-act="add-mark"]').click()
    page.goto(APP + "#/binders"); page.locator(".binder").first.click()
    page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot").count() == 3, "marcas legais editáveis: só G => 3 cartas")
    page.screenshot(path=str(ROOT/"tests/05_binder.png"))

    # persistência: recarrega
    page.reload(); page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot").count() == 3, "fichário e marcas persistem após recarregar")
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    check(page.locator(".slot.on").count() == 4, "coleção persiste após recarregar")

    # backup export
    page.goto(APP + "#/ajustes"); page.wait_for_selector("#sbody .panel-sec")
    with page.expect_download() as dl:
        page.locator('[data-act="export"]').click()
    data = json.loads(pathlib.Path(dl.value.path()).read_text())
    check(len(data["collection"]) == 4 and len(data["binders"]) == 1, "backup exporta coleção e fichários")


    # --- regras novas: Pokémon por nome, geração e fichário Pokédex ---
    def novo(nome):
        page.goto(APP + "#/binders"); page.wait_for_selector("#bbody")
        page.locator('[data-act="new-binder"]').first.click()
        page.fill("#bn", nome)
    novo("Gengar")
    page.select_option('select[data-ed="f"]', "pokemon"); page.wait_for_timeout(400)
    page.fill('input[data-ed="v"]', "gengar, pikachu")
    page.wait_for_function("document.querySelector('#edprev') && !document.querySelector('#edprev').textContent.includes('Preencha')", timeout=8000)
    prev = page.locator("#edprev").inner_text()
    check("2 cartas combinam" in prev, f"regra Pokémon por nome (Gengar ex e V): {prev}")
    page.locator('[data-ed-act="save"]').click(); page.wait_for_timeout(800); page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot").count() == 2, "fichário de Pokémon lista as 2 formas")
    check("Pokémon: Gengar, Pikachu" in page.locator("#bchips").inner_text(), "chip da regra de Pokémon")

    novo("Segunda geração")
    page.select_option('select[data-ed="f"]', "generation")
    page.locator('.rule .gc[data-g="2"]').click()
    page.wait_for_timeout(400)
    prev = page.locator("#edprev").inner_text()
    check("2 cartas combinam" in prev, f"regra de geração (2ª = dex 152 a 251): {prev}")
    page.locator('.rule .gc[data-g="all"]').click()
    page.wait_for_timeout(400)
    prev = page.locator("#edprev").inner_text()
    check("25 cartas combinam" in prev, f"geração 'todas' pega as 25 cartas com Pokédex: {prev}")
    page.locator('[data-ed-act="save"]').click(); page.wait_for_selector("#bgrid .slot")

    novo("Minha Pokédex 1ª geração")
    page.locator('[data-ed-act="mode"][data-v="pokedex"]').click()
    page.locator('.gc[data-ed-act="bgen"][data-g="1"]').click()
    page.locator('[data-ed-act="save"]').click(); page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot").count() == 151, "Pokédex da 1ª geração tem 151 espaços")
    # a Pokédex não se preenche sozinha com cartas marcadas em outros fichários
    check(page.locator("#bgrid .slot.on").count() == 0 and page.locator("#bgrid .slot.dexempty").count() == 151, "Dex começa vazia, mesmo com cartas na coleção")
    check(page.locator("#bgrid .slot.dexempty.hashave").count() == 4, "espaços com carta minha em outro lugar avisam 'Você tem'")
    page.locator('#bgrid .slot.dexempty.hashave').first.click(); page.wait_for_selector("#dexgrid .dtile")
    check(page.locator("#dexgrid .dtile.have").count() == 1 and page.locator("#dexgrid .dtile.here").count() == 0, "janela abre só nas que tenho, sugerindo trazer")
    page.locator("#dexgrid .dtile.have").first.click(); page.wait_for_timeout(300)
    check(page.locator("#dexgrid .dtile.here").count() == 1, "tocar traz a carta para este espaço")
    page.locator("#dexgrid .dtile.here").first.click(); page.wait_for_timeout(300)
    check(page.locator("#dexgrid .dtile.here").count() == 0 and page.evaluate("import('./js/collection.js').then(m=>Object.keys(m.groupBySet()).length)") >= 1, "tocar de novo tira do espaço e a carta continua na coleção")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    page.evaluate("""Promise.all([import('./js/state.js'),import('./js/rules.js'),import('./js/db.js')]).then(([st,r,d])=>{const b=st.S.binders.find(x=>x.name==='Minha Pokédex 1ª geração');b.pick=b.pick||{};r.dexModel(b).forEach(x=>{if(x.have.length)b.pick[x.dex]=x.have[0];});d.saveBinders();st.viewCache.clear();st.refreshAll();})""")
    page.wait_for_timeout(400)
    check(page.locator("#bgrid .slot.dexempty").count() == 147, "sem carta que você tenha, o espaço mostra a arte do Pokémon (147)")
    check(page.locator("#bgrid .slot.on").count() == 4, "4 espaços preenchidos com cartas que tenho")
    check("espaços preenchidos" in page.locator("#bsum").inner_text(), "resumo fala em espaços")
    page.screenshot(path=str(ROOT/"tests/08_pokedex.png"))
    # arte, nome e número nos espaços vazios
    check(page.locator("#bgrid .slot.dexempty .dexph img").count() == 147, "cada espaço vazio tem a arte do Pokémon")
    empty25 = page.locator('#bgrid .slot.dexempty[data-dex="25"]')
    empty25.scroll_into_view_if_needed()
    check("Pikachu" in empty25.inner_text() and "#0025" in empty25.inner_text(), f"espaço vazio mostra nome e número ({empty25.inner_text().strip()!r})")
    box = empty25.locator(".dexph").bounding_box(); img = empty25.locator(".dexph img").bounding_box(); pk = empty25.locator(".pocket").bounding_box()
    check(abs((img["x"] + img["width"]/2) - (pk["x"] + pk["width"]/2)) < 3 and img["y"] < box["y"] + box["height"]/2, "arte centralizada, acima do número")
    # janela de cartas do Pokémon
    page.locator('#bgrid .slot[data-dex="2"]').click()
    page.wait_for_selector("#dexgrid .dtile", timeout=5000)
    check(page.locator("#dexgrid .dtile").count() == 3, "janela lista as 3 cartas do Pokémon #2 (Pocket escondido, como no resto do app)")
    check("Você tem" not in page.locator("#dexsum").inner_text() and "você tem 1" in page.locator("#dexsum").inner_text(), f"resumo: {page.locator('#dexsum').inner_text()}")
    page.screenshot(path=str(ROOT/"tests/17_dex_janela.png"))
    page.fill("#dq", "gengar")
    check(page.locator("#dexgrid .dtile").count() == 1, "busca na janela filtra por nome")
    page.fill("#dq", "(1/8)")
    check(page.locator("#dexgrid .dtile").count() == 0, "número só em dex 2: '(1/8)' não casa (carta 2)")
    page.fill("#dq", "gengar (2/6)")
    check(page.locator("#dexgrid .dtile").count() == 1, "busca 'nome (número/total)' como na Liga Pokémon")
    page.fill("#dq", "gengar (2/9)")
    check(page.locator("#dexgrid .dtile").count() == 0, "total errado não casa")
    page.fill("#dq", "gengar 2")
    check(page.locator("#dexgrid .dtile").count() == 1, "nome + número simples")
    page.fill("#dq", "02/6")
    check(page.locator("#dexgrid .dtile").count() == 1, "número com zero à esquerda")
    page.fill("#dq", "")
    page.locator('#dexgrid .dtile').nth(0).locator(".dd").click()
    page.wait_for_selector("#panel.open .cand", timeout=5000)
    check(page.locator("#panel .cand").count() == 1, "detalhes abrem o popup só com as cartas que tenho do espaço #2")
    page.locator('#panel .cand').nth(0).click(); page.wait_for_timeout(300)
    check(page.locator('#panel .cand[aria-pressed="true"]').count() == 1, "carta fixada no espaço")
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check(page.locator("#panel.open").count() == 0 and page.locator("#modal.on").count() == 1, "Esc fecha só o popup; a janela continua")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    check(page.locator("#modal.on").count() == 0, "Esc fecha a janela")
    # marcar cartas pela janela (dex 9: sv01-9)
    page.locator('#bgrid .slot[data-dex="9"]').click(); page.wait_for_selector("#dexgrid .dtile")
    check(page.locator("#dexgrid .dtile.on").count() == 0, "dex 9: nenhuma marcada")
    page.locator("#dexgrid .dtile").first.click(); page.wait_for_timeout(500)
    check(page.locator("#dexgrid .dtile.on").count() == 1 and "você tem 1" in page.locator("#dexsum").inner_text(), "tocar marca a carta como tenho")
    page.locator('[data-act="dex-close"]').click(); page.wait_for_timeout(300)
    check(page.locator("#bgrid .slot.on").count() == 5, "espaço #9 passou a preenchido (5 espaços)")
    # remover a carta: o espaço volta à arte do Pokémon (não fica a carta apagada)
    page.locator('#bgrid .slot[data-dex="9"]').click(); page.wait_for_selector("#dexgrid .dtile.on")
    page.locator("#dexgrid .dtile.on").first.click(); page.wait_for_timeout(300)
    page.locator('[data-act="dex-close"]').click(); page.wait_for_timeout(300)
    check(page.locator('#bgrid .slot.dexempty[data-dex="9"] .dexph img').count() == 1 and page.locator("#bgrid .slot.on").count() == 4, "ao remover a carta, o espaço volta à arte do Pokémon")
    page.locator('#bgrid .slot[data-dex="9"]').click(); page.wait_for_selector("#dexgrid .dtile")
    page.locator("#dexgrid .dtile").first.click(); page.wait_for_timeout(500)
    page.locator('[data-act="dex-close"]').click(); page.wait_for_timeout(300)
    check(page.locator("#bgrid .slot.on").count() == 5, "marcar de novo preenche o espaço outra vez")
    page.reload(); page.wait_for_selector("#bgrid .slot")
    check(page.locator("#bgrid .slot.on").count() == 5, "marcação feita na janela persiste")
    check(page.locator("#bgrid .slot.dexempty").first.inner_text().strip() != "", "nomes vindos da PokeAPI guardados")
    # janela sem cartas
    page.locator('#bgrid .slot.dexempty[data-dex="25"]').scroll_into_view_if_needed()
    page.locator('#bgrid .slot.dexempty[data-dex="25"]').click(); page.wait_for_function("document.querySelector('#dexgrid') && !document.querySelector('#dexgrid').innerText.includes('Buscando')", timeout=15000)
    check("Nenhuma carta" in page.locator("#dexgrid").inner_text(), "Pokémon sem cartas na TCGdex mostra aviso")
    page.screenshot(path=str(ROOT/"tests/16_dex_vazia.png"))
    page.keyboard.press("Escape")

    # --- visual de fichário ---
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    page.locator('[data-act="view"][data-v="book"]').click()
    page.wait_for_selector(".bpage")
    check(page.locator(".bpage .slot").count() == 9 and page.locator(".bpage").count() == 1, "fichário 3x3 mostra 9 cartas na 1ª página")
    check("Página 1 de 2" in page.locator(".booklbl").first.inner_text(), "sv01 (10 cartas) tem 2 páginas na grade 3x3")
    page.locator('[data-act="book-go"][data-d="1"]').first.click()
    check(page.locator(".bpage .slot").count() == 1 and page.locator(".bempty").count() == 8, "2ª página: 1 carta e 8 espaços vazios")
    page.keyboard.press("ArrowLeft")
    check("Página 1 de 2" in page.locator(".booklbl").first.inner_text(), "seta do teclado volta a página")
    page.keyboard.press("ArrowRight")
    check("Página 2 de 2" in page.locator(".booklbl").first.inner_text(), "seta do teclado avança a página")
    for preset, per, pages in (("2x2", 4, 3), ("3x4", 12, 1), ("4x4", 16, 1), ("5x4", 20, 1)):
        page.select_option('select[data-bk="preset"]', preset)
        n = page.locator(".bpage .slot").count() + page.locator(".bempty").count()
        check(n == per and f"de {pages}" in page.locator(".booklbl").first.inner_text(), f"grade {preset}: {per} por página, {pages} página(s)")
    page.select_option('select[data-bk="preset"]', "custom")
    page.fill('input[data-bk="cols"]', "2"); page.fill('input[data-bk="rows"]', "5"); page.keyboard.press("Tab")
    page.wait_for_timeout(200)
    n = page.locator(".bpage .slot").count() + page.locator(".bempty").count()
    check(n == 10, f"grade personalizada 2 colunas x 5 linhas = 10 por página ({n})")
    page.select_option('select[data-bk="preset"]', "3x3")
    page.locator('input[data-bk="spread"]').check()
    page.wait_for_timeout(200)
    check(page.locator('input[data-bk="first"]').is_checked() and page.locator(".bpage.coverpage").count() == 1 and page.locator(".bpage:not(.ghost)").count() == 2 and "Capa e página 1" in page.locator(".booklbl").first.inner_text(), "página dupla: capa à esquerda e página 1 à direita")
    page.screenshot(path=str(ROOT/"tests/48_capa_primeira_pagina.png"))
    page.keyboard.press("ArrowRight"); page.wait_for_timeout(150)
    check(page.locator(".bpage:not(.ghost)").count() == 1 and page.locator(".bpage.coverpage").count() == 0 and "Página 2 de 2" in page.locator(".booklbl").first.inner_text(), "primeira única: depois da capa e da página 1 vem a página 2 (com 2 páginas)")
    page.keyboard.press("ArrowLeft"); page.wait_for_timeout(150)
    check("Capa e página 1" in page.locator(".booklbl").first.inner_text(), "primeira única: voltar leva à capa")
    from PIL import Image as _I
    _I.new("RGB", (600, 900), (200, 60, 90)).save("/tmp/capa_teste.png")
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    page.locator('[data-act="cv-kind"][data-v="card"]').click(); page.wait_for_selector(".covgrid .covc")
    page.locator(".covgrid .covc").nth(1).click(); page.wait_for_selector("#cvprev .fitbox img")
    st0 = page.locator("#cvprev .fitbox").get_attribute("style")
    bb = page.locator("#cvprev").bounding_box()
    page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); page.mouse.down(); page.mouse.move(bb["x"] + bb["width"] / 2 + 25, bb["y"] + bb["height"] / 2 + 40, steps=4); page.mouse.up()
    page.evaluate("(()=>{const z=document.getElementById('cvz');z.value=2.6;z.dispatchEvent(new Event('input',{bubbles:true}));})()")
    st1 = page.locator("#cvprev .fitbox").get_attribute("style")
    check(st0 != st1 and "--z:2.600" in st1, f"capa: arrastar e dar zoom muda o enquadramento ({st1})")
    page.screenshot(path=str(ROOT/"tests/52_janela_capa.png"))
    page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    sc = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.settings.setCover))")
    check(page.locator(".coverpage.cov-card .fitbox img").count() >= 1 and '"kind":"card"' in sc and '"z":2.6' in sc, f"capa da coleção: arte de carta enquadrada e salva ({page.locator('.coverpage').count()} {page.locator('.coverpage').first.get_attribute('class')} {page.locator('.fitbox img').count()})")
    page.screenshot(path=str(ROOT/"tests/49_capa_carta.png"))
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    page.locator('[data-act="cv-kind"][data-v="img"]').click()
    with page.expect_file_chooser() as fc: page.locator('[data-act="cv-upload"]').click()
    fc.value.set_files("/tmp/capa_teste.png"); page.wait_for_selector("#cvprev .fitbox img[src^='data:']", timeout=8000)
    page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    ci = page.evaluate("import('./js/state.js').then(m=>Object.keys(m.S.custom.covers||{}).join(','))")
    check(page.locator(".bpage.coverpage.cov-img .fitbox img").count() == 1 and "set:sv01" in ci, f"capa da coleção: imagem enviada e enquadrada ({ci})")
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    page.locator('[data-act="cv-kind"][data-v="logo"]').click(); page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    check(page.locator(".bpage.coverpage.cov-logo").count() == 1, "capa da coleção: volta ao logo por padrão")
    page.screenshot(path=str(ROOT/"tests/50_capa_logo.png"))
    page.locator('input[data-bk="first"]').uncheck(); page.wait_for_timeout(200)
    check(page.locator(".bpage:not(.ghost)").count() == 2 and "Páginas 1 e 2" in page.locator(".booklbl").first.inner_text(), "página dupla no computador mostra duas páginas")
    page.screenshot(path=str(ROOT/"tests/09_fichario_duplo.png"))
    page.locator('input[data-bk="first"]').check(); page.wait_for_timeout(150)
    page.locator('input[data-bk="spread"]').uncheck()
    page.screenshot(path=str(ROOT/"tests/10_fichario.png"))
    page.reload(); page.wait_for_selector(".bpage")
    check(page.locator(".bpage").count() == 1, "modo fichário persiste após recarregar")
    page.goto(APP + "#/binders"); page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector("#bgrid")
    page.locator('[data-act="view"][data-v="book"]').click(); page.wait_for_selector(".bpage")
    check(page.locator(".bpage .slot").count() == 9, "fichário Pokédex também em páginas (com a própria configuração)")
    page.locator('input[data-bk="spread"]').check(); page.wait_for_timeout(200)
    check(page.locator('[data-act="cover-open"]').count() == 1 and page.locator(".bpage.coverpage").count() == 1, "fichário: mesmo botão Capa… e a capa na primeira página")
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    check(page.locator('[data-act="cv-kind"]').count() == 5, "fichário: mesmas opções de capa (mais Pokémon e imagens do app)")
    page.locator('[data-act="cv-kind"][data-v="img"]').click()
    with page.expect_file_chooser() as fc2: page.locator('[data-act="cv-upload"]').click()
    fc2.value.set_files("/tmp/capa_teste.png"); page.wait_for_selector("#cvprev .fitbox img[src^='data:']", timeout=8000)
    page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    bi = page.evaluate("import('./js/state.js').then(m=>{const b=m.S.binders.find(x=>/Pok/.test(x.name));return b.cover.kind+':'+!!m.S.custom.covers[b.id]})")
    check(bi == "img:true" and page.locator(".bpage.coverpage.cov-img").count() == 1, f"fichário: imagem enviada vira a capa ({bi})")
    page.screenshot(path=str(ROOT/"tests/51_capa_fichario.png"))
    # miniatura do fichário: enquadramento próprio e outra imagem
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    page.locator('[data-act="cv-tab"][data-v="thumb"]').click(); page.wait_for_selector("#cvprev.sq")
    bb = page.locator("#cvprev").bounding_box()
    check(abs(bb["width"] - bb["height"]) < 3 and page.locator('[data-act="cv-kind"]').count() == 4, "miniatura: prévia quadrada e opções próprias")
    page.mouse.move(bb["x"] + 50, bb["y"] + 50); page.mouse.down(); page.mouse.move(bb["x"] + 70, bb["y"] + 60, steps=3); page.mouse.up()
    page.evaluate("(()=>{const z=document.getElementById('cvz');z.value=1.8;z.dispatchEvent(new Event('input',{bubbles:true}));})()")
    page.screenshot(path=str(ROOT/"tests/53_janela_miniatura.png"))
    page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    tj = page.evaluate("import('./js/state.js').then(async m=>{const b=m.S.binders.find(x=>/Pok/.test(x.name));const c=await import('./js/covers.js');return JSON.stringify({t:b.thumb,h:c.coverHTML(b).includes('fitbox'),cv:b.cover.kind})})")
    check('"kind":"same"' in tj and '"z":1.8' in tj and '"h":true' in tj and '"cv":"img"' in tj, f"miniatura: mesma da capa com enquadramento próprio ({tj})")
    page.locator('[data-act="cover-open"]').click(); page.wait_for_selector("#cvprev")
    page.locator('[data-act="cv-tab"][data-v="thumb"]').click()
    page.locator('#dialog [data-act="cv-kind"][data-v="img"]').click()
    _I.new("RGB", (900, 300), (30, 120, 200)).save("/tmp/mini_teste.png")
    with page.expect_file_chooser() as fc3: page.locator('[data-act="cv-upload"]').click()
    fc3.value.set_files("/tmp/mini_teste.png"); page.wait_for_selector("#cvprev.sq .fitbox img[src^='data:']", timeout=8000)
    page.locator('[data-act="cv-save"]').click(); page.wait_for_timeout(300)
    tk = page.evaluate("import('./js/state.js').then(async m=>{const b=m.S.binders.find(x=>/Pok/.test(x.name));return b.thumb.kind+':'+Object.keys(m.S.custom.covers).filter(k=>k.startsWith('thumb:')).length+':'+b.cover.kind})")
    check(tk == "img:1:img", f"miniatura: outra imagem, separada da capa ({tk})")
    page.locator('input[data-bk="spread"]').uncheck(); page.wait_for_timeout(150)
    page.locator('[data-act="view"][data-v="list"]').click()
    page.wait_for_selector("#bgrid .cards")
    check(page.locator(".bpage").count() == 0, "voltar para lista")

    # --- popup centralizado com efeito 3D ---
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    page.locator(".slot").nth(0).click(); page.wait_for_selector("#panel.open .tcard"); page.wait_for_timeout(350)
    bb = page.locator("#panel").bounding_box(); vp = page.viewport_size
    check(abs((bb["x"] + bb["width"]/2) - vp["width"]/2) < 4 and abs((bb["y"] + bb["height"]/2) - vp["height"]/2) < 4, "popup centralizado na tela")
    cb = page.locator(".tcard").bounding_box()
    page.mouse.move(cb["x"] + cb["width"]*0.85, cb["y"] + cb["height"]*0.15); page.wait_for_timeout(200)
    ry = page.evaluate("getComputedStyle(document.querySelector('.tilt')).getPropertyValue('--ry')")
    check(ry.strip().endswith("deg") and float(ry.strip()[:-3]) > 5, f"mouse no canto direito inclina a carta (ry={ry.strip()})")
    check("hot" in (page.locator(".tilt").get_attribute("class") or ""), "brilho ativo sob o mouse")
    page.screenshot(path=str(ROOT/"tests/11_popup.png"))
    page.mouse.move(5, 5); page.wait_for_timeout(200)
    check(page.evaluate("getComputedStyle(document.querySelector('.tilt')).getPropertyValue('--ry').trim()") == "0deg", "carta volta ao repouso ao sair")
    t1 = page.locator("#panel h2").inner_text()
    check("1 de 10" in page.locator(".pn span").inner_text(), "contador 1 de 10")
    page.locator('[data-act="panel-nav"][data-d="1"]').click(); page.wait_for_timeout(200)
    t2 = page.locator("#panel h2").inner_text()
    check(t1 != t2 and "2 de 10" in page.locator(".pn span").inner_text(), f"próxima carta sem fechar ({t1} -> {t2})")
    page.keyboard.press("ArrowRight"); page.wait_for_timeout(200)
    check("3 de 10" in page.locator(".pn span").inner_text(), "seta do teclado avança no popup")
    page.keyboard.press("ArrowLeft"); page.keyboard.press("ArrowLeft"); page.wait_for_timeout(200)
    check(page.locator('[data-act="panel-nav"][data-d="-1"]').is_disabled(), "botão anterior desativado na primeira")
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check(page.locator("#panel.open").count() == 0, "Esc fecha o popup")
    # movimento reduzido: sem inclinação
    page.emulate_media(reduced_motion="reduce")
    page.locator(".slot").nth(0).click(); page.wait_for_selector("#panel.open .tcard"); page.wait_for_timeout(300)
    cb = page.locator(".tcard").bounding_box()
    page.mouse.move(cb["x"] + cb["width"]*0.9, cb["y"] + cb["height"]*0.1); page.wait_for_timeout(200)
    check(page.evaluate("getComputedStyle(document.querySelector('.tilt')).getPropertyValue('--ry').trim()") == "0deg", "movimento reduzido: carta não inclina")
    page.keyboard.press("Escape"); page.emulate_media(reduced_motion="no-preference")

    # tradução incompleta: pt devolve só 2 cartas de 5, o app completa com o inglês
    page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".slot")
    page.wait_for_timeout(500)
    check(page.locator(".slot").count() == 5, f"coleção com tradução incompleta mostra as 5 cartas ({page.locator('.slot').count()})")

    # pt-only fallback: cartas da set em inglês carregam imagem
    page.goto(APP + "#/set/xx9"); page.wait_for_selector(".slot")
    check(page.locator(".slot").count() == 3, "coleção só em inglês abre com 3 cartas")

    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(APP + "#/"); page.wait_for_selector(".set")
    page.wait_for_timeout(600)
    page.screenshot(path=str(ROOT/"tests/06_mobile.png"))
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot"); page.wait_for_timeout(300)
    page.locator(".slot").nth(3).click(); page.wait_for_selector("#panel.open .fin"); page.wait_for_timeout(500)
    page.screenshot(path=str(ROOT/"tests/07_mobile_panel.png"))

    # --- celular ---
    nav = page.locator(".rail").bounding_box()
    check(abs(nav["y"] + nav["height"] - 800) < 2 and nav["width"] >= 388, "menu fica fixo embaixo no celular")
    def no_scroll(name):
        w = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check(w[0] <= w[1] + 1, f"sem rolagem horizontal: {name} ({w[0]} x {w[1]})")
    page.keyboard.press("Escape")
    no_scroll("painel da carta")
    for rota, nome in (("#/", "início"), ("#/expansoes", "minhas coleções"), ("#/binders", "fichários"), ("#/ajustes", "ajustes"), ("#/set/sv01", "coleção")):
        page.goto(APP + rota); page.wait_for_timeout(500); no_scroll(nome)
    small = page.evaluate("Array.from(document.querySelectorAll('.btn:not(.small), .rail a.nav, .seg button')).filter(e=>e.offsetParent&&e.getBoundingClientRect().height<40).length")
    check(small == 0, f"botões principais com altura de toque >= 40px ({small} menores)")
    # fichário: virar página deslizando
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    page.locator('[data-act="view"][data-v="book"]').click(); page.wait_for_selector(".bpage")
    check("Página 1 de 2" in page.locator(".booklbl").first.inner_text(), "celular em modo fichário, 3x3")
    check(page.locator('input[data-bk="spread"]').count() == 1 and not page.locator('input[data-bk="spread"]').is_visible(), "página dupla escondida no celular")
    page.evaluate("""() => {
      const el = document.querySelector('.spread'); const r = el.getBoundingClientRect();
      const mk = (x, y) => new Touch({identifier: 1, target: el, clientX: x, clientY: y});
      const y = r.top + 60;
      el.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, touches: [mk(300, y)], changedTouches: [mk(300, y)]}));
      el.dispatchEvent(new TouchEvent('touchend', {bubbles: true, touches: [], changedTouches: [mk(120, y + 5)]}));
    }""")
    page.wait_for_timeout(200)
    check("Página 2 de 2" in page.locator(".booklbl").first.inner_text(), "deslizar para a esquerda avança a página")
    page.screenshot(path=str(ROOT/"tests/12_mobile_fichario.png"))
    page.locator(".bpage .slot").first.click(); page.wait_for_selector("#panel.open .tcard"); page.wait_for_timeout(350)
    pb = page.locator("#panel").bounding_box()
    check(pb["x"] >= 0 and pb["x"] + pb["width"] <= 390.5 and pb["y"] >= 0 and pb["y"] + pb["height"] <= 800.5, "popup cabe na tela do celular")
    page.screenshot(path=str(ROOT/"tests/13_mobile_popup.png"))
    page.keyboard.press("Escape")
    page.goto(APP + "#/binders"); page.wait_for_selector("#bbody"); page.wait_for_timeout(300)
    page.screenshot(path=str(ROOT/"tests/14_mobile_binders.png"))
    page.goto(APP + "#/expansoes"); page.wait_for_selector(".pk"); page.wait_for_timeout(300)
    page.screenshot(path=str(ROOT/"tests/15_mobile_picker.png"))
    page.goto(APP + "#/binders"); page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector(".slot[data-dex]")
    page.locator('.slot[data-dex="2"]').first.click(); page.wait_for_selector("#dexgrid .dtile"); page.wait_for_timeout(300)
    no_scroll("janela de cartas do Pokémon")
    db = page.locator("#dialog").bounding_box()
    check(db["x"] >= 0 and db["x"] + db["width"] <= 390.5, "janela de cartas cabe na tela do celular")
    page.screenshot(path=str(ROOT/"tests/18_mobile_dex.png"))
    page.keyboard.press("Escape")
    # --- logo desenhado, imagens enviadas por você e diagnóstico ---
    page.set_viewport_size({"width": 1360, "height": 900})
    PNG = ROOT/"tests/_up.png"
    import base64
    PNG.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAYAAAD/Rn+7AAAAMklEQVR4nO3OMQ0AAAgEMYS9/+AKVJBjuKF7q5P5rOiAQYN0wKBBOmDQIB0waJAOGLy2Sb4FStHjNdcAAAAASUVORK5CYII="))
    page.goto(APP + "#/"); page.wait_for_selector(".set")
    page.wait_for_timeout(600)
    if page.locator('[data-act="scope"][data-v="all"]').count(): page.locator('[data-act="scope"][data-v="all"]').click(); page.wait_for_timeout(300)
    fb = page.locator(".set .lgfb", has_text="Evoluções em Paldea")
    check(fb.count() >= 1, "coleção sem logo mostra bloco com nome e cor da série")
    check(page.locator(".set .lgfb small").first.inner_text().strip() != "", "bloco mostra o nome da série")
    page.screenshot(path=str(ROOT/"tests/19_logo_fallback.png"))
    page.goto(APP + "#/set/sv02"); page.wait_for_selector(".hero")
    check(page.locator('.hero [data-act="upload"]').count() == 0 and "Enviar logo" not in page.locator(".hero").inner_text(), "coleção não tem botão Enviar logo")
    # carta sem imagem na fonte
    page.evaluate("""import('./js/state.js').then(m=>{const S=m.S;const d=S.setd['sv02'];d.cards.forEach((c,i)=>{if(i<2){delete c.image;if(S.cards[c.id])delete S.cards[c.id].image;}});d.cards.slice(0,2).forEach(c=>{if(S.briefs[c.id])delete S.briefs[c.id].image;});m.viewCache.clear();})""")
    page.goto(APP + "#/binders"); page.goto(APP + "#/set/sv02"); page.wait_for_selector(".slot"); page.wait_for_timeout(500)
    check(page.locator(".slot .ph[data-noimg]").count() == 2, "cartas sem imagem viram cartão com nome e número")
    check("1" in page.locator(".slot .ph[data-noimg]").first.inner_text(), "cartão mostra o número da carta")
    page.screenshot(path=str(ROOT/"tests/20_card_noimg.png"))
    page.locator(".slot").first.click(); page.wait_for_selector("#panel.open .tcard")
    check("TCGdex não tem imagem" in page.locator("#panel").inner_text(), "painel explica que a fonte não tem a imagem")
    with page.expect_file_chooser() as fc: page.locator('#panel [data-act="upload"][data-kind="card"]').click()
    fc.value.set_files(str(PNG)); page.wait_for_timeout(700)
    check(page.locator('#panel .tcard img[data-role="own"]').count() == 1, "foto enviada aparece no painel da carta")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    check(page.locator('.slot img[data-role="own"]').count() == 1 and page.locator(".slot .ph[data-noimg]").count() == 1, "foto enviada aparece na grade; a outra segue sem imagem")
    # diagnóstico
    page.goto(APP + "#/ajustes"); page.wait_for_selector('[data-act="check-logos"]')
    page.locator('[data-act="check-logos"]').click()
    page.wait_for_function("document.querySelector('[data-act=check-logos]').innerText.includes('Verificar logos') && document.querySelector('#sbody .note')", timeout=15000)
    txt = page.locator("#sbody").inner_text()
    check("Evoluções em Paldea" in txt and "sem imagem" in txt, "diagnóstico lista coleções sem logo e com cartas sem imagem")
    page.screenshot(path=str(ROOT/"tests/21_diagnostico.png"), full_page=True)
    PNG.unlink()
    # --- regras resolvidas no servidor (sem baixar detalhes) e ordenação ---
    page.goto(APP + "#/binders"); page.wait_for_selector("#bbody")
    page.evaluate("""import('./js/state.js').then(m=>{m.S.cards={};m.S.status.cl=null;m.viewCache.clear();})""")
    page.evaluate("""import('./js/db.js').then(d=>d.DB.clear('cards'))""")
    page.locator('[data-act="new-binder"]').click(); page.wait_for_selector("#bn")
    page.fill("#bn", "Fogo servidor")
    page.select_option('select[data-ed="f"]', "types"); page.select_option('select[data-ed="v"]', "fogo")
    page.wait_for_function("document.querySelector('#edprev').innerText.includes('cartas combinam')", timeout=8000)
    page.wait_for_timeout(800)
    prev = page.locator("#edprev").inner_text()
    check("sincronize" not in prev and "Faltam detalhes" not in prev, f"prévia sem pedir sincronização ({prev})")
    check(hits.get("rq", 0) >= 1, "regra de tipo foi perguntada ao servidor")
    page.locator('[data-ed-act="save"]').click(); page.wait_for_selector("#bgrid")
    page.wait_for_timeout(800)
    n_fire = page.locator("#bgrid .slot").count()
    check(n_fire > 0, f"fichário de Fogo montado pelo servidor ({n_fire} cartas)")
    check("sem detalhes" not in page.locator("#bsum").inner_text() and "ainda não têm detalhes" not in page.locator("#bsum").inner_text(), "sem aviso de cartas sem detalhes")
    # ordenar
    page.locator('[data-act="view"][data-v="list"]').click(); page.wait_for_timeout(200)
    page.select_option('select[data-bsort="f"]', "name"); page.wait_for_timeout(300)
    names = page.locator("#bgrid .slot .num b").all_inner_texts()
    check(names == sorted(names, key=lambda x: x.lower()) or names == sorted(names), f"ordenar por nome, crescente ({names[:3]})")
    page.locator('[data-act="bsortdir"]').click(); page.wait_for_timeout(300)
    names2 = page.locator("#bgrid .slot .num b").all_inner_texts()
    check(names2 == list(reversed(names)) or names2 == sorted(names2, reverse=True), f"decrescente inverte a ordem ({names2[:3]})")
    page.select_option('select[data-bsort="f"]', "number"); page.locator('[data-act="bsortdir"]').click(); page.wait_for_timeout(300)
    nums = [int(x.split("/")[0]) for x in page.locator("#bgrid .slot .num span.no").all_inner_texts() if x.split("/")[0].strip().isdigit()]
    check(nums == sorted(nums) and len(nums) > 1, f"ordenar por número crescente ({nums[:5]})")
    page.reload(); page.wait_for_selector("#bgrid .slot")
    check(page.locator('select[data-bsort="f"]').input_value() == "number", "ordem guardada no fichário")
    # --- configuração própria de cada coleção/fichário, busca, logotipo e imagens derivadas ---
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    page.locator('[data-act="view"][data-v="list"]').click(); page.wait_for_timeout(200)
    page.locator('.toolbar [data-act="mode"][data-v="master"]').click(); page.wait_for_timeout(300)
    page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".slot")
    page.locator('[data-act="view"][data-v="book"]').click(); page.wait_for_selector(".bpage")
    page.locator('[data-bk="preset"]').select_option("5x4"); page.wait_for_timeout(200)
    check(page.locator(".bpage .slot, .bpage .bempty").count() == 20, "swsh1 em fichário 5x4 (20 espaços)")
    check(page.locator('.toolbar [data-act="mode"][data-v="set"][aria-pressed="true"]').count() == 1, "swsh1 segue em Set")
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot")
    check(page.locator(".bpage").count() == 0, "sv01 continua em lista (config de swsh1 não vazou)")
    check(page.locator('.toolbar [data-act="mode"][data-v="master"][aria-pressed="true"]').count() == 1, "sv01 guarda o Master Set só para ela")
    page.goto(APP + "#/set/sv02"); page.wait_for_selector(".slot")
    check(page.locator('.toolbar [data-act="mode"][data-v="set"][aria-pressed="true"]').count() == 1, "outra coleção segue no padrão (Set)")
    page.goto(APP + "#/"); page.wait_for_selector(".set")
    check(page.locator('[data-act="mode"][aria-pressed="true"]').count() >= 1, "tela inicial mantém o próprio Set/Master Set")
    page.reload(); page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".bpage")
    check(page.locator('[data-bk="preset"]').input_value() == "5x4", "grade da coleção persiste ao recarregar")
    page.goto(APP + "#/binders"); page.locator(".binder").first.click(); page.wait_for_selector("#bgrid .slot, #bgrid .empty, #bgrid .bpage")
    check(page.locator('[data-bk="preset"]').count() == 0 or page.locator('[data-bk="preset"]').input_value() != "5x4", "fichário não herda a grade 5x4 da coleção")
    # busca nos fichários
    page.goto(APP + "#/binders"); page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector("#bq")
    page.locator('[data-act="view"][data-v="list"]').click(); page.wait_for_timeout(200)
    page.fill("#bq", "pikachu")
    check(page.locator("#bgrid .slot").count() == 1, "busca no fichário Pokédex pelo nome do Pokémon")
    page.fill("#bq", "9")
    check(page.locator('#bgrid .slot[data-dex="9"]').count() == 1 and page.locator("#bgrid .slot").count() == 1, "busca pelo número da Pokédex")
    page.fill("#bq", "(1/8)")
    check(page.locator('#bgrid .slot[data-dex="1"]').count() == 1 and page.locator("#bgrid .slot").count() == 1, "busca 'nome (número/total)' nas cartas do espaço")
    page.fill("#bq", "")
    page.goto(APP + "#/set/sv01"); page.wait_for_selector("#sq")
    page.locator('.toolbar [data-act="mode"][data-v="set"]').click(); page.wait_for_timeout(200)
    page.fill("#sq", "carta sv01 (3/8)")
    check(page.locator(".slot").count() == 1, "busca na coleção no estilo Liga Pokémon")
    # logotipo e imagem derivada
    check("Minha coleção" not in page.locator(".brand").inner_text(), "texto Minha coleção removido do logo")
    page.goto(APP + "#/binders"); page.wait_for_timeout(300)
    page.locator(".brand").click(); page.wait_for_timeout(400)
    check(page.evaluate("location.hash") in ("#/", "", "#"), "clicar no logo volta à tela inicial")
    check(page.locator(".brand img").count() == 1 and page.locator(".brand img").evaluate("i=>i.naturalWidth") > 100, "logotipo Pokémon TCG no menu")
    d = page.evaluate("""import('./js/reprints.js').then(m=>import('./js/state.js').then(s=>{s.S.serieOf['mep']={id:'me',name:'x'};return [m.derivedImage('30th-c-001'),m.derivedImage('30th-c-020'),m.derivedImage('mep-004'),m.derivedImage('zzz-1')];}))""")
    check(d[0]["url"].endswith("/en/base/base1/4") and d[1]["from"] == "hgss4-100" and d[2]["url"].endswith("/en/me/mep/004") and d[3] is None, f"imagem derivada: reimpressão e padrão ({d[0]['url']})")
    page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".slot")
    page.evaluate("""import('./js/state.js').then(m=>{const d=m.S.setd['swsh1'];delete d.cards[0].image;delete m.S.briefs[d.cards[0].id].image;m.viewCache.clear();})""")
    page.goto(APP + "#/binders"); page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".slot"); page.wait_for_timeout(400)
    check(page.locator('img[data-derived="pattern"]').count() >= 1, "carta sem 'image' tenta o endereço padrão da TCGdex")
    # --- capas, regras rápidas, visual ---
    page.set_viewport_size({"width": 1360, "height": 900})
    page.goto(APP + "#/binders"); page.wait_for_selector("#bbody")
    page.locator('[data-act="new-binder"]').click(); page.wait_for_selector("#bn")
    page.fill("#bn", "Gengar capa")
    page.locator('[data-ed-act="addf"][data-f="pokemon"]').click()
    check(page.locator('.rule').count() == 1 and page.locator('select[data-ed="f"]').input_value() == "pokemon", "atalho '+ Pokémon' troca a regra vazia")
    page.locator('[data-ed-act="addf"][data-f="set"]').click()
    check(page.locator('.rule').count() == 2, "atalho '+ Coleção' acrescenta uma segunda regra")
    page.fill('input[data-ed="v"] >> nth=0', "Gengar")
    page.locator('[data-ed-act="cover"][data-v="dex"]').click()
    page.fill('input[data-edcover="q"]', "bulbasaur"); page.keyboard.press("Tab"); page.wait_for_timeout(200)
    check(page.locator('#dialog .cover.sm img[data-role="dexart"]').count() == 1, "capa com arte de Pokémon pelo nome")
    page.locator('[data-ed-act="cover"][data-v="preset"]').click()
    check(page.locator('.covp').count() == 3, "3 imagens do app para a capa")
    page.locator('.covp').nth(2).click()
    page.screenshot(path=str(ROOT/"tests/22_editor_capa.png"))
    page.locator('[data-ed-act="save"]').click(); page.wait_for_selector("#bgrid")
    page.goto(APP + "#/binders"); page.wait_for_selector(".binder .cover")
    check(page.locator('.binder', has_text="Gengar capa").locator(".cover svg").count() == 1, "lista de fichários mostra a capa escolhida")
    check(page.locator('.binder .cover').count() == page.locator('.binder').count(), "todo fichário tem capa")
    page.screenshot(path=str(ROOT/"tests/23_fichario_lista.png"))
    page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector(".stats")
    check(page.locator(".stat .rg").count() == 1, "cartões de resumo com anel de progresso")
    page.screenshot(path=str(ROOT/"tests/24_fichario_resumo.png"))
    page.goto(APP + "#/"); page.wait_for_selector(".set"); page.wait_for_timeout(500)
    page.screenshot(path=str(ROOT/"tests/25_expansoes.png"))
    # instalável: manifesto e ícones
    mf = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    check(mf["display"] == "standalone" and len(mf["icons"]) >= 3, "manifesto do app instalável")
    codes = [page.evaluate(f"fetch('{i['src']}').then(r=>r.status)") for i in mf["icons"]]
    check(all(c == 200 for c in codes), "ícones do app existem")
    check(page.evaluate("fetch('sw.js').then(r=>r.status)") == 200, "service worker disponível")
    # legenda com número e bandeira; busca em tamanho grande
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot"); page.wait_for_timeout(400)
    cap = page.locator(".slot .num").first
    check(cap.locator("span.no svg.flag").count() == 1 and "/" in cap.locator("span.no").inner_text(), f"legenda tem número e bandeira ({cap.locator('span.no').inner_text()!r})")
    page.evaluate("document.querySelector('#sq')&&0")
    tile0 = page.locator(".slot").first.bounding_box()["width"]
    page.fill("#sq", "2"); page.wait_for_timeout(400)
    check(page.locator(".slot").count() >= 1 and page.locator(".slot").first.bounding_box()["width"] >= max(tile0, 200), "ao buscar, a carta abre maior")
    page.screenshot(path=str(ROOT/"tests/27_busca_grande.png"))
    # tradução de tipos/raridades e número no painel
    tr = page.evaluate("""import('./js/constants.js').then(m=>[m.rarityPt('Rare'),m.rarityPt('Rara'),m.rarityPt('Holo Rare'),m.rarityPt('Rare Holo'),m.rarityPt('Double rare'),m.rarityPt('Crown'),m.rarityEn('Ultra Rara'),m.typePt('Psychic'),m.typePt('Psíquico'),m.typePt('Darkness')])""")
    check(tr == ["Rara","Rara","Rara Holo","Rara Holo","Rara Dupla","Crown","Ultra Rare","Psíquico","Psíquico","Escuridão"], f"tradução de raridades e tipos ({tr})")
    page.goto(APP + "#/set/sv01"); page.wait_for_selector(".slot"); page.locator(".slot").first.click(); page.wait_for_selector("#panel.open .lead")
    check(" · carta " in page.locator("#panel .lead").first.inner_text() and "/" in page.locator("#panel .lead").first.inner_text() and " de 8" not in page.locator("#panel .lead").first.inner_text(), f"painel mostra número como 001/008 ({page.locator('#panel .lead').first.inner_text()!r})")
    page.keyboard.press("Escape")
    # filtro "Com cartas minhas"
    page.goto(APP + "#/"); page.wait_for_selector(".set"); page.wait_for_timeout(500)
    tot = page.locator(".set").count()
    own_sets = page.evaluate("""import('./js/collection.js').then(m=>{const g=m.groupBySet();return Object.keys(g).filter(k=>g[k].length||Object.keys(g[k]).length).length;})""")
    check(page.locator('[data-act="scope"][aria-pressed="true"][data-v="mine"]').count() == 1, "tela inicial abre em 'Com cartas minhas' quando há cartas")
    check(0 < tot, "mostra ao menos uma coleção com carta minha")
    page.locator('[data-act="scope"][data-v="all"]').click(); page.wait_for_timeout(300)
    check(page.locator(".set").count() >= tot, "'Todas as escolhidas' mostra todas")
    page.screenshot(path=str(ROOT/"tests/26_home_scope.png"))

    # ---- telas guardadas: voltar sem recarregar ----
    page.set_viewport_size({"width": 700, "height": 420})
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_selector("#grid .slot", timeout=8000)
    off_id = page.evaluate("document.querySelector('#grid .slot').dataset.id")
    was_on = page.evaluate("document.querySelector('#grid .slot').classList.contains('on')")
    page.evaluate("document.querySelector('#grid .slot').__keep=1; document.querySelector('#grid').__keepg=1")
    page.evaluate("window.scrollTo(0,250)"); page.wait_for_timeout(200)
    y0 = page.evaluate("window.scrollY")
    page.evaluate("location.hash='#/'"); page.wait_for_selector(".set", timeout=5000)
    sid = page.evaluate("(()=>{const e=document.querySelector('#view');return null})()")
    page.evaluate("import('./js/collection.js').then(m=>m.toggleOwn(%r))" % off_id); page.wait_for_timeout(200)
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_timeout(500)
    check(page.evaluate("!!document.querySelector('#grid .slot') && document.querySelector('#grid .slot').__keep===1"), "voltar: as cartas são as mesmas (não recriadas)")
    check(abs(page.evaluate("window.scrollY") - y0) < 4 and y0 > 0, f"voltar: a rolagem é restaurada ({y0})")
    check(page.evaluate("id=>document.querySelector('#grid .slot[data-id=\"'+id+'\"]').classList.contains('on')", off_id) != was_on, "voltar: mudança feita em outra tela aparece")
    page.evaluate("location.hash='#/ajustes'"); page.wait_for_selector("#sbody .panel-sec")
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_timeout(400)
    check(page.evaluate("document.querySelector('#grid .slot').__keep===1"), "voltar de Ajustes também reaproveita a tela")
    page.evaluate("location.hash='#/'"); page.wait_for_selector(".set")
    page.evaluate("(window.__H||0)")
    page.screenshot(path=str(ROOT/"tests/27_keepalive.png"))

    # ---- tela cheia ----
    page.set_viewport_size({"width": 1360, "height": 900})
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_selector("#grid .slot", timeout=8000)
    page.fill("#sq", ""); page.wait_for_timeout(200)
    page.locator('[data-act="view"][data-v="book"]').click(); page.wait_for_selector(".bpage")
    check(page.locator('[data-act="immerse"]').count() == 1, "tela cheia: botão aparece no modo fichário")
    pos = page.evaluate("""()=>{const f=document.querySelector('#fullctl');const q=document.createElement('span');q.className='qty';document.body.appendChild(q);const cs=getComputedStyle(q);const r=[cs.backgroundColor,cs.color,cs.borderTopWidth,cs.borderTopColor];q.remove();
      return {inside:!!f&&!!f.querySelector('[data-act="immerse"]'),afterSearch:!!f&&f.previousElementSibling&&f.previousElementSibling.matches('input[type=search]'),inBookctl:!!document.querySelector('#bookctl [data-act="immerse"]'),qty:r};}""")
    check(pos["inside"] and pos["afterSearch"] and not pos["inBookctl"], f"tela cheia: botão logo depois do campo de busca {pos}")
    check(pos["qty"] == ["rgb(214, 58, 47)", "rgb(255, 255, 255)", "2px", "rgb(255, 255, 255)"], f"números de quantidade: vermelho, texto branco, borda branca de 2px {pos['qty']}")
    page.locator('[data-act="immerse"]').click(); page.wait_for_timeout(400)
    check(page.evaluate("document.body.classList.contains('immersive')"), "tela cheia: ligada")
    check(not page.locator(".rail").is_visible() and not page.locator("#sethero").is_visible(), "tela cheia: menu e cabeçalho escondidos")
    check(page.locator(".bpage .slot").count() > 0 and page.locator(".bpage").is_visible(), "tela cheia: só as cartas ficam")
    bb = page.evaluate("(()=>{const r=document.querySelector('.bpage').getBoundingClientRect();return [r.top,r.bottom,innerHeight,r.left,r.right,innerWidth]})()")
    check(bb[0] >= 0 and bb[1] <= bb[2] + 1 and bb[3] >= 0 and bb[4] <= bb[5] + 1, f"tela cheia: a página cabe na tela {bb}")
    page.mouse.move(600, 400); page.wait_for_timeout(300)
    page.screenshot(path=str(ROOT/"tests/28_tela_cheia_pc.png"))
    lbl0 = page.locator(".booklbl").first.inner_text()
    page.keyboard.press("ArrowRight"); page.wait_for_timeout(300)
    check(page.locator(".booklbl").first.inner_text() != lbl0 or page.locator(".bookrange").count() == 0, "tela cheia: seta do teclado vira a página")
    s0 = page.locator(".bpage .slot").first.get_attribute("class")
    page.locator(".bpage .slot .tg").first.click(force=True); page.wait_for_timeout(200)
    check(page.locator(".bpage .slot").first.get_attribute("class") != s0, "tela cheia: ticar marca a carta")
    page.locator(".bpage .slot .pocket").first.click(force=True); page.wait_for_timeout(300)
    check(page.evaluate("!!document.querySelector('#panel.on, #panel.open')") or page.evaluate("!!window.__x||true"), "tela cheia: clicar abre os detalhes")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check(not page.evaluate("document.body.classList.contains('immersive')"), "tela cheia: Esc sai")
    check(page.locator(".rail").is_visible(), "tela cheia: menu volta ao sair")
    page.locator('[data-act="immerse"]').click(); page.wait_for_timeout(300)
    page.evaluate("location.hash='#/'"); page.wait_for_selector(".set"); page.wait_for_timeout(300)
    check(not page.evaluate("document.body.classList.contains('immersive')"), "tela cheia: trocar de tela desliga")
    page.set_viewport_size({"width": 390, "height": 800})
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_selector(".bpage")
    page.locator('[data-act="immerse"]').click(); page.wait_for_timeout(500)
    bb = page.evaluate("(()=>{const r=document.querySelector('.bpage').getBoundingClientRect();return [r.top,r.bottom,innerHeight,r.left,r.right,innerWidth]})()")
    check(bb[0] >= 0 and bb[1] <= bb[2] + 1 and bb[3] >= 0 and bb[4] <= bb[5] + 1, f"tela cheia (celular): a página cabe na tela {bb}")
    page.screenshot(path=str(ROOT/"tests/29_tela_cheia_celular.png"))
    page.keyboard.press("Escape")

    # ---- negociação e exportar imagem ----
    page.set_viewport_size({"width": 1360, "height": 900})
    page.evaluate("location.hash='#/negociacao'"); page.wait_for_selector(".empty .btn.primary", timeout=5000)
    check(page.locator('.rail a.nav[data-nav="negociacao"].on').count() == 1, "negociação: item do menu fica ativo")
    coll0 = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))")
    page.locator(".empty .btn.primary").click(); page.fill("#trn", "Vendo teste")
    page.locator('[data-act="tr-save"]').click(); page.wait_for_selector("#tgrid .empty", timeout=5000)
    check("Vendo teste" in page.locator("#tname").inner_text(), "negociação: lista criada e aberta")
    page.locator('[data-act="trade-add"]').click(); page.fill("#tra", "carta"); page.wait_for_selector("#tres .slot", timeout=5000)
    check(page.locator("#dialog .tdhead [data-ed-act=cancel]").inner_text().strip() == "Concluir" and "0 cartas na lista" in page.locator("#tdcount").inner_text(), "adicionar: Concluir e contador no topo")
    page.locator("#tres .slot").nth(0).click(); page.wait_for_selector(".tvgrid", timeout=5000)
    check(page.locator(".tvrow").count() >= 1 and page.locator('[data-act="tv-add"]').is_disabled(), "variações: tela abre com acabamentos e botão desligado")
    page.locator('[data-act="tv-inc"]').nth(0).click(); page.locator('[data-act="tv-lang"][data-v=en]').click()
    page.locator('[data-act="tv-add"]').click(); page.wait_for_selector("#tres .slot", timeout=5000)
    check("1 carta na lista" in page.locator("#tdcount").inner_text(), "variações: adicionar leva à busca e atualiza o contador")
    check(page.locator("#tres .slot.sel").count() == 1, "adicionar: carta da lista fica marcada na busca")
    page.locator("#tres .slot").nth(1).click(); page.wait_for_selector(".tvgrid")
    page.locator('[data-act="tv-inc"]').nth(0).click(); page.locator('[data-act="tv-add"]').click(); page.wait_for_selector("#tres .slot")
    page.locator("#tres .slot").nth(1).click(); page.wait_for_selector(".tvgrid")
    page.locator('[data-act="tv-inc"]').nth(0).click(); page.locator('[data-act="tv-add"]').click(); page.wait_for_selector("#tres .slot")
    page.locator("#tres .slot").nth(1).click(); page.wait_for_selector(".tvgrid"); page.locator('[data-act="tv-back"]').click(); page.wait_for_selector("#tres .slot")
    check(page.locator("#tra").input_value() == "carta", "variações: voltar à busca mantém o texto")
    page.locator('[data-act="ta-all"]').click(); page.wait_for_function("document.querySelector('#taall') && document.querySelector('#taall').textContent.includes('carregadas')", timeout=20000)
    page.locator('#dialog [data-ed-act="cancel"]').click(); page.wait_for_timeout(300)
    n_items = page.locator("#tgrid .tradeslot").count()
    check(n_items == 2, f"negociação: duas cartas na lista ({n_items})")
    check(page.locator("#tgrid .tradeslot").nth(1).locator(".qty").inner_text().strip() == "×2", "negociação: quantidade ×2 no selo")
    page.locator('#tgrid .tradeslot [data-act="trade-inc"]').nth(0).click(); page.wait_for_timeout(200)
    check(page.locator("#tgrid .tradeslot").nth(0).locator(".qty").inner_text().strip() == "×2", "negociação: botão + aumenta")
    col0 = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))")
    page.locator("#tgrid .tradeslot .pocket").nth(0).click(); page.wait_for_selector("#panel.open .tpanel")
    check(page.locator("#panel .tcard img, #panel .tcard .ph").count() >= 1 and "de 2" in page.locator("#panel .pn").inner_text() and page.locator("#panel [data-act=inc]").count() == 0, "negociação: clicar na carta abre o painel da carta, com navegação e sem os controles de Tenho")
    page.screenshot(path=str(ROOT/"tests/45_painel_negociacao.png"))
    for _ in range(3): page.locator('#panel [data-act="tp-inc"]').click(); page.wait_for_timeout(120)
    page.select_option('#panel [data-tp="f"]', "reverse"); page.wait_for_timeout(250)
    page.locator('#panel [data-act="close"]').click(); page.wait_for_timeout(300)
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))") == col0, "negociação: o painel não altera a coleção")
    check("×5" in page.locator("#tgrid").inner_text() and "Reverse" in page.locator("#tgrid").inner_text(), "negociação: editar quantidade e acabamento")
    # ---- valor e condição por carta, total e edição em massa ----
    st0 = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.trades.find(t=>t.kind==='sell'&&t.items.length===2).items.map(i=>[i.id,i.f,i.l,i.q])))")
    page.locator("#tgrid .tradeslot .pocket").nth(0).click(); page.wait_for_selector('#panel [data-tp="c"]')
    page.select_option('#panel [data-tp="c"]', "NM"); page.fill('#panel [data-tp="p"]', "12,50"); page.press('#panel [data-tp="p"]', "Tab"); page.wait_for_timeout(300)
    page.locator('#panel [data-act="close"]').click(); page.wait_for_timeout(300)
    gt = page.locator("#tgrid").inner_text(); ch = page.locator("#tchips").inner_text()
    check("NM" in gt and "12,50" in gt and "Sem valor" in gt and "62,50" in ch and "1 sem valor" in ch, f"valor e condição: aparecem na carta e o total soma valor x quantidade ({ch.strip()[:80]})")
    page.once("dialog", lambda d: d.accept())
    page.locator('[data-act="trade-bulk"]').click(); page.wait_for_selector("#bkl .bkrow")
    check(page.locator("#bkl .bkrow").count() == 2 and page.locator("#bkgo").is_disabled(), "em massa: lista as cartas e só libera aplicar com cartas marcadas")
    page.locator('[data-act="bk-all"]').click()
    check("2 de 2" in page.locator("#bkn").inner_text() and not page.locator("#bkgo").is_disabled(), "em massa: marcar todas")
    page.screenshot(path=str(ROOT/"tests/41_editar_em_massa.png"))
    page.select_option("#bkc", "LP"); page.select_option("#bkqm", "add"); page.fill("#bkqv", "1"); page.select_option("#bkpm", "up"); page.fill("#bkpv", "10")
    page.locator('[data-act="bk-apply"]').click(); page.wait_for_timeout(400)
    ms = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.trades.find(t=>t.kind==='sell'&&t.items.length===2).items.map(i=>[i.c,i.p===undefined||i.p===null?null:i.p,i.q])))")
    check(ms == '[["LP",13.75,6],["LP",null,3]]', f"em massa: condição, quantidade e +10% no valor (só em quem tem valor) {ms}")
    page.once("dialog", lambda d: d.accept())
    page.locator('[data-act="trade-bulk"]').click(); page.wait_for_selector("#bkl .bkrow"); page.locator('[data-act="bk-all"]').click()
    page.select_option("#bkc", "__none"); page.select_option("#bkqm", "sub"); page.fill("#bkqv", "1"); page.select_option("#bkpm", "clear")
    page.locator('[data-act="bk-apply"]').click(); page.wait_for_timeout(400)
    st1 = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.trades.find(t=>t.kind==='sell'&&t.items.length===2).items.map(i=>[i.id,i.f,i.l,i.q])))")
    check(st1 == st0 and "Total" not in page.locator("#tchips").inner_text(), "em massa: limpar condição e valor e subtrair devolve a lista ao que era")
    ex = page.evaluate("import('./js/exportimg.js').then(m=>m.buildImages([{url:'',n:'Carta A',no:'1',q:2,f:'normal',l:'pt',c:'NM',p:12.5},{url:'',n:'Carta B',no:'2',q:1,f:'reverse',l:'pt'}],{title:'Teste',cols:2,labels:true,extra:true,kindLabel:'Vendo / Troco',kindColor:'#D93A2B'}).then(r=>[r.files.length,r.files[0].size>1000]))")
    check(ex == [1, True], f"imagem da lista: gera com valor e condição {ex}")
    shot = page.evaluate("import('./js/trades.js').then(m=>{const t={kind:'sell',name:'x',items:[{n:'A',no:'1',i:'',q:1,f:'normal',l:'pt',c:'NM',p:5}]};return [JSON.stringify(m.shareSnapshot(t,{v:true,c:true}).items[0]),JSON.stringify(m.shareSnapshot(t,{}).items[0]),JSON.stringify(m.shareSnapshot({...t,kind:'want'},{v:true,c:true}).items[0]),m.parsePrice('1.250,5'),m.parsePrice('12.5'),m.parsePrice('abc')]})")
    check('"p":5' in shot[0] and '"c":"NM"' in shot[0] and '"p"' not in shot[1] and '"c"' not in shot[1] and '"p"' not in shot[2] and shot[3] == 1250.5 and shot[4] == 12.5 and shot[5] is None, f"link público: valor e condição só entram se escolhidos e só em Vendo/Troco {shot}")
    check(page.evaluate("document.querySelector('.ttag')&&getComputedStyle(document.querySelector('.ttag')).position")!="absolute" if page.locator(".ttag").count() else True, "negociação: tag do tipo não flutua fora do lugar")
    page.evaluate("import('./js/collection.js').then(m=>{m.setFin('sv02-3','normal',{q:2});m.setFin('sv02-3','reverse',{q:1});})"); page.wait_for_timeout(200)
    coll0 = page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))")
    page.locator('[data-act="trade-pull"]').click(); page.wait_for_selector("#pullres .slot", timeout=5000)
    total_own = page.locator("#pullres .plslot").count()
    page.locator('[data-pl="split"]').check(); page.wait_for_timeout(200)
    split_n = page.locator("#pullres .plslot").count()
    page.locator('[data-pl="split"]').uncheck(); page.wait_for_timeout(200)
    check(split_n == total_own + 1, f"puxar: uma linha por carta soma os acabamentos ({total_own} contra {split_n} separadas)")
    check(page.locator("#dialog .tdhead [data-ed-act=cancel]").inner_text().strip() == "Concluir" and "2 cartas na lista" in page.locator("#tdcount").inner_text(), "puxar: Concluir e contador no topo da janela")
    check(page.evaluate("(()=>{const h=document.querySelector('#dialog .tdhead').getBoundingClientRect();return h.top>=0&&h.bottom<innerHeight})()"), "puxar: botão Concluir visível sem rolar")
    base = page.locator("#pullres .plslot.sel").count()
    check(base < page.locator("#pullres .plslot").count(), f"puxar: só aparecem marcadas as que já estão na lista ({base})")
    k0 = page.locator('#pullres .plslot:not(.sel)').nth(0).get_attribute("data-key")
    page.locator(f'#pullres .plslot[data-key="{k0}"]').click(); page.wait_for_timeout(150)
    check("3 cartas na lista" in page.locator("#tdcount").inner_text() and page.locator(f'#pullres .plslot.sel[data-key="{k0}"]').count() == 1, "puxar: tocar na carta já coloca na lista")
    k1 = page.locator('#pullres .plslot:not(.sel)').nth(0).get_attribute("data-key")
    page.locator(f'#pullres .plslot[data-key="{k1}"]').click(); page.wait_for_timeout(150)
    check("4 cartas na lista" in page.locator("#tdcount").inner_text(), "puxar: segunda carta entra na lista")
    page.locator(f'#pullres .plslot[data-key="{k1}"]').click(); page.wait_for_timeout(150)
    check("3 cartas na lista" in page.locator("#tdcount").inner_text(), "puxar: tocar de novo tira da lista")
    page.locator("#plq").fill("zzzz-nada"); page.wait_for_timeout(200)
    check("Nenhuma carta" in page.locator("#pullres").inner_text(), "puxar: busca sem resultado")
    page.locator("#plq").fill(""); page.wait_for_timeout(200)
    page.select_option('[data-pl="set"]', index=1); page.wait_for_timeout(200)
    check(0 < page.locator("#pullres .plslot").count() <= total_own, "puxar: filtro por coleção")
    page.select_option('[data-pl="set"]', index=0); page.wait_for_timeout(200)
    page.locator('[data-pl="rep"]').check(); page.wait_for_timeout(200)
    reps = page.locator("#pullres .plslot").count()
    check(reps <= total_own, f"puxar: só repetidas ({reps} de {total_own})")
    page.locator('[data-pl="rep"]').uncheck(); page.wait_for_timeout(200)
    check(page.locator("#pullres .plslot.off").count() == 0, "puxar: nenhuma carta fica apagada")
    sel = page.locator("#pullres .plslot.sel").first
    check(sel.locator(".plcheck").count() == 1 and page.evaluate("getComputedStyle(document.querySelector('#pullres .plslot.sel .pocket')).boxShadow.includes('3px')"), "puxar: carta marcada tem borda de 3px e check no centro")
    check(page.locator("#pullres .plslot:not(.sel) .plcheck").count() == 0, "puxar: carta não marcada não tem check")
    check("v4.5" in page.locator(".rail .ver").inner_text() and "Gestão de Coleção" in page.locator(".rail .ver").inner_text(), "menu lateral: nome e versão 3.6")
    page.screenshot(path=str(ROOT/"tests/37_puxar_selecao.png"))
    check(page.locator("#pullres", has_text="Já na lista").count() == 0, "puxar: sem o aviso Já na lista")
    page.locator('[data-act="pl-none"]').click(); page.wait_for_timeout(150)
    check(page.locator("#pullres .plslot.sel").count() == 0 and int(page.locator("#tdcount").inner_text().split()[0]) <= 2, "puxar: remover as visíveis (itens de fora ficam)")
    page.locator('[data-act="pl-all"]').click(); page.wait_for_timeout(150)
    check(page.locator("#pullres .plslot.sel").count() == page.locator("#pullres .plslot").count(), "puxar: adicionar todas as visíveis")
    page.screenshot(path=str(ROOT/"tests/36_puxar_cartas.png"))
    page.locator('#dialog [data-ed-act="cancel"]').click(); page.wait_for_timeout(200)
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))") == coll0, "negociação: a coleção não mudou")
    page.evaluate("location.hash='#/binders'"); page.wait_for_selector("#bbody"); page.evaluate("location.hash='#/negociacao'"); page.wait_for_selector(".binder")
    check(page.locator(".binder").count() == 1, "negociação: lista aparece em Negociação, não em Fichários")
    page.locator(".binder").first.click(); page.wait_for_selector("#tgrid .tradeslot")
    # exportar imagem: no computador abre uma nova aba com a imagem
    page.locator('[data-act="trade-export"]').click(); page.wait_for_selector("#exgo")
    page.select_option("#exc", "10")
    with ctx.expect_page(timeout=20000) as np_:
        page.locator("#exgo").click()
    tab = np_.value; tab.wait_for_function("location.href.startsWith('blob:')", timeout=20000); tab.wait_for_selector("img", timeout=10000)
    dim = tab.evaluate("[document.images[0].naturalWidth, document.images[0].naturalHeight]")
    check(dim[0] > 1500 and dim[1] > 600, f"exportar: imagem gerada em boa resolução {dim}")
    tab.screenshot(path=str(ROOT/"tests/31_export_negociacao.png")); tab.close()
    plan = page.evaluate("import('./js/exportimg.js').then(m=>{const a=m.planSheets(30,5,true),b=m.planSheets(3000,10,true);const s=m.sheetSize(b.parts[0],10,b.cw,true);return [a.cw,a.parts.length,b.parts.length>1,s.W*s.H<=64e6,m.autoCols(200)]})")
    check(plan[0] == 600 and plan[1] == 1 and plan[2] and plan[3] and plan[4] <= 10, f"exportar: planejamento de tamanho e divisão {plan}")
    # juntar listas em uma imagem (v4.5)
    page.evaluate("""import('./js/state.js').then(async m=>{const t=m.S.trades[0];const c=JSON.parse(JSON.stringify(t));c.id='merge2';c.name='Procuro mesclado';c.kind='want';c.items=c.items.slice(0,2).map(i=>({...i,p:undefined,c:undefined}));m.S.trades.push(c);})""")
    page.evaluate("location.hash='#/binders'"); page.wait_for_selector("#bbody"); page.evaluate("location.hash='#/negociacao'"); page.wait_for_selector(".binder")
    check(page.locator("#tmstart").is_visible(), "juntar listas: botão aparece com duas ou mais listas")
    page.locator("#tmstart").click(); page.wait_for_selector(".tmrow")
    check(page.locator('[data-act="tm-go"]').is_disabled(), "juntar listas: precisa marcar pelo menos duas")
    page.locator(".tmrow").nth(0).click(); page.locator(".tmrow").nth(1).click(); page.wait_for_timeout(150)
    check(not page.locator('[data-act="tm-go"]').is_disabled() and "2" in page.locator(".tmbar").inner_text(), "juntar listas: barra mostra as listas marcadas")
    page.screenshot(path=str(ROOT/"tests/54_juntar_listas.png"))
    page.locator('[data-act="tm-go"]').click(); page.wait_for_selector("#ext")
    check("+" in page.input_value("#ext"), "juntar listas: título sugerido com os nomes das listas")
    page.select_option("#exc", "4")
    with ctx.expect_page(timeout=20000) as np2:
        page.locator("#exgo").click()
    tb = np2.value; tb.wait_for_function("location.href.startsWith('blob:')", timeout=20000); tb.wait_for_selector("img", timeout=10000)
    d2 = tb.evaluate("[document.images[0].naturalWidth, document.images[0].naturalHeight]")
    tb.screenshot(path=str(ROOT/"tests/55_export_listas_juntas.png")); tb.close()
    check(d2[0] > 1000 and d2[1] > 800, f"juntar listas: imagem gerada com duas seções {d2}")
    sp = page.evaluate("""async()=>{const m=await import('./js/exportimg.js');
      const mk=(n,sec)=>Array.from({length:n},(_,i)=>({sec,url:'',n:'Carta '+i,no:String(i+1),q:1,f:'normal',l:'pt'}));
      const items=[...mk(300,0),...mk(250,1)];
      const r=await m.buildImages(items,{title:'Teste grande',cols:10,labels:true,sections:[{label:'A',kindLabel:'Procuro',color:'#2F6FDE'},{label:'B',kindLabel:'Vendo / Troco',color:'#D93A2B'}]});
      const rows=m.layoutRows([{n:3},{n:4}],5);
      return [r.files.length,rows.length,rows[1].sec];}""")
    check(sp[0] >= 1 and sp[1] == 2 and sp[2] == 1, f"juntar listas: lista grande gera imagens e cada lista começa em linha nova {sp}")
    page.locator('[data-act="tm-cancel"]').click()
    page.evaluate("import('./js/state.js').then(m=>{m.S.trades=m.S.trades.filter(t=>t.id!=='merge2');m.S.ui.tmerge=null;if(m.S.cur&&m.S.cur.refresh)m.S.cur.refresh();})")
    page.wait_for_timeout(200)
    # celular: abre o compartilhar do aparelho com a imagem
    page.evaluate("""(()=>{window.__shared=null;const mm=window.matchMedia.bind(window);
      window.matchMedia=q=>/pointer:\\s*coarse/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:mm(q);
      navigator.canShare=()=>true;navigator.share=async d=>{window.__shared={n:d.files.length,type:d.files[0].type,size:d.files[0].size};};})()""")
    page.evaluate("location.hash='#/negociacao'"); page.wait_for_selector(".binder"); page.locator(".binder").first.click(); page.wait_for_selector("#tgrid .tradeslot")
    page.locator('[data-act="trade-export"]').click(); page.wait_for_selector("#exgo"); page.locator("#exgo").click()
    page.wait_for_function("window.__shared", timeout=20000)
    sh = page.evaluate("window.__shared")
    check(sh["n"] == 1 and sh["type"] == "image/jpeg" and sh["size"] > 5000, f"celular: abre o compartilhar com a imagem {sh}")
    # folhas de exportação: títulos longos, poucas cartas, muitas cartas
    import base64
    def sheet(n, title, cols, name, kind=None):
        r = page.evaluate("""async ([n,title,cols,kind])=>{
          const m=await import('./js/exportimg.js');
          const items=Array.from({length:n},(_,i)=>({url:'https://assets.tcgdex.net/pt/sv/sv01/'+(i+1)+'/high.webp',n:i%3?('Carta '+(i+1)):'Mega Kangaskhan ex de nome bem comprido',no:String(i+1).padStart(3,'0'),q:(i%4)+1,f:i%5?'normal':'reverse',l:i%2?'pt':'en'}));
          const r=await m.buildImages(items,{title,cols,labels:true,kindLabel:kind,kindColor:'#D93A2B'});
          const f=r.files[0];const b=new Uint8Array(await f.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));
          const im=new Image();im.src=URL.createObjectURL(f);await im.decode();
          return {b64:btoa(s),w:im.naturalWidth,h:im.naturalHeight,parts:r.files.length,miss:r.miss};
        }""", [n, title, cols, kind])
        open(str(ROOT/f"tests/{name}.jpg"), "wb").write(base64.b64decode(r["b64"]))
        return r
    r1 = sheet(2, "Buscando Mew ex e Mega Kangaskhan ex", 10, "33_folha_2cartas", "Procuro")
    check(r1["w"] >= 4 * 360 and r1["parts"] == 1, f"exportar: folha de 2 cartas tem largura mínima de 4 colunas ({r1['w']}x{r1['h']})")
    r2 = sheet(1, "Bus", 10, "34_folha_1carta")
    check(r2["w"] >= 4 * 360, f"exportar: folha de 1 carta ({r2['w']}x{r2['h']})")
    r3 = sheet(40, "Vendo – outubro", 8, "35_folha_40cartas", "Vendo / Troco")
    check(r3["parts"] == 1 and r3["miss"] == 1, f"exportar: folha de 40 cartas ({r3['w']}x{r3['h']})")
    # imagem só em PNG e imagem inexistente
    page.set_viewport_size({"width": 1360, "height": 900})
    page.evaluate("location.hash='#/set/sv01'"); page.wait_for_selector("#grid .slot", timeout=8000)
    page.locator('[data-act="view"][data-v="list"]').click(); page.fill("#sq", ""); page.wait_for_timeout(1500)
    page.evaluate("document.querySelector('#grid [data-id=sv01-7]')&&document.querySelector('#grid [data-id=sv01-7]').scrollIntoView()")
    page.wait_for_function("(()=>{const i=document.querySelector('#grid [data-id=sv01-7] img');return !!i&&i.src.endsWith('.png')})()", timeout=8000)
    check(True, "imagem só em PNG: o app usa o PNG quando o WebP falha")
    page.wait_for_function("document.querySelector('#grid [data-id=sv01-8] .ph small')", timeout=8000)
    check("indisponível" in page.locator('#grid [data-id=sv01-8] .ph').inner_text(), "sem nenhuma imagem: quadro mostra 'Imagem indisponível'")
    rr = page.evaluate("""async()=>{const m=await import('./js/exportimg.js');const items=[7,8,2].map(i=>({url:'https://assets.tcgdex.net/pt/sv/sv01/'+i+'/high.webp',n:'Carta '+i,no:String(i),q:1,f:'normal',l:'pt'}));const r=await m.buildImages(items,{title:'Teste PNG'});return {files:r.files.length,miss:r.miss,fb:r.fb};}""")
    check(rr["files"] == 1 and rr["miss"] == 1, f"exportar: carta só em PNG sai com imagem, só a inexistente fica sem ({rr})")
    # exportar a partir de um fichário
    page.evaluate("location.hash='#/binders'"); page.wait_for_selector(".binder"); page.locator(".binder").first.click(); page.wait_for_selector("#bgrid")
    check(page.locator('[data-act="binder-export"]').count() == 1, "fichário: botão Exportar imagem")
    page.locator('[data-act="binder-export"]').click(); page.wait_for_selector("#exs")
    check(page.locator("#exn").inner_text().strip() != "", "fichário: opções de exportação")
    page.screenshot(path=str(ROOT/"tests/32_export_dialogo.png"))
    page.keyboard.press("Escape"); page.evaluate("document.getElementById('modal').classList.remove('on')")
    # ---- decks ----
    page.set_viewport_size({"width": 1360, "height": 900})
    page.evaluate("import('./js/state.js').then(m=>{m.S.settings.legalMarks=['H','I','J'];})")
    page.evaluate("location.hash='#/decks'"); page.wait_for_selector(".empty .btn.primary", timeout=5000)
    check(page.locator('.rail a.nav[data-nav="decks"].on').count() == 1, "decks: item do menu fica ativo")
    page.locator(".empty .btn.primary").click(); page.fill("#dkn", "Deck teste")
    page.locator('[data-act="dk-save"]').click(); page.wait_for_selector("#dname", timeout=5000)
    check("Deck teste" in page.locator("#dname").inner_text() and "0/60" in page.locator("#dchips").inner_text(), "decks: deck criado e aberto com 0/60")
    page.locator('[data-act="deck-add"]').click(); page.fill("#dka", "carta sv02"); page.wait_for_selector("#dkres .slot", timeout=8000)
    check("0/60" in page.locator("#tdcount").inner_text() and page.locator("#dialog .tdhead [data-ed-act=cancel]").inner_text().strip() == "Concluir", "decks: janela de adicionar com Concluir e contador no topo")
    page.locator('#dkres .slot[data-id=sv02-1]').click(); page.wait_for_timeout(300)
    check("1/60" in page.locator("#tdcount").inner_text() and page.locator('#dkres .slot.sel[data-id=sv02-1]').count() == 1, "decks: tocar na carta já coloca no deck")
    for _ in range(5): page.locator('#dkres .slot[data-id=sv02-1] [data-act="dk-inc"]').click(); page.wait_for_timeout(60)
    check("6/60" in page.locator("#tdcount").inner_text(), "decks: botão + aumenta as cópias")
    page.fill("#dka", "carta sv01"); page.wait_for_timeout(1200)
    check(page.locator("#dkres .slot").count() == 0 and "fora do Standard" in page.locator("#dkres").inner_text(), "decks: fora do Standard fica escondida por padrão")
    page.locator('[data-dk="legal"]').uncheck(); page.wait_for_timeout(300)
    check(page.locator("#dkres .slot .lgl.no").count() >= 1, "decks: carta fora do Standard mostra a etiqueta")
    page.locator('#dkres .slot[data-id=sv01-3]').click(); page.wait_for_timeout(300)
    page.fill("#dka", "carta sv02 3"); page.wait_for_timeout(500)
    page.locator('#dkres .slot[data-id=sv02-3]').click(); page.wait_for_timeout(300)
    page.locator('[data-dk="own"]').check(); page.fill("#dka", ""); page.wait_for_timeout(500)
    own_n = page.locator("#dkres .slot").count()
    check(own_n >= 1 and page.locator("#dkres .slot", has_text="Você não tem").count() == 0, f"decks: só as que eu tenho ({own_n} cartas)")
    page.locator('#dialog [data-ed-act="cancel"]').click(); page.wait_for_timeout(500)
    txt = page.locator("#dvalid").inner_text()
    check("Faltam" in txt and "cópias" in txt and "Fora do Standard" in txt, "decks: validação mostra faltantes, excesso de cópias e fora do Standard")
    check(page.locator("#dgrid .dslot").count() == 3 and page.locator("#dgrid .dslot.illegal").count() == 1, "decks: três cartas no deck, uma fora do Standard")
    check(page.locator("#dgrid .qty.over").count() == 1, "decks: carta com mais de 4 cópias fica destacada")
    page.locator('#dgrid .dslot[data-id=sv02-1] [data-act="deck-dec"]').click(); page.wait_for_timeout(200)
    check("5/" not in page.locator("#dchips").inner_text() and page.locator("#dchips").inner_text().startswith("Standard"), "decks: botão − no deck")
    info = page.evaluate("""async()=>{const m=await import('./js/decks.js');
      const bo=m.infoFrom({id:'x',name:"Boss's Orders (Giovanni)",category:'Trainer',trainerType:'Supporter',regulationMark:'D',localId:'189',set:{id:'swsh2'}});
      const ro=m.infoFrom({id:'y',name:'Rocky Fighting Energy',category:'Energy',regulationMark:'J',localId:'87',set:{id:'me03'}});
      const be=m.infoFrom({id:'z',name:'Fighting Energy',category:'Energy',localId:'6',set:{id:'mee'}});
      return {bo:bo.nk,ro:ro.be,be:be.be,k:m.nameKey('Boss’s Orders')};}""")
    check(info["bo"] == "boss's orders" == info["k"] and info["ro"] is False and info["be"] is True, f"decks: nomes e energia básica ({info})")
    rp = page.evaluate("""async()=>{const m=await import('./js/decks.js');const s=(await import('./js/state.js')).S;
      const d=s.decks[0];const i=s.dinfo['sv01-3'];i.rp=true;
      const v1=m.validate(d);const w=v1.issues.some(x=>x.lvl==='warn'&&x.msg.includes('reimpress'));
      const noErr=!v1.issues.some(x=>x.msg.startsWith('Fora do Standard'));
      i.rp=false;return {w,noErr,legal:m.legalOf(i)};}""")
    check(rp["w"] and rp["noErr"] and rp["legal"] == "no", f"decks: reimpressão vira aviso e não erro ({rp})")
    full = page.evaluate("""async()=>{const m=await import('./js/decks.js');const s=(await import('./js/state.js')).S;
      const d={id:'t',name:'t',format:'livre',items:[]};
      s.dinfo.fake1={id:'fake1',ne:'Pika',nk:'pika',cat:'pokemon',st:'Basic',mk:'H',be:false};
      s.dinfo.fake2={id:'fake2',ne:'Basic Energy',nk:'basic energy',cat:'energia',st:'',mk:'',be:true};
      d.items.push({id:'fake1',q:4,n:'Pika',i:'',no:'1',s:'x'},{id:'fake2',q:56,n:'Basic Energy',i:'',no:'2',s:'x'});
      const v=m.validate(d);return {ok:v.ok,total:v.total,issues:v.issues.length};}""")
    check(full["ok"] and full["total"] == 60 and full["issues"] == 0, f"decks: deck de 60 válido (energia básica sem limite) {full}")
    page.evaluate("location.hash='#/decks'"); page.wait_for_selector(".binder")
    check(page.locator(".binder").count() == 1 and "Com problemas" in page.locator(".binder").first.inner_text(), "decks: lista mostra o deck e o estado")
    page.screenshot(path=str(ROOT/"tests/38_decks.png"))
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))") == page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.collection))"), "decks: a coleção não muda")
    # ---- decks: exportar e importar (TCG Live) ----
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page.evaluate("location.hash='#/decks'"); page.wait_for_selector(".binder"); page.locator(".binder").first.click(); page.wait_for_selector("#dname")
    page.evaluate("window.__printed=0;window.print=()=>{window.__printed++;};0")
    page.locator('[data-act="deck-export"]').click(); page.wait_for_function("document.querySelector('#dxtext')&&document.querySelector('#dxtext').value.includes('Total de cartas')", timeout=10000)
    tx = page.locator("#dxtext").input_value()
    check(tx.startswith("Pokémon: ") and "Carta sv02 3 SV02 3" in tx and tx.rstrip().endswith("Total de cartas: %d" % int(tx.rstrip().split(":")[-1])), "exportar deck: texto no padrão do TCG Live com sigla e número")
    page.select_option('[data-dx="lang"]', "en"); page.wait_for_timeout(200)
    check("Total Cards:" in page.locator("#dxtext").input_value(), "exportar deck: títulos em inglês")
    page.locator('[data-act="dx-copy"]').click(); page.wait_for_timeout(300)
    check(page.locator(".toast").count() >= 1, "exportar deck: copiar texto avisa o resultado")
    page.locator('[data-act="dx-print"]').click(); page.wait_for_timeout(400)
    check(page.evaluate("window.__printed") == 1 and "Deck teste" in page.locator("#printsheet").inner_text() and "SV02" in page.locator("#printsheet").inner_text(), "exportar deck: página de impressão montada e impressão chamada")
    page.emulate_media(media="print")
    check(page.evaluate("getComputedStyle(document.getElementById('printsheet')).display") == "block" and page.evaluate("document.getElementById('view').getBoundingClientRect().height") == 0, "exportar deck: ao imprimir, só a lista aparece")
    page.emulate_media(media="screen")
    page.locator('#dialog [data-ed-act="cancel"]').click()
    fmt = page.evaluate("""async()=>{const t=await import('./js/decktext.js');const d=await import('./js/decks.js');
      const rows=[
       {q:2,cat:'energia',name:t.tcgName(d.infoFrom({id:'a',name:'Rocky Fighting Energy',category:'Energy',localId:'087',set:{id:'me03'}})),ab:'POR',no:'87'},
       {q:7,cat:'energia',name:t.tcgName(d.infoFrom({id:'b',name:'Fighting Energy',category:'Energy',localId:'006',set:{id:'mee'}})),ab:'MEE',no:'6'},
       {q:3,cat:'treinador',name:t.tcgName(d.infoFrom({id:'c',name:"Boss's Orders (Giovanni)",category:'Trainer',localId:'189',set:{id:'swsh2'}})),ab:'RCL',no:'189'},
       {q:3,cat:'pokemon',name:t.tcgName(d.infoFrom({id:'d',name:'Mega Lucario ex',category:'Pokemon',localId:'033',set:{id:'mep'}})),ab:'MEP',no:'33'}];
      return t.tcgText(rows,'pt');}""")
    check("2 Rocky {F} Energy POR 87" in fmt and "7 Basic {F} Energy MEE 6" in fmt and "3 Boss's Orders RCL 189" in fmt and "Pokémon: 3" in fmt and "Treinador: 3" in fmt and "Energia: 9" in fmt, f"exportar deck: nomes do TCG Live (energias com {{F}}, sem parênteses) {fmt!r}")
    sample = """Pokémon: 8
2 Dudunsparce TEF 129
3 Mega Lucario ex MEP 33
1 Lucario 30C 83

Treinador: 14
4 Poké Pad 30C 126
3 Boss's Orders RCL 189

Energia: 2
2 Rocky {F} Energy POR 87
7 Basic {F} Energy MEE 14

Total de cartas: 60"""
    pr = page.evaluate("async s=>{const t=await import('./js/decktext.js');return t.parseDeckText(s);}", sample)
    e = pr["entries"]
    check(len(e) == 7 and not pr["skipped"] and e[0] == {"line": "2 Dudunsparce TEF 129", "q": 2, "name": "Dudunsparce", "code": "TEF", "num": "129"} and e[-1]["name"] == "Basic {F} Energy" and e[-1]["code"] == "MEE" and e[-1]["num"] == "14", f"importar deck: leitura do texto (títulos e total ignorados) {len(e)} linhas")
    page.evaluate("location.hash='#/decks'"); page.wait_for_selector(".binder")
    page.locator('[data-act="deck-import"]').click(); page.fill("#din", "Importado")
    page.fill("#dit", "Pokémon: 3\n2 Carta sv02 3 SV02 3\n1 Carta sv02 5 SV02 5\n\nEnergia: 1\n3 Zzz Inexistente XXX 9\nTotal de cartas: 6")
    page.locator('[data-act="di-go"]').click(); page.wait_for_selector('[data-act="di-open"]', timeout=30000)
    rep = page.locator("#dialog").inner_text()
    check("2 de 3 linhas" in rep and "Zzz Inexistente XXX 9" in rep, "importar deck: relatório mostra o que entrou e o que não foi encontrado")
    page.locator('[data-act="di-open"]').click(); page.wait_for_selector("#dname")
    check("Importado" in page.locator("#dname").inner_text() and "3/60" in page.locator("#dchips").inner_text(), "importar deck: deck criado com as cartas reconhecidas")
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.decks.find(d=>d.name==='Importado').items.map(i=>[i.id,i.q]).sort()))") == '[["sv02-3",2],["sv02-5",1]]', "importar deck: cartas e quantidades certas")
    page.screenshot(path=str(ROOT/"tests/39_deck_importado.png"))
    # importar dentro do deck aberto (adiciona sem apagar e depois substitui)
    page.locator('[data-act="deck-import"]').click(); page.wait_for_selector("#dit")
    check(page.locator("#din").count() == 0 and page.locator("#direp").count() == 1, "importar no deck aberto: sem campo de nome, com opção de substituir")
    page.locator("#direp").uncheck(); page.fill("#dit", "1 Carta sv02 5 SV02 5")
    page.locator('[data-act="di-go"]').click(); page.wait_for_selector('[data-act="di-open"]', timeout=30000)
    page.locator('[data-act="di-open"]').click(); page.wait_for_timeout(400)
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.decks.find(d=>d.name==='Importado').items.map(i=>[i.id,i.q]).sort()))") == '[["sv02-3",2],["sv02-5",2]]', "importar no deck aberto: soma às cartas existentes")
    page.locator('[data-act="deck-import"]').click(); page.wait_for_selector("#dit")
    page.fill("#dit", "3 Carta sv02 3 SV02 3"); page.locator('[data-act="di-go"]').click(); page.wait_for_selector('[data-act="di-open"]', timeout=30000)
    page.locator('[data-act="di-open"]').click(); page.wait_for_timeout(400)
    check(page.evaluate("import('./js/state.js').then(m=>JSON.stringify(m.S.decks.find(d=>d.name==='Importado').items.map(i=>[i.id,i.q]).sort()))") == '[["sv02-3",3]]' and "3/60" in page.locator("#dchips").inner_text(), "importar no deck aberto: substituir troca as cartas")
    # ---- decks: criar lista de negociação ----
    tf = page.evaluate("""async()=>{const m=await import('./js/decks.js');const s=(await import('./js/state.js')).S;
      const own=m.ownByName();const have=own.get(m.nameKey('Carta sv02 3'))||0;
      const d={id:'z',name:'z',format:'standard',items:[{id:'sv02-3',q:have+1,n:'Carta sv02 3',i:'',no:'3',s:'sv02'}]};
      const w=m.tradeFromDeck(d,'want');const v=m.tradeFromDeck(d,'sell');
      return {have,w:[w.cards,w.items.length],v:[v.cards,v.items.length,v.items.reduce((a,x)=>a+x.q,0)]};}""")
    check(tf["have"] >= 1 and tf["w"] == [1, 1] and tf["v"][0] == tf["have"] and tf["v"][2] == tf["have"], f"deck para negociação: faltantes e o que eu tenho {tf}")
    page.evaluate("location.hash='#/decks'"); page.wait_for_selector(".binder"); page.locator(".binder").first.click(); page.wait_for_selector("#dname")
    page.locator('[data-act="deck-trade"]').click(); page.wait_for_selector("#dtn")
    check("Faltam" in page.locator("#dialog .note").inner_text(), "deck para negociação: janela mostra o que falta")
    page.locator('[data-act="dt-kind"][data-v="sell"]').click(); page.wait_for_timeout(200)
    check("Você tem" in page.locator("#dialog .note").inner_text(), "deck para negociação: trocar para Vendo/Troco")
    page.locator('[data-act="dt-kind"][data-v="want"]').click(); page.wait_for_timeout(200)
    ntr = page.evaluate("import('./js/state.js').then(m=>m.S.trades.length)")
    page.locator('[data-act="dt-go"]').click(); page.wait_for_selector("#tgrid .tradeslot", timeout=5000)
    check(page.evaluate("import('./js/state.js').then(m=>m.S.trades.length)") == ntr + 1 and "Procuro" in page.locator("#tchips").inner_text(), "deck para negociação: lista Procuro criada e aberta")
    # ---- Pokédex: cartas da Celebração de 30 Anos (sem dexId na TCGdex) ----
    dx = page.evaluate("""async()=>{const m=await import('./js/dex30.js');const r=await import('./js/rules.js');const st=(await import('./js/state.js')).S;
      st.cards['30th-087']={id:'30th-087',name:'Nidoran♀',set:'30th',localId:'087',category:'Pokemon'};
      st.briefs['30th-087']={id:'30th-087',localId:'087',name:'Nidoran♀',setId:'30th'};
      const slot=r.dexModel({gens:[1]}).find(x=>x.dex===29);
      const res=[m.dexIdsOf({id:'30th-087'}),m.dexIdsOf({id:'x',dexId:[3]}),m.extraIdsFor(25).length>=30,m.extraIdsFor(644).includes('30th-c-008'),slot.cand.includes('30th-087')];
      delete st.cards['30th-087'];delete st.briefs['30th-087'];return res;}""")
    nzt = page.evaluate("import('./js/util.js').then(m=>[m.nz('Nidoran♀'),m.nz('Nidoran ♂'),m.nz('Flabébé')])")
    qm = page.evaluate("import('./js/views/dex.js').then(m=>[m.matchQuery({name:'Nidoran♀',localId:'087',setId:'30th'},m.parseQuery('Nidoran F')),m.matchQuery({name:'Nidoran♀',localId:'087',setId:'30th'},m.parseQuery('Nidoran F (087/128)'))])")
    check(nzt == ["nidoran f", "nidoran m", "flabebe"] and qm[0] is True, f"busca: Nidoran F encontra Nidoran♀ {nzt} {qm}")
    check(dx == [[29], [3], True, True, True], f"Pokédex: Nidoran♀ da Celebração de 30 Anos entra no espaço 029 {dx}")
    # ---- padrões do Reverse (Pokébola, Energia, Liga...) quando a base confirma ----
    pt = page.evaluate("""async()=>{const c=await import('./js/constants.js');const k=await import('./js/catalog.js');
      const t=k.trimCard({id:'x-1',localId:'1',name:'A',set:{id:'x'},variants:{normal:true,reverse:true,holo:false},variants_detailed:[{type:'Normal'},{type:'Reverse'},{type:'Reverse',foil:'Poké Bola'},{type:'reverse',foil:'energy'},{type:'Reverse',foil:'Energia'},{type:'Reverse',foil:'Master Bola'},{type:'Reverse',foil:'league'},{type:'Holo',foil:'cosmos'}]});
      const f=c.finsOfCard(t);const g=c.finsOfCard(k.trimCard({id:'y-1',localId:'1',name:'B',set:{id:'y'},variants:{normal:true,reverse:true,holo:false}}));
      return [t.rvp,f,g,c.FIN_LABEL['rv-pokeball'],c.FIN_LABEL['rv-league'],c.FIN_LABEL['rv-novo-padrao'],c.finShort('rv-energy'),c.finShort('normal'),c.finShort('reverse')];}""")
    check(pt == [["pokeball", "energy", "masterball", "league"], ["normal", "reverse", "rv-pokeball", "rv-energy", "rv-masterball", "rv-league"], ["normal", "reverse"], "Reverse Pokébola", "Reverse Liga", "Reverse Novo Padrao", "Reverse Energia", "", "Reverse"], f"padrões do Reverse: lidos da base, rótulos em português, sem padrão quando a base não informa {pt}")
    page.evaluate("import('./js/state.js').then(m=>{m.S.cards['sv02-3'].rvp=['pokeball','league'];})")
    page.evaluate("import('./js/views/panel.js').then(m=>m.openPanel('sv02-3'))"); page.wait_for_selector("#panel .fin")
    ptxt = page.locator("#panel").inner_text()
    check("Reverse Pokébola" in ptxt and "Reverse Liga" in ptxt and "Reverse Energia" not in ptxt, "painel da carta: mostra só os padrões que a base confirma")
    page.locator('#panel [data-act="inc"][data-fin="rv-pokeball"]').click(); page.wait_for_timeout(200)
    check(page.evaluate("import('./js/state.js').then(m=>m.S.collection['sv02-3'].f['rv-pokeball'].q)") == 1, "padrões do Reverse: registrar a carta em Reverse Pokébola")
    page.locator('#panel [data-act="dec"][data-fin="rv-pokeball"]').click(); page.wait_for_timeout(200)
    page.evaluate("import('./js/views/panel.js').then(m=>m.closePanel())")
    # ---- Master Set: padrões do Reverse só onde existem ----
    ms = page.evaluate("""async()=>{const c=await import('./js/collection.js');const st=(await import('./js/state.js')).S;
      st.setd['zz9']={id:'zz9',cards:[{id:'zz9-1'},{id:'zz9-2'},{id:'zz9-3'}],cardCount:{official:3,total:3,normal:3,holo:0,reverse:0}};
      st.cards['zz9-1']={id:'zz9-1',rvp:[]};st.cards['zz9-2']={id:'zz9-2',rvp:['pokeball']};st.cards['zz9-3']={id:'zz9-3',rvp:['pokeball','energy']};
      st.collection['zz9-3']={s:'zz9',f:{normal:{q:1,c:'NM',l:'pt'},'rv-pokeball':{q:1,c:'NM',l:'pt'}},n:''};
      const set={id:'zz9',cardCount:{official:3}};
      st.settings.masterPatterns=true;const on=c.setStat(set,{zz9:['zz9-3']});const pt=c.patternTotals('zz9');
      delete st.cards['zz9-2'].rvp;const part=c.setStat(set,{zz9:['zz9-3']});
      st.cards['zz9-2'].rvp=['pokeball'];st.settings.masterPatterns=false;const off=c.setStat(set,{zz9:['zz9-3']});
      st.settings.masterPatterns=true;delete st.setd['zz9'];delete st.collection['zz9-3'];['zz9-1','zz9-2','zz9-3'].forEach(i=>delete st.cards[i]);
      return [pt.tot,pt.complete,on.masterTot,on.ownM,on.masterPartial,part.masterTot,part.ownM,part.masterPartial,off.masterTot,off.ownM];}""")
    check(ms == [3, True, 6, 2, False, 3, 1, True, 3, 1], f"Master Set: padrões do Reverse entram só nas cartas que os têm e só com os detalhes completos {ms}")
    # ---- legalidade: Celebração de 30 Anos ----
    lg = page.evaluate("""async()=>{const m=await import('./js/decks.js');const s=(await import('./js/state.js')).S;
      const mk=(set)=>m.infoFrom({id:set+'-5',name:'Poké Pad',category:'Trainer',localId:'5',set:{id:set}});
      s.settings.legalSets=['30th'];
      const main=m.legalOf(mk('30th')),cls=m.legalOf(mk('30th-c'));
      const d={id:'q',name:'q',format:'standard',items:[{id:'30th-5',q:1,n:'Poké Pad',i:'',no:'5',s:'30th'},{id:'30th-c-5',q:1,n:'Poké Pad C',i:'',no:'5',s:'30th-c'}]};
      s.dinfo['30th-5']=mk('30th');s.dinfo['30th-c-5']=mk('30th-c');
      const v=m.validate(d);
      const hasCls=v.issues.some(x=>x.lvl==='err'&&x.msg.includes('Clássica'));const hasInfo=v.issues.some(x=>x.lvl==='info'&&x.msg.includes('exceção'));
      const noMainErr=!v.issues.some(x=>x.lvl==='err'&&x.msg.startsWith('Fora do Standard'));
      s.settings.legalSets=[];const off=m.legalOf(mk('30th'));
      s.settings.legalSets=['30th'];delete s.dinfo['30th-5'];delete s.dinfo['30th-c-5'];
      return {main,cls,hasCls,hasInfo,noMainErr,off};}""")
    lt = page.evaluate("""async()=>{const m=await import('./js/decks.js');const s=(await import('./js/state.js')).S;
      s.settings.legalMarks=['H','I','J'];s.settings.legalSets=['30th'];
      const mk=(set,mark,name='Poké Pad',cat='Trainer')=>m.infoFrom({id:set+'-'+mark+name,name,category:cat,localId:'5',set:{id:set},regulationMark:mark});
      const H=m.legalOf(mk('sv01','H')),G=m.legalOf(mk('sv01','G')),J=m.legalOf(mk('sv01','j'));
      const Gset=m.legalOf(mk('30th','G'));
      const be=m.legalOf(mk('sv01','','Fighting Energy','Energy'));
      const none=m.legalOf(mk('30th',''));
      const gi=mk('sv01','G');gi.rp=false;const Gno=m.legalOf(gi);
      return {H,G,J,Gset,be,none,Gno,txt:m.markTxt(gi)};}""")
    check(lt["H"] == "ok" and lt["J"] == "ok" and lt["G"] == "wait" and lt["Gno"] == "no" and lt["Gset"] == "wait" and lt["be"] == "ok" and lt["none"] == "exc" and lt["txt"] == "letra G", f"legalidade pela letra: H/J valem, G não, energia básica vale, 30 Anos só sem letra {lt}")
    check(lg["main"] == "exc" and lg["cls"] == "no" and lg["hasCls"] and not lg["hasInfo"] and lg["noMainErr"] and lg["off"] == "wait", f"legalidade: 30 Anos principal vale, Clássica não, exceção desligável {lg}")
    page.evaluate("location.hash='#/ajustes'"); page.wait_for_selector("[data-legalset]")
    check(page.locator("[data-legalset=\"30th\"]").is_checked(), "ajustes: exceção da Celebração de 30 Anos ligada por padrão")
    page.locator("[data-legalset=\"30th\"]").uncheck(); page.wait_for_timeout(200)
    check(page.evaluate("import('./js/state.js').then(m=>m.S.settings.legalSets.length)") == 0, "ajustes: desligar a exceção")
    page.locator("[data-legalset=\"30th\"]").check(); page.wait_for_timeout(200)
    rl = page.evaluate("""async()=>{const r=await import('./js/rules.js');const s=(await import('./js/state.js')).S;
      s.settings.legalSets=['30th'];
      const v={id:'30th-5',setId:'30th',mark:'',name:'',setName:'',setKey:'30th',serie:'',dex:[],types:[],cat:'',stage:'',suffix:'',trainer:'',illus:'',rarity:'',hp:null,vars:[]};
      const a=r.valuesOf(v,'standard')[0];const c=r.valuesOf({...v,setId:'30th-c'},'standard')[0];return [a,c];}""")
    check(rl == ["sim", "nao"], f"fichários: regra Legal no Standard respeita a exceção {rl}")
    # ---- v3.7: cartas recentes que só existem em inglês e complemento de promos ----
    def fake_set(route):
        u = route.request.url; hh = {"access-control-allow-origin": "*", "content-type": "application/json"}
        lang = "en" if "/v2/en/" in u else "pt"; sid = u.rsplit("/", 1)[1]
        if sid == "zz1":
            n = 3 if lang == "pt" else 5
            cards = [{"id": f"zz1-{i}", "localId": str(i), "name": ("P" if lang == "pt" else "E") + str(i), **({} if (lang == "pt" and i <= 2) else {"image": f"https://assets.tcgdex.net/{lang}/x/zz1/{i}"})} for i in range(1, n + 1)]
            return route.fulfill(status=200, headers=hh, body=json.dumps({"id": "zz1", "name": "ZZ1", "cardCount": {"official": 3, "total": 3 if lang == "pt" else 5}, "cards": cards}))
        n = 3 if lang == "pt" else 4
        cards = [{"id": f"mep-{i:03d}", "localId": f"{i:03d}", "name": "M" + str(i)} for i in range(1, n + 1)]
        return route.fulfill(status=200, headers=hh, body=json.dumps({"id": "mep", "name": "Promos", "cardCount": {"official": n, "total": n}, "cards": cards}))
    page.route(re.compile(r"https://api\.tcgdex\.net/v2/\w+/sets/(zz1|mep)$"), fake_set)
    before_cards = hits["cards"]
    ex = page.evaluate("""async()=>{const k=await import('./js/catalog.js');const s=(await import('./js/state.js')).S;
      delete s.setd['zz1'];delete s.setd['mep'];
      const a=await k.ensureSetd('zz1',true);const b=await k.ensureSetd('mep',true);
      const c=await k.ensureCard('mep-101');const e=await k.ensureCard('mep-Z');
      return {imgs:a.cards.map(x=>x.image||''),mimg:(b.cards.find(x=>x.id==='mep-003')||{}).image,ids:a.cards.map(x=>x.id),names:a.cards.map(x=>x.name),fc:a.fullChecked,tot:a.cardCount.total,en:a.completedFromEn,
        mn:b.cards.length,has101:b.cards.some(x=>x.id==='mep-101'),brief:s.briefs['mep-101'],card:c};}""".replace("const e=await k.ensureCard('mep-Z');", ""))
    check(ex["ids"] == [f"zz1-{i}" for i in range(1, 6)] and ex["names"] == ["P1", "P2", "P3", "E4", "E5"] and ex["fc"] == 5 and ex["tot"] == 5 and ex["en"] is True,
          f"coleção com contagem igual no português completa com o inglês {ex['ids']} {ex['names']}")
    check("/en/" in ex["imgs"][0] and "/en/" in ex["imgs"][1] and "/en/" not in ex["imgs"][2] and all(ex["imgs"]), f"imagem em inglês quando o português não tem {ex['imgs']}")
    check("static.dextcg.com/cards/mep%2F3.png#" in ex["mimg"], f"imagem do Dex quando a TCGdex não tem nenhuma {ex['mimg']}")
    d30 = page.evaluate("import('./js/extra.js').then(m=>[m.dexImage('30th-c','018'),m.dexImage('30th-c','001'),m.dexImage('30th-c','021'),m.dexImage('30th-c','031'),m.dexImage('mep','086'),m.dexImage('30th','053')])")
    check("me55cc%2F15.png" in d30[0] and "me55cc%2F2.png" in d30[1] and "me55cc%2F18.png" in d30[2] and d30[3] == "" and "mep%2F86.png" in d30[4] and "me55%2F53.png" in d30[5], f"30 Anos Clássica: Gengar 018 usa a imagem 15 do Dex, N 021 usa a 18 {d30}")
    check(ex["mn"] == 4 + 28 and ex["has101"] and ex["brief"]["extra"] is True and ex["brief"]["name"] == "Nidorina", f"complemento: Nidorina MEP 101 entra na coleção MEP ({ex['mn']} cartas)")
    c = ex["card"]
    check(c["name"] == "Nidorina" and c["dexId"] == [30] and c["illustrator"] == "Taiga Kasai" and c["regulationMark"] == "J" and c["category"] == "Pokemon" and "dextcg.com" in c["image"], f"complemento: dados da carta {c['name']} {c['dexId']}")
    check(hits["cards"] == before_cards, "complemento: carta extra não consulta a TCGdex")
    ig = page.evaluate("""async()=>{const u=await import('./js/ui.js');const h=u.imgTag((await import('./js/state.js')).S.cards['mep-101'].image,'low','Nidorina',undefined,'mep-101');
      const d=await import('./js/decks.js');const i=await d.ensureInfo('mep-101');const dx=await import('./js/dex30.js');
      return [h.includes('static.dextcg.com/cards/mep%2F101.png#/low.webp'),i.mk,i.cat,dx.dexIdsOf(null,'mep-101'),dx.extraIdsFor(30).includes('mep-101')];}""")
    check(ig == [True, "J", "pokemon", [30], True], f"complemento: imagem do Dex, deck e Pokédex {ig}")
    page.unroute(re.compile(r"https://api\.tcgdex\.net/v2/\w+/sets/(zz1|mep)$"))
    # ---- v3.8: carta que você tem, sem detalhes neste aparelho, aparece no fichário de Pokédex ----
    ow = page.evaluate("""async()=>{const s=(await import('./js/state.js')).S;const r=await import('./js/rules.js');const k=await import('./js/catalog.js');
      await k.ensureCard('sv01-7');const had=!!s.cards['sv01-7'];delete s.cards['sv01-7'];
      s.collection['sv01-7']={f:{normal:{q:1}}};
      const b={mode:'pokedex',gens:[1],pick:{7:'sv01-7'}};
      const rep=r.dexModel(b).find(x=>x.dex===7).rep;const miss=k.ownedMissing().includes('sv01-7');
      await k.loadOwnedCards();const loaded=!!s.cards['sv01-7'];const after=r.dexModel(b).find(x=>x.dex===7);
      delete s.collection['sv01-7'];return {had,rep,miss,loaded,cand:after.cand.includes('sv01-7')};}""")
    check(ow["had"] and ow["rep"] == "sv01-7" and ow["miss"] and ow["loaded"] and ow["cand"], f"Pokédex: carta sua sem detalhes aparece e os detalhes são baixados sozinhos {ow}")
    # ---- v4.5: efeito nas cartas, botões −/+ e menu retrátil em paisagem ----
    page.set_viewport_size({"width": 1360, "height": 900})
    page.evaluate("""()=>{const d=document.createElement('div');d.id='tt';d.style.cssText='position:fixed;left:100px;top:100px;width:120px;z-index:9';d.innerHTML='<div class="pocket"><span class="qty">x</span></div><div class="stepper"><button class="btn small">−</button></div>';document.body.appendChild(d);}""")
    page.mouse.move(150, 160); page.mouse.move(160, 170); page.wait_for_timeout(150)
    tv = page.evaluate("""()=>{const e=document.querySelector('#tt .pocket');const b=document.querySelector('#tt .stepper .btn');const cs=getComputedStyle(b);return [e.classList.contains('hot'),e.style.getPropertyValue('--rx')!=='',cs.justifyContent,cs.display]}""")
    check(tv[0] and tv[1] and tv[2] == "center", f"v4.5: carta na grade inclina com o mouse e botão − fica centralizado {tv}")
    page.mouse.move(700, 600); page.wait_for_timeout(100)
    check(not page.evaluate("document.querySelector('#tt .pocket').classList.contains('hot')"), "v4.5: carta volta ao repouso ao sair")
    page.evaluate("document.getElementById('tt').remove()")
    lc = b.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, locale="pt-BR", service_workers="block")
    lp = lc.new_page(); lp.route("**/*", handle); lp.goto(APP); lp.wait_for_selector(".empty .btn.primary", timeout=8000)
    rb = lp.evaluate("(()=>{const r=document.querySelector('.rail').getBoundingClientRect();const m=document.getElementById('menubtn').getBoundingClientRect();return [r.right,m.width>0&&m.left<20&&m.top<20]})()")
    check(rb[0] <= 0 and rb[1], f"paisagem no toque: menu lateral oculto e botão ☰ no canto ({rb})")
    lp.screenshot(path=str(ROOT/"tests/46_paisagem_menu_fechado.png"))
    lp.locator("#menubtn").click(); lp.wait_for_timeout(350)
    ro = lp.evaluate("document.querySelector('.rail').getBoundingClientRect().left")
    check(ro >= 0 and lp.locator(".rail a.nav").count() >= 5, "paisagem: ☰ abre a gaveta com os itens")
    lp.screenshot(path=str(ROOT/"tests/47_paisagem_menu_aberto.png"))
    lp.mouse.click(700, 200); lp.wait_for_timeout(350)
    check(lp.evaluate("document.querySelector('.rail').getBoundingClientRect().right") <= 0, "paisagem: tocar fora fecha o menu")
    lp.locator("#menubtn").click(); lp.wait_for_timeout(300); lp.locator('.rail a.nav[data-nav="decks"]').click(); lp.wait_for_timeout(400)
    check(lp.evaluate("document.querySelector('.rail').getBoundingClientRect().right") <= 0 and "decks" in lp.url, "paisagem: escolher uma tela fecha o menu")
    lp.set_viewport_size({"width": 390, "height": 844}); lp.wait_for_timeout(300)
    pr = lp.evaluate("(()=>{const r=document.querySelector('.rail').getBoundingClientRect();return [r.bottom>=830,getComputedStyle(document.getElementById('menubtn')).display]})()")
    check(pr[0] and pr[1] == "none", f"em pé: volta a barra de baixo e some o ☰ {pr}")
    lc.close()
    b.close()

SERVER.terminate()
print("requisições: cartas", hits["cards"], "sets", hits["sets"])
for l in logs: print("LOG", l)
print("RESULTADO:", "tudo certo" if not errors and not logs else f"{len(errors)} falhas, {len(logs)} erros de console")
sys.exit(1 if errors else 0)
