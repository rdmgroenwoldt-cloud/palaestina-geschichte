/* Zahlenformat nach Seitensprache: Uebersetzungen (en/es) zeigen 750,000 bzw. 750.000 */
var SEITEN_LOCALE = ({ en: "en-US", es: "es-ES" })[(document.documentElement.lang || "de").slice(0, 2)] || "de-DE";
/* ============================================================
   Palästina – Geschichte eines Landes · Interaktions-Bausteine
   Vanilla JS, keine externen Bibliotheken. Wird auf allen Seiten
   per <script src="assets/interactions.js" defer></script> geladen.

   Bausteine:
   1) .expand      – aufklappbare <details>-Karten mit Höhenanimation
   2) .carousel     – Swipe-/Scroll-Leiste mit Pfeil-Buttons für Desktop
   3) .reveal       – Einblenden beim Hineinscrollen (IntersectionObserver)
   4) Mega-Menü     – Hauptnavigation mit Dropdown-Kategorien (nav.topnav)
   5) .flipcard     – Karten, die sich per Klick/Enter umdrehen (3D-Flip)
   6) .count-up     – Zahlen, die beim Hineinscrollen hochzählen
   7) .tabs         – Tab-Umschalter mit Pfeiltasten-Bedienung
   8) .compare      – Vorher/Nachher-Bildvergleich mit ziehbarem Teiler
   (Karten-Hover ist reines CSS und braucht kein JS.)

   MARKUP-KONVENTIONEN der neuen Bausteine 5–8 (Kurzreferenz, Details
   als Kommentar am jeweiligen CSS-Block in assets/style.css):

   5) Flip-Karte:
      <div class="flipcard">            (Variante: class="flipcard accent2" → rote Rückseite)
        <div class="flip-inner">
          <div class="flip-front">Bild/Titel + optional <span class="flip-hint">Karte umdrehen</span></div>
          <div class="flip-back">Info-Text</div>
        </div>
      </div>
      tabindex/role/aria-pressed setzt das JS selbst.

   6) Zahlen-Counter (Endwert steht als Text schon im HTML → ohne JS sichtbar):
      <span class="count-up" data-target="198273" data-suffix=" %" data-duration="1400">198.273 %</span>
      data-target: Dezimaltrenner PUNKT ("5.9" ergibt „5,9"); optional data-prefix.

   7) Tabs (Panel-Reihenfolge = Tab-Reihenfolge; alle Panels außer dem ersten
      bekommen im HTML das hidden-Attribut, damit es ohne JS nicht doppelt aussieht):
      <div class="tabs">
        <div class="tab-list" role="tablist" aria-label="…">
          <button type="button" role="tab" aria-selected="true">Tab 1</button>
          <button type="button" role="tab">Tab 2</button>
        </div>
        <div class="tab-panel" role="tabpanel">Inhalt 1</div>
        <div class="tab-panel" role="tabpanel" hidden>Inhalt 2</div>
      </div>

   8) Vorher/Nachher-Vergleich (ohne JS: simples Nebeneinander):
      <div class="compare" data-label-before="2022" data-label-after="2024">
        <figure><img src="vorher.jpg" alt="…"><figcaption>…</figcaption></figure>
        <figure><img src="nachher.jpg" alt="…"><figcaption>…</figcaption></figure>
      </div>
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------
     1) Aufklappbare Karten (details.expand)
     Native <details> öffnen/schließen sich sofort ohne Animation.
     Damit sich die Höhe sanft ändert, wird der native Klick abgefangen
     und die Höhe stattdessen per Web Animations API animiert.
     ------------------------------------------------------------ */
  function initExpandCards() {
    var items = document.querySelectorAll("details.expand");
    items.forEach(function (el) {
      var summary = el.querySelector(":scope > summary");
      var body = el.querySelector(":scope > .expand-body");
      if (!summary || !body) return;

      var animation = null;
      var isClosing = false;
      var isExpanding = false;

      // Ohne Animations-API oder bei "reduzierte Bewegung": natives Verhalten belassen.
      if (reduceMotion || typeof el.animate !== "function") return;

      summary.addEventListener("click", function (e) {
        e.preventDefault();
        el.style.overflow = "hidden";
        if (isClosing || !el.open) {
          openCard();
        } else if (isExpanding || el.open) {
          shrinkCard();
        }
      });

      function shrinkCard() {
        isClosing = true;
        var startHeight = el.offsetHeight + "px";
        var endHeight = summary.offsetHeight + "px";
        if (animation) animation.cancel();
        animation = el.animate(
          { height: [startHeight, endHeight] },
          { duration: 260, easing: "ease-out" }
        );
        animation.onfinish = function () { onFinish(false); };
        animation.oncancel = function () { isClosing = false; };
      }

      function openCard() {
        el.style.height = el.offsetHeight + "px";
        el.open = true;
        window.requestAnimationFrame(function () { expandCard(); });
      }

      function expandCard() {
        isExpanding = true;
        var startHeight = el.offsetHeight + "px";
        var endHeight = summary.offsetHeight + body.offsetHeight + "px";
        if (animation) animation.cancel();
        animation = el.animate(
          { height: [startHeight, endHeight] },
          { duration: 260, easing: "ease-out" }
        );
        animation.onfinish = function () { onFinish(true); };
        animation.oncancel = function () { isExpanding = false; };
      }

      function onFinish(open) {
        el.open = open;
        animation = null;
        isClosing = false;
        isExpanding = false;
        el.style.height = "";
        el.style.overflow = "";
      }
    });
  }

  /* ------------------------------------------------------------
     2) Swipe-/Scroll-Carousel (.carousel)
     Funktioniert per Touch von selbst (scroll-snap in CSS).
     Für Desktop-Nutzer ohne Touch ergänzt JS zwei Pfeil-Buttons,
     die per scrollBy sanft weiterscrollen.
     ------------------------------------------------------------ */
  var ICON_LEFT = '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_RIGHT = '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  function initCarousels() {
    var tracks = document.querySelectorAll(".carousel");
    tracks.forEach(function (track) {
      if (track.dataset.carouselReady) return;
      track.dataset.carouselReady = "1";

      // Track in eine Hülle packen, damit die Pfeile absolut darüber sitzen können.
      var shell = document.createElement("div");
      shell.className = "carousel-shell";
      track.parentNode.insertBefore(shell, track);
      shell.appendChild(track);

      var prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "carousel-btn prev";
      prevBtn.setAttribute("aria-label", "Zurück");
      prevBtn.innerHTML = ICON_LEFT;

      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "carousel-btn next";
      nextBtn.setAttribute("aria-label", "Weiter");
      nextBtn.innerHTML = ICON_RIGHT;

      shell.appendChild(prevBtn);
      shell.appendChild(nextBtn);

      function step() {
        var first = track.querySelector(":scope > *");
        var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "16");
        return first ? first.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      }

      function updateButtons() {
        var maxScroll = track.scrollWidth - track.clientWidth - 2;
        prevBtn.disabled = track.scrollLeft <= 2;
        nextBtn.disabled = track.scrollLeft >= maxScroll;
      }

      prevBtn.addEventListener("click", function () {
        track.scrollBy({ left: -step(), behavior: "smooth" });
      });
      nextBtn.addEventListener("click", function () {
        track.scrollBy({ left: step(), behavior: "smooth" });
      });

      track.addEventListener("scroll", updateButtons, { passive: true });
      window.addEventListener("resize", updateButtons);
      updateButtons();
    });
  }

  /* ------------------------------------------------------------
     3) Scroll-Reveal (.reveal)
     Blendet Elemente einmalig ein, sobald sie in den sichtbaren
     Bereich scrollen. Respektiert prefers-reduced-motion.
     ------------------------------------------------------------ */
  function initScrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (reduceMotion || typeof IntersectionObserver !== "function") {
      // Ohne Animation oder ohne Observer-Unterstützung: sofort sichtbar machen.
      items.forEach(function (el) { el.classList.add("reveal-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target); // nur einmal animieren
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------
     4) Mega-Menü (nav.topnav)
     Die Hauptkategorien stehen im Nav-Balken; jede öffnet ein
     Dropdown-Panel mit ihren Unterseiten:
       - Klick/Tap auf den Kategorie-Button schaltet das Panel um
         (das ist der Weg, der auf Touch-Geräten funktioniert, wo es
         kein echtes Hover gibt) und setzt aria-expanded.
       - Auf Desktop öffnet zusätzlich Hover mit kurzer Verzögerung
         (damit ein Vorbeifahren mit der Maus nicht sofort ein Panel
         aufreißt) und schließt mit etwas Nachlauf, damit der Weg zum
         Panel selbst nicht abbricht.
       - Escape schließt das offene Panel und gibt den Fokus an den
         auslösenden Button zurück.
       - Klick außerhalb des Menüs schließt alle offenen Panels.
       - Unter 760px (siehe CSS) klappt die komplette Linkliste
         hinter einem Hamburger-Button zusammen; die Kategorien
         werden dort zu Akkordeons, die dieselbe .open-Klasse nutzen.
     Reine CSS-:focus-within-Regeln in style.css sind ein Fallback,
     damit Tab-only-Nutzer ohne JS grundsätzlich an die Links kommen;
     dieses Modul liefert die volle, angekündigte (aria-expanded)
     Bedienung obendrauf.
     ------------------------------------------------------------ */
  function initMegaMenu() {
    var nav = document.querySelector("nav.topnav");
    if (!nav) return;

    var burger = nav.querySelector(".mm-burger");
    var navLinks = nav.querySelector(".nav-links");
    var groups = Array.prototype.slice.call(nav.querySelectorAll(".nl-group"));
    var mqDesktop = window.matchMedia("(min-width: 761px)");

    function closeGroup(group) {
      group.classList.remove("open");
      var btn = group.querySelector(".nl-trigger");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function closeAllGroups(except) {
      groups.forEach(function (g) {
        if (g !== except) closeGroup(g);
      });
    }

    function openGroup(group) {
      closeAllGroups(group);
      group.classList.add("open");
      var btn = group.querySelector(".nl-trigger");
      if (btn) btn.setAttribute("aria-expanded", "true");
    }

    /* Seit dem 14.08.2026 ist das Menue ein Hamburger-Menue LINKS: Der Knopf
       klappt die Hauptpunkte senkrecht auf; Klick oder Darueberfahren auf einem
       Hauptpunkt oeffnet dessen Unterpunkte in einem Fenster RECHTS daneben
       (Flyout, ab 761 px). Unter 760 px sind die Unterpunkte ein Akkordeon. */
    var openTimer = null, closeTimer = null;
    function schliesseLeiste() {
      closeAllGroups();
      nav.classList.remove("mm-mobile-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
    }

    groups.forEach(function (group) {
      var trigger = group.querySelector(".nl-trigger");
      if (!trigger) return;
      trigger.addEventListener("click", function () {
        if (group.classList.contains("open")) {
          closeGroup(group);
        } else {
          openGroup(group);
        }
      });
      // Darueberfahren (nur breite Fenster, nur bei geoeffneter Hauptliste):
      // kleine Verzoegerung, damit ein Vorbeifahren nichts aufreisst; beim
      // Verlassen etwas Nachlauf, damit der Weg ins seitliche Fenster nicht abbricht.
      group.addEventListener("mouseenter", function () {
        if (!mqDesktop.matches || !nav.classList.contains("mm-mobile-open")) return;
        window.clearTimeout(closeTimer);
        openTimer = window.setTimeout(function () { openGroup(group); }, 110);
      });
      group.addEventListener("mouseleave", function () {
        if (!mqDesktop.matches) return;
        window.clearTimeout(openTimer);
        closeTimer = window.setTimeout(function () { closeGroup(group); }, 260);
      });
    });

    // Escape: erst das offene Akkordeon schließen (Fokus zurück auf dessen
    // Knopf), beim zweiten Mal die ganze Leiste (Fokus zurück auf den Hamburger).
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      var openGroupEl = groups.filter(function (g) { return g.classList.contains("open"); })[0];
      if (openGroupEl) {
        closeGroup(openGroupEl);
        var btn = openGroupEl.querySelector(".nl-trigger");
        if (btn) btn.focus();
      } else if (nav.classList.contains("mm-mobile-open")) {
        schliesseLeiste();
        if (burger) burger.focus();
      }
    });

    // Klick außerhalb des gesamten Menüs schließt die Leiste samt Akkordeons.
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) schliesseLeiste();
    });

    // Hamburger klappt die gesamte Linkliste auf/zu; Kategorien bleiben darin
    // als eigene Akkordeons per Klick bedienbar (s. oben).
    if (burger && navLinks) {
      burger.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("mm-mobile-open");
        burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (!isOpen) closeAllGroups();
      });
      // Ein Klick auf einen echten Link (Start oder eine Unterseite) navigiert
      // ohnehin weg – die Leiste sauber mitschließen, falls die Seite
      // z. B. per Zurück-Button erneut sichtbar wird.
      navLinks.querySelectorAll("a.nl, .mm-item").forEach(function (a) {
        a.addEventListener("click", function () { schliesseLeiste(); });
      });
    }

    // Beim Wechsel zwischen Flyout (breit) und Akkordeon (schmal) alle
    // offenen Zustände zurücksetzen, damit nichts hängen bleibt.
    if (typeof mqDesktop.addEventListener === "function") {
      mqDesktop.addEventListener("change", schliesseLeiste);
    } else if (typeof mqDesktop.addListener === "function") {
      mqDesktop.addListener(schliesseLeiste); // ältere Browser (Safari < 14)
    }
  }

  /* ------------------------------------------------------------
     5) Flip-Karten (.flipcard)
     Klick/Tap oder Enter/Leertaste dreht die Karte um (CSS macht die
     3D-Rotation; bei prefers-reduced-motion schaltet das CSS stattdessen
     hart per Sichtbarkeit um — das JS bleibt identisch). Das JS macht
     die Karte zusätzlich per Tastatur bedienbar: tabindex=0, role=button
     und aria-pressed spiegeln den Umdreh-Zustand für Screenreader.
     ------------------------------------------------------------ */
  function initFlipCards() {
    var cards = document.querySelectorAll(".flipcard");
    cards.forEach(function (card) {
      if (card.dataset.flipReady) return;
      var inner = card.querySelector(":scope > .flip-inner");
      if (!inner) return;
      card.dataset.flipReady = "1";

      /* Barrierefreiheit (20.10.2026): Die Karte selbst ist KEIN Knopf mehr – mit role="button"
         lasen Screenreader den ganzen Karteninhalt als eine Knopf-Beschriftung, und die Links der
         Rückseite waren unerreichbar. Stattdessen wird der Hinweis „Karte umdrehen“ ein echter
         <button>. Mausklick auf die Karte dreht weiterhin. */
      card.removeAttribute("tabindex");
      card.removeAttribute("role");
      card.removeAttribute("aria-pressed");

      var front = inner.querySelector(":scope > .flip-front");
      var hinweis = front ? front.querySelector(".flip-hint") : null;
      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "flip-hint flip-knopf";
      knopf.textContent = hinweis ? hinweis.textContent.trim() : "Karte umdrehen";
      var titel = front ? front.querySelector("h3, h4") : null;
      if (titel) knopf.setAttribute("aria-label", knopf.textContent + " – " + titel.textContent.replace(/\s+/g, " ").trim());
      knopf.setAttribute("aria-pressed", "false");
      if (hinweis) hinweis.parentNode.replaceChild(knopf, hinweis);
      else if (front) front.appendChild(knopf);

      function setzen(an) {
        card.classList.toggle("flipped", an);
        knopf.setAttribute("aria-pressed", an ? "true" : "false");
      }

      card.addEventListener("click", function (e) {
        // Echte Links auf der Karte sollen normal navigieren, nicht flippen.
        if (e.target.closest && e.target.closest("a")) return;
        setzen(!card.classList.contains("flipped"));
      });
      // Wer per Tastatur auf einen Link der Rückseite springt, bekommt die Rückseite zu sehen –
      // und beim Zurückspringen auf den Knopf wieder die Vorderseite.
      card.addEventListener("focusin", function (e) {
        if (e.target.closest(".flip-back")) setzen(true);
        else if (e.target === knopf && e.relatedTarget && card.contains(e.relatedTarget)) setzen(false);
      });
    });
  }

  /* ------------------------------------------------------------
     6) Zahlen-Counter (.count-up)
     Zählt beim ERSTEN Hineinscrollen von 0 zum data-target hoch,
     deutsch formatiert (Tausenderpunkt, Dezimal-Komma). Der fertige
     Wert steht bereits als Text im HTML — ohne JS oder bei
     prefers-reduced-motion wird er einfach (sofort) gesetzt/belassen.
     data-target: Zahl, Dezimaltrenner Punkt ("5.9")
     data-suffix / data-prefix: Text hinter/vor der Zahl (optional)
     data-duration: Dauer in ms (optional, Standard 1400)
     ------------------------------------------------------------ */
  function initCountUps() {
    var items = document.querySelectorAll(".count-up[data-target]");
    if (!items.length) return;

    function decimalsOf(raw) {
      var i = raw.indexOf(".");
      return i === -1 ? 0 : raw.length - i - 1;
    }

    function render(el, value, decimals) {
      var text = value.toLocaleString(SEITEN_LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      el.textContent = (el.dataset.prefix || "") + text + (el.dataset.suffix || "");
    }

    function setFinal(el) {
      var target = parseFloat(el.dataset.target);
      if (!isNaN(target)) render(el, target, decimalsOf(el.dataset.target));
    }

    function animate(el) {
      var raw = el.dataset.target;
      var target = parseFloat(raw);
      if (isNaN(target)) return;
      var decimals = decimalsOf(raw);
      var duration = Math.max(200, parseInt(el.dataset.duration, 10) || 1400);
      var start = null;

      function frame(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: schnell los, weich ankommen
        render(el, target * eased, decimals);
        if (t < 1) {
          window.requestAnimationFrame(frame);
        } else {
          render(el, target, decimals); // exakt auf dem Zielwert enden
        }
      }
      window.requestAnimationFrame(frame);
    }

    if (reduceMotion || typeof IntersectionObserver !== "function") {
      items.forEach(setFinal);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target); // nur einmal zählen
            animate(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    items.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------
     7) Tab-Umschalter (.tabs)
     Verdrahtet die role=tab-Buttons der .tab-list mit den .tab-panel-
     Geschwistern (Reihenfolge = Zuordnung): Klick wechselt, Pfeiltasten/
     Home/Ende wandern durch die Tabs (roving tabindex), aria-selected,
     aria-controls/aria-labelledby und hidden werden korrekt gepflegt.
     ------------------------------------------------------------ */
  var tabsUid = 0;

  function initTabs() {
    var roots = document.querySelectorAll(".tabs");
    roots.forEach(function (root) {
      if (root.dataset.tabsReady) return;
      var list = root.querySelector(":scope > .tab-list");
      if (!list) return;
      var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      var panels = Array.prototype.slice.call(root.querySelectorAll(":scope > .tab-panel"));
      if (!tabs.length || tabs.length !== panels.length) return;
      root.dataset.tabsReady = "1";

      tabs.forEach(function (tab, i) {
        tabsUid += 1;
        if (!tab.id) tab.id = "tab-" + tabsUid;
        if (!panels[i].id) panels[i].id = "tabpanel-" + tabsUid;
        tab.setAttribute("aria-controls", panels[i].id);
        panels[i].setAttribute("aria-labelledby", tab.id);
        panels[i].setAttribute("tabindex", "0"); // Panel-Inhalt per Tab erreichbar
      });

      function select(index, focus) {
        tabs.forEach(function (tab, i) {
          var on = i === index;
          tab.setAttribute("aria-selected", on ? "true" : "false");
          tab.tabIndex = on ? 0 : -1;
          panels[i].hidden = !on;
        });
        if (focus) tabs[index].focus();
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(i, false); });
        tab.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = tabs.length - 1;
          if (next !== null) {
            e.preventDefault();
            select(next, true);
          }
        });
      });

      // Startzustand: der im HTML mit aria-selected="true" markierte Tab, sonst der erste.
      var initial = 0;
      tabs.forEach(function (tab, i) {
        if (tab.getAttribute("aria-selected") === "true") initial = i;
      });
      select(initial, false);
    });
  }

  /* ------------------------------------------------------------
     8) Vorher/Nachher-Vergleich (.compare)
     Progressive Enhancement: Ohne JS zeigt das CSS die beiden <figure>
     einfach nebeneinander. Dieses Modul baut daraus eine Bühne:
       - Vorher-Bild als Basis, Nachher-Bild als darüberliegende, per
         clip-path beschnittene Ebene, grüner Teiler mit Griff.
       - Bedienung über einen unsichtbaren <input type=range>, der die
         GANZE Fläche bedeckt: Maus-Ziehen, Touch-Wischen und die
         Pfeiltasten funktionieren damit ohne eigene Event-Akrobatik,
         und Screenreader bekommen einen echten Schieberegler.
       - Die beiden figcaption-Texte wandern zusammengefasst unter die
         Bühne, data-label-before/-after (Standard „Vorher"/„Nachher")
         werden als Eck-Badges eingeblendet.
     ------------------------------------------------------------ */
  function initCompare() {
    var boxes = document.querySelectorAll(".compare");
    boxes.forEach(function (box) {
      if (box.dataset.compareReady) return;
      var figures = box.querySelectorAll(":scope > figure");
      if (figures.length < 2) return;
      var imgBefore = figures[0].querySelector("img");
      var imgAfter = figures[1].querySelector("img");
      if (!imgBefore || !imgAfter) return;
      box.dataset.compareReady = "1";

      var labelBefore = box.dataset.labelBefore || "Vorher";
      var labelAfter = box.dataset.labelAfter || "Nachher";

      var stage = document.createElement("div");
      stage.className = "compare-stage";

      // Basis-Ebene (Vorher) bestimmt die Höhe der Bühne.
      stage.appendChild(imgBefore);

      // Beschnittene Ebene (Nachher) darüber.
      var afterLayer = document.createElement("div");
      afterLayer.className = "cmp-after-layer";
      afterLayer.appendChild(imgAfter);
      stage.appendChild(afterLayer);

      var divider = document.createElement("div");
      divider.className = "cmp-divider";
      divider.setAttribute("aria-hidden", "true");
      stage.appendChild(divider);

      var badgeBefore = document.createElement("span");
      badgeBefore.className = "cmp-label before";
      badgeBefore.textContent = labelBefore;
      var badgeAfter = document.createElement("span");
      badgeAfter.className = "cmp-label after";
      badgeAfter.textContent = labelAfter;
      stage.appendChild(badgeBefore);
      stage.appendChild(badgeAfter);

      var range = document.createElement("input");
      range.type = "range";
      range.className = "cmp-range";
      range.min = "0";
      range.max = "100";
      range.step = "1";
      range.value = "50";
      range.setAttribute("aria-label",
        "Bildvergleich " + labelBefore + " / " + labelAfter + " – Teiler verschieben");
      range.addEventListener("input", function () {
        stage.style.setProperty("--cmp", range.value + "%");
      });
      stage.appendChild(range);

      // Bildunterschriften beider Figuren unter der Bühne zusammenfassen.
      var captionParts = [];
      figures.forEach(function (fig, i) {
        var cap = fig.querySelector("figcaption");
        if (cap && cap.textContent.trim()) {
          captionParts.push((i === 0 ? labelBefore : labelAfter) + ": " + cap.textContent.trim());
        }
      });

      // Ursprüngliche Figuren entfernen, Bühne (+ Caption) einsetzen.
      figures.forEach(function (fig) { box.removeChild(fig); });
      box.appendChild(stage);
      if (captionParts.length) {
        var caption = document.createElement("p");
        caption.className = "compare-caption";
        caption.textContent = captionParts.join(" · ");
        box.appendChild(caption);
      }
      box.classList.add("compare-ready");
    });
  }


  /* ------------------------------------------------------------
     9) Lesefortschritt
     Dünner Balken am oberen Rand, der zeigt, wie weit man im Text ist.
     Rein dekorativ, deshalb aria-hidden.
     ------------------------------------------------------------ */
  function initLesefortschritt() {
    if (!document.querySelector("main")) { return; }
    var bar = document.createElement("div");
    bar.className = "lesefortschritt";
    bar.setAttribute("aria-hidden", "true");
    var fill = document.createElement("i");
    bar.appendChild(fill);
    document.body.appendChild(bar);

    var ticking = false;
    function messen() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      fill.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(messen); }
    }, { passive: true });
    messen();
  }

  /* ------------------------------------------------------------
     Gemeinsame Grundlage für Kapitelband und Sprungleiste:
     alle Abschnitte mit id + h2 einsammeln.
     ------------------------------------------------------------ */
  function kapitelSammeln() {
    var main = document.querySelector("main");
    if (!main) { return []; }
    var out = [];
    Array.prototype.forEach.call(main.querySelectorAll(":scope > section[id]"), function (sec) {
      var h2 = sec.querySelector("h2");
      if (!h2) { return; }
      var sub = sec.querySelector(".sub");
      out.push({
        id: sec.id,
        el: sec,
        titel: (h2.textContent || "").replace(/\s+/g, " ").trim(),
        kicker: sub ? (sub.textContent || "").replace(/\s+/g, " ").trim() : ""
      });
    });
    return out;
  }

  /* ------------------------------------------------------------
     10) Kapitelband – das „Wissens-Karussell" oben auf der Seite.
     Statt einer Textwand zuerst eine Übersicht: Was steht hier drin,
     und wo springe ich hin? Wischbar auf dem Handy, Pfeile am Desktop.
     ------------------------------------------------------------ */
  function initKapitelband() {
    var main = document.querySelector("main");
    var kapitel = kapitelSammeln();
    if (!main || kapitel.length < 3) { return; }
    if (document.querySelector(".kapitelband")) { return; }
    /* Startseite hat bereits eine Kachel-Übersicht – dort wäre das Band doppelt. */
    if (main.querySelector(".tiles")) { return; }

    var box = document.createElement("nav");
    box.className = "kapitelband";
    box.setAttribute("aria-label", "Kapitel dieser Seite");

    var kopf = document.createElement("div");
    kopf.className = "kb-kopf";
    var titel = document.createElement("span");
    titel.className = "kb-titel";
    titel.textContent = kapitel.length + " Kapitel auf dieser Seite";
    kopf.appendChild(titel);

    var steuer = document.createElement("div");
    steuer.className = "kb-steuer";
    var links = document.createElement("button");
    links.type = "button";
    links.className = "kb-pfeil";
    links.setAttribute("aria-label", "Kapitel nach links");
    links.textContent = "\u2039";
    var rechts = document.createElement("button");
    rechts.type = "button";
    rechts.className = "kb-pfeil";
    rechts.setAttribute("aria-label", "Kapitel nach rechts");
    rechts.textContent = "\u203a";
    steuer.appendChild(links);
    steuer.appendChild(rechts);
    kopf.appendChild(steuer);

    var spur = document.createElement("div");
    spur.className = "kb-spur";

    kapitel.forEach(function (k, i) {
      var a = document.createElement("a");
      a.className = "kb-karte";
      a.href = "#" + k.id;
      var t = document.createElement("span");
      t.className = "kb-kt";
      t.textContent = k.titel;
      if (k.kicker) {
        var kick = document.createElement("span");
        kick.className = "kb-kick";
        kick.textContent = k.kicker;
        a.appendChild(kick);
      }
      a.appendChild(t);
      spur.appendChild(a);
    });

    box.appendChild(kopf);
    box.appendChild(spur);
    main.insertBefore(box, main.firstChild);

    function schieben(richtung) {
      spur.scrollBy({ left: richtung * Math.max(240, spur.clientWidth * 0.8),
                      behavior: reduceMotion ? "auto" : "smooth" });
    }
    links.addEventListener("click", function () { schieben(-1); });
    rechts.addEventListener("click", function () { schieben(1); });

    function pfeileStatus() {
      var max = spur.scrollWidth - spur.clientWidth - 2;
      links.disabled = spur.scrollLeft <= 2;
      rechts.disabled = spur.scrollLeft >= max;
      steuer.style.display = max <= 2 ? "none" : "";
    }
    spur.addEventListener("scroll", pfeileStatus, { passive: true });
    window.addEventListener("resize", pfeileStatus);
    pfeileStatus();
  }

  /* ------------------------------------------------------------
     11) Sprungleiste – dieselben Kapitel als dauerhafte Navigation.
     Breite Fenster: senkrechte Punktleiste am rechten Rand, Beschriftung
     erscheint beim Überfahren. Schmale Fenster: waagerechte Chip-Leiste,
     die einblendet, sobald man den Kopfbereich verlassen hat.
     Der aktive Abschnitt wird per IntersectionObserver hervorgehoben.
     ------------------------------------------------------------ */
  function initKapitelnavi() {
    var kapitel = kapitelSammeln();
    if (kapitel.length < 3) { return; }
    if (document.querySelector(".kapitelnavi")) { return; }

    var navi = document.createElement("nav");
    navi.className = "kapitelnavi";
    navi.setAttribute("aria-label", "Sprungleiste");

    kapitel.forEach(function (k) {
      var a = document.createElement("a");
      a.href = "#" + k.id;
      a.className = "kn-punkt";
      a.dataset.ziel = k.id;
      var label = document.createElement("span");
      label.className = "kn-label";
      label.textContent = k.titel;
      a.appendChild(label);
      a.setAttribute("aria-label", "Zum Kapitel: " + k.titel);
      navi.appendChild(a);
    });
    document.body.appendChild(navi);

    var punkte = {};
    Array.prototype.forEach.call(navi.querySelectorAll(".kn-punkt"), function (a) {
      punkte[a.dataset.ziel] = a;
    });

    function aktiv(id) {
      Object.keys(punkte).forEach(function (k) {
        var an = k === id;
        punkte[k].classList.toggle("aktiv", an);
        if (an) { punkte[k].setAttribute("aria-current", "true"); }
        else { punkte[k].removeAttribute("aria-current"); }
      });
    }

    if ("IntersectionObserver" in window) {
      var sichtbar = {};
      var beob = new IntersectionObserver(function (eintraege) {
        eintraege.forEach(function (e) { sichtbar[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
        var beste = null, wert = 0;
        kapitel.forEach(function (k) {
          if ((sichtbar[k.id] || 0) > wert) { wert = sichtbar[k.id]; beste = k.id; }
        });
        if (beste) { aktiv(beste); }
      }, { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.8] });
      kapitel.forEach(function (k) { beob.observe(k.el); });
    }

    /* einblenden, sobald der Kopfbereich verlassen ist */
    var hero = document.querySelector(".page-hero, .hero");
    function sichtbarkeit() {
      /* Schwelle deckeln, damit die Leiste auch bei sehr hohen Kopfbereichen
         früh erscheint – und bei kurzen Seiten überhaupt. */
      var grenze = Math.min(hero ? hero.offsetHeight * 0.6 : 200, 320);
      navi.classList.toggle("sichtbar", window.scrollY > grenze);
    }
    window.addEventListener("scroll", sichtbarkeit, { passive: true });
    sichtbarkeit();
  }


  /* ---------- 12. Lichtkasten ----------------------------------------
     Jedes <figure class="foto"> mit Bild wird anklickbar. Der Lichtkasten
     zeigt das Bild gross, darunter die Bildunterschrift samt Lizenz, und
     blaettert innerhalb der Seite durch alle Fotos (Pfeiltasten, Wischen).
     Es wird genau ein Overlay erzeugt und wiederverwendet.            */
  function initLichtkasten() {
    var figuren = [].slice.call(document.querySelectorAll("figure.foto")).filter(function (f) {
      return f.querySelector("img");
    });
    if (!figuren.length) return;

    var kasten = document.createElement("div");
    kasten.className = "lk";
    kasten.setAttribute("role", "dialog");
    kasten.setAttribute("aria-modal", "true");
    kasten.setAttribute("aria-label", "Bildansicht");
    kasten.innerHTML =
      '<button type="button" class="lk-zu" aria-label="Schlie\u00dfen">\u00d7</button>' +
      '<button type="button" class="lk-zurueck" aria-label="Vorheriges Bild">\u2039</button>' +
      '<button type="button" class="lk-vor" aria-label="N\u00e4chstes Bild">\u203a</button>' +
      '<div class="lk-buehne"><img alt=""></div>' +
      '<div class="lk-text"><span class="lk-zaehler"></span><span class="lk-bu"></span></div>';
    document.body.appendChild(kasten);

    var bild = kasten.querySelector(".lk-buehne img");
    var bu = kasten.querySelector(".lk-bu");
    var zaehler = kasten.querySelector(".lk-zaehler");
    var vor = kasten.querySelector(".lk-vor");
    var zurueck = kasten.querySelector(".lk-zurueck");
    var jetzt = -1;
    var vorherFokus = null;

    function zeige(i) {
      if (i < 0) i = figuren.length - 1;
      if (i >= figuren.length) i = 0;
      jetzt = i;
      var f = figuren[i];
      var q = f.querySelector("img");
      bild.src = q.currentSrc || q.src;
      bild.alt = q.alt || "";
      var cap = f.querySelector("figcaption");
      bu.innerHTML = cap ? cap.innerHTML : (q.alt || "");
      zaehler.textContent = figuren.length > 1 ? "Bild " + (i + 1) + " von " + figuren.length : "";
      vor.hidden = zurueck.hidden = figuren.length < 2;
    }

    function auf(i) {
      vorherFokus = document.activeElement;
      zeige(i);
      kasten.classList.add("auf");
      document.body.style.overflow = "hidden";
      kasten.querySelector(".lk-zu").focus();
    }

    function zu() {
      kasten.classList.remove("auf");
      document.body.style.overflow = "";
      bild.removeAttribute("src");
      if (vorherFokus && vorherFokus.focus) vorherFokus.focus();
    }

    figuren.forEach(function (f, i) {
      var q = f.querySelector("img");
      if (!f.querySelector(".lupe")) {
        var lupe = document.createElement("span");
        lupe.className = "lupe";
        lupe.setAttribute("aria-hidden", "true");
        f.appendChild(lupe);
      }
      q.setAttribute("tabindex", "0");
      q.setAttribute("role", "button");
      q.setAttribute("aria-label", "Bild vergr\u00f6\u00dfern: " + (q.alt || "Foto"));
      q.addEventListener("click", function () { auf(i); });
      q.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); auf(i); }
      });
    });

    kasten.querySelector(".lk-zu").addEventListener("click", zu);
    vor.addEventListener("click", function () { zeige(jetzt + 1); });
    zurueck.addEventListener("click", function () { zeige(jetzt - 1); });
    kasten.addEventListener("click", function (e) {
      if (e.target === kasten || e.target.classList.contains("lk-buehne")) zu();
    });
    document.addEventListener("keydown", function (e) {
      if (!kasten.classList.contains("auf")) return;
      if (e.key === "Escape") zu();
      else if (e.key === "ArrowRight") zeige(jetzt + 1);
      else if (e.key === "ArrowLeft") zeige(jetzt - 1);
    });

    var startX = null;
    kasten.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    kasten.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var d = e.changedTouches[0].clientX - startX;
      if (Math.abs(d) > 48) zeige(jetzt + (d < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
  }


  /* ---------- 13. Filterleiste ---------------------------------------
     <div class="filter" data-ziel="#gitter" data-titel="Thema"></div>
     Die Knoepfe entstehen aus den data-tags der Karten im Zielgitter.
     Mehrfachauswahl: eine Karte bleibt sichtbar, wenn sie mindestens
     eines der gewaehlten Schlagworte traegt.                          */
  function initFilter() {
    var leisten = document.querySelectorAll(".filter[data-ziel]");
    if (!leisten.length) return;

    Array.prototype.forEach.call(leisten, function (leiste) {
      var ziel = document.querySelector(leiste.getAttribute("data-ziel"));
      if (!ziel) return;
      var karten = [].slice.call(ziel.querySelectorAll("[data-tags]"));
      if (!karten.length) return;

      var alle = [];
      karten.forEach(function (k) {
        k.getAttribute("data-tags").split(/\s+/).forEach(function (tag) {
          if (tag && alle.indexOf(tag) === -1) alle.push(tag);
        });
      });
      alle.sort(function (a, b) { return a.localeCompare(b, "de"); });

      var abschnitte = [];
      karten.forEach(function (k) {
        var s = k.closest("section");
        if (s && abschnitte.indexOf(s) === -1) abschnitte.push(s);
      });

      var gewaehlt = [];
      var titel = document.createElement("span");
      titel.className = "filter-titel";
      titel.textContent = leiste.getAttribute("data-titel") || "Filtern nach";
      leiste.appendChild(titel);

      var alleKnopf = document.createElement("button");
      alleKnopf.type = "button";
      alleKnopf.textContent = "Alle";
      alleKnopf.setAttribute("aria-pressed", "true");
      leiste.appendChild(alleKnopf);

      var zahl = document.createElement("span");
      zahl.className = "filter-zahl";

      var leer = document.createElement("p");
      leer.className = "filter-leer";
      leer.textContent = "Zu dieser Auswahl gibt es hier nichts \u2014 bitte ein anderes Schlagwort w\u00e4hlen.";
      ziel.parentNode.insertBefore(leer, ziel.nextSibling);

      function anwenden() {
        var sichtbar = 0;
        karten.forEach(function (k) {
          var tags = k.getAttribute("data-tags").split(/\s+/);
          var zeigen = !gewaehlt.length || gewaehlt.some(function (g) { return tags.indexOf(g) !== -1; });
          k.classList.toggle("aus", !zeigen);
          if (zeigen) sichtbar++;
        });
        abschnitte.forEach(function (s) {
          var offen = s.querySelectorAll("[data-tags]:not(.aus)").length;
          s.classList.toggle("aus-abschnitt", offen === 0);
        });
        zahl.textContent = sichtbar + " von " + karten.length + " sichtbar";
        leer.classList.toggle("zeigen", sichtbar === 0);
        alleKnopf.setAttribute("aria-pressed", gewaehlt.length ? "false" : "true");
      }

      alleKnopf.addEventListener("click", function () {
        gewaehlt = [];
        Array.prototype.forEach.call(leiste.querySelectorAll("button[data-tag]"), function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        anwenden();
      });

      alle.forEach(function (tag) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-tag", tag);
        b.setAttribute("aria-pressed", "false");
        b.textContent = tag.replace(/-/g, " ");
        b.addEventListener("click", function () {
          var i = gewaehlt.indexOf(tag);
          if (i === -1) { gewaehlt.push(tag); b.setAttribute("aria-pressed", "true"); }
          else { gewaehlt.splice(i, 1); b.setAttribute("aria-pressed", "false"); }
          anwenden();
        });
        leiste.appendChild(b);
      });

      leiste.appendChild(zahl);
      anwenden();
    });
  }

  /* Buchcover erst auf Wunsch laden (Datenschutz): Die Cover liegen bei covers.openlibrary.org
     (Internet Archive, USA). Ohne Zustimmung geht keine Anfrage dorthin; die Bilder tragen nur
     data-cover, der Text-Platzhalter ist sichtbar. „Immer anzeigen" merkt sich der Browser lokal. */
  function initBuchcover() {
    var SCHLUESSEL = "pal-buchcover";
    document.querySelectorAll("[data-cover-zuruecksetzen]").forEach(function (knopf) {
      var status = document.getElementById(knopf.getAttribute("data-cover-zuruecksetzen"));
      function zeigen() {
        var an = false;
        try { an = window.localStorage.getItem(SCHLUESSEL) === "ja"; } catch (e) {}
        if (status) status.textContent = an
          ? "Derzeit gespeichert: Buchcover werden immer angezeigt."
          : "Derzeit gespeichert: nichts – Buchcover werden erst auf Klick geladen.";
      }
      knopf.addEventListener("click", function () {
        try { window.localStorage.removeItem(SCHLUESSEL); } catch (e) {}
        zeigen();
      });
      zeigen();
    });

    var bilder = document.querySelectorAll("img[data-cover]");
    if (!bilder.length) return;

    function laden() {
      bilder.forEach(function (img) {
        if (!img.getAttribute("src")) img.setAttribute("src", img.getAttribute("data-cover"));
      });
      var h = document.querySelector(".cover-hinweis");
      if (h) h.parentNode.removeChild(h);
    }

    var gemerkt = false;
    try { gemerkt = window.localStorage.getItem(SCHLUESSEL) === "ja"; } catch (e) {}
    if (gemerkt) { laden(); return; }

    var erstes = bilder[0].closest(".booklist, .person-books") || bilder[0];
    var hinweis = document.createElement("div");
    hinweis.className = "cover-hinweis";
    var p = document.createElement("p");
    p.innerHTML = "<strong>Buchcover sind ausgeblendet.</strong> Sie werden von openlibrary.org " +
      "(Internet Archive, USA) geladen – dabei erhält dieser Dienst Ihre IP-Adresse. " +
      "<a href=\"datenschutz.html#buchcover\">Mehr dazu</a>";
    var knoepfe = document.createElement("div");
    knoepfe.className = "cover-knoepfe";
    var einmal = document.createElement("button");
    einmal.type = "button";
    einmal.textContent = "Buchcover anzeigen";
    einmal.addEventListener("click", laden);
    var immer = document.createElement("button");
    immer.type = "button";
    immer.className = "zweit";
    immer.textContent = "Immer anzeigen";
    immer.addEventListener("click", function () {
      try { window.localStorage.setItem(SCHLUESSEL, "ja"); } catch (e) {}
      laden();
    });
    knoepfe.appendChild(einmal);
    knoepfe.appendChild(immer);
    hinweis.appendChild(p);
    hinweis.appendChild(knoepfe);
    erstes.parentNode.insertBefore(hinweis, erstes);
  }

  /* Sprungmarken in eingeklappte Bereiche (z. B. ältere Quartale auf nachrichten.html):
     Zeigt die Adresse auf ein Ziel innerhalb eines geschlossenen <details>, wird es geöffnet. */
  function initAnkerOeffnen() {
    function oeffnen() {
      var id = decodeURIComponent((location.hash || "").slice(1));
      if (!id) return;
      var ziel = document.getElementById(id);
      if (!ziel) return;
      var d = ziel.parentElement, geoeffnet = false;
      while (d) {
        if (d.tagName === "DETAILS" && !d.open) { d.open = true; geoeffnet = true; }
        d = d.parentElement;
      }
      if (geoeffnet) ziel.scrollIntoView();
    }
    window.addEventListener("hashchange", oeffnen);
    oeffnen();
  }

  /* ------------------------------------------------------------
     Drucken / PDF: Knopf [data-drucken] ruft den Druckdialog auf;
     vor dem Druck werden alle <details> geöffnet (danach wieder
     geschlossen) und die Seitenadresse in den Druckfuß geschrieben.
     ------------------------------------------------------------ */
  function initDrucken() {
    document.querySelectorAll("[data-drucken]").forEach(function (b) {
      b.addEventListener("click", function () { window.print(); });
    });
    var geoeffnet = [];
    window.addEventListener("beforeprint", function () {
      geoeffnet = [];
      document.querySelectorAll("details:not([open])").forEach(function (d) { d.open = true; geoeffnet.push(d); });
      document.querySelectorAll(".count-up[data-target]").forEach(function (el) {
        var raw = el.dataset.target, v = parseFloat(raw), i = raw.indexOf(".");
        if (isNaN(v)) return;
        var dez = i === -1 ? 0 : raw.length - i - 1;
        el.textContent = (el.dataset.prefix || "") + v.toLocaleString(SEITEN_LOCALE, { minimumFractionDigits: dez, maximumFractionDigits: dez }) + (el.dataset.suffix || "");
      });
      var fuss = document.querySelector(".druck-fuss");
      if (!fuss) { fuss = document.createElement("p"); fuss.className = "druck-fuss"; (document.querySelector("main") || document.body).appendChild(fuss); }
      fuss.textContent = window.location.href.split("#")[0];
    });
    window.addEventListener("afterprint", function () {
      geoeffnet.forEach(function (d) { d.open = false; });
      geoeffnet = [];
    });
  }

  function init() {
    initAnkerOeffnen();
    initBuchcover();
    initLesefortschritt();
    initKapitelband();
    initKapitelnavi();
    initExpandCards();
    initCarousels();
    initScrollReveal();
    initMegaMenu();
    initFlipCards();
    initCountUps();
    initTabs();
    initCompare();
    initLichtkasten();
    initFilter();
    initDrucken();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ================= Tatreez-Stoff als Hintergrund (23.11.2026) =================
   Übernommen von der Medical-Point-Website (eigene Gestaltung): dunkler Stoff mit
   Stickraster, Kreuzstich-Borte links und rechts, blasse Stickmotive über die Fläche,
   Spur aus Kreuzstichen bei Mausbewegung, Antippen einer freien Fläche stickt ein Motiv.
   Nichts wird gespeichert. Bei „Bewegung reduzieren“ steht alles still. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const ruhig = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPRACHE = (document.documentElement.lang || "de").slice(0, 2);
  (function stickgrund() {
    /* Dunkelblauer Stoff mit feinem Stickraster. Bewegung hinterlässt Kreuzstiche, die verblassen;
       beim Scrollen stickt sich am Rand eine Borte; Antippen setzt ein bleibendes Motiv. Nichts wird gespeichert. */
    if (document.getElementById("sterne")) return;
    const c = document.createElement("canvas"); c.id = "sterne"; c.setAttribute("aria-hidden", "true");
    document.body.insertBefore(c, document.body.firstChild);
    const ctx = c.getContext("2d");
    // Eigene Ebene für die Borte, damit Kopfbilder und breite Bänder sie nicht verdecken (Klicks gehen durch)
    const ebene = document.createElement("canvas");
    ebene.setAttribute("aria-hidden", "true");
    ebene.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:45";
    document.body.appendChild(ebene);
    const ectx = ebene.getContext("2d");
    const INHALT = 1400;
    const ROT = "#e4312b", GRUEN = "#22b067", CREME = "#f1e4c4";
    const FARBE = { r: ROT, g: GRUEN, c: CREME };
    const BORTE = ["...r...", "..rgr..", ".rgcgr.", "rgc.cgr", ".rgcgr.", "..rgr..", "...r...", ".......", "...c...", "......."];
    /*stickmotive*/ const STICKMOTIVE = [{"id":"stern-bethlehem","de":"Stern von Bethlehem","en":"Star of Bethlehem","ar":"نجمة بيت لحم","r":["......r......","...r..r..r...","....r.r.r....","...rgrgrgr...","....grgrg....",".r.rgcccgr.r.","rrrggcccggrrr",".r.rgcccgr.r.","....grgrg....","...rgrgrgr...","....r.r.r....","...r..r..r...","......r......"],"b":{"de":"Der achtzackige Stern steht für die überlieferten geometrischen Sternformen der palästinensischen Stickerei.","en":"The eight-pointed star stands for the traditional geometric star shapes of Palestinian embroidery.","ar":"النجمة الثمانية ترمز إلى أشكال النجوم الهندسية المتوارثة في التطريز الفلسطيني."}},{"id":"zypresse-gaza","de":"Zypresse","en":"Cypress","ar":"السرو","r":["......g......",".....grg.....",".....grg.....","....ggrgg....",".....grg.....","...gggrggg...","....grgrg....","..ggggrgggg..","...ggrgrgg...",".gggggrggggg.",".....crc.....",".....crc.....","....ccccc...."],"b":{"de":"Die Zypresse ist ein häufiges Baumornament und wird mit Beständigkeit verbunden.","en":"The cypress is a common tree ornament and is associated with steadfastness.","ar":"السرو زخرفة شجرية شائعة ترتبط بالثبات."}},{"id":"palme-ramallah","de":"Dattelpalme","en":"Date palm","ar":"النخلة","r":["......g......","..g...g...g..","...g..g..g...","....ggggg....",".gggggrggggg.","...gg.g.gg...","....ggrgg....","......r......",".....crc.....","......r......","......r......",".....rrr.....","....ccccc...."],"b":{"de":"Die Palme erinnert an die Landschaft und die landwirtschaftliche Kultur Palästinas.","en":"The palm recalls the landscape and agricultural culture of Palestine.","ar":"النخلة تذكّر بطبيعة فلسطين وثقافتها الزراعية."}},{"id":"orangenbluete-beit-dajan","de":"Orangenblüte","en":"Orange blossom","ar":"زهر البرتقال","r":[".............","......g......",".....gcg.....","...g.ccc.g...","....ccrcc....","..g.ccrcc.g..","..gccrrrccg..","..g.ccrcc.g..","....ccrcc....","...g.ccc.g...",".....gcg.....","......g......","............."],"b":{"de":"Die Orangenblüte verweist auf die Zitrusgärten der palästinensischen Küstenebene.","en":"The orange blossom refers to the citrus groves of the Palestinian coastal plain.","ar":"زهر البرتقال يشير إلى بساتين الحمضيات في السهل الساحلي الفلسطيني."}},{"id":"federn-hebron","de":"Federn","en":"Feathers","ar":"الريش","r":["......r......",".....rgr.....","....rgcgr....","...rgc.cgr...","..rgc...cgr..",".rgc.....cgr.","rgc.......cgr",".rgc.....cgr.","..rgc...cgr..","...rgc.cgr...","....rgcgr....",".....rgr.....","......r......"],"b":{"de":"Federartige Zacken gehören zu den naturbezogenen Stickformen der Region Hebron.","en":"Feather-like points are among the nature-inspired forms of the Hebron region.","ar":"الأشكال المسننة الشبيهة بالريش من الأشكال المستوحاة من الطبيعة في منطقة الخليل."}},{"id":"weinrebe-gaza","de":"Weinrebe","en":"Grapevine","ar":"دالية العنب","r":["......g......","....ggggg....","...g..g..g...","..g...g...g..","...r..g..r...","..rrr.g.rrr..","..rcr.g.rcr..","...r..g..r...","....g.g.g....",".....ggg.....","......g......",".....gcg.....","....ggggg...."],"b":{"de":"Die Weinrebe veranschaulicht die Bedeutung von Pflanzen und Früchten in traditionellen Motiven.","en":"The grapevine shows the importance of plants and fruit in traditional motifs.","ar":"دالية العنب تُظهر مكانة النباتات والثمار في النقوش التقليدية."}},{"id":"rose-gaza","de":"Rose","en":"Rose","ar":"الوردة","r":[".............",".....rrr.....","....rcrcr....","...rccrccr...","..rrccrccrr..","..rcccrcccr..","..rrrcrcrrr..","...rccrccr...","....rcrcr....",".....rrr.....","......g......",".....ggg.....","......g......"],"b":{"de":"Die stilisierte Rose gehört zu den Blütenformen palästinensischer Sticktraditionen.","en":"The stylised rose is one of the flower forms of Palestinian embroidery traditions.","ar":"الوردة المحوّرة من أشكال الزهور في تقاليد التطريز الفلسطيني."}},{"id":"mond-bethlehem","de":"Mond von Bethlehem","en":"Moon of Bethlehem","ar":"قمر بيت لحم","r":["......c......","...c..c..c...","....crcrc....","..ccrrgrrcc..","....rgggr....",".crrggcggrrc.","ccrggcccggrcc",".crrggcggrrc.","....rgggr....","..ccrrgrrcc..","....crcrc....","...c..c..c...","......c......"],"b":{"de":"Der Bethlehem-Mond bezeichnet eine überlieferte geometrische Stern- beziehungsweise Mondform.","en":"The Moon of Bethlehem is a traditional geometric star or moon shape.","ar":"قمر بيت لحم شكل هندسي تقليدي لنجمة أو قمر."}},{"id":"raute-hebron","de":"Raute","en":"Diamond","ar":"المعيّن","r":["......r......",".....rcr.....","....rcccr....","...rccgccr...","..rccgggccr..",".rccggcggccr.","rccgggrgggccr",".rccggcggccr.","..rccgggccr..","...rccgccr...","....rcccr....",".....rcr.....","......r......"],"b":{"de":"Rauten sind ein Grundelement vieler geometrischer palästinensischer Kreuzstichmuster.","en":"Diamonds are a basic element of many geometric Palestinian cross-stitch patterns.","ar":"المعيّن عنصر أساسي في كثير من نقوش التطريز الفلسطيني الهندسية."}},{"id":"zaehne-alte-frau","de":"Zähne der alten Frau","en":"Old woman's teeth","ar":"سنان العجوز","r":[".............","..r..r.r..r..","..rr.r.r.rr..","..rcrrrrrcr..","..rccrcrccr..","..rcrrcrrcr..","..rccrcrccr..","..rcrrcrrcr..","..rccrcrccr..","..rcrrrrrcr..","..rr.r.r.rr..","..r..r.r..r..","............."],"b":{"de":"Eine traditionelle volkstümliche Bezeichnung für gezackte, sägeähnliche Geometriemuster.","en":"A traditional folk name for jagged, saw-like geometric patterns.","ar":"اسم شعبي تقليدي للنقوش الهندسية المسننة الشبيهة بالمنشار."}},{"id":"granatapfel","de":"Granatapfel","en":"Pomegranate","ar":"الرمان","r":[".............",".....rgr.....","....rrrrr....",".....rgr.....","...rrrgrrr...","..rcccccccr..",".rcccrcrcccr.",".rcccrcrcccr.","..rcccccccr..","...rcccccr...","....rcccr....",".....rrr.....","............."],"b":{"de":"Der Granatapfel steht als Fruchtmotiv für die reichhaltige Pflanzenwelt Palästinas.","en":"As a fruit motif, the pomegranate stands for the rich plant life of Palestine.","ar":"الرمان، بوصفه نقشة ثمرية، يرمز إلى غنى الحياة النباتية في فلسطين."}},{"id":"olivenzweig","de":"Olivenzweig","en":"Olive branch","ar":"غصن الزيتون","r":[".............","......g......","...g..g..g...","..ggg.g.ggg..","...c..g..c...","....ggggg....","..gg..g..gg..","..gcg.g.gcg..","...g..g..g...","....ggggg....",".....ggg.....","......g......","............."],"b":{"de":"Der Olivenzweig verbindet das Motiv mit dem Olivenanbau und der Verbundenheit zum Land.","en":"The olive branch links the motif to olive growing and the bond with the land.","ar":"غصن الزيتون يربط النقشة بزراعة الزيتون وبالارتباط بالأرض."}},{"id":"schluessel-palaestina","de":"Schlüssel der Rückkehr","en":"Key of Return","ar":"مفتاح العودة","r":["....rrrrr....","...rr...rr...","..rr.....rr..","..r...c...r..","..rr.....rr..","...rr...rr...","....rrrrr....","......r......","......r......","....rrrrr....","....r.r.r....","....r.r.r....","....rrrrr...."],"b":{"de":"Der Schlüssel erinnert an die verlorenen Häuser palästinensischer Familien, an die Vertreibung 1948 (Nakba) und an das Recht auf Rückkehr.","en":"The key recalls the lost homes of Palestinian families, the expulsion of 1948 (Nakba) and the right of return.","ar":"يذكّر المفتاح بالبيوت التي فقدتها العائلات الفلسطينية، وبالتهجير عام 1948 (النكبة)، وبحق العودة."}}]; /*/stickmotive*/
    let dpr = 1, w = 0, h = 0, zelle = 12, bz = 10, schmal = false, stoff = null;
    let spur = [], motive = [], letzte = "", naechsteRuhe = 0, letztesMotiv = -1;

    function aufbau() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight; schmal = w < 760;
      zelle = schmal ? 10 : 12; bz = schmal ? 4 : 10;
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      ebene.width = c.width; ebene.height = c.height;
      // Stoff einmal vorzeichnen: Grundfarbe, leichtes Licht in der Mitte, Stickraster als Punkte
      stoff = document.createElement("canvas"); stoff.width = c.width; stoff.height = c.height;
      const s = stoff.getContext("2d"); s.scale(dpr, dpr);
      s.fillStyle = "#02040f"; s.fillRect(0, 0, w, h);
      const licht = s.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.75);
      licht.addColorStop(0, "rgba(22,44,130,.38)"); licht.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = licht; s.fillRect(0, 0, w, h);
      s.fillStyle = "rgba(255,255,255,.07)";
      for (let y = 0; y < h; y += zelle) for (let x = 0; x < w; x += zelle) s.fillRect(x, y, 1, 1);
    }
    function stich(x, y, farbe, alpha, gr, g = ctx) {
      const p = gr * 0.2;
      g.globalAlpha = alpha; g.strokeStyle = farbe; g.lineWidth = Math.max(1.2, gr * 0.17); g.lineCap = "round";
      g.beginPath(); g.moveTo(x + p, y + p); g.lineTo(x + gr - p, y + gr - p);
      g.moveTo(x + gr - p, y + p); g.lineTo(x + p, y + gr - p); g.stroke();
    }
    function borte() {
      // Immer vollständig links und rechts; läuft beim Scrollen wie ein Stoffband mit der Seite mit
      const muster = BORTE.length * bz;
      const versatz = ruhig ? 0 : -(scrollY % muster);
      const reihen = Math.ceil(h / bz) + BORTE.length;
      const alpha = schmal ? 0.32 : 0.5;
      const xL = schmal ? 2 : 10, xR = w - (schmal ? 2 : 10) - 7 * bz;
      // Großer Bildschirm: auf der oberen Ebene (über Bildern). Handy: hinter dem Inhalt, damit Text lesbar bleibt.
      const randFrei = Math.max(0, (w - INHALT) / 2) + Math.min(48, w * 0.05) >= 7 * bz + 14; // nur wenn neben dem Inhalt genug Platz ist, sonst hinter den Inhalt
      const g = schmal || !randFrei ? ctx : ectx;
      ectx.setTransform(1, 0, 0, 1, 0, 0); ectx.clearRect(0, 0, ebene.width, ebene.height); ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let r = 0; r < reihen; r++) {
        const zeile = BORTE[r % BORTE.length], y = versatz + r * bz;
        if (y > h) break;
        for (let k = 0; k < 7; k++) {
          const f = zeile[k]; if (f === ".") continue;
          stich(xL + k * bz, y, FARBE[f], alpha, bz, g);
          stich(xR + k * bz, y, FARBE[f], alpha, bz, g);
        }
      }
      ectx.globalAlpha = 1;
    }
    function zeichne(jetzt) {
      if (!w || !h || !stoff.width || innerWidth !== w || innerHeight !== h) aufbau(); // z. B. Fenster war beim Laden noch unsichtbar
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.drawImage(stoff, 0, 0, w, h);
      borte();
      // bleibende Motive (wandern mit der Seite)
      for (const m of motive) {
        const mz = m.mz || (schmal ? 7 : 9), halb = (m.groesse * mz) / 2;
        const x0 = m.x - halb, y0 = m.y - scrollY - halb;
        if (y0 < -m.groesse * mz - 40 || y0 > h + 20) continue;
        if (m.t0 === null) m.t0 = jetzt; // feste Motive sticken sich ein, sobald man hinscrollt
        const sichtbar = ruhig ? 1e9 : (jetzt - m.t0) / 22; // Stich für Stich, von der Mitte nach außen
        for (let i = 0; i < m.zellen.length && i <= sichtbar; i++) {
          const [k, r, f] = m.zellen[i];
          stich(x0 + k * mz, y0 + r * mz, FARBE[f], m.alpha || 0.92, mz);
        }
        if (m.fest) continue;
        // Name des Motivs kurz darunter einblenden
        const alter = jetzt - m.t0;
        const na = ruhig ? 0 : alter < 600 ? alter / 600 : alter < 3200 ? 1 : Math.max(0, 1 - (alter - 3200) / 1200);
        if (na > 0) {
          ctx.globalAlpha = na; ctx.fillStyle = CREME; ctx.textAlign = "center";
          ctx.font = `600 ${schmal ? 12 : 13}px system-ui, "Segoe UI", Tahoma, sans-serif`;
          ctx.fillText(m.name, m.x, y0 + m.groesse * mz + 18);
        }
      }
      // Spur und leise Zufallsstiche verblassen
      spur = spur.filter((s) => jetzt - s.t0 < s.dauer);
      for (const s of spur) {
        const t = Math.max(0, (jetzt - s.t0) / s.dauer);
        stich(s.x, s.y, s.f, s.a * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88), zelle);
      }
      ctx.globalAlpha = 1;
    }
    function lauf() {
      const jetzt = performance.now(); // gleiche Uhr wie bei den Stichen
      if (!document.hidden) {
        if (jetzt > naechsteRuhe) { // ab und zu ein leiser Stich irgendwo
          naechsteRuhe = jetzt + 650 + Math.random() * 700;
          spur.push({ x: Math.floor(Math.random() * w / zelle) * zelle, y: Math.floor(Math.random() * h / zelle) * zelle,
            f: [ROT, GRUEN, CREME][Math.floor(Math.random() * 3)], t0: jetzt, dauer: 4200, a: 0.45 });
        }
        zeichne(jetzt);
      }
      requestAnimationFrame(lauf); // (zeichne fängt eine leere Zeichenfläche selbst ab)
    }
    const farbeZufall = () => (Math.random() < 0.45 ? ROT : Math.random() < 0.6 ? GRUEN : CREME);
    if (!ruhig) {
      addEventListener("pointermove", (e) => {
        const x = Math.floor(e.clientX / zelle) * zelle, y = Math.floor(e.clientY / zelle) * zelle, key = x + "," + y;
        if (key === letzte) return; letzte = key;
        spur.push({ x, y, f: farbeZufall(), t0: performance.now(), dauer: 2600, a: 0.85 });
        if (spur.length > 400) spur.splice(0, spur.length - 400);
      }, { passive: true });
    }
    // Antippen auf freie Fläche (nicht auf Knöpfe, Links, Karten …) setzt ein bleibendes Motiv
    addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !e.target.closest || e.target.closest("a, button, input, textarea, select, summary, details, video, iframe, dialog, label, img, svg, canvas:not(#sterne), table, .btn, .card, .callout, .merksatz, .tile, .doc, .event, .lernkarte, .flipcard, nav, header, footer, p, li, h1, h2, h3, h4, blockquote, figure")) return;
      // zufälliges Motiv, nicht zweimal hintereinander dasselbe
      const pool = STICKMOTIVE.map((_, i) => i).filter((i) => i !== letztesMotiv);
      const wahl = pool[Math.floor(Math.random() * pool.length)];
      letztesMotiv = wahl;
      const vorlage = STICKMOTIVE[wahl];
      motive.push({ x: e.clientX, y: e.clientY + scrollY, t0: performance.now(), zellen: zellenVon(vorlage), groesse: vorlage.r.length, name: vorlage[SPRACHE] || vorlage.de });
      const eigene = motive.filter((m) => !m.fest);
      if (eigene.length > 40) motive.splice(motive.indexOf(eigene[0]), 1);
      if (ruhig) zeichne(performance.now());
    });

    /* ---------- Feste Motive: von Anfang an verteilt, abwechselnd links und rechts neben dem Inhalt ---------- */
    function feste() {
      motive = motive.filter((m) => !m.fest);
      const mz = 9, gr = 13 * mz, randEnde = 10 + 7 * bz + 18;
      const frei = Math.max(0, (w - INHALT) / 2) - randEnde;     // Platz zwischen Borte und Inhalt
      const genug = frei >= gr + 20;
      const xL = randEnde + (genug ? frei / 2 : gr / 2 + 6), xR = w - xL;
      const hoehe = document.documentElement.scrollHeight;
      let samen = 0; for (const z of location.pathname) samen = (samen * 31 + z.charCodeAt(0)) % 997; // jede Seite etwas anders
      let i = 0;
      for (let y = 380; !schmal && y < hoehe - 260; y += 540, i++) { // kräftige Motive am Rand nur auf größeren Bildschirmen
        const links = i % 2 === 0, vorlage = STICKMOTIVE[(samen + i * 5) % STICKMOTIVE.length];
        motive.push({ x: links ? xL : xR, y: y + (links ? 0 : 170), t0: null, fest: true, alpha: genug ? 0.85 : 0.4,
          zellen: zellenVon(vorlage), groesse: vorlage.r.length, name: "" });
      }
      // Viele kleine, verblasste Ornamente über die ganze Fläche (auch hinter dem Inhalt, auch auf dem Handy)
      let z = samen + 7;
      const zufall = () => ((z = (z * 9301 + 49297) % 233280) / 233280);
      const innen = (schmal ? 34 : 10 + 7 * bz + 24), abstand = schmal ? 230 : 260;
      for (let y = 140; y < hoehe - 80; y += abstand) {
        const proReihe = schmal ? 1 : w > 1300 ? 3 : 2;
        for (let s = 0; s < proReihe; s++) {
          const breite = (w - 2 * innen) / proReihe;
          const vorlage = STICKMOTIVE[Math.floor(zufall() * STICKMOTIVE.length)];
          const mz = schmal ? 4 : 5 + Math.floor(zufall() * 2);   // klein: 4–6 Pixel je Stich
          motive.push({ x: innen + breite * s + breite * (0.2 + zufall() * 0.6), y: y + zufall() * (abstand * 0.6),
            t0: null, fest: true, mz, alpha: (schmal ? 0.18 : 0.22) + zufall() * 0.1,
            zellen: zellenVon(vorlage), groesse: vorlage.r.length, name: "" });
        }
      }
    }

    function zellenVon(vorlage) {
      const n = vorlage.r.length, mitte = (n - 1) / 2, zellen = [];
      vorlage.r.forEach((zeile, r) => [...zeile].forEach((f, k) => { if (f !== ".") zellen.push([k, r, f]); }));
      return zellen.sort((a, b) => Math.hypot(a[0] - mitte, a[1] - mitte) - Math.hypot(b[0] - mitte, b[1] - mitte));
    }

    aufbau();
    feste();
    addEventListener("load", feste);   // erst wenn Bilder geladen sind, stimmt die Seitenhöhe
    addEventListener("resize", () => { aufbau(); feste(); if (ruhig) zeichne(performance.now()); });
    if (ruhig) { zeichne(performance.now()); addEventListener("scroll", () => zeichne(performance.now()), { passive: true }); }
    else requestAnimationFrame(lauf);
  })();
})();

/* ================= Fußzeile (22.11.2026) =================
   Auf schmalen Bildschirmen sind die Linkgruppen der Fußzeile beim Laden
   zugeklappt (Akkordeon); auf breiten bleiben sie offen. */
(function fusszeile() {
  "use strict";
  if (!window.matchMedia("(max-width: 759px)").matches) return;
  document.querySelectorAll("footer details.fg[open]").forEach(function (d) { d.open = false; });
})();

/* ================= Suche in der oberen Leiste (22.11.2026) =================
   Vorgabe: Suche oben, nicht im Menü – wie auf üblichen Websites. Das Feld
   wird hier in die Leiste eingesetzt, damit keine Seite einzeln angepasst
   werden muss. Auf schmalen Bildschirmen erst nur die Lupe; ein Tipp klappt
   das Feld unter der Leiste auf. Ergebnisse zeigt suche.html (?q=…). */
(function obenSuche() {
  "use strict";
  var leiste = document.querySelector("nav.topnav .inner");
  if (!leiste || leiste.querySelector(".top-suche")) return;
  var sprache = (document.documentElement.lang || "de").slice(0, 2);
  var T = {
    de: { ph: "Website durchsuchen …", knopf: "Suchen", lupe: "Suche öffnen" },
    en: { ph: "Search the site …", knopf: "Search", lupe: "Open search" },
    es: { ph: "Buscar en el sitio …", knopf: "Buscar", lupe: "Abrir búsqueda" }
  }[sprache] || null;
  if (!T) T = { ph: "Website durchsuchen …", knopf: "Suchen", lupe: "Suche öffnen" };
  var lupeSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var form = document.createElement("form");
  form.className = "top-suche"; form.setAttribute("role", "search");
  form.action = "suche.html"; form.method = "get";
  form.innerHTML =
    '<button type="button" class="ts-lupe" aria-label="' + T.lupe + '" aria-expanded="false">' + lupeSvg + '</button>' +
    '<input type="search" name="q" placeholder="' + T.ph + '" aria-label="' + T.ph + '" autocomplete="off">' +
    '<button type="submit" class="ts-los" aria-label="' + T.knopf + '">' + lupeSvg + '</button>';
  leiste.appendChild(form);
  var feld = form.querySelector("input");
  try { var q = new URL(window.location.href).searchParams.get("q"); if (q && /suche(\.html)?\/?$/.test(location.pathname)) feld.value = q; } catch (e) {}
  var lupe = form.querySelector(".ts-lupe");
  lupe.addEventListener("click", function () {
    var offen = form.classList.toggle("offen");
    lupe.setAttribute("aria-expanded", offen ? "true" : "false");
    if (offen) feld.focus();
  });
  form.addEventListener("submit", function (e) { if (!feld.value.trim()) { e.preventDefault(); feld.focus(); } });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && form.classList.contains("offen")) { form.classList.remove("offen"); lupe.setAttribute("aria-expanded", "false"); lupe.focus(); }
  });
})();

/* ================= Lange Kästen in Rastern kürzen (23.11.2026) =================
   Vorgabe: keine langen Textblöcke nebeneinander. Kästen in .duo/.trio/.bento/
   .split-inhalt, die höher als HOEHE sind, werden gekürzt und bekommen einen
   Knopf „Weiterlesen“. Kernaussage-Abschnitte bleiben offen; Druck und Sprung-
   ziele (#anker) öffnen sie. */
(function kaestenKuerzen() {
  "use strict";
  var HOEHE = 300;
  var lang = (document.documentElement.lang || "de").slice(0, 2);
  var T = { de: ["Weiterlesen", "Weniger anzeigen"], en: ["Read more", "Show less"], es: ["Seguir leyendo", "Mostrar menos"] }[lang] || ["Weiterlesen", "Weniger anzeigen"];
  var sel = ".duo > .callout, .trio > .callout, .bento > .callout, .split-inhalt > .callout, " +
            ".duo > .card, .trio > .card, .duo > .steckbrief, .trio > .steckbrief";
  var kaesten = [].slice.call(document.querySelectorAll(sel)).filter(function (k) {
    return !k.closest("#kernaussage, #einordnung, #kern, header, footer, nav");
  });
  function zu(k, b) { k.classList.add("gekuerzt"); b.textContent = T[0]; b.setAttribute("aria-expanded", "false"); }
  function auf(k, b) { k.classList.remove("gekuerzt"); b.textContent = T[1]; b.setAttribute("aria-expanded", "true"); }
  kaesten.forEach(function (k) {
    if (k.querySelector("details") || k.scrollHeight <= HOEHE + 80) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "kasten-mehr";
    k.insertAdjacentElement("afterend", b);
    var huelle = document.createElement("div"); huelle.className = "kasten-huelle";
    k.parentNode.insertBefore(huelle, k); huelle.appendChild(k); huelle.appendChild(b);
    zu(k, b);
    if (k.scrollHeight - k.clientHeight < 60) { k.classList.remove("gekuerzt"); huelle.parentNode.insertBefore(k, huelle); huelle.remove(); return; }
    b.addEventListener("click", function () { k.classList.contains("gekuerzt") ? auf(k, b) : zu(k, b); });
  });
  function zielOeffnen() {
    if (!location.hash) return;
    var z = null; try { z = document.querySelector(decodeURIComponent(location.hash)); } catch (e) {}
    var k = z && z.closest(".gekuerzt");
    if (k) { var b = k.parentNode.querySelector(".kasten-mehr"); if (b) auf(k, b); }
  }
  zielOeffnen(); window.addEventListener("hashchange", zielOeffnen);
  window.addEventListener("beforeprint", function () { document.querySelectorAll(".gekuerzt").forEach(function (k) { k.classList.add("druck-offen"); }); });
  window.addEventListener("afterprint", function () { document.querySelectorAll(".druck-offen").forEach(function (k) { k.classList.remove("druck-offen"); }); });
})();
