/* Suche über die ganze Website (suche.html).
   Lädt assets/data/suchindex.json (erzeugt von wissensbank/suchindex_bauen.py) und durchsucht
   alle Abschnitte im Browser – ohne fremde Dienste, ohne Cookies, ohne Übertragung der Suchbegriffe.
   Umlaute, ß und Groß-/Kleinschreibung spielen keine Rolle („Voelkermord“ findet „Völkermord“). */
(function () {
  "use strict";
  var feld = document.getElementById("suche-feld");
  if (!feld) return;
  var ausgabe = document.getElementById("suche-treffer"),
      stand = document.getElementById("suche-stand"),
      daten = null, timer = null, MAX_SEITEN = 40, MAX_ABSCHNITTE = 3;

  function entschaerfen(s) {
    return String(s).replace(/[&<>"]/g, function (z) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z];
    });
  }
  function norm(s) {
    return String(s).toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u")
      .replace(/[„“”‚‘’"'«»]/g, "").replace(/[‐-―]/g, "-")
      .replace(/([a-z])\1+/g, "$1");   /* Doppelbuchstaben wie einfache: „Yassin“ = „Yasin“ */
  }
  /* Regex für das Hervorheben im Originaltext: jeder Buchstabe darf Akzent- und Umlautvarianten haben. */
  var VAR = { a: "(?:a|ä|ae|à|á|â)", o: "(?:o|ö|oe|ó|ô)", u: "(?:u|ü|ue|ú|û)", e: "[eéèê]", i: "[iíî]",
              c: "[cç]", s: "(?:ss|ß|s)", n: "[nñ]" };
  function wortRegex(w) {
    var teile = [], i, z;
    for (i = 0; i < w.length; i++) {
      z = w.charAt(i);
      teile.push("(?:" + (VAR[z] || z.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) + ")+");
    }
    return teile.join("");
  }

  function vorbereiten(roh) {
    roh.forEach(function (seite) {
      seite.nti = norm(seite.ti);
      seite.s.forEach(function (ab) { ab.nh = norm(ab.h); ab.nt = norm(ab.t); });
    });
    return roh;
  }

  function zaehle(text, wort) {
    var n = 0, pos = text.indexOf(wort);
    while (pos !== -1 && n < 20) { n++; pos = text.indexOf(wort, pos + wort.length); }
    return n;
  }

  function ausschnitt(text, regexe) {
    var erster = -1, i, m;
    for (i = 0; i < regexe.length; i++) {
      m = new RegExp(regexe[i], "i").exec(text);
      if (m && (erster === -1 || m.index < erster)) erster = m.index;
    }
    var start = Math.max(0, erster - 90), ende = Math.min(text.length, start + 260);
    var stueck = (start > 0 ? "… " : "") + text.slice(start, ende) + (ende < text.length ? " …" : "");
    var html = entschaerfen(stueck);
    var gesamt = new RegExp("(" + regexe.join("|") + ")", "gi");
    return html.replace(gesamt, "<mark>$1</mark>");
  }

  function suchen(frage) {
    var woerter = norm(frage).split(/[\s,;:.!?()\/]+/).filter(function (w) { return w.length >= 2; });
    if (!woerter.length) { ausgabe.innerHTML = ""; stand.textContent = "Mindestens zwei Buchstaben eingeben."; return; }
    var regexe = woerter.map(wortRegex), ergebnis = [], abschnitteGesamt = 0;
    daten.forEach(function (seite) {
      var treffer = [];
      seite.s.forEach(function (ab) {
        var punkte = 0, alle = true;
        woerter.forEach(function (w) {
          var inT = seite.nti.indexOf(w) !== -1, inH = ab.nh.indexOf(w) !== -1, n = zaehle(ab.nt, w);
          if (!inT && !inH && !n) { alle = false; return; }
          punkte += (inT ? 8 : 0) + (inH ? 15 : 0) + Math.min(n, 10);
        });
        if (alle) treffer.push({ ab: ab, p: punkte });
      });
      if (treffer.length) {
        treffer.sort(function (x, y) { return y.p - x.p; });
        abschnitteGesamt += treffer.length;
        var summe = treffer.reduce(function (s, t) { return s + t.p; }, 0);
        ergebnis.push({ seite: seite, treffer: treffer, p: treffer[0].p + summe * 0.15 });
      }
    });
    ergebnis.sort(function (x, y) { return y.p - x.p; });
    zeichnen(ergebnis, abschnitteGesamt, regexe);
  }

  function zeichnen(ergebnis, abschnitte, regexe) {
    if (!ergebnis.length) {
      stand.textContent = "Keine Treffer.";
      ausgabe.innerHTML = '<p class="suche-leer">Nichts gefunden. Tipp: weniger Wörter oder nur einen Wortanfang eingeben – „Vertreib“ findet auch „Vertreibung“ und „Vertreibungen“.</p>';
      return;
    }
    stand.textContent = abschnitte.toLocaleString("de-DE") + " passende Abschnitte auf " +
      ergebnis.length.toLocaleString("de-DE") + " Seiten" + (ergebnis.length > MAX_SEITEN ? " – die " + MAX_SEITEN + " besten werden gezeigt" : "");
    var html = [];
    ergebnis.slice(0, MAX_SEITEN).forEach(function (e) {
      var s = e.seite;
      html.push('<article class="suche-seite"><h3><a href="' + entschaerfen(s.u) + '">' + entschaerfen(s.ti) + "</a></h3>");
      e.treffer.slice(0, MAX_ABSCHNITTE).forEach(function (t) {
        var ziel = s.u + (t.ab.a ? "#" + t.ab.a : "");
        html.push('<a class="suche-abschnitt" href="' + entschaerfen(ziel) + '"><span class="suche-ueb">' +
          (t.ab.h ? entschaerfen(t.ab.h) : "Einleitung") + '</span><span class="suche-text">' +
          ausschnitt(t.ab.t, regexe) + "</span></a>");
      });
      if (e.treffer.length > MAX_ABSCHNITTE) {
        html.push('<p class="suche-mehr">+ ' + (e.treffer.length - MAX_ABSCHNITTE) + " weitere Abschnitte auf dieser Seite</p>");
      }
      html.push("</article>");
    });
    ausgabe.innerHTML = html.join("");
  }

  function ausloesen() {
    var q = feld.value.trim();
    try {
      var url = new URL(window.location.href);
      if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
    } catch (e) { /* ältere Browser: URL bleibt */ }
    if (!daten) return;
    if (!q) { ausgabe.innerHTML = ""; stand.textContent = "Suchbegriff eingeben – die Treffer erscheinen beim Tippen."; return; }
    suchen(q);
  }

  feld.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(ausloesen, 160); });
  var formular = feld.form;
  if (formular) formular.addEventListener("submit", function (ev) { ev.preventDefault(); ausloesen(); });

  try { var start = new URL(window.location.href).searchParams.get("q"); if (start) feld.value = start; } catch (e) {}
  stand.textContent = "Suchindex wird geladen …";
  fetch("assets/data/suchindex.json", { cache: "default" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (roh) {
      daten = vorbereiten(roh);
      var n = daten.reduce(function (s, x) { return s + x.s.length; }, 0);
      stand.textContent = daten.length + " Seiten mit " + n.toLocaleString("de-DE") + " Abschnitten durchsuchbar.";
      if (feld.value.trim()) ausloesen();
      feld.focus();
    })
    .catch(function () { stand.textContent = "Der Suchindex konnte nicht geladen werden. Bitte die Seite neu laden."; });
})();
