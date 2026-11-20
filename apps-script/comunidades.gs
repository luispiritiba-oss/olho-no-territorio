/**
 * Olho no Território – localização das comunidades e ameaças por comunidade (app 1.9.0)
 *
 * Como instalar no script do Google que já recebe os envios:
 *  1. No editor do Apps Script, clique em "+" > Script, dê o nome "comunidades" e cole este arquivo inteiro.
 *  2. Na função doPost, logo depois de conferir a chave (token) e antes de responder, cole a linha:
 *         try { otRegistrarComunidade_(item); } catch (e) {}
 *     (troque "item" pelo nome da variável que guarda o envio recebido, se for outro).
 *  3. Na parte da função doGet que responde ao painel (?painel=1), antes de devolver o JSON, cole:
 *         otPainelExtra_(resposta);
 *     (troque "resposta" pelo nome do objeto que vira JSON).
 *  4. Implantar > Gerenciar implantações > editar > Nova versão > Implantar. O endereço /exec continua o mesmo.
 *
 * Cria na planilha "Olho no Território – respostas":
 *  - aba "Comunidades": uma linha por pessoa cadastrada, com onde fica a sua comunidade (atualizada a cada envio);
 *  - aba "Ameacas": uma linha por registro de campo, com a comunidade ou localidade ("Onde estou?"), o município e a ameaça. O painel recebe só comunidade, município, ponto e situação no mapa: sem nome, CPF ou data de nascimento.
 */
var OT_PASTA_ID = "161X1XIMGQo4PSxoum4T_0yhXchlw9XPL";
var OT_PLANILHA_NOME = "Olho no Território – respostas";
var OT_COM_CAB = ["Atualizado em", "ID da pessoa", "Comunidade", "Município", "Situação no mapa", "Latitude", "Longitude",
  "Precisão (m)", "Como informou", "Território mapeado", "Tipo do território", "Fonte", "Código", "Dentro de", "Território mapeado mais próximo", "Distância (km)"];
var OT_SIT = { mapeado: "Em território mapeado", nova: "Nova comunidade (fora de território mapeado)", sem: "Localização não informada" };

function otPlanilha_() {
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return a; } catch (e) {}
  var it = DriveApp.getFolderById(OT_PASTA_ID).getFilesByName(OT_PLANILHA_NOME);
  if (!it.hasNext()) throw new Error("planilha não encontrada");
  return SpreadsheetApp.open(it.next());
}

function otAbaComunidades_(ss) {
  var sh = ss.getSheetByName("Comunidades");
  if (!sh) { sh = ss.insertSheet("Comunidades"); sh.appendRow(OT_COM_CAB); sh.setFrozenRows(1); sh.getRange(1, 1, 1, OT_COM_CAB.length).setFontWeight("bold"); }
  return sh;
}

var OT_AME_CAB = ["Data", "ID do registro", "Comunidade ou localidade", "Município", "Ameaça", "Latitude", "Longitude",
  "Situação no mapa", "Território mapeado no ponto", "Comunidade de quem registrou"];

/** Registro de campo: guarda comunidade/localidade, município e ameaça na aba "Ameacas" (sem a descrição escrita). */
function otRegistrarAmeaca_(item) {
  if (!item || item.tipo !== "registro" || !item.dados || !item.dados.localidade) return;
  var d = item.dados, L = d.localidadeNoMapa || {}, ss = otPlanilha_();
  var sh = ss.getSheetByName("Ameacas");
  if (!sh) { sh = ss.insertSheet("Ameacas"); sh.appendRow(OT_AME_CAB); sh.setFrozenRows(1); sh.getRange(1, 1, 1, OT_AME_CAB.length).setFontWeight("bold"); }
  var id = d.localId || item.id, n = sh.getLastRow();
  if (n > 1 && sh.getRange(2, 2, n - 1, 1).getValues().some(function (r) { return String(r[0]) === String(id); })) return; // reenvio
  sh.appendRow([new Date(item.criadoEm || new Date()), id, d.localidade, d.municipio || "", d.tipo || "", d.lat, d.lon,
    L.situacao === "mapeado" ? "Em território mapeado" : "Fora de território mapeado", (L.territorio && L.territorio.nome) || "",
    (item.pessoa && item.pessoa.comunidade) || ""]);
}

/** Acrescenta à resposta do painel as comunidades e as ameaças por comunidade. */
function otPainelExtra_(resposta) {
  try { resposta.comunidades = otComunidadesPainel_(); } catch (e) { resposta.comunidades = []; }
  try { resposta.ameacas = otAmeacasPainel_(); } catch (e) { resposta.ameacas = []; }
}

function otAmeacasPainel_() {
  var sh = otPlanilha_().getSheetByName("Ameacas");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, OT_AME_CAB.length).getValues().map(function (r) {
    return { d: r[0] ? new Date(r[0]).toISOString() : null, local: r[2], mun: r[3], tipo: r[4], lat: r[5] === "" ? null : +r[5], lon: r[6] === "" ? null : +r[6],
      sit: /^Em/.test(r[7]) ? "mapeado" : "nova", terr: r[8] };
  });
}

/** Grava ou atualiza a linha da pessoa. Ignora envios de versões antigas do app (sem o campo "local"). */
function otRegistrarComunidade_(item) {
  try { otRegistrarAmeaca_(item); } catch (e) {}
  if (!item || !item.pessoa) return;
  var p = item.pessoa, L = p.local || (item.dados && item.dados.comunidadeLocal);
  if (L === undefined || L === null) return;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = otAbaComunidades_(otPlanilha_());
    var t = L.territorio || {}, prox = L.proximo || {};
    var row = [new Date(item.criadoEm || new Date()), p.id || "", p.comunidade || "", p.municipio || "", OT_SIT[L.situacao] || L.situacao || "",
      L.lat == null ? "" : L.lat, L.lon == null ? "" : L.lon, L.prec == null ? "" : L.prec, L.como || "",
      t.nome || "", t.tipo || "", t.fonte || "", t.cod ? "'" + t.cod : "", (L.dentroDe || []).join("; "), prox.nome || "", prox.km == null ? "" : prox.km];
    var n = sh.getLastRow(), ids = n > 1 ? sh.getRange(2, 2, n - 1, 1).getValues() : [];
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(p.id)) {
        var antes = sh.getRange(i + 2, 1).getValue();
        if (antes && new Date(antes) > row[0]) return; // envio mais velho chegando depois: não sobrescreve
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return;
      }
    }
    sh.appendRow(row);
  } finally { lock.releaseLock(); }
}

/** Para o painel: uma entrada por comunidade (junta pessoas da mesma comunidade e município). */
function otComunidadesPainel_() {
  var sh = otPlanilha_().getSheetByName("Comunidades");
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, OT_COM_CAB.length).getValues(), m = {};
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var sitK = function (s) { return /^Em territ/.test(s) ? "mapeado" : /^Nova/.test(s) ? "nova" : "sem"; };
  v.forEach(function (r) {
    var k = norm(r[2]) + "|" + norm(r[3]), s = sitK(r[4]);
    var o = m[k] || (m[k] = { com: r[2], mun: r[3], pessoas: 0, d: null, sit: "sem", lat: null, lon: null, terr: "", tipo: "", fonte: "", prox: "", proxKm: null });
    o.pessoas++;
    var d = r[0] ? new Date(r[0]).toISOString() : null;
    if (!o.d || (d && d < o.d)) o.d = d; // primeira vez que a comunidade apareceu
    // prioridade: território mapeado confirmado > nova com ponto > sem localização
    var rank = { mapeado: 2, nova: 1, sem: 0 };
    if (rank[s] > rank[o.sit] || (rank[s] === rank[o.sit] && o.lat == null && r[5] !== "")) {
      o.sit = s; o.lat = r[5] === "" ? null : +r[5]; o.lon = r[6] === "" ? null : +r[6];
      o.terr = r[9]; o.tipo = r[10]; o.fonte = r[11]; o.prox = r[14]; o.proxKm = r[15] === "" ? null : +r[15];
    }
  });
  return Object.keys(m).map(function (k) { return m[k]; });
}
