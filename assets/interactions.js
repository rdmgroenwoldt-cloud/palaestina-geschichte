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
    var openTimer = null;
    var closeTimer = null;

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
      ausrichten(group);
    }

    /* Mehrspaltige Panels koennen am rechten Bildrand anstossen. Dann wird das
       Panel rechtsbuendig unter den Knopf gelegt, statt aus dem Bild zu laufen. */
    function ausrichten(group) {
      var panel = group.querySelector(".mm-panel");
      if (!panel || window.innerWidth <= 760) { return; }
      panel.classList.remove("nach-links");
      var r = panel.getBoundingClientRect();
      if (r.right > window.innerWidth - 12) {
        panel.classList.add("nach-links");
      }
    }

    /* Auch geschlossene Panels stehen im Layout an ihrer Position. Ragt eines
       ueber den rechten Fensterrand, entsteht ein waagerechter Scrollbalken.
       Deshalb wird die Ausrichtung fuer alle Gruppen berechnet, nicht erst
       beim Oeffnen. */
    function alleAusrichten() {
      groups.forEach(ausrichten);
    }
    alleAusrichten();

    window.addEventListener("resize", function () {
      alleAusrichten();
    });

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

      // Hover mit Verzögerung – nur auf Desktop-Breiten aktiv. Touch-Geräte
      // lösen kein mouseenter/mouseleave aus, dort greift ausschließlich der
      // Klick-Handler oben.
      group.addEventListener("mouseenter", function () {
        if (!mqDesktop.matches) return;
        window.clearTimeout(closeTimer);
        openTimer = window.setTimeout(function () { openGroup(group); }, 120);
      });
      group.addEventListener("mouseleave", function () {
        if (!mqDesktop.matches) return;
        window.clearTimeout(openTimer);
        closeTimer = window.setTimeout(function () { closeGroup(group); }, 200);
      });
    });

    // Escape schließt das offene Panel und gibt den Fokus an dessen Button zurück.
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      var openGroupEl = groups.filter(function (g) { return g.classList.contains("open"); })[0];
      if (openGroupEl) {
        closeGroup(openGroupEl);
        var btn = openGroupEl.querySelector(".nl-trigger");
        if (btn) btn.focus();
      }
    });

    // Klick außerhalb des gesamten Menüs schließt alle offenen Panels.
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) closeAllGroups();
    });

    // Mobile: Hamburger klappt die gesamte Linkliste auf/zu; Kategorien
    // bleiben darin als eigene Akkordeons per Klick bedienbar (s. oben).
    if (burger && navLinks) {
      burger.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("mm-mobile-open");
        burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (!isOpen) closeAllGroups();
      });
      // Ein Klick auf einen echten Link (Start oder eine Unterseite) navigiert
      // ohnehin weg – das mobile Menü sauber mitschließen, falls die Seite
      // z. B. per Zurück-Button erneut sichtbar wird.
      navLinks.querySelectorAll("a.nl, .mm-item").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("mm-mobile-open");
          burger.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Beim Überschreiten der Breakpoint-Grenze (z. B. Fenster-Resize,
    // Rotation) alle offenen Zustände zurücksetzen, damit nichts hängen bleibt.
    var handleBreakpointChange = function () {
      closeAllGroups();
      nav.classList.remove("mm-mobile-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
    };
    if (typeof mqDesktop.addEventListener === "function") {
      mqDesktop.addEventListener("change", handleBreakpointChange);
    } else if (typeof mqDesktop.addListener === "function") {
      mqDesktop.addListener(handleBreakpointChange); // ältere Browser (Safari < 14)
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

      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", "false");

      function toggle() {
        var flipped = card.classList.toggle("flipped");
        card.setAttribute("aria-pressed", flipped ? "true" : "false");
      }

      card.addEventListener("click", function (e) {
        // Echte Links auf der Karte sollen normal navigieren, nicht flippen.
        if (e.target.closest && e.target.closest("a")) return;
        toggle();
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          toggle();
        }
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
      var text = value.toLocaleString("de-DE", {
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

  function init() {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
