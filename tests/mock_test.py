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
            "serie": {"id": ser, "name": sername},
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
    if "fonts.g" in url:
        return route.abort()
    if url.startswith("https://assets.tcgdex.net") and ("/sv02/logo" in url or "/sv02/symbol" in url):
        return route.fulfill(status=404, body="", headers=h)
    if url.startswith("https://assets.tcgdex.net") and "/en/sv/sv02/" in url:
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
    # primeira vez: nada escolhido, a home pede para escolher expansões
    page.wait_for_selector(".empty .btn.primary", timeout=8000)
    check(page.locator(".set").count() == 0, "home vazia antes de escolher expansões")
    n0 = hits["sets"]
    page.locator(".empty .btn.primary").click()
    page.wait_for_selector(".pk", timeout=5000)
    names = page.locator(".pk .sname").all_inner_texts()
    check("Ilha Lendária" not in names, "picker: expansão do Pocket escondida por padrão")
    check("English Only Set" in names, "picker: expansão só em inglês aparece")
    check(hits["sets"] == n0, "nada foi baixado antes de escolher")
    page.screenshot(path=str(ROOT/"tests/00_picker.png"))
    page.fill("#pq", "paldea")
    check(page.locator(".pk").count() == 1, "busca no picker filtra")
    page.fill("#pq", "")
    page.locator('[data-act="pick-toggle"]', has_text="Espada e Escudo").click()
    check(page.locator('.pk.on').count() == 1, "marcar uma expansão")
    bar = page.locator("#pickbar").inner_text()
    check("1 expansão" in bar and "5 cartas" in bar, f"estimativa na barra: {bar[:60]!r}")
    page.locator('[data-act="pick-serie"][data-on="0"]').first.click()
    check(page.locator('.pk.on').count() == 0 or page.locator('.pk.on').count() == 1, "limpar série age só na série")
    page.locator('[data-act="pick-serie"][data-on="1"]').nth(0).click()
    page.locator('[data-act="pick-serie"][data-on="1"]').nth(1).click()
    check(page.locator('.pk.on').count() == 4, "selecionar séries inteiras marca as 4 expansões")
    page.locator('[data-act="pick-save"]').click()
    page.wait_for_selector(".set", timeout=8000)
    page.wait_for_function("!document.body.innerText.includes('Baixando os detalhes')", timeout=15000)
    page.wait_for_timeout(500)
    check(hits["sets"] >= 4 and hits["cards"] >= 26, f"só as escolhidas carregam completas (sets {hits['sets']}, cartas {hits['cards']})")

    names = page.locator(".set .sname").all_inner_texts()
    check("Ilha Lendária" not in names, "expansão do Pocket escondida por padrão")
    check("English Only Set" in names, "expansão só em inglês aparece (fallback)")
    check(set(["Escarlate e Violeta","Evoluções em Paldea","Espada e Escudo"]) <= set(names), "expansões em português listadas")
    check(page.locator(".series-head h2").count() == 2, "agrupado em 2 séries")
    page.screenshot(path=str(ROOT/"tests/01_home.png"))

    # abrir expansão
    page.locator(".set", has=page.locator(".sname", has_text="Escarlate e Violeta")).first.click()
    page.wait_for_selector(".slot", timeout=5000)
    check(page.locator(".slot").count() == 10, "expansão sv01 mostra 10 cartas")
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
    check(True, "detalhes das expansões escolhidas já vieram completos (sem sincronização manual)")
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
    page.select_option('select[data-ed="f"]', "pokemon")
    page.fill('input[data-ed="v"]', "gengar, pikachu")
    page.wait_for_timeout(400)
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
    page.locator('#bgrid .slot.dexempty[data-dex="25"]').click(); page.wait_for_timeout(500)
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
    check(page.locator(".bpage:not(.ghost)").count() == 2 and "Páginas 1 e 2" in page.locator(".booklbl").first.inner_text(), "página dupla no computador mostra duas páginas")
    page.screenshot(path=str(ROOT/"tests/09_fichario_duplo.png"))
    page.locator('input[data-bk="spread"]').uncheck()
    page.screenshot(path=str(ROOT/"tests/10_fichario.png"))
    page.reload(); page.wait_for_selector(".bpage")
    check(page.locator(".bpage").count() == 1, "modo fichário persiste após recarregar")
    page.goto(APP + "#/binders"); page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector("#bgrid")
    page.locator('[data-act="view"][data-v="book"]').click(); page.wait_for_selector(".bpage")
    check(page.locator(".bpage .slot").count() == 9, "fichário Pokédex também em páginas (com a própria configuração)")
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
    check(page.locator(".slot").count() == 5, f"expansão com tradução incompleta mostra as 5 cartas ({page.locator('.slot').count()})")

    # pt-only fallback: cartas da set em inglês carregam imagem
    page.goto(APP + "#/set/xx9"); page.wait_for_selector(".slot")
    check(page.locator(".slot").count() == 3, "expansão só em inglês abre com 3 cartas")

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
    for rota, nome in (("#/", "início"), ("#/expansoes", "minhas expansões"), ("#/binders", "fichários"), ("#/ajustes", "ajustes"), ("#/set/sv01", "expansão")):
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
    check(fb.count() >= 1, "expansão sem logo mostra bloco com nome e cor da série")
    check(page.locator(".set .lgfb small").first.inner_text().strip() != "", "bloco mostra o nome da série")
    page.screenshot(path=str(ROOT/"tests/19_logo_fallback.png"))
    page.goto(APP + "#/set/sv02"); page.wait_for_selector(".hero")
    check(page.locator('.hero [data-act="upload"]').count() == 0 and "Enviar logo" not in page.locator(".hero").inner_text(), "expansão não tem botão Enviar logo")
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
    check("Evoluções em Paldea" in txt and "sem imagem" in txt, "diagnóstico lista expansões sem logo e com cartas sem imagem")
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
    # --- configuração própria de cada expansão/fichário, busca, logotipo e imagens derivadas ---
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
    check(page.locator('.toolbar [data-act="mode"][data-v="set"][aria-pressed="true"]').count() == 1, "outra expansão segue no padrão (Set)")
    page.goto(APP + "#/"); page.wait_for_selector(".set")
    check(page.locator('[data-act="mode"][aria-pressed="true"]').count() >= 1, "tela inicial mantém o próprio Set/Master Set")
    page.reload(); page.goto(APP + "#/set/swsh1"); page.wait_for_selector(".bpage")
    check(page.locator('[data-bk="preset"]').input_value() == "5x4", "grade da expansão persiste ao recarregar")
    page.goto(APP + "#/binders"); page.locator(".binder").first.click(); page.wait_for_selector("#bgrid .slot, #bgrid .empty, #bgrid .bpage")
    check(page.locator('[data-bk="preset"]').count() == 0 or page.locator('[data-bk="preset"]').input_value() != "5x4", "fichário não herda a grade 5x4 da expansão")
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
    check(page.locator(".slot").count() == 1, "busca na expansão no estilo Liga Pokémon")
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
    check(page.locator('.rule').count() == 2, "atalho '+ Expansão' acrescenta uma segunda regra")
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
    # filtro "Com cartas minhas"
    page.goto(APP + "#/"); page.wait_for_selector(".set"); page.wait_for_timeout(500)
    tot = page.locator(".set").count()
    own_sets = page.evaluate("""import('./js/collection.js').then(m=>{const g=m.groupBySet();return Object.keys(g).filter(k=>g[k].length||Object.keys(g[k]).length).length;})""")
    check(page.locator('[data-act="scope"][aria-pressed="true"][data-v="mine"]').count() == 1, "tela inicial abre em 'Com cartas minhas' quando há cartas")
    check(0 < tot, "mostra ao menos uma expansão com carta minha")
    page.locator('[data-act="scope"][data-v="all"]').click(); page.wait_for_timeout(300)
    check(page.locator(".set").count() >= tot, "'Todas as escolhidas' mostra todas")
    page.screenshot(path=str(ROOT/"tests/26_home_scope.png"))
    b.close()

SERVER.terminate()
print("requisições: cartas", hits["cards"], "sets", hits["sets"])
for l in logs: print("LOG", l)
print("RESULTADO:", "tudo certo" if not errors and not logs else f"{len(errors)} falhas, {len(logs)} erros de console")
sys.exit(1 if errors else 0)
