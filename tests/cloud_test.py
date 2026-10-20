"""Testa login e sincronização com um Supabase simulado (servidor falso em memória, vários aparelhos)."""
import json, re, pathlib, subprocess, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8766
APP = f"http://localhost:{PORT}/index.html"
SERVER = subprocess.Popen(["python3","-m","http.server",str(PORT),"--directory",str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)

CFG_ON = "export const SUPABASE={url:'https://fake-supabase.test',key:'pk_test'};"
CFG_OFF = "export const SUPABASE={url:'',key:''};"

FAKE_LIB = r"""
const API='https://fake-supabase.test/api';
const call=async b=>{const r=await fetch(API,{method:'POST',body:JSON.stringify(b)});return r.json();};
let session=null;try{session=JSON.parse(localStorage.getItem('fake-session')||'null');}catch(e){}
const lis=[];
const save=s=>{session=s;try{if(s)localStorage.setItem('fake-session',JSON.stringify(s));else localStorage.removeItem('fake-session');}catch(e){}};
export function createClient(url,key,opts){
 if(/type=recovery/.test(location.hash)){setTimeout(()=>lis.forEach(f=>f('PASSWORD_RECOVERY',session)),0);}
 const auth={
  getSession:async()=>({data:{session}}),
  onAuthStateChange:cb=>{lis.push(cb);return{data:{subscription:{unsubscribe(){}}}};},
  signInWithPassword:async({email,password})=>{const r=await call({op:'signin',email,password});if(r.error)return{data:{session:null,user:null},error:{message:r.error}};save(r.session);return{data:{session:r.session,user:r.session.user},error:null};},
  signUp:async({email,password})=>{const r=await call({op:'signup',email,password});if(r.error)return{data:{session:null,user:null},error:{message:r.error}};if(r.session)save(r.session);return{data:{session:r.session||null,user:{email}},error:null};},
  signOut:async()=>{save(null);return{error:null};},
  resetPasswordForEmail:async(email)=>{const r=await call({op:'reset',email});return{error:r.error?{message:r.error}:null};},
  updateUser:async({password})=>{const r=await call({op:'newpass',password,token:session&&session.access_token});return{error:r.error?{message:r.error}:null};}
 };
 const from=t=>{
  const q={t,op:'select',filters:[]};
  const b={
   select(c){q.op='select';return b;},order(c,o){return b;},range(a,z){q.a=a;q.z=z;return b;},
   upsert(rows,o){q.op='upsert';q.rows=Array.isArray(rows)?rows:[rows];q.conf=o&&o.onConflict;return b;},
   delete(){q.op='delete';return b;},eq(c,v){q.filters.push([c,'eq',v]);return b;},in(c,v){q.filters.push([c,'in',v]);return b;},
   then(res,rej){return call({op:'table',token:session&&session.access_token,q}).then(r=>res(r.error?{data:null,error:{message:r.error}}:{data:r.data,error:null}),rej);}
  };return b;
 };
 return{auth,from};
}
"""

users = {}      # email -> {pw, id, confirmed}
db = {}         # uid -> table -> key -> row
state = {"signups": True, "down": False, "log": []}
def jsonb(v):   # imita o jsonb do Postgres: reordena as chaves
    if isinstance(v, dict): return {k: jsonb(v[k]) for k in sorted(v, key=lambda x: (len(x), x))}
    if isinstance(v, list): return [jsonb(x) for x in v]
    return v
def key_of(t, r):
    return {"collection": lambda: r["card_id"], "binders": lambda: r["id"], "user_settings": lambda: "me", "custom_images": lambda: r["kind"] + "/" + r["id"]}[t]()

def api(route):
    h = {"access-control-allow-origin": "*", "content-type": "application/json"}
    if state["down"]: return route.abort()
    b = json.loads(route.request.post_data or "{}"); op = b.get("op")
    out = {}
    if op == "signup":
        if not state["signups"]: out = {"error": "Signups not allowed for this instance"}
        elif b["email"] in users: out = {"error": "User already registered"}
        else:
            users[b["email"]] = {"pw": b["password"], "id": "u" + str(len(users) + 1), "confirmed": False}
            out = {}
    elif op == "signin":
        u = users.get(b["email"])
        if not u or u["pw"] != b["password"]: out = {"error": "Invalid login credentials"}
        elif not u["confirmed"]: out = {"error": "Email not confirmed"}
        else: out = {"session": {"access_token": "tok-" + u["id"], "user": {"id": u["id"], "email": b["email"]}}}
    elif op == "reset": state["log"].append(("reset", b["email"])); out = {}
    elif op == "newpass":
        uid = (b.get("token") or "").replace("tok-", "")
        for e, u in users.items():
            if u["id"] == uid: u["pw"] = b["password"]
        out = {}
    elif op == "table":
        uid = (b.get("token") or "").replace("tok-", "")
        if not uid: out = {"error": "JWT required"}
        else:
            q = b["q"]; t = q["t"]; tab = db.setdefault(uid, {}).setdefault(t, {})
            if q["op"] == "select":
                rows = list(tab.values())[q["a"]:q["z"] + 1]; out = {"data": rows}
            elif q["op"] == "upsert":
                for r in q["rows"]: tab[key_of(t, r)] = jsonb(r)
                state["log"].append(("upsert", t, len(q["rows"]))); out = {"data": None}
            elif q["op"] == "delete":
                if not q["filters"]: out = {"error": "DELETE requires a WHERE clause"}
                else:
                    n = 0
                    for k in list(tab):
                        r = tab[k]; ok = True
                        for c, o, v in q["filters"]:
                            ok = ok and ((r.get(c) == v) if o == "eq" else (r.get(c) in v))
                        if ok: del tab[k]; n += 1
                    state["log"].append(("delete", t, n)); out = {"data": None}
    route.fulfill(status=200, headers=h, body=json.dumps(out))

errors = []
def check(cond, msg):
    print(("OK   " if cond else "FALHA"), msg)
    if not cond: errors.append(msg)

def setup(ctx, cfg_on=True):
    def other(route):
        u = route.request.url
        if u.startswith("https://fake-supabase.test"):
            if route.request.method == "OPTIONS":
                return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
            return api(route)
        if "cdn.jsdelivr.net" in u: return route.fulfill(status=200, headers={"access-control-allow-origin": "*", "content-type": "application/javascript"}, body=FAKE_LIB)
        if u.endswith("/js/config.js"): return route.fulfill(status=200, headers={"content-type": "application/javascript"}, body=CFG_ON if cfg_on else CFG_OFF)
        if u.startswith("http://localhost"): return route.continue_()
        return route.abort()
    ctx.route("**/*", other)

def wait_idle(page, timeout=8000):
    page.wait_for_function("document.querySelector('#acct .acct-st.idle')", timeout=timeout)

def count_coll(page):
    return page.evaluate("import('./js/state.js').then(m=>Object.keys(m.S.collection).length)")

with sync_playwright() as p:
    b = p.chromium.launch()
    logs = []
    def newctx(cfg_on=True, vw=1360):
        c = b.new_context(viewport={"width": vw, "height": 900}, locale="pt-BR", service_workers="block", accept_downloads=True)
        setup(c, cfg_on)
        return c
    def newpage(c):
        pg = c.new_page()
        pg.on("pageerror", lambda e: (logs.append("pageerror: " + str(e)), print("PAGEERROR", e)))
        pg.on("dialog", lambda d: d.accept())
        return pg

    # ---- Aparelho A (o Mac): primeiro usa sem nuvem e cria dados locais ----
    cA = newctx(cfg_on=False); A = newpage(cA)
    A.goto(APP); A.wait_for_timeout(800)
    check(A.locator("#auth.on").count() == 0 and A.locator("#acct:visible").count() == 0, "sem configuração, o app abre direto, sem login e sem bloco de conta")
    A.evaluate("""Promise.all([import('./js/collection.js'),import('./js/db.js'),import('./js/state.js'),import('./js/custom.js')]).then(async([c,d,st,cu])=>{
      c.setFin('sv01-1','normal',{q:2});c.setFin('sv01-2','reverse',{q:1,c:'LP',l:'en'});c.setFin('sv02-3','normal',{q:1});
      st.S.binders=[{id:'b1',name:'Meu fichário',mode:'manual',match:'all',conds:[],cardIds:['sv01-1'],gens:[],pick:{},created:1}];await d.saveBinders();
      st.S.settings.mySets=['sv01','sv02'];await d.saveSettings();
      await cu.setCustom('logo','sv01','data:image/png;base64,AAAA');
    })""")
    A.wait_for_timeout(500)
    check(count_coll(A) == 3, "3 cartas locais criadas antes do login")
    # ---- liga a nuvem e recarrega ----
    cA.unroute("**/*"); setup(cA, True)
    A.reload(); A.wait_for_selector("#auth.on", timeout=8000)
    check(A.locator("#auth form input[type=email]").count() == 1 and "Entrar" in A.locator("#auth").inner_text(), "com a nuvem ligada e sem sessão, aparece a tela de entrada")
    check(A.locator("#acct:visible").count() == 0, "bloco da conta escondido antes do login")
    A.screenshot(path=str(ROOT/"tests/30_login.png"))
    # erros
    A.fill("#au-em", "rafael@teste.com"); A.fill("#au-pw", "senha-errada1"); A.locator('#auth button[type=submit]').click()
    A.wait_for_function("document.querySelector('#au-err').textContent.length>0")
    check("incorretos" in A.locator("#au-err").inner_text(), f"senha errada: {A.locator('#au-err').inner_text()!r}")
    # cadastro desativado
    state["signups"] = False
    A.locator('[data-auth-mode="up"]').click(); A.fill("#au-em", "rafael@teste.com"); A.fill("#au-pw", "curta"); A.locator('#auth button[type=submit]').click()
    check("8 caracteres" in A.locator("#au-err").inner_text(), "senha curta é barrada no cadastro")
    A.fill("#au-pw", "senha-boa-123"); A.locator('#auth button[type=submit]').click()
    A.wait_for_function("document.querySelector('#au-err').textContent.includes('desativados')")
    check(True, "cadastros desativados: mensagem clara")
    state["signups"] = True
    A.locator('#auth button[type=submit]').click()
    A.wait_for_function("document.querySelector('#au-err').textContent.includes('confirmação')")
    check("e-mail de confirmação" in A.locator("#au-err").inner_text(), "cadastro pede confirmação do e-mail")
    users["rafael@teste.com"]["confirmed"] = True
    # entrar (primeiro vínculo, com dados locais): baixa backup e envia
    A.locator('[data-auth-mode="in"]').click(); A.fill("#au-em", "rafael@teste.com"); A.fill("#au-pw", "senha-boa-123")
    with A.expect_download(timeout=10000) as dl:
        A.locator('#auth button[type=submit]').click()
    check(dl.value.suggested_filename.startswith("pokedex-backup-"), "primeiro vínculo baixa um backup do que estava no aparelho")
    A.wait_for_selector("#auth.on", state="detached", timeout=10000)
    wait_idle(A)
    check("rafael@teste.com" in A.locator("#acct").inner_text() and "Sincronizado" in A.locator("#acct").inner_text(), "menu mostra o e-mail e 'Sincronizado'")
    check("v1.0" in A.locator(".rail .ver").inner_text(), "versão 1.0 no menu")
    uid = users["rafael@teste.com"]["id"]
    check(len(db[uid]["collection"]) == 3 and len(db[uid]["binders"]) == 1 and len(db[uid]["user_settings"]) == 1 and len(db[uid]["custom_images"]) == 1, f"nuvem recebeu coleção, fichário, ajustes e imagem ({ {k:len(v) for k,v in db[uid].items()} })")
    check(db[uid]["collection"]["sv01-2"]["finishes"]["reverse"]["l"] == "en", "acabamento e idioma enviados")
    A.screenshot(path=str(ROOT/"tests/31_menu_conta.png"))

    # ---- Aparelho B (o celular): entra do zero ----
    cB = newctx(); B = newpage(cB)
    B.goto(APP); B.wait_for_selector("#auth.on", timeout=8000)
    B.fill("#au-em", "rafael@teste.com"); B.fill("#au-pw", "senha-boa-123"); B.locator('#auth button[type=submit]').click()
    B.wait_for_selector("#auth.on", state="detached", timeout=10000); wait_idle(B)
    check(count_coll(B) == 3, "aparelho novo recebe as 3 cartas")
    check(B.evaluate("import('./js/state.js').then(m=>m.S.binders.length+':'+JSON.stringify(m.S.settings.mySets)+':'+!!m.S.custom.logos.sv01)") == '1:["sv01","sv02"]:true', "aparelho novo recebe fichário, seleção de coleções e logo")
    check(B.locator(".set").count() >= 0 and B.locator(".top h1").inner_text() == "Coleções", "tela inicial chama-se Coleções")

    # ---- alteração em B chega em A; remoção também ----
    B.evaluate("import('./js/collection.js').then(c=>{c.setFin('sv01-5','normal',{q:1});c.setFin('sv01-1','normal',{q:0});})")
    B.wait_for_function("document.querySelector('#acct .acct-st.syncing')||true"); B.wait_for_timeout(2600); wait_idle(B)
    check("sv01-5" in db[uid]["collection"] and "sv01-1" not in db[uid]["collection"], "alteração e remoção em B chegaram à nuvem")
    A.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); A.wait_for_timeout(1500); wait_idle(A)
    has = A.evaluate("import('./js/state.js').then(m=>[!!m.S.collection['sv01-5'],!!m.S.collection['sv01-1']])")
    check(has == [True, False], f"A recebeu a carta nova e a remoção ({has})")

    # ---- sem conexão: alterações ficam guardadas e sobem depois ----
    state["down"] = True
    A.evaluate("import('./js/collection.js').then(c=>c.setFin('sv02-4','normal',{q:3}))")
    A.wait_for_timeout(2600)
    A.wait_for_function("document.querySelector('#acct .acct-st.offline')", timeout=8000)
    check("Sem conexão" in A.locator("#acct").inner_text(), "sem conexão: status avisa que as alterações ficam guardadas")
    state["down"] = False
    A.evaluate("window.dispatchEvent(new Event('online'))"); wait_idle(A, 10000)
    check("sv02-4" in db[uid]["collection"] and db[uid]["collection"]["sv02-4"]["finishes"]["normal"]["q"] == 3, "ao voltar a conexão, a alteração sobe")

    # ---- imagem própria e fichário editados ----
    A.evaluate("Promise.all([import('./js/custom.js'),import('./js/state.js'),import('./js/db.js')]).then(async([cu,st,d])=>{await cu.setCustom('cover','b1','data:image/png;base64,BBBB');st.S.binders[0].name='Renomeado';await d.saveBinders();})")
    A.wait_for_timeout(2600); wait_idle(A)
    check("covers/b1" in db[uid]["custom_images"] and db[uid]["binders"]["b1"]["data"]["name"] == "Renomeado", "capa e fichário renomeado sincronizados")
    B.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); B.wait_for_timeout(1500); wait_idle(B)
    check(B.evaluate("import('./js/state.js').then(m=>m.S.binders[0].name+':'+!!(m.S.custom.covers||{}).b1)") == "Renomeado:true", "B recebeu o fichário e a capa")

    # ---- Ajustes: seção de conta ----
    A.goto(APP + "#/ajustes"); A.wait_for_selector("#cloudsec"); A.wait_for_timeout(300)
    check("rafael@teste.com" in A.locator("#cloudsec").inner_text() and A.locator('#cloudsec [data-cloud="out"]').count() == 1, "Ajustes mostram a conta e o botão de sair")
    A.screenshot(path=str(ROOT/"tests/32_ajustes_conta.png"))

    # ---- sair apaga o aparelho, a nuvem fica; entrar de novo restaura ----
    A.locator(".acct [data-cloud=out]").click()
    A.wait_for_selector("#auth.on", timeout=10000)
    check(len(db[uid]["collection"]) == 4, "sair não apaga nada na nuvem")
    check(count_coll(A) == 0, "sair apaga os dados deste aparelho")
    A.fill("#au-em", "rafael@teste.com"); A.fill("#au-pw", "senha-boa-123"); A.locator('#auth button[type=submit]').click()
    A.wait_for_selector("#auth.on", state="detached", timeout=10000); wait_idle(A)
    check(count_coll(A) == 4, "entrar de novo restaura a coleção")

    # ---- outra conta no mesmo aparelho não mistura dados ----
    users["outra@teste.com"] = {"pw": "senha-boa-456", "id": "u9", "confirmed": True}
    A.evaluate("localStorage.removeItem('fake-session')")
    A.reload(); A.wait_for_selector("#auth.on", timeout=8000)
    A.fill("#au-em", "outra@teste.com"); A.fill("#au-pw", "senha-boa-456"); A.locator('#auth button[type=submit]').click()
    A.wait_for_selector("#auth.on", state="detached", timeout=10000); wait_idle(A)
    check(count_coll(A) == 0 and len(db.get("u9", {}).get("collection", {})) == 0, "outra conta não herda os dados da conta anterior")

    # ---- recuperação de senha ----
    cC = newctx(); C = newpage(cC)
    C.goto(APP); C.wait_for_selector("#auth.on")
    C.locator('[data-auth-mode="reset"]').click(); C.fill("#au-em", "rafael@teste.com"); C.locator('#auth button[type=submit]').click()
    C.wait_for_function("document.querySelector('#au-err').textContent.length>0")
    check(("reset", "rafael@teste.com") in state["log"], "pedido de recuperação de senha enviado")
    C.goto(APP + "#access_token=x&type=recovery"); C.reload(); C.wait_for_selector("#auth.on"); C.wait_for_timeout(500)
    check("Nova senha" in C.locator("#auth").inner_text(), "link de recuperação abre a tela de nova senha")

    # ---- celular: bloco da conta também em Ajustes (menu lateral some em tela pequena) ----
    cD = newctx(vw=420); D = newpage(cD)
    D.goto(APP); D.wait_for_selector("#auth.on")
    D.fill("#au-em", "rafael@teste.com"); D.fill("#au-pw", "senha-boa-123"); D.locator('#auth button[type=submit]').click()
    D.wait_for_selector("#auth.on", state="detached", timeout=10000); D.wait_for_timeout(600)
    D.goto(APP + "#/ajustes"); D.wait_for_selector("#cloudsec"); D.wait_for_timeout(300)
    check(D.locator(".rail .acct:visible").count() == 0 and D.locator('#cloudsec [data-cloud="out"]:visible').count() == 1, "no celular a conta aparece em Ajustes")
    D.screenshot(path=str(ROOT/"tests/33_celular_ajustes.png"))
    b.close()

SERVER.terminate()
for l in logs: print("LOG", l)
print("RESULTADO:", "tudo certo" if not errors and not logs else f"{len(errors)} falhas, {len(logs)} erros de console")
