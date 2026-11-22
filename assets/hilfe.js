/* Projektseiten "Hilfe für Gaza": Karussell-Pfeile und Zähler für .hk-galerie (wischen geht immer). */
(function () {
  document.querySelectorAll(".hk-galerie").forEach(function (m) {
    var karten = Array.prototype.slice.call(m.children);
    if (karten.length < 2) return;
    var huelle = m.parentElement;
    function pfeil(seite, zeichen, text) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "hk-pfeil " + seite; b.textContent = zeichen; b.setAttribute("aria-label", text);
      b.addEventListener("click", function () { m.scrollBy({ left: (seite === "links" ? -1 : 1) * m.clientWidth * 0.9, behavior: "smooth" }); });
      huelle.appendChild(b); return b;
    }
    var li = pfeil("links", "‹", "Vorherige Bilder"), re = pfeil("rechts", "›", "Weitere Bilder");
    var z = document.createElement("p"); z.className = "hk-zaehler"; huelle.after(z);
    function stand() {
      var breite = karten[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(m).columnGap) || 0);
      if (!breite) return;
      var sichtbar = Math.max(1, Math.round(m.clientWidth / breite));
      var erstes = Math.min(karten.length, Math.round(m.scrollLeft / breite) + 1);
      var letztes = Math.min(karten.length, erstes + sichtbar - 1);
      z.textContent = (letztes > erstes ? erstes + "–" + letztes : erstes) + " von " + karten.length + " Bildern · wischen oder Pfeile";
      li.disabled = m.scrollLeft < 8;
      re.disabled = m.scrollLeft + m.clientWidth >= m.scrollWidth - 8;
    }
    m.addEventListener("scroll", function () { requestAnimationFrame(stand); }, { passive: true });
    window.addEventListener("resize", stand);
    var klapp = m.closest("details"); if (klapp) klapp.addEventListener("toggle", stand);
    stand();
  });
  /* Sensible Bilder: erst nach Tippen scharf, zweites Tippen öffnet eine eigene Großansicht
     (bewusst getrennt vom allgemeinen Lichtkasten, damit man nicht versehentlich hineinblättert). */
  var sens = document.querySelectorAll("figure.hk-sensibel");
  if (sens.length) {
    var gross = document.createElement("div");
    gross.className = "hk-gross"; gross.setAttribute("role", "dialog"); gross.setAttribute("aria-modal", "true");
    gross.innerHTML = '<button type="button" aria-label="Schließen">×</button><img alt=""><p></p>';
    document.body.appendChild(gross);
    var zu = function () { gross.classList.remove("auf"); };
    gross.addEventListener("click", function (e) { if (e.target === gross || e.target.tagName === "BUTTON") zu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") zu(); });
    sens.forEach(function (f) {
      f.setAttribute("tabindex", "0");
      var los = function () {
        if (!f.classList.contains("frei")) { f.classList.add("frei"); return; }
        var q = f.querySelector("img");
        gross.querySelector("img").src = q.currentSrc || q.src; gross.querySelector("img").alt = q.alt;
        gross.querySelector("p").textContent = q.alt; gross.classList.add("auf");
      };
      f.addEventListener("click", los);
      f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); los(); } });
    });
  }
})();
