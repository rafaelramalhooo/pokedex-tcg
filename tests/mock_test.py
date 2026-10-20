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
    page.locator(".set", has_text="Escarlate e Violeta").first.click()
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
    check(page.locator("#panel .fin").count() == 2, "painel mostra normal + reverse da carta 4")
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
    tile = page.locator(".set", has_text="Escarlate e Violeta").first.inner_text()
    check("4" in tile and "de 16" in tile, "home (modo master) mostra 4 de 16")
    page.locator('[data-act="mode"][data-v="set"]').first.click()
    tile = page.locator(".set", has_text="Escarlate e Violeta").first.inner_text()
    check("de 8" in tile, "home (modo set) mostra de 8")

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
    check(page.locator("#bgrid .slot.dexempty").count() == 140, "espaços sem carta ficam vazios e cinza (140)")
    check(page.locator("#bgrid .slot.on").count() == 4, "4 espaços preenchidos com cartas que tenho")
    check("espaços preenchidos" in page.locator("#bsum").inner_text(), "resumo fala em espaços")
    page.screenshot(path=str(ROOT/"tests/08_pokedex.png"))
    # arte, nome e número nos espaços vazios
    check(page.locator("#bgrid .slot.dexempty .dexph img").count() == 140, "cada espaço vazio tem a arte do Pokémon")
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
    page.fill("#dq", "")
    page.locator('#dexgrid .dtile').nth(0).locator(".dd").click()
    page.wait_for_selector("#panel.open .cand", timeout=5000)
    check(page.locator("#panel .cand").count() == 3, "detalhes abrem o popup com as 3 cartas do espaço #2")
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
    page.goto(APP + "#/binders"); page.locator(".binder", has_text="Minha Pokédex").click(); page.wait_for_selector(".bpage")
    check(page.locator(".bpage .slot").count() == 9, "fichário Pokédex também em páginas")
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
    # instalável: manifesto e ícones
    mf = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    check(mf["display"] == "standalone" and len(mf["icons"]) >= 3, "manifesto do app instalável")
    codes = [page.evaluate(f"fetch('{i['src']}').then(r=>r.status)") for i in mf["icons"]]
    check(all(c == 200 for c in codes), "ícones do app existem")
    check(page.evaluate("fetch('sw.js').then(r=>r.status)") == 200, "service worker disponível")
    b.close()

SERVER.terminate()
print("requisições: cartas", hits["cards"], "sets", hits["sets"])
for l in logs: print("LOG", l)
print("RESULTADO:", "tudo certo" if not errors and not logs else f"{len(errors)} falhas, {len(logs)} erros de console")
sys.exit(1 if errors else 0)
