/* Explorador de eleições: 2022 | 2026 | 2022 × 2026, Brasil → estado → município.
 * Dados estáticos em dados/{ano}/{cargo}_t{turno}/{uf|br}.json (gerados por processar_2022.py / gerar_mun2026.py)
 * e dados/{ano}/{dep_federal|dep_estadual}/{uf}.json. Mapa: /apuracao2026/mapa.js + /apuracao2026/geo/. */
(function () {
  "use strict";
  const M = window.Mapa, BASE_GEO = "/apuracao2026/";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => (Math.round(n) || 0).toLocaleString("pt-BR");
  const pct = (x, d = 1) => { if (!isFinite(x)) return "–"; if (Math.abs(x - 0.5) < 0.0005) d = 2; return (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%"; };
  const pp = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " p.p.";
  const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const UF_COD = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53, ZZ: 99 }; // ZZ = exterior (só Presidente)
  const NOMES = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins", ZZ: "Exterior" };
  const ufDeCod = (c) => Object.keys(UF_COD).find((u) => String(UF_COD[u]) === String(c));
  const COR = { PL: "#12286B", PT: "#D7263D", PSD: "#8B5E3C", MDB: "#A47551", "União": "#3F8FD8", UNIÃO: "#3F8FD8", PP: "#2F6FB8", Republicanos: "#62B6E2", REPUBLICANOS: "#62B6E2", NOVO: "#FF7A00", PSOL: "#7B2CBF", PSB: "#2E8B57", PDT: "#5DAE6B", PSDB: "#6E7C91", Podemos: "#7D8590", PODE: "#7D8590", "Missão": "#F2C230", MISSÃO: "#F2C230", PCdoB: "#B5172B", "PC do B": "#B5172B", PV: "#3E9B4F", REDE: "#5EAD8C", Cidadania: "#E08A9B", CIDADANIA: "#E08A9B", Solidariedade: "#E37B2B", SOLIDARIEDADE: "#E37B2B", Avante: "#6B5B4E", AVANTE: "#6B5B4E", PSC: "#4A7A3F", PTB: "#3D5A3A", PROS: "#C9A227", Patriota: "#2B4F81", PATRIOTA: "#2B4F81", DC: "#B3DCF5", PRTB: "#5FA8D3", PMB: "#C46BAE", Agir: "#8E7CC3", AGIR: "#8E7CC3", PCO: "#9CCC65", PSTU: "#6E9F3F", UP: "#4F9A5E", PCB: "#8B1E2B", PMN: "#A1887F", PRD: "#8C7B6B", DEMOCRATA: "#A3C9E8" };
  const corPartido = (p) => COR[p] || COR[String(p).toUpperCase()] || "#9AA3AE";

  const CARGOS = {
    presidente: { nome: "Presidente", turnos: [1, 2], brasil: true },
    governador: { nome: "Governador", turnos: [1, 2], brasil: true },
    senador: { nome: "Senador", turnos: [1], brasil: true },
    dep_federal: { nome: "Deputado Federal", turnos: [1], brasil: false, dep: true },
    dep_estadual: { nome: "Deputado Estadual", turnos: [1], brasil: false, dep: true },
  };
  // o que existe de 2026 (1º turno de todos os cargos, 27 UFs; o 2º turno de 2026 fica nas páginas da apuração ao vivo)
  const TEM2026 = { presidente: { t1: "todos" }, governador: { t1: "todos" }, senador: { t1: "todos" }, dep_federal: { t1: "todos" }, dep_estadual: { t1: "todos" } };

  // ------------------------------------------------------------ estado da tela (e do endereço)
  const q = new URLSearchParams(location.search);
  const E = {
    modo: ["2022", "2026", "comp"].includes(q.get("ano")) ? q.get("ano") : "2022",
    cargo: CARGOS[q.get("cargo")] ? q.get("cargo") : "presidente",
    turno: q.get("turno") === "2" ? 2 : 1,
    nivel: NOMES[(q.get("uf") || "").toUpperCase()] ? q.get("uf").toUpperCase() : "BR",
    selSlug: q.get("cidade") || null, sel: null, cand: q.get("cand") || "",
  };
  function urlEstado() {
    const p = new URLSearchParams();
    p.set("ano", E.modo); p.set("cargo", E.cargo); if (E.turno === 2) p.set("turno", "2");
    if (E.nivel !== "BR") p.set("uf", E.nivel.toLowerCase());
    if (E.sel && vals[E.sel]) p.set("cidade", slug(vals[E.sel].nome));
    if (E.cand) p.set("cand", E.cand);
    history.replaceState(null, "", location.pathname + "?" + p);
    navAtual();
  }
  function navAtual() { if (window.RNMenu) RNMenu.marcar(); } // menu de cima (/menu.js) marca o cargo/ano aberto
  navAtual();

  // ------------------------------------------------------------ dados
  const cache = {};
  const getJ = (u) => cache[u] || (cache[u] = fetch(u).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }));
  const anoModo = () => (E.modo === "2026" ? "2026" : "2022");
  function arqMaj(ano, cargo, turno, uf) { return `d/${ano}-${cargo}_t${turno}-${uf.toLowerCase()}.json`; }
  function disponivel(ano, cargo, turno, uf) {
    if (ano === "2022") return CARGOS[cargo].turnos.includes(turno);
    const t = TEM2026[cargo] && TEM2026[cargo]["t" + turno];
    if (!t) return false;
    return t === "todos" || uf === "BR" || t.includes(uf);
  }
  // majoritário → {cod: área} com área = {nome, te, c, vv, votos:{n:v}, nomes:{n:[nome,partido,sit]}}
  async function lerMaj(ano, cargo, turno, uf) {
    const j = await getJ(arqMaj(ano, cargo, turno, uf));
    const nomesBase = {}; j.c.forEach(([n, nome, p, sit]) => { nomesBase[n] = [nome, p, sit]; });
    const out = {};
    for (const [cod, a] of Object.entries(j.m)) {
      const [nome, te, c, vv, pst, ...vs] = a, votos = {};
      j.c.forEach(([n], i) => { votos[n] = vs[i] || 0; });
      let nomes = nomesBase;
      if (uf === "BR" && j.lideres && j.lideres[cod]) { const [n, nm, p] = j.lideres[cod]; nomes = Object.assign({}, nomesBase, { [n]: [nm, p] }); }
      out[cod] = { nome, te, c, vv, votos, nomes };
    }
    return out;
  }
  // deputados → área com votos por partido (para a cor) e a lista de candidatos
  async function lerDep(ano, cargo, uf) {
    const j = await getJ(`d/${ano}-${cargo}-${uf.toLowerCase()}.json`);
    const out = {};
    for (const [cod, a] of Object.entries(j.m)) {
      const [nome, te, c, vv, top, parts] = a, votos = {}, nomes = {};
      for (const [pi, v] of parts) { const p = j.p[pi][0]; votos[p] = v; nomes[p] = [p, p]; }
      out[cod] = { nome, te, c, vv, votos, nomes, top: top.map(([ci, v]) => ({ c: j.c[ci], v })) };
    }
    return { areas: out, cands: j.c, partidos: j.p };
  }

  // deputados no Brasil: resumo por estado (d/{ano}-{cargo}-br.json, gerado por gerar_resumo_dep.py)
  let resumo = null;
  async function lerResumoBR(ano, cargo) {
    const j = await getJ(`d/${ano}-${cargo}-br.json`);
    resumo = j;
    const out = {};
    for (const [uf, u] of Object.entries(j.ufs)) {
      const votos = {}, nomes = {}, cad = {};
      for (const [p, v, c] of u.p) { votos[p] = v; nomes[p] = [p, p]; cad[p] = c; }
      out[UF_COD[uf]] = { nome: NOMES[uf], vv: u.vv, votos, nomes, cad, vagas: u.v };
    }
    return out;
  }

  // ------------------------------------------------------------ análise e cores
  function analisa(x) {
    const ord = Object.entries(x.votos || {}).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
    const vv = x.vv || ord.reduce((s, c) => s + c.v, 0);
    if (!vv || !ord.length || !ord[0].v) return { vv: 0, ord };
    const dif = ord[0].v - (ord[1] ? ord[1].v : 0);
    return { vv, ord, lider: ord[0].n, vant: dif / vv, dif };
  }
  const nomeDe = (x, n) => (x.nomes && x.nomes[n]) || [n, ""];
  function corDe(x, n) { const [nome, p] = nomeDe(x, n); return corPartido(p || nome); }
  // escala de um candidato (deputado buscado): verde, 6 faixas
  const ESCALA = ["#EEF6F1", "#CFE8D9", "#A3D3B6", "#6FB98E", "#3E9B67", "#1E7A4A", "#0F5A35"];
  // comparação: diverge entre PL (azul) e PT (vermelho)
  function mistura(hex, t) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = (c) => Math.round(255 - (255 - c) * t); return `rgb(${m(r)},${m(g)},${m(b)})`; }
  const TONS_SW = [0.2, 0.45, 0.7, 1];
  function corSwing(d) {
    if (d == null || !isFinite(d)) return "#E3E7ED";
    const a = Math.abs(d), base = d > 0 ? "#12286B" : "#D7263D";
    return mistura(base, TONS_SW[a >= 0.10 ? 3 : a >= 0.05 ? 2 : a >= 0.02 ? 1 : 0]);
  }

  // ------------------------------------------------------------ montagem dos valores do nível atual
  let vals = {}, extra = null, svgAtual = null;
  async function valoresNivel() {
    const uf = E.nivel, cg = CARGOS[E.cargo];
    extra = null;
    if (E.modo === "comp") return valoresComp();
    const ano = anoModo();
    if (!disponivel(ano, E.cargo, E.turno, uf)) return null;
    if (cg.dep) {
      if (uf === "BR") return lerResumoBR(ano, E.cargo);
      const d = await lerDep(ano, E.cargo, uf); extra = d; return d.areas;
    }
    return lerMaj(ano, E.cargo, E.turno, uf);
  }
  // 2022 × 2026: Presidente, PT (13) × PL (22), 1º turno nos dois anos
  async function valoresComp() {
    const uf = E.nivel;
    const [a, b] = await Promise.all([lerMaj("2022", "presidente", 1, uf), lerMaj("2026", "presidente", 1, uf)]);
    const out = {};
    for (const [cod, x] of Object.entries(b)) {
      const y = a[cod]; if (!y) continue;
      const f = (z, n) => (z.vv ? (z.votos[n] || 0) / z.vv : NaN);
      const pt22 = f(y, "13"), pl22 = f(y, "22"), pt26 = f(x, "13"), pl26 = f(x, "22");
      const v22 = analisa(y).lider, v26 = analisa(x).lider;
      out[cod] = { nome: x.nome, te: x.te, vv: x.vv, votos: x.votos, nomes: x.nomes, a22: y, pt22, pl22, pt26, pl26, swing: (pl26 - pt26) - (pl22 - pt22), v22, v26, virou: v22 !== v26 };
    }
    return out;
  }

  // ------------------------------------------------------------ desenho
  async function desenhar() {
    const meu = (desenhar.n = (desenhar.n || 0) + 1);
    if (E.nivel === "ZZ" && E.cargo !== "presidente") E.nivel = "BR";
    const br = E.nivel === "BR", cg = CARGOS[E.cargo];
    controles(); trilha();
    $("#ex-sub").textContent = subtitulo();
    let v;
    try { v = await valoresNivel(); }
    catch (e) { $("#mapa").innerHTML = `<p class="aviso">Não foi possível carregar os dados (${esc(e.message)}).</p>`; return; }
    if (meu !== desenhar.n) return;
    if (v == null) {
      $("#mapa").innerHTML = `<p class="aviso">Ainda não temos ${esc(cg.nome.toLowerCase())} de ${anoModo()} ${E.turno}º turno ${br ? "" : "em " + esc(NOMES[E.nivel])} no explorador. Escolha outro cargo, outro ano ou outro estado.</p>`;
      $("#mapa-lista").innerHTML = ""; $("#mapa-det").innerHTML = ""; $("#mapa-leg").innerHTML = ""; $("#ex-extra").innerHTML = ""; vals = {}; cartao(); return;
    }
    vals = v; trilha();
    if (E.selSlug && !br) { const c = Object.keys(vals).find((k) => slug(vals[k].nome) === E.selSlug); if (c) E.sel = c; E.selSlug = null; }
    if (E.nivel === "ZZ") { // exterior: sem mapa, só a lista das cidades
      svgAtual = null;
      $("#mapa").innerHTML = `<div class="ex-mundo"><svg viewBox="0 0 24 24" width="64" height="64" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 12h19M12 2.5c2.8 3 2.8 16 0 19M12 2.5c-2.8 3-2.8 16 0 19" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><p><b>Votos no exterior</b><br>${fmt(Object.keys(vals).length)} cidades em outros países. Clique numa cidade da lista para ver o resultado.</p></div>`;
      $("#mapa").classList.remove("mun");
      legenda(); lista(); painelExtra(); camara(); cartao();
      if (E.sel) detalhe(E.sel); else $("#mapa-det").innerHTML = "";
      urlEstado(); return;
    }
    const geo = await M.carregar(BASE_GEO, br ? "br" : E.nivel.toLowerCase());
    if (meu !== desenhar.n) return;
    const semCor = false;
    svgAtual = M.desenhar($("#mapa"), geo, {
      rotulo: br ? "Mapa do Brasil" : "Mapa de " + NOMES[E.nivel], sel: E.sel,
      cor: (cod) => semCor ? "#D5DBE3" : cor(cod),
      dica: (cod) => dica(cod, br),
      clique: (cod) => br ? abrir(ufDeCod(cod)) : selecionar(cod),
    });
    $("#mapa").classList.toggle("mun", !br);
    legenda(); lista(); painelExtra(); camara(); cartao();
    if (E.sel && !br) detalhe(E.sel); else $("#mapa-det").innerHTML = br && cg.dep ? '<p class="nota forte">Deputados são eleitos por estado: escolha um estado no mapa ou na lista para ver os mais votados de cada cidade.</p>' : "";
    urlEstado();
  }
  function cor(cod) {
    const x = vals[cod]; if (!x) return "#E3E7ED";
    if (E.modo === "comp") return corSwing(x.swing);
    if (E.cand && extra) { // deputado buscado: % dos válidos na cidade
      const t = (x.top || []).find((k) => String(k.c[0]) === E.cand);
      const p = t && x.vv ? t.v / x.vv : 0;
      return ESCALA[p >= 0.2 ? 6 : p >= 0.1 ? 5 : p >= 0.05 ? 4 : p >= 0.02 ? 3 : p >= 0.01 ? 2 : p > 0 ? 1 : 0];
    }
    const a = analisa(x); if (!a.vv) return "#E3E7ED";
    return M.tom(corDe(x, a.lider), a.vant);
  }
  function dica(cod, br) {
    const x = vals[cod];
    const nome = x ? x.nome : (br ? NOMES[ufDeCod(cod)] : "");
    if (!x) return `<b>${esc(nome || "sem dados")}</b>`;
    if (E.modo === "comp") return `<b>${esc(x.nome)}</b><div>Lula: ${pct(x.pt22)} → <b>${pct(x.pt26)}</b></div><div>PL: ${pct(x.pl22)} → <b>${pct(x.pl26)}</b></div><small>${x.swing > 0 ? "a favor do PL" : "a favor do PT"}: ${pp(Math.abs(x.swing))} na diferença${x.virou ? " · <b>virou</b>" : ""}</small>`;
    const a = analisa(x); if (!a.vv) return `<b>${esc(nome)}</b><br><small>sem votos</small>`;
    let s = `<b>${esc(nome)}</b>`;
    if (E.cand && extra) { const t = (x.top || []).find((k) => String(k.c[0]) === E.cand); s += `<div>${esc(candNome())}: <b>${t ? fmt(t.v) + " votos (" + pct(t.v / x.vv) + ")" : "fora dos 20 mais votados"}</b></div>`; }
    s += a.ord.slice(0, 3).map((c) => `<div><i class="dot" style="background:${corDe(x, c.n)}"></i>${esc(nomeDe(x, c.n)[0])} <b>${pct(c.v / a.vv)}</b>${x.cad ? ` · ${x.cad[c.n] || 0} cad.` : ""}</div>`).join("");
    if (x.cad) s += `<small>${x.vagas} cadeiras · clique para ver por cidade</small><br>`;
    return s + `<small>vantagem: +${fmt(a.dif)} votos</small>`;
  }
  function legenda() {
    const el = $("#mapa-leg");
    if (E.modo === "comp") { el.innerHTML = `<span class="leg-sw">${[3, 2, 1, 0].map((i) => `<i style="background:${mistura("#D7263D", TONS_SW[i])}"></i>`).join("")}${[0, 1, 2, 3].map((i) => `<i style="background:${mistura("#12286B", TONS_SW[i])}"></i>`).join("")}</span><span class="leg-tons">vermelho: o PT ganhou terreno de 2022 para 2026 · azul: o PL ganhou terreno. Quanto mais forte, maior a mudança na diferença entre os dois (até 2, 2 a 5, 5 a 10, mais de 10 pontos percentuais)</span>`; return; }
    if (E.cand && extra) { el.innerHTML = `<span class="leg-sw">${ESCALA.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span class="leg-tons">% dos votos válidos de ${esc(candNome())} em cada cidade: 0 · até 1 · 1–2 · 2–5 · 5–10 · 10–20 · mais de 20</span>`; return; }
    const conta = {};
    for (const [cod, x] of Object.entries(vals)) { if (E.nivel === "BR" && cod === "99") continue; const a = analisa(x); if (a.vv) { const k = nomeDe(x, a.lider)[0]; conta[k] = conta[k] || { n: 0, cor: corDe(x, a.lider) }; conta[k].n++; } }
    const itens = Object.entries(conta).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, o]) => `<span><i class="dot" style="background:${o.cor}"></i>${esc(k)} <b>${o.n}</b></span>`).join("");
    el.innerHTML = itens ? `<span class="leg-t">${E.nivel === "BR" ? "Estados" : "Cidades"} em que ${CARGOS[E.cargo].dep ? "o partido foi o mais votado" : "venceu"}:</span>${itens}<span class="leg-tons">quanto mais forte a cor, mais folgada a vitória</span>` : "";
  }
  function lista() {
    const el = $("#mapa-lista"), br = E.nivel === "BR";
    const f = semAcento(($("#mapa-filtro") || {}).value || "");
    let l = Object.entries(vals).map(([cod, x]) => ({ cod, x, a: analisa(x) }));
    if (f) l = l.filter((o) => semAcento(o.x.nome).includes(f));
    l.sort((p, q) => (q.x.te || q.a.vv) - (p.x.te || p.a.vv));
    let cab, linha;
    if (E.modo === "comp") {
      cab = `<th class="l">${br ? "Estado" : "Cidade"}</th><th>Lula 22</th><th>Lula 26</th><th>PL 22</th><th>PL 26</th><th class="l">Mudança</th>`;
      linha = ({ x }) => `<td>${pct(x.pt22)}</td><td><b>${pct(x.pt26)}</b></td><td>${pct(x.pl22)}</td><td><b>${pct(x.pl26)}</b></td><td class="l"><i class="dot" style="background:${x.swing > 0 ? "#12286B" : "#D7263D"}"></i>${x.swing > 0 ? "PL" : "PT"} ${pp(Math.abs(x.swing)).replace("+", "")}${x.virou ? ' <span class="tag t2">virou</span>' : ""}</td>`;
    } else {
      cab = `<th class="l">${br ? "Estado" : "Cidade"}</th><th class="l">Mais votado</th><th>%</th><th class="l">Vantagem (votos)</th>`;
      linha = ({ x, a }) => a.vv ? `<td class="l"><i class="dot" style="background:${corDe(x, a.lider)}"></i>${esc(nomeDe(x, a.lider)[0])}</td><td>${pct(a.ord[0].v / a.vv)}</td><td class="l">+${fmt(a.dif)}</td>` : `<td colspan="3" class="l">–</td>`;
    }
    el.innerHTML = `<table><thead><tr>${cab}</tr></thead><tbody>${l.map((o) => `<tr data-cod="${o.cod}" class="clic${o.cod === E.sel ? " sel" : ""}"><td class="l">${esc(o.x.nome)}</td>${linha(o)}</tr>`).join("") || `<tr><td class="l" colspan="6">${f ? "nenhuma cidade com esse nome" : "–"}</td></tr>`}</tbody></table>`;
    $("#mapa-filtro").hidden = br; $("#mapa-filtro").placeholder = E.nivel === "ZZ" ? "Filtrar cidades do exterior" : "Filtrar cidades do estado";
  }
  function detalhe(cod) {
    const el = $("#mapa-det"), x = vals[cod];
    if (!x) { el.innerHTML = ""; return; }
    const titulo = `<h3>${esc(x.nome)} <small>${esc(subtitulo())}</small></h3>`;
    if (E.modo === "comp") {
      const lin = (n, a, b) => `<tr><td class="l">${n}</td><td>${pct(a)}</td><td><b>${pct(b)}</b></td><td>${pp(b - a)}</td></tr>`;
      el.innerHTML = titulo + `<div class="tw"><table><thead><tr><th class="l"></th><th>2022</th><th>2026</th><th>mudança</th></tr></thead><tbody>${lin('<i class="dot" style="background:#D7263D"></i>Lula (PT)', x.pt22, x.pt26)}${lin('<i class="dot" style="background:#12286B"></i>PL (Jair em 2022 · Flávio em 2026)', x.pl22, x.pl26)}</tbody></table></div><p class="nota">1º turno nos dois anos, % dos votos válidos. Vencedor em 2022: ${esc(nomeDe(x.a22, x.v22)[0])}; em 2026: ${esc(nomeDe(x, x.v26)[0])}.</p>`;
      return;
    }
    const a = analisa(x);
    if (!a.vv) { el.innerHTML = titulo + '<p class="vazio">Sem votos.</p>'; return; }
    let corpo;
    if (extra) { // deputados: os mais votados da cidade e os partidos
      const max = x.top.length ? x.top[0].v : 1;
      corpo = `<div class="cbs">` + x.top.slice(0, 12).map((t) => `<div class="cb in"><div class="cn"><i class="dot" style="background:${corPartido(t.c[2])}"></i><b>${esc(t.c[1])}</b> <small>${esc(t.c[2])}${t.c[4] ? " · eleito" : ""}</small></div><div class="ct"><div class="cf" style="width:${(t.v / max * 100).toFixed(1)}%;background:${corPartido(t.c[2])}"></div></div><div class="cv"><b>${fmt(t.v)}</b> <small>${pct(t.v / x.vv)}</small></div></div>`).join("") + `</div>` +
        `<p class="nota">Votos nominais na cidade. Partidos (nominais + legenda): ${a.ord.slice(0, 6).map((c) => `${esc(c.n)} ${pct(c.v / a.vv)}`).join(" · ")}</p>`;
    } else {
      const max = a.ord[0].v / a.vv;
      corpo = `<div class="cbs">` + a.ord.filter((c) => c.v > 0).slice(0, 8).map((c) => { const [nm, p] = nomeDe(x, c.n); return `<div class="cb in"><div class="cn"><i class="dot" style="background:${corDe(x, c.n)}"></i><b>${esc(nm)}</b> <small>${esc(p)}</small></div><div class="ct"><div class="cf" style="width:${(c.v / a.vv / max * 100).toFixed(1)}%;background:${corDe(x, c.n)}"></div></div><div class="cv"><b>${pct(c.v / a.vv)}</b> <small>${fmt(c.v)}</small></div></div>`; }).join("") + `</div>`;
    }
    const pe = [x.vv ? fmt(x.vv) + " votos válidos" : "", x.te ? fmt(x.te) + " eleitores" : "", x.c && x.te ? "comparecimento " + pct(x.c / x.te) : ""].filter(Boolean).join(" · ");
    el.innerHTML = titulo + corpo + `<p class="nota">${pe}</p>`;
  }


  // ------------------------------------------------------------ cartão do resultado (16/10): o mesmo do 2º turno 2026, sem fotos
  // Presidente (Brasil ou estado), Governador e Senador (estado). Story + WhatsApp dentro do cartão; nos outros casos, fora dele.
  function totalNivel() {
    const v = {}, nomes = {}; let vv = 0;
    for (const y of Object.values(vals)) { vv += y.vv || 0; for (const [n, k] of Object.entries(y.votos || {})) v[n] = (v[n] || 0) + k; for (const [n, nm] of Object.entries(y.nomes || {})) if (!nomes[n] || E.nivel !== "BR") nomes[n] = nm; }
    return { votos: v, vv, nomes };
  }
  function cartao() {
    const el = $("#ex-cartao"), fora = $("#compartilhar"), cg = CARGOS[E.cargo];
    const vale = E.modo !== "comp" && !cg.dep && (E.cargo === "presidente" || E.nivel !== "BR") && Object.keys(vals).length;
    const bt = window.Compartilhar && Compartilhar.botoes ? Compartilhar.botoes() : "";
    if (!vale) { el.hidden = true; el.innerHTML = ""; if (fora) fora.innerHTML = bt; $("#ex-ctl-comp").hidden = false; return; }
    const area = totalNivel(), a = analisa(area);
    if (!a.vv) { el.hidden = true; el.innerHTML = ""; if (fora) fora.innerHTML = bt; $("#ex-ctl-comp").hidden = false; return; }
    if (fora) fora.innerHTML = ""; $("#ex-ctl-comp").hidden = true;
    const lado = a.ord.slice(0, 2).map((c) => { const [nm, p] = nomeDe(area, c.n); return { nome: nm, partido: p || "", cor: corDe(area, c.n), p: c.v / a.vv, v: c.v }; });
    const [A, B] = lado.length > 1 ? lado : [lado[0], { nome: "", partido: "", cor: "#E3E7ED", p: 0, v: 0 }];
    const onde = E.nivel === "BR" ? "Brasil" : NOMES[E.nivel];
    const titulo = E.cargo === "presidente" ? (E.nivel === "BR" ? "Presidente da República" : "Presidente · " + onde) : cg.nome + " · " + onde;
    const outros = 1 - A.p - B.p;
    const rod = [`resultado final do ${E.turno}º turno`, `diferença de ${fmt(A.v - B.v)} votos`, outros > 0.0005 ? `outros candidatos: ${pct(outros)}` : "", E.nivel === "BR" && !vals["99"] ? "sem os votos do exterior" : E.nivel === "BR" ? "inclui o exterior" : ""].filter(Boolean).join(" · ");
    const pessoa = (L, cls) => `<div class="pp ${cls}"><div class="pp-t"><span class="pp-n">${esc(L.nome)} <small>${esc(L.partido)}</small></span><b class="pp-p" style="color:${L.cor}">${pct(L.p)}</b></div></div>`;
    const barra = `<div class="d-barra mini" role="img" aria-label="${esc(A.nome)} ${pct(A.p)}, ${esc(B.nome)} ${pct(B.p)}"><div style="width:${(A.p * 100).toFixed(2)}%;background:${A.cor}"></div><div style="width:${(Math.max(0, 1 - A.p - B.p) * 100).toFixed(2)}%;background:transparent"></div><div style="width:${(B.p * 100).toFixed(2)}%;background:${B.cor};margin-left:auto"></div><i class="d-meio"></i></div>`;
    el.innerHTML = `<div class="cartao grande pres ex-res"><h3>${esc(titulo)} <span class="tag-t">${E.turno}º turno · ${anoModo()}</span></h3><div class="pres-lados">${pessoa(A, "pa")}<span class="pres-x" aria-hidden="true">×</span>${pessoa(B, "pb")}</div>${barra}<p class="rod">${rod}</p><div class="share" role="group" aria-label="Compartilhar">${bt}</div></div>`;
    el.hidden = false;
  }
  // ------------------------------------------------------------ painéis extras: busca de deputado; dispersão e "viraram" na comparação
  function candNome() { const c = extra && extra.cands.find((k) => String(k[0]) === E.cand); return c ? `${c[1]} (${c[2]})` : ""; }
  // ------------------------------------------------------------ painel da Câmara / Assembleias (deputados, Brasil)
  function lugares(total) {
    const filas = total > 600 ? 17 : 12, r0 = 0.40, r1 = 1;
    const raios = Array.from({ length: filas }, (_, i) => r0 + (r1 - r0) * i / (filas - 1));
    const somaR = raios.reduce((s, r) => s + r, 0);
    const porFila = raios.map((r) => Math.round(total * r / somaR));
    porFila[filas - 1] += total - porFila.reduce((s, n) => s + n, 0);
    const pts = [];
    raios.forEach((r, i) => { const n = porFila[i]; for (let j = 0; j < n; j++) { const a = Math.PI * (1 - j / Math.max(1, n - 1)); pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a }); } });
    pts.sort((p, q) => q.a - p.a || Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
    return { pts, raio: (r1 - r0) / (filas - 1) * 100 * 0.46 };
  }
  function hemiciclo(legs, total, rot) {
    const { pts, raio } = lugares(total);
    const cores = [];
    for (const x of legs) for (let i = 0; i < x.c; i++) cores.push({ c: x.cor, t: `${x.id}: ${x.c}` });
    const circ = pts.map((p, i) => { const k = cores[i]; return `<circle cx="${(p.x * 100).toFixed(2)}" cy="${(-p.y * 100).toFixed(2)}" r="${raio.toFixed(2)}" fill="${k ? k.c : "#E3E7ED"}"><title>${k ? esc(k.t) : ""}</title></circle>`; }).join("");
    return `<svg class="hemi" viewBox="-104 -104 208 110" role="img" aria-label="${esc(rot)}">${circ}<text x="0" y="-13" text-anchor="middle" class="h-num">${fmt(total)}</text><text x="0" y="-3" text-anchor="middle" class="h-rot">cadeiras</text></svg>`;
  }
  function camara() {
    const el = $("#ex-camara"), cg = CARGOS[E.cargo];
    const ok = cg.dep && E.nivel === "BR" && E.modo !== "comp" && !E.cand && resumo && resumo.cargo === E.cargo && resumo.ano === anoModo();
    el.hidden = !ok;
    if (!ok) return;
    const R = resumo.clausula, fedDe = {};
    for (const [f, ps] of Object.entries(resumo.fed || {})) for (const p of ps) fedDe[p] = f;
    const L = {}; let VB = 0, total = 0;
    for (const [uf, u] of Object.entries(resumo.ufs)) {
      VB += u.vv; total += u.v; const loc = {};
      for (const [p, v, c] of u.p) {
        const id = fedDe[p] || p;
        const x = L[id] = L[id] || { id, v: 0, c: 0, ufs: 0, ufc: new Set(), membros: {}, cor: corPartido(resumo.fed && resumo.fed[id] ? resumo.fed[id][0] : p) };
        x.v += v; x.c += c; if (c) x.ufc.add(uf); if (fedDe[p]) x.membros[p] = (x.membros[p] || 0) + c;
        loc[id] = (loc[id] || 0) + v;
      }
      if (R) for (const [id, v] of Object.entries(loc)) if (u.vv && v / u.vv * 100 >= R.pctUf) L[id].ufs++;
    }
    const legs = Object.values(L).filter((x) => x.c > 0 || x.v / VB >= 0.01).sort((a, b) => b.c - a.c || b.v - a.v);
    const ano = anoModo(), fed = E.cargo === "dep_federal";
    const pc1 = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    let linhas = legs.map((x) => {
      const pv = x.v / VB * 100, sub = Object.keys(x.membros).length ? `<small>${Object.entries(x.membros).map(([m, n]) => esc(m) + (n ? " " + n : "")).join(" · ")}</small>` : "";
      let cl = "";
      if (R) {
        const porV = pv >= R.pctBrasil && x.ufs >= R.minUfs, porE = x.c >= R.deputados && x.ufc.size >= R.minUfs;
        cl = `<td>${x.ufs}</td><td>${porV || porE ? `<span class="cl sim" title="Passa ${porV && porE ? "por votos e por eleitos" : porV ? "por votos" : "por eleitos"}">✓</span>` : `<span class="cl nao" title="Não atinge">✗</span>`}</td>`;
      }
      return `<tr><td class="l"><i class="dot" style="background:${x.cor}"></i><b>${esc(x.id)}</b>${sub}</td><td><b>${x.c || "–"}</b></td><td>${pc1(pv)}</td>${fed ? "" : `<td>${x.ufc.size || "–"}</td>`}${cl}</tr>`;
    }).join("");
    const cab = `<th class="l">Partido / federação</th><th>Cadeiras</th><th>% votos</th>${fed ? "" : "<th title=\"Estados em que elegeu deputados\">Estados</th>"}${R ? `<th title="Estados com pelo menos ${pc1(R.pctUf)} dos votos válidos">UFs ≥${pc1(R.pctUf).replace(",0", "")}</th><th>Cláusula</th>` : ""}`;
    const nota = R ? `<p class="nota">Cláusula de barreira ${ano}: ✓ com ${pc1(R.pctBrasil).replace(",0", "")} dos votos válidos no Brasil e ${pc1(R.pctUf).replace(",0", "")} em pelo menos ${R.minUfs} estados, ou com ${R.deputados} deputados eleitos em pelo menos ${R.minUfs} estados. Federações contam como uma legenda. Resultado do TSE.</p>`
      : `<p class="nota">Soma das ${fmt(total)} cadeiras das 27 Assembleias Legislativas (e da Câmara Legislativa do DF). Federações contam como uma legenda. Resultado do TSE.</p>`;
    const titulo = fed ? `Câmara dos Deputados · ${ano}` : `Assembleias Legislativas · ${ano}`;
    const link = ano === "2026" && fed ? `<a class="ex-link" href="/apuracao2026/">Quociente, sobras e cadeiras garantidas em cada estado →</a>` : ano === "2026" ? `<a class="ex-link" href="/apuracao2026/estaduais.html">Quociente e sobras em cada estado →</a>` : "";
    el.innerHTML = `<h2>${titulo} <small>${fmt(total)} cadeiras · 1º turno</small></h2><div class="ex-cam"><div>${hemiciclo(legs, total, titulo)}${link}</div><div class="tw"><table><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table>${nota}</div></div>`;
  }

  function painelExtra() {
    const el = $("#ex-extra");
    if (E.modo === "comp") { el.innerHTML = dispersao() + viraram(); return; }
    if (extra) {
      const top = extra.cands.slice(0, 30);
      el.innerHTML = `<div class="ex-busca"><label>Ver no mapa um candidato: <input id="cand-busca" list="cand-lista" placeholder="nome ou número" value="${esc(E.cand ? candNome() : "")}"></label><datalist id="cand-lista">${extra.cands.map((c) => `<option value="${esc(c[1])} (${esc(c[2])}) · ${c[0]}">`).join("")}</datalist>${E.cand ? ' <button type="button" class="btn" id="cand-limpar">limpar</button>' : ""}</div>` +
        `<h3 class="sec">Mais votados em ${esc(NOMES[E.nivel])}</h3><div class="tw"><table><thead><tr><th class="l">Candidato</th><th class="l">Partido</th><th>Votos</th><th></th></tr></thead><tbody>${top.map((c) => `<tr class="clic" data-cand="${c[0]}"><td class="l">${esc(c[1])} <small>${c[0]}</small></td><td class="l"><i class="dot" style="background:${corPartido(c[2])}"></i>${esc(c[2])}</td><td>${fmt(c[3])}</td><td class="l">${c[4] ? '<span class="tag ok">eleito</span>' : ""}</td></tr>`).join("")}</tbody></table></div><p class="nota">Clique num nome para ver no mapa em que cidades ele foi mais forte.</p>`;
      const inp = $("#cand-busca");
      inp.addEventListener("change", () => { const m = /·\s*(\d+)\s*$/.exec(inp.value) || /^(\d+)$/.exec(inp.value.trim()); if (m) { E.cand = m[1]; desenhar(); } });
      const lp = $("#cand-limpar"); if (lp) lp.addEventListener("click", () => { E.cand = ""; desenhar(); });
      el.querySelectorAll("tr[data-cand]").forEach((tr) => tr.addEventListener("click", () => { E.cand = tr.dataset.cand; desenhar(); $("#painel-mapa").scrollIntoView({ behavior: "smooth" }); }));
      return;
    }
    if (E.nivel === "BR" && CARGOS[E.cargo].dep && resumo && resumo.top) {
      el.innerHTML = `<h3 class="sec">Os 20 mais votados do Brasil · ${CARGOS[E.cargo].nome} ${anoModo()}</h3><div class="tw"><table><thead><tr><th>#</th><th class="l">Candidato</th><th class="l">Partido</th><th class="l">Estado</th><th>Votos</th><th></th></tr></thead><tbody>${resumo.top.map((c, i) => `<tr><td>${i + 1}</td><td class="l">${esc(c[0])}</td><td class="l"><i class="dot" style="background:${corPartido(c[1])}"></i>${esc(c[1])}</td><td class="l">${c[2]}</td><td>${fmt(c[3])}</td><td class="l">${c[4] ? '<span class="tag ok">eleito</span>' : ""}</td></tr>`).join("")}</tbody></table></div><p class="nota">Para ver os mais votados de cada cidade, escolha um estado no mapa.</p>`;
      return;
    }
    el.innerHTML = "";
  }
  function dispersao() {
    const pts = Object.entries(vals).filter(([, x]) => isFinite(x.pt22) && isFinite(x.pt26));
    if (!pts.length) return "";
    const W = 520, H = 400, P = 44, maxTe = Math.max(...pts.map(([, x]) => x.te || 1));
    const X = (v) => P + v * (W - P - 12), Y = (v) => H - P - v * (H - P - 12);
    const r = (te) => 2 + 14 * Math.sqrt((te || 1) / maxTe);
    const eixos = [0, 0.25, 0.5, 0.75, 1].map((t) => `<line x1="${X(t)}" y1="${Y(0)}" x2="${X(t)}" y2="${Y(1)}" class="g"/><line x1="${X(0)}" y1="${Y(t)}" x2="${X(1)}" y2="${Y(t)}" class="g"/><text x="${X(t)}" y="${H - P + 18}" text-anchor="middle">${t * 100}%</text><text x="${P - 8}" y="${Y(t) + 4}" text-anchor="end">${t * 100}%</text>`).join("");
    const bol = pts.sort((a, b) => (b[1].te || 0) - (a[1].te || 0)).map(([cod, x]) => `<circle cx="${X(x.pt22).toFixed(1)}" cy="${Y(x.pt26).toFixed(1)}" r="${r(x.te).toFixed(1)}" fill="${x.pt26 > x.pt22 ? "#D7263D" : "#12286B"}" fill-opacity=".45" stroke="#fff" stroke-width=".5" data-cod="${cod}"><title>${esc(x.nome)}: Lula ${pct(x.pt22)} em 2022 → ${pct(x.pt26)} em 2026</title></circle>`).join("");
    return `<div class="ex-graf"><h3 class="sec">Lula em 2022 × Lula em 2026, por ${E.nivel === "BR" ? "estado" : "cidade"}</h3><svg viewBox="0 0 ${W} ${H}" class="disp" role="img" aria-label="Gráfico de dispersão">${eixos}<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" class="diag"/>${bol}<text x="${(X(0) + X(1)) / 2}" y="${H - 6}" text-anchor="middle" class="t">% de Lula no 1º turno de 2022</text><text x="12" y="${(Y(0) + Y(1)) / 2}" text-anchor="middle" class="t" transform="rotate(-90 12 ${(Y(0) + Y(1)) / 2})">% de Lula no 1º turno de 2026</text></svg><p class="nota">Cada bolinha é ${E.nivel === "BR" ? "um estado" : "uma cidade"} (tamanho = eleitorado). Acima da linha diagonal, Lula cresceu; abaixo, caiu.</p></div>`;
  }
  function viraram() {
    const v = Object.entries(vals).filter(([, x]) => x.virou);
    const lado = (x, n) => esc(nomeDe(x, n)[0]);
    return `<div class="ex-vir"><h3 class="sec">${v.length} ${E.nivel === "BR" ? (v.length === 1 ? "estado mudou" : "estados mudaram") : (v.length === 1 ? "cidade mudou" : "cidades mudaram")} de vencedor</h3>` +
      (v.length ? `<div class="tw"><table><thead><tr><th class="l">${E.nivel === "BR" ? "Estado" : "Cidade"}</th><th class="l">2022</th><th class="l">2026</th></tr></thead><tbody>${v.sort((a, b) => (b[1].te || 0) - (a[1].te || 0)).slice(0, 60).map(([cod, x]) => `<tr class="clic" data-cod="${cod}"><td class="l">${esc(x.nome)}</td><td class="l">${lado(x.a22, x.v22)}</td><td class="l"><b>${lado(x, x.v26)}</b></td></tr>`).join("")}</tbody></table></div>` : '<p class="vazio">Nenhum.</p>') + `</div>`;
  }

  // ------------------------------------------------------------ navegação
  function subtitulo() {
    if (E.modo === "comp") return "Presidente · 1º turno · 2022 × 2026";
    return `${CARGOS[E.cargo].nome} · ${anoModo()} · ${E.turno}º turno`;
  }
  function trilha() {
    const el = $("#mapa-trilha");
    const mundo = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h19M12 2.5c2.8 3 2.8 16 0 19M12 2.5c-2.8 3-2.8 16 0 19" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
    const ext = E.nivel === "BR" && E.cargo === "presidente" && vals["99"] ? ` <button type="button" class="ex-ext" id="ver-ext" title="Votos dos brasileiros no exterior">${mundo} Exterior</button>` : "";
    el.innerHTML = E.nivel === "BR" ? "<b>Brasil</b>" + ext : `<button type="button" class="volta-br" id="volta-br" title="Voltar ao mapa do Brasil"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 3l6 1 4 3 4 2-1 4-4 3-2 5-4 1-2-4-3-2 1-4-3-3 2-4z" fill="currentColor"/></svg> Voltar ao Brasil</button> <b>${esc(NOMES[E.nivel])}</b>`;
    const b = $("#volta-br"); if (b) b.addEventListener("click", () => abrir("BR"));
    const x = $("#ver-ext"); if (x) x.addEventListener("click", () => abrir("ZZ"));
  }
  function controles() {
    document.querySelectorAll("#ex-anos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === E.modo)));
    document.querySelectorAll("#ex-cargos button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.v === E.cargo));
      b.disabled = E.modo === "comp" && b.dataset.v !== "presidente";
    });
    document.querySelectorAll("#ex-turnos button").forEach((b) => {
      const t = Number(b.dataset.v);
      b.setAttribute("aria-pressed", String(t === E.turno));
      b.disabled = E.modo === "comp" ? t === 2 : !(CARGOS[E.cargo].turnos.includes(t) && (anoModo() === "2022" || (TEM2026[E.cargo] && TEM2026[E.cargo]["t" + t])));
    });
    $("#ex-sel").textContent = E.modo === "comp" ? "Comparação 2022 × 2026" : `${CARGOS[E.cargo].nome} · ${anoModo()}`;
  }
  function abrir(nivel) { E.nivel = nivel; E.sel = null; E.cand = ""; M.esconderDica(); const f = $("#mapa-filtro"); if (f) f.value = ""; desenhar(); }
  function selecionar(cod) {
    E.sel = cod; M.selecionar(svgAtual, cod);
    document.querySelectorAll("#mapa-lista tr.sel").forEach((t) => t.classList.remove("sel"));
    const tr = document.querySelector(`#mapa-lista tr[data-cod="${cod}"]`); if (tr) { tr.classList.add("sel"); tr.scrollIntoView({ block: "nearest" }); }
    detalhe(cod); urlEstado();
  }

  // ------------------------------------------------------------ Story / compartilhar
  window.StoryDados = function () {
    const x = E.sel && vals[E.sel];
    let titulo = x ? `${x.nome} (${E.nivel})` : (E.nivel === "BR" ? "Brasil" : NOMES[E.nivel]);
    let linhas = [], area = x;
    if (!area && E.nivel !== "BR") { // soma das cidades do estado
      const v = {}, nomes = {}; let vv = 0;
      for (const y of Object.values(vals)) { vv += y.vv || 0; for (const [n, k] of Object.entries(y.votos || {})) v[n] = (v[n] || 0) + k; Object.assign(nomes, y.nomes || {}); }
      area = { votos: v, vv, nomes };
    }
    if (!area && E.nivel === "BR") { const v = {}, nomes = {}; let vv = 0; for (const y of Object.values(vals)) { vv += y.vv || 0; for (const [n, k] of Object.entries(y.votos || {})) v[n] = (v[n] || 0) + k; Object.assign(nomes, y.nomes || {}); } area = { votos: v, vv, nomes }; }
    if (E.modo === "comp" && x) {
      linhas = [{ nome: "Lula 2022 → 2026", partido: `${pct(x.pt22)} → ${pct(x.pt26)}`, cor: "#D7263D", pct: x.pt26 }, { nome: "PL 2022 → 2026", partido: `${pct(x.pl22)} → ${pct(x.pl26)}`, cor: "#12286B", pct: x.pl26 }];
    } else if (area) {
      const a = analisa(area);
      linhas = a.ord.filter((c) => c.v > 0).slice(0, 3).map((c) => { const [nm, p] = nomeDe(area, c.n); return { nome: nm, partido: p || "", cor: corDe(area, c.n), pct: a.vv ? c.v / a.vv : 0, votos: c.v }; });
    }
    const l = linhas[0];
    return { selo: E.modo === "comp" ? "2022 × 2026" : "ELEIÇÕES " + anoModo(), titulo, sub: subtitulo(), linhas, svg: document.querySelector("#mapa svg"), arquivo: slug(titulo) + "-" + E.modo,
      rodape: "Explore a sua cidade em:", textoCompartilhar: l ? `${titulo}: ${l.nome} ${E.modo === "comp" ? "" : pct(l.pct)} · ${subtitulo()} · Radar Numérico` : document.title };
  };

  // ------------------------------------------------------------ início
  function init() {
    document.querySelectorAll("#ex-anos button").forEach((b) => b.addEventListener("click", () => { E.modo = b.dataset.v; if (E.modo === "comp") { E.cargo = "presidente"; E.turno = 1; } if (E.modo === "2026" && !(TEM2026[E.cargo] && TEM2026[E.cargo]["t" + E.turno])) { E.cargo = "presidente"; E.turno = 1; } E.cand = ""; desenhar(); }));
    document.querySelectorAll("#ex-cargos button").forEach((b) => b.addEventListener("click", () => { E.cargo = b.dataset.v; if (!CARGOS[E.cargo].turnos.includes(E.turno)) E.turno = 1; E.cand = ""; E.sel = null; desenhar(); }));
    document.querySelectorAll("#ex-turnos button").forEach((b) => b.addEventListener("click", () => { E.turno = Number(b.dataset.v); desenhar(); }));
    $("#mapa-filtro").addEventListener("input", lista);
    $("#mapa-lista").addEventListener("click", (ev) => { const tr = ev.target.closest("tr[data-cod]"); if (!tr) return; E.nivel === "BR" ? abrir(ufDeCod(tr.dataset.cod)) : selecionar(tr.dataset.cod); });
    $("#ex-extra").addEventListener("click", (ev) => { const tr = ev.target.closest("tr[data-cod]"); if (tr && E.nivel !== "BR") selecionar(tr.dataset.cod); else if (tr) abrir(ufDeCod(tr.dataset.cod)); });
    // busca de cidade em todo o Brasil
    const bc = $("#busca-cidade");
    if (bc) bc.addEventListener("change", async () => {
      const m = /\(([A-Z]{2})\)\s*$/.exec(bc.value); if (!m) return;
      E.nivel = m[1]; E.selSlug = slug(bc.value.replace(/\s*\([A-Z]{2}\)\s*$/, "")); E.sel = null; E.cand = ""; bc.value = ""; await desenhar();
      $("#painel-mapa").scrollIntoView({ behavior: "smooth" });
    });
    getJ("d/cidades.json").then((l) => { const dl = $("#cidades-lista"); if (dl) dl.innerHTML = l.map(([n, uf]) => `<option value="${esc(n)} (${uf})">`).join(""); }).catch(() => {});
    desenhar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
