/* Register der Resolutionen und Entscheidungen — Suche und Filter.
   Lädt assets/data/un-register.json (2.401 Einträge) erst, wenn der Abschnitt
   sichtbar wird, und rendert höchstens 200 Treffer auf einmal. Ohne Treffer
   bleibt die Seite bedienbar; ohne JavaScript bleibt der Hinweistext stehen. */
(function () {
  "use strict";
  var wurzel = document.getElementById("register");
  if (!wurzel) return;

  var suchfeld = document.getElementById("reg-suche"),
      organWahl = document.getElementById("reg-organ"),
      jahrVon = document.getElementById("reg-von"),
      jahrBis = document.getElementById("reg-bis"),
      ausgabe = document.getElementById("reg-treffer"),
      zaehler = document.getElementById("reg-zahl"),
      daten = null, geladen = false, GRENZE = 200;

  function entschaerfen(s) {
    return String(s).replace(/[&<>"]/g, function (z) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z];
    });
  }

  function zeichnen(treffer) {
    zaehler.textContent = treffer.length.toLocaleString("de-DE");
    if (!treffer.length) {
      ausgabe.innerHTML = '<p class="reg-leer">Keine Treffer. Andere Schreibweise versuchen — das Register führt die Originaltitel auf Englisch.</p>';
      return;
    }
    var teil = treffer.slice(0, GRENZE), zeilen = [], i, e;
    for (i = 0; i < teil.length; i++) {
      e = teil[i];
      zeilen.push('<tr><td class="reg-datum">' + entschaerfen(e.d) + '</td>' +
        '<td class="reg-organ">' + entschaerfen(e.o) + '</td>' +
        '<td class="reg-symbol">' + (e.s ? entschaerfen(e.s) : "—") + '</td>' +
        '<td class="reg-titel"><a href="' + entschaerfen(e.u) + '" rel="noopener" target="_blank">' +
        entschaerfen(e.t) + "</a></td></tr>");
    }
    ausgabe.innerHTML = '<div class="tablewrap"><table class="reg-tabelle">' +
      "<tr><th>Datum</th><th>Organ</th><th>Symbol</th><th>Titel im Original (führt zum UN-Archiv)</th></tr>" +
      zeilen.join("") + "</table></div>" +
      (treffer.length > GRENZE
        ? '<p class="reg-mehr">Angezeigt werden die ersten ' + GRENZE + " von " +
          treffer.length.toLocaleString("de-DE") + " Treffern — bitte die Suche eingrenzen.</p>"
        : "");
  }

  function filtern() {
    if (!daten) return;
    var q = (suchfeld.value || "").trim().toLowerCase(),
        org = organWahl.value,
        von = parseInt(jahrVon.value, 10) || 0,
        bis = parseInt(jahrBis.value, 10) || 9999;
    zeichnen(daten.filter(function (e) {
      if (org && e.o !== org) return false;
      if (e.j && (e.j < von || e.j > bis)) return false;
      if (!q) return true;
      return (e.t + " " + e.s + " " + e.c).toLowerCase().indexOf(q) !== -1;
    }));
  }

  function laden() {
    if (geladen) return;
    geladen = true;
    ausgabe.innerHTML = '<p class="reg-leer">Register wird geladen …</p>';
    fetch("assets/data/un-register.json")
      .then(function (r) { return r.json(); })
      .then(function (j) { daten = j; filtern(); })
      .catch(function () {
        ausgabe.innerHTML = '<p class="reg-leer">Das Register konnte nicht geladen werden. ' +
          'Die Datei liegt unter <code>assets/data/un-register.json</code>.</p>';
      });
  }

  ["input", "change"].forEach(function (ereignis) {
    [suchfeld, organWahl, jahrVon, jahrBis].forEach(function (feld) {
      if (feld) feld.addEventListener(ereignis, filtern);
    });
  });

  // Laden ausloesen: beim Sichtbarwerden, bei direktem Sprung auf den Anker,
  // bei der ersten Eingabe - und notfalls nach kurzer Zeit von selbst. Ein
  // IntersectionObserver allein reicht nicht: In versteckten Rahmen und bei
  // Direktaufruf mit #register loest er nie aus.
  if (location.hash === "#register") laden();
  [suchfeld, organWahl, jahrVon, jahrBis].forEach(function (feld) {
    if (feld) feld.addEventListener("focus", laden, { once: true });
  });
  if ("IntersectionObserver" in window) {
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) { laden(); beobachter.disconnect(); } });
    }, { rootMargin: "300px" });
    beobachter.observe(wurzel);
  }
  window.setTimeout(laden, 2500);
})();
