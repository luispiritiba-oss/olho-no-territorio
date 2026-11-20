/**
 * Olho no Território – comunidades e ameaças a partir dos registros de campo (app 1.9.2)
 *
 * Como instalar no script do Google que já recebe os envios:
 *  1. No editor do Apps Script, clique em "+" > Script, dê o nome "comunidades" e cole este arquivo inteiro.
 *  2. Na função doPost, logo depois de conferir a chave (token) e antes de responder, cole a linha:
 *         try { otRegistrarAmeaca_(item); } catch (e) {}
 *     (troque "item" pelo nome da variável que guarda o envio recebido, se for outro).
 *  3. Na parte da função doGet que responde ao painel (?painel=1), antes de devolver o JSON, cole:
 *         otPainelExtra_(resposta);
 *     (troque "resposta" pelo nome do objeto que vira JSON).
 *  4. Implantar > Gerenciar implantações > editar > Nova versão > Implantar. O endereço /exec continua o mesmo.
 *
 * Cria a aba "Ameacas" na planilha "Olho no Território – respostas": uma linha por registro de campo, com
 * "Onde estou?" (comunidade ou localidade), município, ameaça, ponto e se o ponto fica em território já mapeado.
 * O painel recebe só esses campos: sem nome, CPF, data de nascimento ou a descrição escrita.
 */
var OT_PASTA_ID = "161X1XIMGQo4PSxoum4T_0yhXchlw9XPL";
var OT_PLANILHA_NOME = "Olho no Território – respostas";
var OT_AME_CAB = ["Data", "ID do registro", "Comunidade ou localidade", "Município", "Ameaça", "Latitude", "Longitude",
  "Situação no mapa", "Território mapeado no ponto", "Tipo do território", "Fonte", "Território mapeado mais próximo", "Distância (km)"];

function otPlanilha_() {
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return a; } catch (e) {}
  var it = DriveApp.getFolderById(OT_PASTA_ID).getFilesByName(OT_PLANILHA_NOME);
  if (!it.hasNext()) throw new Error("planilha não encontrada");
  return SpreadsheetApp.open(it.next());
}

/** Registro de campo: grava uma linha na aba "Ameacas". Ignora outros tipos de envio e reenvios. */
function otRegistrarAmeaca_(item) {
  if (!item || item.tipo !== "registro" || !item.dados || !item.dados.localidade) return;
  var d = item.dados, L = d.localidadeNoMapa || {}, t = L.territorio || {}, prox = L.proximo || {};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = otPlanilha_(), sh = ss.getSheetByName("Ameacas");
    if (!sh) { sh = ss.insertSheet("Ameacas"); sh.appendRow(OT_AME_CAB); sh.setFrozenRows(1); sh.getRange(1, 1, 1, OT_AME_CAB.length).setFontWeight("bold"); }
    var id = d.localId || item.id, n = sh.getLastRow();
    if (n > 1 && sh.getRange(2, 2, n - 1, 1).getValues().some(function (r) { return String(r[0]) === String(id); })) return;
    sh.appendRow([new Date(item.criadoEm || new Date()), id, d.localidade, d.municipio || "", d.tipo || "",
      d.lat == null ? "" : d.lat, d.lon == null ? "" : d.lon,
      L.situacao === "mapeado" ? "Em território mapeado" : "Fora de território mapeado",
      t.nome || "", t.tipo || "", t.fonte || "", prox.nome || "", prox.km == null ? "" : prox.km]);
  } finally { lock.releaseLock(); }
}

/** Acrescenta à resposta do painel a lista de registros com comunidade, município e ameaça. */
function otPainelExtra_(resposta) {
  try { resposta.ameacas = otAmeacasPainel_(); } catch (e) { resposta.ameacas = []; }
}

function otAmeacasPainel_() {
  var sh = otPlanilha_().getSheetByName("Ameacas");
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, OT_AME_CAB.length).getValues().map(function (r) {
    return { d: r[0] ? new Date(r[0]).toISOString() : null, local: r[2], mun: r[3], tipo: r[4],
      lat: r[5] === "" ? null : +r[5], lon: r[6] === "" ? null : +r[6],
      sit: /^Em/.test(r[7]) ? "mapeado" : "nova", terr: r[8], terrTipo: r[9], fonte: r[10],
      prox: r[11], proxKm: r[12] === "" ? null : +r[12] };
  });
}
