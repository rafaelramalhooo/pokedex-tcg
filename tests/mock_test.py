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

def set_cards(sid, n, lang):
    return [{"id": f"{sid}-{i}", "localId": str(i), "name": f"Carta {sid} {i}" if lang=="pt" else f"Card {sid} {i}",
             "image": f"https://assets.tcgdex.net/{lang}/x/{sid}/{i}"} for i in range(1, n+1)]

def set_detail(sid, lang):
    d = {**SETS, **EN_ONLY}[sid]
    name, ser, sername, off, tot, mark, rel = d
    return {"id": sid, "name": name, "logo": f"https://assets.tcgdex.net/{lang}/x/{sid}/logo",
            "symbol": f"https://assets.tcgdex.net/univ/x/{sid}/symbol", "releaseDate": rel,
            "serie": {"id": ser, "name": sername},
            "cardCount": {"official": off, "total": tot, "normal": tot, "holo": 2, "reverse": 4, "firstEd": 0},
            "cards": set_cards(sid, tot, lang)}

def card_detail(cid, lang):
    sid, i = cid.rsplit("-", 1); i = int(i)
    d = {**SETS, **EN_ONLY}[sid]; mark = d[5]
    return {"id": cid, "localId": str(i), "name": f"Carta {sid} {i}", "category": "Pokemon" if i % 4 else "Trainer",
            "illustrator": ILL[i % 2], "rarity": "Rara" if i % 3 == 0 else "Comum",
            "set": {"id": sid, "name": d[0]}, "image": f"https://assets.tcgdex.net/{lang}/x/{sid}/{i}",
            "variants": {"normal": True, "reverse": i <= 4, "holo": i in (5, 6), "firstEdition": False},
            "dexId": [i], "hp": 50 + i * 20, "types": [TYPES_PT[i % 3]], "stage": "Basic", "regulationMark": mark,
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
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, locale="pt-BR")
    page = ctx.new_page()
    logs = []
    page.on("pageerror", lambda e: logs.append("pageerror: " + str(e)))
    page.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" and "404" not in m.text and "ERR_FAILED" not in m.text else None)
    page.route("**/*", handle)
    page.goto(APP)
    page.wait_for_selector(".set", timeout=8000)
    page.wait_for_timeout(800)

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
    page.locator('[data-act="sync-start"]').click()
    page.wait_for_function("document.body.innerText.includes('Catálogo completo')", timeout=20000)
    check(True, "sincronização concluiu")
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
    b.close()

SERVER.terminate()
print("requisições: cartas", hits["cards"], "sets", hits["sets"])
for l in logs: print("LOG", l)
print("RESULTADO:", "tudo certo" if not errors and not logs else f"{len(errors)} falhas, {len(logs)} erros de console")
sys.exit(1 if errors else 0)
