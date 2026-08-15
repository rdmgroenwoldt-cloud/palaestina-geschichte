/* ============================================================
   Namenssuche für namen.html
   Lädt assets/data/getoetete-gaza.json (Array aus
   [name_arabisch, name_umschrift, alter, geschlecht]) und macht
   die Liste durchsuchbar und filterbar. Vanilla JS, keine
   externen Bibliotheken — wie der Rest der Website.
   ============================================================ */
(function () {
  "use strict";

  var SEITE = 200;               // Einträge pro Nachladeschritt
  var daten = null;              // vollständiger Datensatz
  var treffer = [];              // aktuelle Filterergebnisse
  var gezeigt = 0;               // wie viele davon gerendert sind

  var elQ = document.getElementById("ns-q");
  var elGruppe = document.getElementById("ns-gruppe");
  var elSex = document.getElementById("ns-sex");
  var elReset = document.getElementById("ns-reset");
  var elStatus = document.getElementById("ns-status");
  var elBody = document.getElementById("ns-body");
  var elMehr = document.getElementById("ns-mehr");
  var elMehrBox = elMehr ? elMehr.parentNode : null;

  if (!elQ || !elBody) { return; }   // Seite ohne Suche

  function zahl(n) {
    return n.toLocaleString("de-DE");
  }

  /* Arabische Diakritika und lateinische Akzente entfernen, damit
     „Muhammad" auch „Muhammád" findet und arabische Suche toleranter ist. */
  function normalisieren(s) {
    if (!s) { return ""; }
    s = s.toLowerCase();
    if (s.normalize) {
      s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
    return s
      .replace(/[ً-ْٰـ]/g, "")   // Tashkil und Tatweel
      .replace(/[آأإ]/g, "ا")     // Alif-Varianten
      .replace(/ى/g, "ي")                   // Alif maqsura
      .replace(/ة/g, "ه")                   // Ta marbuta
      .replace(/[^\w؀-ۿ]+/g, " ")
      .trim();
  }

  function passtAlter(alter, gruppe) {
    if (gruppe === "alle") { return true; }
    if (alter === null || alter === undefined) { return false; }
    if (gruppe === "kinder") { return alter < 18; }
    if (gruppe === "baby") { return alter <= 1; }
    if (gruppe === "jung") { return alter <= 12; }
    if (gruppe === "alt") { return alter >= 60; }
    return true;
  }

  function filtern() {
    var q = normalisieren(elQ.value);
    var gruppe = elGruppe ? elGruppe.value : "alle";
    var sex = elSex ? elSex.value : "alle";
    var teile = q ? q.split(" ").filter(Boolean) : [];

    treffer = [];
    for (var i = 0; i < daten.length; i++) {
      var p = daten[i];
      if (!passtAlter(p[2], gruppe)) { continue; }
      if (sex !== "alle" && p[3] !== sex) { continue; }
      if (teile.length) {
        var heu = p[4];                       // vorberechneter Suchtext
        var ok = true;
        for (var t = 0; t < teile.length; t++) {
          if (heu.indexOf(teile[t]) === -1) { ok = false; break; }
        }
        if (!ok) { continue; }
      }
      treffer.push(p);
    }
    gezeigt = 0;
    elBody.innerHTML = "";
    nachladen();
    statusSchreiben();
  }

  function statusSchreiben() {
    var txt;
    if (treffer.length === 0) {
      txt = "Kein Eintrag gefunden. Versuch einen einzelnen Namensbestandteil — die Umschrift arabischer " +
            "Namen ist nicht eindeutig.";
    } else if (treffer.length === daten.length) {
      txt = "Alle " + zahl(daten.length) + " Namen — angezeigt: " + zahl(gezeigt) + ".";
    } else {
      txt = zahl(treffer.length) + " von " + zahl(daten.length) + " Namen entsprechen der Auswahl — " +
            "angezeigt: " + zahl(gezeigt) + ".";
    }
    elStatus.textContent = txt;
  }

  function nachladen() {
    var bis = Math.min(gezeigt + SEITE, treffer.length);
    var frag = document.createDocumentFragment();
    for (var i = gezeigt; i < bis; i++) {
      var p = treffer[i];
      var tr = document.createElement("tr");

      var tdAr = document.createElement("td");
      tdAr.className = "ns-ar";
      tdAr.setAttribute("dir", "rtl");
      tdAr.setAttribute("lang", "ar");
      tdAr.textContent = p[0] || "—";

      var tdEn = document.createElement("td");
      tdEn.textContent = p[1] || "—";

      var tdAlter = document.createElement("td");
      tdAlter.textContent = (p[2] === null || p[2] === undefined) ? "unbekannt" : String(p[2]);
      if (p[2] !== null && p[2] !== undefined && p[2] < 18) {
        tdAlter.className = "ns-kind";
      }

      var tdSex = document.createElement("td");
      tdSex.textContent = p[3] === "f" ? "weiblich" : (p[3] === "m" ? "männlich" : "—");

      tr.appendChild(tdAr);
      tr.appendChild(tdEn);
      tr.appendChild(tdAlter);
      tr.appendChild(tdSex);
      frag.appendChild(tr);
    }
    elBody.appendChild(frag);
    gezeigt = bis;
    if (elMehrBox) {
      elMehrBox.style.display = (gezeigt < treffer.length) ? "" : "none";
    }
    if (elMehr) {
      var rest = treffer.length - gezeigt;
      elMehr.textContent = "Weitere " + zahl(Math.min(SEITE, rest)) + " anzeigen";
    }
  }

  /* Eingabe entprellen, damit das Tippen bei 72.000 Einträgen flüssig bleibt */
  var timer = null;
  function verzoegert() {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(filtern, 180);
  }

  elQ.addEventListener("input", verzoegert);
  if (elGruppe) { elGruppe.addEventListener("change", filtern); }
  if (elSex) { elSex.addEventListener("change", filtern); }
  if (elMehr) {
    elMehr.addEventListener("click", function () {
      nachladen();
      statusSchreiben();
    });
  }
  if (elReset) {
    elReset.addEventListener("click", function () {
      elQ.value = "";
      if (elGruppe) { elGruppe.value = "alle"; }
      if (elSex) { elSex.value = "alle"; }
      filtern();
      elQ.focus();
    });
  }

  elStatus.textContent = "Daten werden geladen (rund 6 MB) …";

  fetch("assets/data/getoetete-gaza.json")
    .then(function (r) {
      if (!r.ok) { throw new Error("HTTP " + r.status); }
      return r.json();
    })
    .then(function (json) {
      daten = json;
      /* Suchtext einmal vorberechnen — danach ist jede Suche ein reiner
         Zeichenkettenvergleich und läuft ohne merkbare Verzögerung. */
      for (var i = 0; i < daten.length; i++) {
        daten[i][4] = normalisieren((daten[i][1] || "") + " " + (daten[i][0] || ""));
      }
      filtern();
    })
    .catch(function (err) {
      elStatus.textContent = "Die Namensliste konnte nicht geladen werden (" + err.message +
        "). Die vollständige Liste ist bei Airwars und Tech for Palestine abrufbar — siehe die Links unten.";
      if (elMehrBox) { elMehrBox.style.display = "none"; }
    });
})();
