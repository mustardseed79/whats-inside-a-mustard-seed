(function () {
  "use strict";
  const BOOK = window.BOOK;
  const BY = Object.assign(Object.create(null), Object.fromEntries(BOOK.map(r => [r.slug, r])));
  const $ = (s, el = document) => el.querySelector(s);
  const main = $("#main");
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = s => String(s || "").replace(/<[^>]+>/g, "");

  // ---------------- Table of contents structure ----------------
  const CATS = [
    { id: "Coffee", title: "Coffee" },
    { id: "Meats", title: "Meats", subs: ["Beef", "Bison", "Chicken"],
      empty: ["Lamb", "Goat", "Venison", "Turkey", "Duck and Goose", "Dove", "Quail", "Chukar", "Fish", "Meatless"] },
    { id: "Soups", title: "Soups" },
    { id: "Vegetables", title: "Vegetables" },
    { id: "Desserts", title: "Desserts" },
    { id: "Snacks", title: "Snacks and Appetizers" },
    { id: "Sauces", title: "Sauces" },
    { id: "Feasts", title: "Feasts" }
  ];
  // Way-of-eating sections. A recipe is listed only when the card itself fits as written.
  const DIETS = [
    { id: "carnivore", title: "Carnivore", blurb: "Meat, fish, eggs, and animal fats, seasoned with salt. Every recipe here still follows the clean rules of this book.", slugs: [] },
    { id: "keto", title: "Keto", blurb: "Very low carb, with most of the energy from fat and protein. Look for the net-carb estimate on each recipe.", slugs: ["savory-food-such-as-i-love"] },
    { id: "carnivore-keto", title: "Carnivore Keto", blurb: "Animal foods only, kept fatty and close to zero carb. The strictest of the three.", slugs: [] }
  ];
  // Quick finders on the home page. Lists are hand-picked from each card's stated time and servings.
  const FINDERS = [
    { id: "quick", title: "Quick Meals", note: "45 minutes or less", blurb: "Recipes with a stated total time of 45 minutes or less, plus the coffee drinks.",
      slugs: ["manna-in-the-morning", "morning-by-morning", "my-cup-overflows", "heritage", "with-joy", "banner-of-love", "every-bitter-thing-is-sweet", "satisfy-every-living-thing", "food-for-her-household", "come-here-and-eat"] },
    { id: "crowd", title: "Feeds a Crowd", note: "10 or more servings", blurb: "Big batches for family gatherings, potlucks, and feast days.",
      slugs: ["a-portion-for-seven", "savory-food-such-as-i-love", "answer-me-speedily", "wait-patiently", "food-for-her-household", "taste-and-see", "rejoice-seven-days"] },
    { id: "ahead", title: "Make Ahead", note: "Prep early, serve later", blurb: "Recipes that chill, slow cook, or rest, so most of the work is done before guests arrive.",
      slugs: ["savory-food-such-as-i-love", "a-portion-for-seven", "wait-patiently", "taste-and-see", "fruit-in-its-season", "garden-of-spices", "good-land", "sweeter-than-honey", "majestic-trees", "park-of-pomegranates"] }
  ];
  // HaMotzi, the family's blessing before every meal (text supplied by Alexis)
  const HAMOTZI = `<div class="blessing">
      <p class="bl-he" lang="he" dir="rtl">בָּרוּךְ אַתָּה יהוה, אֱלֹהֵינוּ, מֶלֶךְ הָעוֹלָם, הַמוֹצִיא לֶחֶם מִן הַאָרֶץ, וְהוֹצִיא יֵשׁוּעַ הַמַשִׁיחַ מִן הָשְׁאוֹל.</p>
      <p class="bl-tr">Barukḥ Atah <bdi lang="he">יהוה</bdi>, Eloheinu, Melekḥ HaOlam, hamotzi lekḥem min ha’aretz, v’hotzi Yeshua HaMashi'akḥ min ha'she’ol.</p>
      <p class="bl-en">Blessed are You, O <bdi lang="he">יהוה</bdi> our Elohim, King of the Universe, who brings forth bread from the earth, and who brought forth Messiah Yeshua from the grave.</p>
    </div>`;
  const NEWEST = "eat-with-joy";
  const dietsOf = slug => DIETS.filter(d => d.slugs.includes(slug)).map(d => d.title);

  // ---------------- nutrition helpers ----------------
  const NK = ["cal", "fat", "sat", "carb", "fiber", "sugar", "protein", "sodium"];
  function batchTotals(R, scale, opts) {
    const t = Object.fromEntries(NK.map(k => [k, 0]));
    (R.groups || []).forEach(g => {
      if (g.option && opts && !opts[g.option]) return;
      g.items.forEach(it => {
        if (!it.n || (it.option && opts && !opts[it.option])) return;
        NK.forEach(k => (t[k] += (it.n[k] || 0) * scale));
      });
    });
    return t;
  }
  function perServing(R) {
    const opts = {}; (R.options || []).forEach(o => (opts[o.id] = o.default));
    const t = batchTotals(R, 1, opts);
    return Object.fromEntries(NK.map(k => [k, t[k] / R.base]));
  }

  // ---------------- HOME / TABLE OF CONTENTS ----------------
  const home = { q: "", cat: "all" };
  function recipeRow(r) {
    const ps = r.groups ? perServing(r) : null;
    const tags = dietsOf(r.slug);
    const meta = [];
    if (r.time) meta.push(esc(strip(r.time).replace(/\.$/, "")));
    if (r.servingsText) meta.push(esc(strip(r.servingsText)));
    return `<li><a class="toc-row" href="#/${r.slug}">
      <img src="assets/thumbs/${r.slug}.jpg" alt="" loading="lazy" width="84" height="84">
      <span class="toc-text">
        <span class="toc-scr">${esc(r.scripture)}</span>
        <span class="toc-dish">${esc(r.dish)}</span>
        <span class="toc-meta">${meta.slice(0, 1).join(" · ")}${ps ? `${meta.length ? " · " : ""}about ${Math.round(ps.cal / 10) * 10} cal per serving` : ""}</span>
        ${tags.length ? `<span class="toc-tags">${tags.map(t => `<span class="tag">${t}</span>`).join("")}</span>` : ""}
      </span>
      <span class="toc-ref">${esc(r.verse.ref)}</span>
    </a></li>`;
  }
  function matches(r) {
    const q = home.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [r.scripture, r.dish, r.subtitle, r.cat, r.sub, r.verse && r.verse.ref, ...(r.groups || []).flatMap(g => g.items.map(i => i.text || (i.q && i.q.rest)))].map(strip).join(" ").toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  function renderHome() {
    document.title = "What's Inside a Mustard Seed? | Recipe Book";
    $("#tb-toc").hidden = true;
    const chips = [["all", "All"], ...CATS.map(c => [c.id, c.title === "Snacks and Appetizers" ? "Snacks" : c.title]), ...DIETS.map(d => [d.id, d.title])];
    main.innerHTML = `
    <div class="page home">
      <header class="masthead">
        <div class="rule"></div>
        <img class="emblem big" src="assets/emblem.png" alt="What's Inside a Mustard Seed? emblem" width="200" height="200">
        <h1 class="book-title">What's Inside a Mustard Seed?</h1>
        <p class="subtitle">Clean-eating recipes, each named from The Word of <span lang="he">יהוה</span></p>
        <p class="home-count">${BOOK.length} pages · scale any recipe · check off steps · print a card</p>
      </header>
      <section class="start no-print" aria-labelledby="start-h">
        <h2 id="start-h">Welcome to the Staton Family Kitchen</h2>
        <p class="start-lead">This isn't one woman's recipe box. It's our whole family's kitchen. Kevin is a flat-out fantastic cook (yes, I'll say it out loud), my son Wyatt loves to get in there and cook right alongside us, and I'm usually the one writing it all down. These are the recipes we make together, the ones we fight over the last bite of, and the stories of everything that went sideways along the way. Every recipe follows the clean food rules of Leviticus 11, and every name comes from The Word of <span lang="he">יהוה</span>. <a href="#/about">A little about me</a></p>
        <details class="howto"${store && store.getItem("ms-tips") === "closed" ? "" : " open"}>
          <summary>How to use this book</summary>
          <ol class="tips">
            <li><b>Open a recipe.</b> Tap any picture or name below.</li>
            <li><b>Change the amount.</b> Pick more or fewer servings, and every ingredient updates for you.</li>
            <li><b>Cook along.</b> Tap ingredients and steps to check them off. Timers start right from the step.</li>
            <li><b>Print a card.</b> Each recipe prints as a 5x7 card or a full page.</li>
            <li><b>Keep it on your phone.</b> In your browser menu, choose Add to Home screen.</li>
          </ol>
        </details>
        <details class="howto bless-home">
          <summary>Our blessing before every meal</summary>
          <h3 class="bl-h">HaMotzi</h3>
          ${HAMOTZI}
        </details>
        ${BY[NEWEST] ? `<div class="newest"><p class="eyebrow">Newest recipe</p><ul class="toc-list">${recipeRow(BY[NEWEST])}</ul></div>` : ""}
        <h3 class="qf-h">Quick finders</h3>
        <div class="qf" role="group" aria-label="Quick finders">${FINDERS.map(f => `<button type="button" class="qf-btn fchip-like" data-cat="${f.id}" aria-pressed="${home.cat === f.id}"><span class="qf-t">${f.title}</span><span class="qf-n">${f.note} · ${f.slugs.filter(x => BY[x]).length} recipes</span></button>`).join("")}</div>
      </section>
      <div class="finder no-print" role="search">
        <label class="search"><span class="sr-only">Search recipes</span>
          <input id="q" type="search" placeholder="Search by name, verse, or ingredient" value="${esc(home.q)}" autocomplete="off">
        </label>
        <div class="filters" role="group" aria-label="Filter by section">${chips.map(([id, t]) => `<button type="button" class="fchip" data-cat="${id}" aria-pressed="${home.cat === id}">${t}</button>`).join("")}</div>
      </div>
      <div id="toc"></div>
      <footer class="foot"><div class="rule"></div><p class="dedication">For my family, and for every family who pulls up a chair.</p><p>What's Inside a Mustard Seed?</p></footer>
    </div>`;
    const q = $("#q");
    q.addEventListener("input", () => { home.q = q.value; renderToc(); });
    renderToc();
  }
  function renderToc() {
    const out = [];
    let shown = 0;
    const want = id => home.cat === "all" || home.cat === id;
    const F = FINDERS.find(f => f.id === home.cat);
    if (F) {
      const rs = F.slugs.map(x => BY[x]).filter(Boolean).filter(matches);
      $("#toc").innerHTML = `<section class="toc-cat" id="cat-${F.id}"><h2>${F.title}</h2><p class="diet-blurb">${F.blurb}</p>
        ${rs.length ? `<ul class="toc-list">${rs.map(recipeRow).join("")}</ul>` : `<p class="no-results">Nothing in ${F.title} matches “${esc(home.q)}”.</p>`}
        <p class="qf-back"><button type="button" class="link-btn fchip-reset" data-cat="all">Show all recipes</button></p></section>`;
      return;
    }
    CATS.forEach(c => {
      if (!want(c.id)) return;
      const rs = BOOK.filter(r => r.cat === c.id && matches(r));
      if (!rs.length && home.q) return;
      shown += rs.length;
      let body = "";
      if (c.subs) {
        c.subs.forEach(s => {
          const sr = rs.filter(r => r.sub === s);
          if (sr.length) body += `<h3 class="toc-sub">${s}</h3><ul class="toc-list">${sr.map(recipeRow).join("")}</ul>`;
        });
        if (!home.q) body += `<p class="toc-empty">Folders waiting for recipes: ${c.empty.join(" · ")}</p>`;
      } else {
        const groups = {};
        rs.forEach(r => { (groups[r.sub || ""] = groups[r.sub || ""] || []).push(r); });
        Object.entries(groups).forEach(([s, list]) => {
          if (s) body += `<h3 class="toc-sub">${s}</h3>`;
          body += `<ul class="toc-list">${list.map(recipeRow).join("")}</ul>`;
        });
      }
      out.push(`<section class="toc-cat" id="cat-${c.id}"><h2>${c.title}</h2>${body}</section>`);
    });
    // Ways of eating
    const dietBlocks = DIETS.filter(d => want(d.id)).map(d => {
      const rs = d.slugs.map(s => BY[s]).filter(Boolean).filter(matches);
      if (!rs.length && home.q) return "";
      shown += rs.length;
      return `<div class="diet" id="cat-${d.id}"><h3 class="toc-sub">${d.title}</h3><p class="diet-blurb">${d.blurb}</p>
        ${rs.length ? `<ul class="toc-list">${rs.map(recipeRow).join("")}</ul>` : `<p class="toc-empty">No recipes in this section yet. New ${d.title.toLowerCase()} recipes will be filed here.</p>`}</div>`;
    }).join("");
    if (dietBlocks) out.push(`<section class="toc-cat"><h2>Ways of Eating</h2>${dietBlocks}</section>`);
    $("#toc").innerHTML = out.join("") || "";
    if (!shown && home.q) $("#toc").innerHTML = `<p class="no-results">Nothing matches “${esc(home.q)}”. Try an ingredient like “bison” or “honey”.</p>`;
  }
  document.addEventListener("toggle", e => {
    if (e.target.classList && e.target.classList.contains("howto") && store) store.setItem("ms-tips", e.target.open ? "open" : "closed");
  }, true);
  document.addEventListener("click", e => {
    const f = e.target.closest(".fchip, .qf-btn, .fchip-reset");
    if (f) {
      home.cat = f.dataset.cat;
      document.querySelectorAll(".fchip, .qf-btn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === home.cat)));
      renderToc();
      if (!f.classList.contains("fchip")) { const t = $(".finder"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  });

  // ---------------- RECIPE PAGE ----------------
  const FR = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""]];
  function nice(v, allowed) {
    const whole = Math.floor(v), rem = v - whole;
    let best = FR[0], bd = 9;
    FR.filter(f => !allowed || allowed.includes(f[1]) || f[0] === 0 || f[0] === 1).forEach(f => { const d = Math.abs(rem - f[0]); if (d < bd) { bd = d; best = f; } });
    const w = best[0] === 1 ? whole + 1 : whole;
    const val = w + (best[0] === 1 ? 0 : best[0]);
    const str = (w ? w : "") + (best[1] && best[0] !== 1 ? best[1] : "");
    return { str: str || (v > 0 ? "⅛" : "0"), val: val || 0.125 };
  }
  const niceEach = v => (v >= 3 ? { str: String(Math.round(v)), val: Math.round(v) } : nice(v, ["¼", "½", "¾"]));
  const plural = (n, s, p) => (n > 1 ? p : s);
  const PL = { cup: "cups", tablespoon: "tablespoons", teaspoon: "teaspoons", pound: "pounds", ounce: "ounces", clove: "cloves", can: "cans", slice: "slices",
    sprig: "sprigs", sheet: "sheets", packet: "packets", package: "packages", box: "boxes", bunch: "bunches", head: "heads", "big handful": "big handfuls",
    handful: "handfuls", log: "logs", container: "containers", "small box": "small boxes" };
  const SG = Object.fromEntries(Object.entries(PL).map(([a, b]) => [b, a]));
  function unitWord(uw, n) {
    if (!uw || uw === "lb" || uw === "oz" || uw === "tbsp" || uw === "tsp") return uw;
    if (n > 1) return PL[uw] || uw;
    return SG[uw] || uw;
  }
  function smart(kind, v, units) {
    if (kind === "vol" && v > 0 && v < 0.0625) return "a pinch of";
    if (units === "metric") {
      if (kind === "vol") { const ml = v * 4.929; const r = ml < 5 ? Math.round(ml * 2) / 2 : ml < 30 ? Math.round(ml) : Math.round(ml / 5) * 5; return r + " ml"; }
      if (kind === "wt") { const g = v * 28.35; return (g >= 1000 ? (Math.round(g / 50) * 50 / 1000).toFixed(2).replace(/\.?0+$/, "") + " kg" : Math.round(g / 5) * 5 + " g"); }
    }
    if (kind === "vol") {
      if (v >= 12) { const c = nice(v / 48, ["¼", "⅓", "½", "⅔", "¾"]); if (Math.abs(c.val * 48 - v) <= 0.08 * v) return c.str + " " + plural(c.val, "cup", "cups"); }
      if (v >= 3) { const n = nice(Math.round((v / 3) * 2) / 2, ["½"]); return n.str + " " + plural(n.val, "tablespoon", "tablespoons"); }
      const t = nice(v, ["⅛", "¼", "½", "¾"]); return t.str + " " + plural(t.val, "teaspoon", "teaspoons");
    }
    if (kind === "wt") {
      if (v >= 16) { const p = nice(v / 16, ["¼", "½", "¾"]); return p.str + " " + plural(p.val, "pound", "pounds"); }
      const n = nice(v >= 4 ? Math.round(v) : Math.round(v * 2) / 2, ["½"]); return n.str + " " + plural(n.val, "ounce", "ounces");
    }
    return nice(v).str;
  }
  function rangeIn(kind, uw, f, a, b, units) {
    if (units === "metric" && kind !== "each") {
      const one = v => smart(kind, v * f, "metric");
      const x = one(a), y = one(b), ux = x.split(" ")[1];
      return x.split(" ")[0] + "–" + y.split(" ")[0] + " " + (y.split(" ")[1] || ux);
    }
    if (kind === "vol" && f) {
      const A = a * f, B = b * f;
      const [d, fr, s1, s2] = B >= 12 ? [48, ["¼", "⅓", "½", "⅔", "¾"], "cup", "cups"] : B >= 3 ? [3, ["½"], "tablespoon", "tablespoons"] : [1, ["⅛", "¼", "½", "¾"], "teaspoon", "teaspoons"];
      const x = nice(A / d, fr), y = nice(B / d, fr);
      return (x.str === y.str ? y.str : x.str + "–" + y.str) + " " + plural(y.val, s1, s2);
    }
    const nf = kind === "each" ? niceEach : nice, na = nf(a), nb = nf(b);
    if (na.str === nb.str) return nb.str + (uw ? " " + unitWord(uw, nb.val) : "");
    return na.str + "–" + nb.str + (uw ? " " + unitWord(uw, nb.val) : "");
  }
  function pluralHead(rest) {
    if (/^\(/.test(rest)) return rest.replace(/^(\([^)]*\)\s*)([A-Za-z]+)/, (m, a, w) => a + (/(ch|sh|x)$/i.test(w) ? w + "es" : w + "s"));
    return rest.replace(/^((?:\([^)]*\)\s*)?[^,(]*?)([A-Za-z]+)(?=\s*(?:[,(]|$))/, (m, a, w) => {
      if (/s$/i.test(w) || /^(zucchini|salt)$/i.test(w)) return m;
      return a + (/(ch|sh|x)$/i.test(w) ? w + "es" : w + "s");
    });
  }
  function ingLine(it, scale, units) {
    const q = it.q;
    if (it.plain || !q || it.fixed) return { qty: "", rest: it.text };
    if (it.anchor && R && R.meat) {
      if (scale === 1 && units === "us") return { qty: "", rest: it.text, orig: true };
      return { qty: fmtW(R.meat.baseLb * scale, units), rest: it.atext };
    }
    if (q.kind === "each" && q.wt && q.hi == null) { const c = canLine(q, q.lo * scale, units); if (c) return c; }
    if (scale === 1 && units === "us" && !q.smart) return { qty: "", rest: it.text, orig: true };
    let qty;
    if (q.hi != null) {
      qty = rangeIn(q.kind, q.uw, q.f, q.lo * scale, q.hi * scale, units);
      if (q.kind === "each" && q.hi * scale <= 1.01) return { qty: (q.pre || "") + qty, rest: batchNote(dropAside(single(q.rest))) };
    }
    else if (q.kind === "each") {
      const k = kitchen(q, q.lo * scale, units);
      if (k) return k;
      const n = niceEach(q.lo * scale); qty = n.str + (q.uw ? " " + unitWord(q.uw, n.val) : "");
      if (!q.uw && n.val > 1 && q.lo <= 1) return { qty: (q.pre || "") + qty, rest: batchNote(dropAside(pluralHead(q.rest))) };
      if (!q.uw && n.val <= 1) return { qty: (q.pre || "") + qty, rest: batchNote(dropAside(single(q.rest))) };
      return { qty: (q.pre || "") + qty, rest: batchNote(dropAside(q.rest)) };
    }
    else if (q.smart || units === "metric" || true) qty = smart(q.kind, q.lo * q.f * scale, units);
    return { qty: (q.pre || "") + qty, rest: batchNote(dropAside(q.kind === "each" ? q.rest : q.rest.replace(/\s*\(\d[\d.]* (?:oz|ounces?)\)/gi, ""))) };
  }
  // Awkward counts ("⅛ can", "¼ onion") become kitchen measures.
  // Volumes are in teaspoons (48 tsp = 1 cup).
  const CUP = 48;
  const KM = [
    [/diced tomatoes/i, "can", 1.75 * CUP],
    [/tomato sauce/i, "can", 1.75 * CUP],
    [/beans/i, "can", 1.5 * CUP],
    [/condensed milk/i, "can", 1.25 * CUP],
    [/cool whip/i, "can", 6 * CUP],
    [/taco seasoning/i, "packet", 6, "taco seasoning (or homemade, see notes)"],
    [/cream cheese|goat cheese/i, "wt"],
    [/^small .*onion/i, "veg", 0.5 * CUP],
    [/^large .*onion/i, "veg", 1.5 * CUP],
    [/onion/i, "veg", 1 * CUP],
    [/bell pepper/i, "veg", 1 * CUP, "bell pepper (any color), cut into 1-inch pieces"],
    [/zucchini/i, "veg", 2 * CUP],
    [/^kale/i, "veg", 6 * CUP, "kale, leaves stripped and chopped"],
    [/baby spinach/i, "veg", 1 * CUP, "fresh baby spinach"],
    [/^garlic \(about 10/i, "veg", 5, "garlic, minced or pressed"],
    [/^garlic/i, "veg", 1],
    [/pudding mix/i, "can", 0.5 * CUP, "instant French vanilla pudding mix (dry)"],
    [/bay lea|bun|roll|pod|egg wash/i, "whole"]
  ];
  const SING = { potatoes: "potato", bananas: "banana", buns: "bun", rolls: "roll", leaves: "leaf", peppers: "pepper", onions: "onion", eggs: "egg", sprigs: "sprig" };
  const single = s => { const i = s.indexOf(","), h = i < 0 ? s : s.slice(0, i); return h.replace(/\b(potatoes|bananas|buns|rolls|leaves|peppers|onions|eggs|sprigs)\b/gi, w => SING[w.toLowerCase()] || w) + (i < 0 ? "" : s.slice(i)); };
  // batch-only notes that stop being true once a recipe is scaled
  const batchNote = s => s.replace(/\s*\(\d+ (?:half-slices|pieces)\)/gi, "").replace(/\(1 box crushed, 1 box whole\)/i, "(half crushed, half whole)");
  // Canned goods: always show ounces first, then a cup/spoon measure in parentheses.
  function canLine(q, v, units) {
    const rule = KM.find(r => r[0].test(q.rest));
    if (!rule || rule[1] !== "can" || !(v > 0)) return null;
    const per = rule[2];
    const word = (q.uw || "").replace(/s$/, "") || ((q.rest.match(/^\([^)]*\)\s*(can|container|package)/i) || [])[1] || "can").toLowerCase();
    const tidy = dropAside(q.rest.replace(/^\([^)]*\)\s*(?:can|container|package)?\s*/i, ""));
    const oz = x => (units === "metric" ? smart("wt", x, "metric") : (x < 4 ? nice(x, ["¼", "½", "¾"]).str : String(Math.round(x * 2) / 2).replace(".5", "½")) + " oz");
    const vol = x => smart("vol", x, units);
    const frac = v - Math.floor(v), n = Math.round(v);
    if (frac < 0.02 || frac > 0.98) {
      const w = n > 1 ? (word === "package" ? "packages" : word + "s") : word;
      return { qty: `${n} ${w}`, rest: `(${units === "metric" ? oz(q.wt) : q.wt + " oz"}${n > 1 ? " each" : ""}, about ${vol(per * n)}${n > 1 ? " total" : ""}) ${tidy}` };
    }
    return { qty: oz(v * q.wt), rest: `(about ${vol(v * per)}) ${tidy}` };
  }
  function kitchen(q, v, units) {
    if (!(v > 0)) return null;
    const rule = KM.find(r => r[0].test(q.rest));
    if (!rule) return null;
    const frac = v - Math.floor(v), clean = frac < 0.02 || frac > 0.98, half = Math.abs(frac - 0.5) < 0.02;
    const [, type, per, name] = rule;
    const tidy = (name || q.rest).replace(/^\([^)]*\)\s*(?:package|can|container|log)?\s*/i, "").replace(/^(small|medium|large)\s+/i, "");
    if (type === "whole") {
      const n = Math.max(1, Math.round(v));
      if (Math.abs(v - q.lo) < 0.01 || (v >= 1 && clean)) return null;
      return { qty: String(n), rest: n > 1 ? pluralHead(q.rest) : single(q.rest) };
    }
    if (clean || (type === "veg" && half && v >= 1)) return null;
    if (type === "wt") return { qty: smart("wt", v * q.wt, units), rest: dropAside(tidy) };
    return { qty: smart("vol", v * per, units), rest: dropAside(tidy) };
  }
  // "(about 3 tablespoons)" or "(two 8-oz blocks)" only describe the original batch
  const dropAside = s => s.replace(/\s*\((?:about|one|two|three|four) [^)]*\)/gi, "");

  let R = null, state = null, KEY = "";
  const timers = new Map();

  function parseHashQuery() {
    const h = location.hash.replace(/^#\/?/, "");
    const [slug, qs] = h.split("?");
    return { slug: decodeURIComponent(slug || ""), params: new URLSearchParams(qs || "") };
  }

  function renderRecipe(slug, params) {
    R = BY[slug];
    if (!R) { location.hash = "#/"; return; }
    $("#tb-toc").hidden = false;
    document.title = `${R.scripture} — ${R.dish} | What's Inside a Mustard Seed?`;
    if (R.type === "menu") return renderMenu();
    KEY = "ms-book-" + R.slug;
    state = {
      servings: clamp(parseInt(params.get("servings"), 10) || R.base, minServ(), 99),
      mode: R.meat && params.get("mode") !== "servings" ? "meat" : "servings",
      lb: R.meat ? clamp(parseFloat(params.get("lb")) || R.meat.baseLb, R.meat.min, R.meat.max) : 0,
      units: params.get("units") === "metric" ? "metric" : "us",
      basis: "serving", opts: {},
      done: new Set(JSON.parse((store && store.getItem(KEY + "-done")) || "[]"))
    };
    (R.options || []).forEach(o => { const p = params.get(o.id); state.opts[o.id] = p === null ? o.default : p === "1"; });
    const idx = BOOK.indexOf(R), prev = BOOK[idx - 1], next = BOOK[idx + 1];
    const cat = CATS.find(c => c.id === R.cat);
    main.innerHTML = `
    <article class="page">
      <header class="masthead">
        <div class="rule"></div>
        <img class="emblem" src="assets/emblem.png" alt="What's Inside a Mustard Seed? emblem" width="120" height="120">
        <p class="book"><a href="#/">What's Inside a Mustard Seed?</a></p>
        <h1>${esc(R.scripture)}<span class="dish">${esc(R.dish)}</span></h1>
        ${R.subtitle && strip(R.subtitle) !== R.dish ? `<p class="subtitle">${R.subtitle}</p>` : ""}
        ${R.status ? `<p class="status">${esc(R.status)}</p>` : ""}
      </header>
      <figure class="photo"><img src="${R.photo}" alt="${esc(R.dish)}"></figure>
      <blockquote class="verse"><p>“${R.verse.text}”</p><cite>${esc(R.verse.ref)}, <a href="${R.verse.url}" target="_blank" rel="noopener">The Word of <span lang="he">יהוה</span></a></cite></blockquote>
      <dl class="facts" id="facts"></dl>

      <section class="toolbar no-print" aria-label="Recipe tools">
        <div class="tool scale-tool" id="scale-tool"></div>
        <div class="tool">
          <span class="tool-label">Units</span>
          <div class="seg" role="radiogroup" aria-label="Units">
            <button type="button" data-units="us" role="radio">US</button>
            <button type="button" data-units="metric" role="radio">Metric</button>
          </div>
        </div>
        ${(R.options || []).length ? `<div class="tool options">${R.options.map(o => `
          <label class="toggle" title="${esc(o.hint)}"><input type="checkbox" data-opt="${o.id}"><span class="track" aria-hidden="true"></span><span class="toggle-text">${o.label}</span></label>`).join("")}</div>` : ""}
      </section>

      <section class="block" aria-labelledby="ing-h">
        <div class="block-head"><h2 id="ing-h">Ingredients</h2><span class="scale-note" id="scale-note"></span></div>
        <div class="portion" id="portion"></div>
        <div id="ingredients"></div>
      </section>

      <section class="block" aria-labelledby="steps-h">
        <div class="block-head"><h2 id="steps-h">Steps</h2><button type="button" class="link-btn no-print" id="reset-steps">Clear checkmarks</button></div>
        <p class="hint no-print">Tap a step to mark it done. Timers count down right on the page.</p>
        <div id="steps"></div>
      </section>

      <section class="block" aria-labelledby="nut-h">
        <div class="block-head"><h2 id="nut-h">Nutrition estimate</h2>
          <div class="seg small no-print" role="radiogroup" aria-label="Nutrition basis">
            <button type="button" data-basis="serving" role="radio">Per serving</button>
            <button type="button" data-basis="batch" role="radio">Whole batch</button>
          </div></div>
        <div class="nutrition" id="nutrition"></div>
      </section>

      <div id="notes"></div>
      ${storyHTML(R)}

      <section class="block export no-print" aria-labelledby="exp-h">
        <h2 id="exp-h">Save, print, and share</h2>
        <div class="export-grid">
          ${(R.downloads || []).map(([t, h], i) => `<a class="btn${i === 0 ? " primary" : ""}" href="${h}" download>${t}</a>`).join("")}
          <button type="button" class="btn${R.downloads ? "" : " primary"}" id="print-full">Print or save as PDF</button>
          <button type="button" class="btn" id="print-card">Print 5×7 recipe card</button>
          <button type="button" class="btn" id="share">Share this recipe</button>
        </div>
        <p class="hint">Printing uses the servings, units, and options you've set above. Choose “Save as PDF” in the print window to keep a copy.</p>
      </section>

      <nav class="pager no-print" aria-label="More recipes">
        ${prev ? `<a href="#/${prev.slug}" class="pg prev"><small>Previous</small>${esc(prev.scripture)}</a>` : "<span></span>"}
        <a href="#/" class="pg mid">Table of Contents</a>
        ${next ? `<a href="#/${next.slug}" class="pg next"><small>Next</small>${esc(next.scripture)}</a>` : "<span></span>"}
      </nav>
      <footer class="foot"><div class="rule"></div><p>What's Inside a Mustard Seed? • ${esc(cat ? cat.title : R.cat)}${R.sub ? " • " + esc(R.sub) : ""}</p></footer>
    </article>`;
    renderNotes();
    bindRecipe();
    update(false);
    window.scrollTo(0, 0);
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  const scale = () => (state.mode === "meat" ? state.lb / R.meat.baseLb : state.servings / R.base);
  const unitN = n => {
    const u = R.unit || "servings";
    if (n !== 1) return u;
    const irr = { servings: "serving", glasses: "glass", dishes: "dish", sandwiches: "sandwich", boxes: "box", loaves: "loaf", pieces: "piece", slices: "slice", bowls: "bowl", cups: "cup", mugs: "mug" };
    if (irr[u]) return irr[u];
    return u.replace(/(ss|ch|sh|x|z)es$/, "$1").replace(/ies$/, "y").replace(/([^s])s$/, "$1");
  };
  const servingsNow = () => (state.mode === "meat" ? R.base * scale() : state.servings);
  function minServ() { return R.meat && R.meat.noSingle ? Math.ceil((R.meat.min / R.meat.baseLb) * R.base) : 1; }
  function fmtW(lb, units) {
    if (units === "metric") return smart("wt", lb * 16, "metric");
    if (lb < 1) return Math.round(lb * 16) + " oz";
    return nice(lb, ["¼", "½", "¾"]).str + " lb";
  }
  const half = v => nice(Math.round(v * 2) / 2, ["½"]).str;
  const hrs = (a, b) => (half(a) === half(b) ? `${half(a)} hours` : `${half(a)}–${half(b)} hours`);
  function brisketTimes() {
    const lb = R.meat.baseLb * scale();
    const t = { lo: lb * 1, hi: lb * 1.25, p1: [Math.max(2, lb * 0.5), Math.max(2.5, lb * 0.57)], p2: [Math.max(1.5, lb * 0.48), Math.max(2, lb * 0.67)] };
    let start = 18 - (Math.round(t.hi * 2) / 2 + 1.5); while (start < 0) start += 24;
    const hh = Math.floor(start), mm = Math.round((start - hh) * 60);
    const clock = `${((hh + 11) % 12) + 1}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${hh < 12 ? "AM" : "PM"}`;
    return { lb: fmtW(lb, "us"), total: hrs(t.lo, t.hi), p1: hrs(...t.p1), p2: hrs(...t.p2), start: clock, p1min: Math.round(t.p1[0] * 2) * 30, p2min: Math.round(t.p2[0] * 2) * 30 };
  }
  function fill(text) {
    if (!text || text.indexOf("{{") < 0 || !R.meat || R.meat.timed !== "brisket") return text;
    const T = brisketTimes();
    return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (T[k] != null ? T[k] : m));
  }
  function renderScaleTool() {
    const M = R.meat, meat = state.mode === "meat";
    const single = !(M && M.noSingle);
    const presets = meat ? (M.presets || [0.5, 1, 2, 3].map(x => Math.max(M.min, Math.round((M.baseLb * x) / M.step) * M.step))) : null;
    $("#scale-tool").innerHTML = `
      ${M ? `<div class="seg scale-by" role="radiogroup" aria-label="Scale by">
        <button type="button" role="radio" data-mode="meat" aria-checked="${meat}">By meat weight</button>
        <button type="button" role="radio" data-mode="servings" aria-checked="${!meat}">By servings</button></div>` : ""}
      <div class="scale-row">
        <span class="tool-label" id="servings-label">${meat ? `${esc(cap(M.name))}, lb` : esc(cap(R.unit || "servings"))}</span>
        <div class="stepper" role="group" aria-labelledby="servings-label">
          <button type="button" id="minus" aria-label="Less">−</button>
          <input id="servings" type="number" inputmode="decimal" step="${meat ? M.step : 1}" min="${meat ? M.min : minServ()}" max="${meat ? M.max : 99}" aria-label="${meat ? "pounds of meat" : esc(R.unit || "servings")}">
          <button type="button" id="plus" aria-label="More">+</button>
        </div>
        <div class="chips" id="multipliers">${meat
          ? [...new Set(presets)].map(v => `<button type="button" class="chip" data-lb="${v}">${fmtW(v, "us")}</button>`).join("")
          : `${single ? `<button type="button" class="chip single" data-single="1">1 serving</button>` : ""}${[0.5, 1, 2, 3].map(m => `<button type="button" class="chip" data-mult="${m}">${m === 0.5 ? "½" : m}×</button>`).join("")}`}</div>
      </div>
      ${M && single && meat ? `<button type="button" class="link-btn light" data-single="1">Make a single serving</button>` : ""}`;
    $("#minus").onclick = () => (state.mode === "meat" ? setLb(state.lb - M.step) : setServings(state.servings - 1));
    $("#plus").onclick = () => (state.mode === "meat" ? setLb(state.lb + M.step) : setServings(state.servings + 1));
    $("#servings").addEventListener("change", e => (state.mode === "meat" ? setLb(parseFloat(e.target.value)) : setServings(parseInt(e.target.value, 10))));
  }
  function setLb(v) { const M = R.meat; state.lb = clamp(Math.round((v || M.baseLb) / M.step) * M.step, M.min, M.max); update(); }
  const ozs = oz => (state.units === "metric" ? Math.round((oz * 28.35) / 5) * 5 + " g" : (oz < 3 ? nice(oz, ["¼", "½", "¾"]).str : Math.round(oz)) + " oz");
  function renderPortion() {
    const n = servingsNow(), M = R.meat, unit = R.unit || "servings";
    const nr = Math.max(1, Math.round(n));
    let html = "";
    if (M) {
      const lb = M.baseLb * scale();
      const raw = (lb * 16) / n, cooked = raw * M.yield;
      html = `<b>Single portions:</b> ${state.mode === "meat" ? `${fmtW(lb, state.units)} of ${esc(M.name)} makes` : "This makes"} about ${nr} ${esc(unitN(nr))}${nr > 1 ? ", each" : ""} with about ${ozs(cooked)} cooked meat (${ozs(raw)} raw).${nr > 1 ? ` For single meals, divide it into ${nr} containers.` : ""}`;
      if (M.noSingle) html += ` A brisket can't cook as one serving, so cook at least ${fmtW(M.min, "us")} and pack single portions. They keep 3–4 days in the fridge or 3 months frozen.`;
    } else {
      html = `<b>Single portions:</b> This makes about ${nr} ${esc(unitN(nr))}.${nr > 1 ? ` Tap “1 serving” above to scale everything to one portion.` : ""}`;
    }
    $("#portion").innerHTML = html;
  }
  const on = x => !x.option || state.opts[x.option];

  function renderFacts() {
    const sc = scale(), nr = Math.max(1, Math.round(servingsNow()));
    const sv = sc === 1 ? R.servingsText : state.mode === "meat" ? `About ${nr} ${unitN(nr)} from ${fmtW(state.lb, state.units)} ${R.meat.name} (card uses ${fmtW(R.meat.baseLb, state.units)})` : `${state.servings} ${unitN(state.servings)} (card makes ${strip(R.servingsText).replace(/^About /, "about ")})`;
    const rows = [["Category", (CATS.find(c => c.id === R.cat) || { title: R.cat }).title + (R.sub ? " / " + R.sub : "")], ["Servings", sv], ["Time", R.timeT ? fill(R.timeT) : R.time], ["You'll need", R.need], ["Clean eating", R.clean]];
    Object.entries(R.extraMeta || {}).forEach(([k, v]) => rows.push([k, v]));
    const d = dietsOf(R.slug); if (d.length) rows.push(["Way of eating", d.join(", ")]);
    if (R.source) rows.push(["Source", R.source]);
    $("#facts").innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<div><dt>${k}:</dt><dd>${v}</dd></div>`).join("");
  }
  function ingredientHTML(withChecks) {
    const s = scale();
    return R.groups.filter(on).map(g => {
      const items = g.items.filter(on);
      if (!items.length) return "";
      return `<div class="ing-group">${g.name ? `<h3>${g.name}${g.note ? ` <span class="g-note">${g.note}</span>` : ""}</h3>` : ""}<ul>${items.map(it => {
        if (it.plain) return `<li class="plain">${it.text}</li>`;
        const L = ingLine(it, s, state.units);
        const body = L.qty ? `<span class="qty">${esc(L.qty)}</span> <span class="ing-name">${esc(L.rest)}</span>` : `<span class="ing-name">${L.rest}</span>`;
        return `<li>${withChecks ? `<label><input type="checkbox" class="ing-check">` : ""}<span class="ing-line">${body}</span>${it.note ? `<span class="ing-note">${it.note}</span>` : ""}${withChecks ? `</label>` : ""}</li>`;
      }).join("")}</ul></div>`;
    }).join("");
  }
  function renderIngredients() {
    $("#ingredients").innerHTML = ingredientHTML(true);
    const s = scale();
    $("#scale-note").textContent = s === 1 ? "Original batch" : state.mode === "meat" ? `Every amount figured for ${fmtW(state.lb, "us")} of meat` : `Scaled ${+s.toFixed(2)}× from ${R.base} ${R.unit || "servings"}`;
    renderPortion();
  }
  function visibleSections() {
    let n = 0;
    return R.sections.filter(on).map(sec => ({
      title: sec.title,
      steps: sec.steps.map(st => {
        if (st.para) return { ...st };
        n++;
        let text = st.text;
        if (st.optionText && state.opts.bacon === st.optionText.bacon) text = st.optionText.text;
        text = fill(text);
        const timer = st.timerKey && R.meat && R.meat.timed ? brisketTimes()[st.timerKey + "min"] : st.timer;
        return { ...st, text, timer, n, id: (sec.title || "s") + "|" + n + "|" + strip(st.text).slice(0, 20) };
      })
    }));
  }
  function renderSteps() {
    $("#steps").innerHTML = visibleSections().map(sec => `
      <div class="step-section">${sec.title ? `<h3>${sec.title}</h3>` : ""}<ol>${sec.steps.map(st => st.para ? `<li class="step-para">${st.text}</li>` : `
        <li class="step${state.done.has(st.id) ? " done" : ""}" data-id="${esc(st.id)}" tabindex="0" role="checkbox" aria-checked="${state.done.has(st.id)}">
          <span class="num" aria-hidden="true">${st.n}</span>
          <div class="step-body"><p>${st.text}</p>
            ${st.tip ? `<p class="tip">${st.tip}</p>` : ""}
            ${st.timer ? `<button type="button" class="timer no-print" data-min="${st.timer}" data-n="${st.n}"><span class="t-label">Start ${fmtMin(st.timer)} timer</span></button>` : ""}
          </div></li>`).join("")}</ol></div>`).join("");
  }
  const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:00` : `${m}:00`);

  const DV = { fat: 78, sat: 20, carb: 275, fiber: 28, protein: 50, sodium: 2300 };
  function renderNutrition() {
    const t = batchTotals(R, scale(), state.opts);
    const div = state.basis === "serving" ? servingsNow() : 1, nS = Math.max(1, Math.round(servingsNow()));
    const v = {}; NK.forEach(k => (v[k] = t[k] / div));
    const g = x => (x < 1 ? "<1" : Math.round(x)) + "g";
    const pct = k => (DV[k] ? Math.round((v[k] / DV[k]) * 100) + "%" : "");
    const row = (label, val, k, sub) => `<div class="n-row${sub ? " sub" : ""}"><span>${sub ? "" : "<b>"}${label}${sub ? "" : "</b>"} ${val}</span><span class="pct">${pct(k)}</span></div>`;
    const unit = R.unit || "servings";
    const net = Math.max(0, v.carb - v.fiber);
    const m = { Fat: v.fat * 9, Carbs: v.carb * 4, Protein: v.protein * 4 }, sum = m.Fat + m.Carbs + m.Protein || 1;
    $("#nutrition").innerHTML = `
      <div class="n-label" aria-label="Nutrition facts estimate">
        <div class="n-title">Nutrition Facts <small>estimate</small></div>
        <div class="n-serv">${state.basis === "serving" ? `1 of ${nS} ${unitN(nS)}` : `Whole batch (${nS} ${unitN(nS)})`}</div>
        <div class="n-cal"><span>Calories</span><strong>${Math.round(v.cal / 5) * 5}</strong></div>
        <div class="n-dvhead">% Daily Value*</div>
        ${row("Total Fat", g(v.fat), "fat")}${row("Saturated Fat", g(v.sat), "sat", true)}
        ${row("Sodium", Math.round(v.sodium / 5) * 5 + "mg", "sodium")}
        ${row("Total Carbohydrate", g(v.carb), "carb")}${row("Dietary Fiber", g(v.fiber), "fiber", true)}${row("Total Sugars", g(v.sugar), "", true)}
        ${row("Protein", g(v.protein), "protein")}
        <p class="n-foot">*Percent Daily Values are based on a 2,000-calorie diet.</p>
      </div>
      <div class="n-side">
        <p class="net"><span>Net carbs</span><strong>${net < 1 ? "<1" : Math.round(net)}g</strong><small>${state.basis === "serving" ? "per serving" : "whole batch"}, total carbs minus fiber</small></p>
        <div class="macro-bar" aria-hidden="true">${Object.entries(m).map(([k, c]) => `<span class="mb-${k.toLowerCase()}" style="width:${(c / sum) * 100}%"></span>`).join("")}</div>
        <ul class="macro-legend">${Object.entries(m).map(([k, c]) => `<li><i class="mb-${k.toLowerCase()}"></i>${k} <b>${Math.round((c / sum) * 100)}%</b> of calories</li>`).join("")}</ul>
        <p class="n-note">${R.nutritionNote || "Estimated from typical USDA values for each ingredient at the amounts listed, using the middle of any range. Optional ingredients, toppings, garnishes, and to-taste seasonings aren't counted, so brands and add-ons will change the numbers."}</p>
      </div>`;
  }
  function noteItems(items) {
    let html = "", list = null;
    const flush = () => { if (list) { html += `<ul class="notes">${list.join("")}</ul>`; list = null; } };
    items.forEach(it => {
      let t = it.text;
      if (t.startsWith("@")) { const r = BY[t.slice(1)]; if (!r) return; t = `<a href="#/${r.slug}">${esc(r.scripture)} ${esc(r.dish)}</a>`; (list = list || []).push(`<li>${t}</li>`); return; }
      if (it.t === "li" || it.t === "step") (list = list || []).push(`<li>${t}</li>`);
      else { flush(); html += `<p class="note-p">${t}</p>`; }
    });
    flush();
    return html;
  }
  function storyHTML(r) {
    const s = r.story; if (!s) return "";
    return `<section class="kstory" aria-labelledby="ks-h">
        <div class="ks-orn" aria-hidden="true"><span></span><img src="assets/emblem.png" alt=""><span></span></div>
        <p class="ks-eyebrow">${s.eyebrow || "From our kitchen table"}</p>
        <h2 id="ks-h" class="ks-title">${s.title}</h2>
        ${s.lede ? `<p class="ks-lede">${s.lede}</p>` : ""}
        <div class="ks-body">${s.paras.map((p, i) => `<p${i === 0 ? ' class="ks-first"' : ""}>${p}</p>`).join("")}</div>
        ${s.pull ? `<blockquote class="ks-pull">${s.pull}</blockquote>` : ""}
        <p class="ks-sign">${s.sign || "Alexis"}</p>
      </section>`;
  }
  function renderNotes() {
    $("#notes").innerHTML = (R.notes || []).map(n => {
      const body = noteItems(n.items || []) + (n.subs || []).map(s => `<h3>${s.title}</h3>${noteItems(s.items)}`).join("");
      if (!strip(body).trim()) return "";
      return `<section class="block note-block"><h2>${n.title}</h2>${body}</section>`;
    }).join("");
  }
  function renderCard() {
    const secs = visibleSections();
    const nIng = R.groups.filter(on).reduce((a, g) => a + g.items.filter(on).length, 0);
    const ingFront = nIng <= 18;
    const ingBlock = `<div class="card-ing">${ingredientHTML(false)}</div>`;
    $("#card").innerHTML = `
      <section class="card-face front${ingFront ? "" : " photo-big"}">
        <img class="card-emblem" src="assets/emblem.png" alt="">
        <h2 class="card-title">${esc(R.scripture)}<span>${esc(R.dish)}</span></h2>
        <img class="card-photo" src="${R.photo}" alt="">
        <p class="card-verse">“${R.verse.text}” <cite>${esc(R.verse.ref)}, The Word of <span lang="he">יהוה</span></cite></p>
        <p class="card-facts"><b>Makes</b> ${scale() === 1 ? strip(R.servingsText).replace(/^About /, "about ") : "about " + Math.max(1, Math.round(servingsNow())) + " " + esc(unitN(Math.max(1, Math.round(servingsNow()))))}${R.time ? ` &nbsp;·&nbsp; <b>Time</b> ${strip(R.timeT ? fill(R.timeT) : R.time).replace(/^About /, "about ")}` : ""}</p>
        ${ingFront ? ingBlock : `<p class="card-more">Ingredients and method continue on the next page.</p>`}
      </section>
      <section class="card-face back">
        <h3 class="card-back-title">${esc(R.dish)}</h3>
        ${ingFront ? "" : `<h4>Ingredients</h4>${ingBlock}<h4>Method</h4>`}
        ${secs.map(s => `${s.title ? `<h4>${s.title}</h4>` : ""}<ol start="${(s.steps.find(x => !x.para) || { n: 1 }).n}">${s.steps.filter(x => !x.para).map(st => `<li>${st.text}</li>`).join("")}</ol>`).join("")}
        ${R.source ? `<p class="card-src"><b>Source:</b> ${strip(R.source)}</p>` : ""}
        <p class="card-foot">What's Inside a Mustard Seed?</p>
      </section>`;
  }
  function update(push = true) {
    renderScaleTool();
    $("#servings").value = state.mode === "meat" ? state.lb : state.servings;
    document.querySelectorAll("[data-mult]").forEach(b => b.setAttribute("aria-pressed", String(Math.abs(state.servings - R.base * +b.dataset.mult) < 0.01)));
    document.querySelectorAll("[data-lb]").forEach(b => b.setAttribute("aria-pressed", String(Math.abs(state.lb - +b.dataset.lb) < 0.01)));
    document.querySelectorAll(".chip[data-single]").forEach(b => b.setAttribute("aria-pressed", String(state.mode === "servings" && state.servings === 1)));
    document.querySelectorAll("[data-units]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.units === state.units)));
    document.querySelectorAll("[data-basis]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.basis === state.basis)));
    document.querySelectorAll("[data-opt]").forEach(c => (c.checked = state.opts[c.dataset.opt]));
    renderFacts(); renderIngredients(); renderSteps(); renderNutrition(); renderCard();
    if (push) {
      const p = new URLSearchParams();
      if (R.meat && state.mode === "servings") p.set("mode", "servings");
      if (state.mode === "meat" && state.lb !== R.meat.baseLb) p.set("lb", state.lb);
      if (state.mode === "servings" && state.servings !== R.base) p.set("servings", state.servings);
      if (state.units !== "us") p.set("units", state.units);
      (R.options || []).forEach(o => { if (state.opts[o.id] !== o.default) p.set(o.id, state.opts[o.id] ? "1" : "0"); });
      const q = p.toString();
      suppress = true;
      try { history.replaceState(null, "", "#/" + R.slug + (q ? "?" + q : "")); } catch (e) {}
      suppress = false;
    }
  }
  function setServings(n) { state.servings = clamp(Math.round(n) || 1, minServ(), 99); update(); }
  function bindRecipe() {
    $("#reset-steps").onclick = () => { state.done.clear(); store && store.removeItem(KEY + "-done"); renderSteps(); };
    $("#print-full").onclick = () => printAs("full");
    $("#print-card").onclick = () => printAs("card");
    $("#share").onclick = async () => {
      const data = { title: `${R.scripture} — ${R.dish}`, text: "From What's Inside a Mustard Seed?", url: location.href };
      try {
        if (navigator.share) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(location.href); toast("Link copied. Your servings and units are saved in it.");
      } catch (e) { if (e && e.name !== "AbortError") toast("Copy the address bar link to share"); }
    };
  }
  document.addEventListener("click", e => {
    if (!R || !state || !$("#steps")) return;
    const m = e.target.closest("[data-mult]"); if (m) setServings(R.base * +m.dataset.mult);
    const w = e.target.closest("[data-lb]"); if (w) setLb(+w.dataset.lb);
    const md = e.target.closest("[data-mode]"); if (md && md.dataset.mode !== state.mode) {
      if (md.dataset.mode === "servings") { state.servings = clamp(Math.round(servingsNow()), minServ(), 99); state.mode = "servings"; }
      else { state.lb = clamp(Math.round((R.meat.baseLb * scale()) / R.meat.step) * R.meat.step, R.meat.min, R.meat.max); state.mode = "meat"; }
      update();
    }
    const sg = e.target.closest("[data-single]"); if (sg) { state.mode = "servings"; setServings(1); }
    const u = e.target.closest("[data-units]"); if (u) { state.units = u.dataset.units; update(); }
    const b = e.target.closest("[data-basis]"); if (b) { state.basis = b.dataset.basis; update(false); }
    const t = e.target.closest(".timer"); if (t) { e.stopPropagation(); toggleTimer(t); return; }
    const s = e.target.closest(".step"); if (s && !e.target.closest("a,button")) toggleStep(s);
  });
  document.addEventListener("keydown", e => {
    const s = e.target.closest && e.target.closest(".step");
    if (s && (e.key === " " || e.key === "Enter") && e.target === s) { e.preventDefault(); toggleStep(s); }
  });
  document.addEventListener("change", e => {
    const o = e.target.closest("[data-opt]"); if (o && state) { state.opts[o.dataset.opt] = o.checked; update(); }
  });
  function toggleStep(el) {
    const id = el.dataset.id;
    state.done.has(id) ? state.done.delete(id) : state.done.add(id);
    el.classList.toggle("done"); el.setAttribute("aria-checked", String(state.done.has(id)));
    store && store.setItem(KEY + "-done", JSON.stringify([...state.done]));
  }
  function toggleTimer(btn) {
    const key = R.slug + "|" + btn.closest(".step").dataset.id;
    const label = btn.querySelector(".t-label");
    const tm = timers.get(key);
    if (tm && tm.iv) { clearInterval(tm.iv); tm.iv = null; btn.classList.remove("running"); label.textContent = `Resume ${mmss(tm.left)}`; return; }
    const obj = { left: tm ? tm.left : +btn.dataset.min * 60, iv: null, n: btn.dataset.n, title: R.scripture }; timers.set(key, obj);
    btn.classList.add("running");
    const stepId = btn.closest(".step").dataset.id;
    const tick = () => {
      const live = document.querySelector(`.step[data-id="${CSS.escape(stepId)}"] .timer .t-label`);
      if (obj.left <= 0) {
        clearInterval(obj.iv); timers.delete(key); beep();
        if (live) { live.textContent = "Time's up. Check it."; live.parentElement.classList.remove("running"); live.parentElement.classList.add("finished"); }
        toast(`Timer finished: ${obj.title}, step ${obj.n}`);
        return;
      }
      if (live) live.textContent = `${mmss(obj.left)} · tap to pause`;
      obj.left--;
    };
    tick(); obj.iv = setInterval(tick, 1000);
  }
  const mmss = s => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(d => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.2, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.3); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3); });
    } catch (e) {}
    navigator.vibrate && navigator.vibrate([200, 100, 200]);
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3400); }
  const pageStyle = document.createElement("style"); document.head.appendChild(pageStyle);
  function setPrint(mode) {
    document.body.classList.toggle("print-card", mode === "card");
    pageStyle.textContent = mode === "card" ? "@page{size:5in 7in;margin:.3in .34in .32in}" : "@page{size:letter;margin:0.55in 0.7in 0.6in}";
  }
  function printAs(mode) { setPrint(mode); window.print(); }
  window.addEventListener("afterprint", () => document.body.classList.remove("print-card"));

  // ---------------- FEAST MENU ----------------
  function renderMenu() {
    state = null;
    main.innerHTML = `
    <article class="page">
      <header class="masthead">
        <div class="rule"></div>
        <img class="emblem" src="assets/emblem.png" alt="What's Inside a Mustard Seed? emblem" width="120" height="120">
        <p class="book"><a href="#/">What's Inside a Mustard Seed?</a></p>
        <h1>${esc(R.scripture)}<span class="dish">${esc(R.dish)}</span></h1>
      </header>
      <figure class="photo"><img src="${R.photo}" alt="${esc(R.dish)}"></figure>
      <blockquote class="verse"><p>“${R.verse.text}”</p><cite>${esc(R.verse.ref)}, <a href="${R.verse.url}" target="_blank" rel="noopener">The Word of <span lang="he">יהוה</span></a></cite></blockquote>
      <dl class="facts"><div><dt>Category:</dt><dd>Feasts / Sukkot</dd></div><div><dt>Theme:</dt><dd>${R.theme}</dd></div></dl>
      <p class="hint">Each recipe below has its own page. Tap a name to open it.</p>
      ${R.menu.map(s => `<section class="block"><h2>${s.title}</h2><ul class="toc-list">${s.items.map(it => {
        const r = BY[it.slug];
        return `<li><a class="toc-row" href="#/${r.slug}"><img src="assets/thumbs/${r.slug}.jpg" alt="" loading="lazy" width="84" height="84"><span class="toc-text"><span class="toc-scr">${esc(r.scripture)}</span><span class="toc-dish">${esc(r.dish)}</span><span class="toc-meta">${it.desc}</span></span></a></li>`;
      }).join("")}</ul>${s.note ? `<p class="note-p">${s.note}</p>` : ""}</section>`).join("")}
      ${R.notes.map(n => `<section class="block note-block"><h2>${n.title}</h2>${noteItems(n.items)}</section>`).join("")}
      <section class="block export no-print"><div class="export-grid">
        <button type="button" class="btn primary" id="print-menu">Print or save as PDF</button>
        <button type="button" class="btn" id="share-menu">Share this menu</button></div></section>
      <nav class="pager no-print"><span></span><a href="#/" class="pg mid">Table of Contents</a><span></span></nav>
      <footer class="foot"><div class="rule"></div><p>What's Inside a Mustard Seed? • Feasts</p></footer>
    </article>`;
    $("#print-menu").onclick = () => printAs("full");
    $("#share-menu").onclick = async () => { try { if (navigator.share) return await navigator.share({ title: "Rejoice Seven Days — Sukkot Feast Menu", url: location.href }); await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch (e) {} };
    window.scrollTo(0, 0);
  }

  // ---------------- ABOUT ----------------
  const SNAPS = {
    1: [["astros", "Wyatt, Alexis, and Kevin at an Astros game"], ["pool", "Alexis, Wyatt, and Kevin in the pool by the water"], ["kevin-bakery", "Kevin at a bakery table with pastries and iced coffee"]],
    2: [["tallit", "Kevin in his tallit with Alexis"]],
    4: [["wyatt-scroll", "Wyatt leaning over a long scroll laid out across the tables"]],
    5: [["alexis-wyatt", "Alexis kissing Wyatt on the cheek"]],
    7: [["rome", "Kevin and Alexis at the Colosseum in Rome"], ["venice", "Kevin and Alexis in Italy"]]
  };
  function snaps(list) {
    if (!list) return "";
    return `<div class="about-snaps n${list.length}">${list.map(([f, alt]) => `<figure class="snap"><img src="assets/photos/family/${f}.jpg" alt="${alt}" loading="lazy" onerror="this.closest('figure').remove()"></figure>`).join("")}</div>`;
  }
  function renderAbout() {
    document.title = "About Me | What's Inside a Mustard Seed?";
    $("#tb-toc").hidden = false;
    const chapters = [
      ["Where it started", "I've loved cooking since I was a little girl. Long before I knew what a recipe card was, the kitchen was where I felt at peace. Measuring, stirring, and waiting on something to come out of the oven let my mind rest. It was quiet, it was mine, and it made sense when other things didn't. I still cook to slow down, catch my breath, and give thanks."],
      ["Who's in my kitchen now", "These days I don't cook alone, and honestly, I don't want to. Kevin, my soon-to-be husband, is a seriously good cook. I mean it. The man can cook. My son Wyatt loves being in the kitchen as much as we do, and he'll take the heat in anything you hand him, the spicier the better. Some nights it's all three of us bumping elbows at the counter, tasting as we go and laughing when something doesn't turn out quite right. That's the good stuff. That's what this book is really about."],
      ["The heart of the house", "I've always believed the kitchen is the heart of the house. It's where we talk about our day, where we bless our food, and where a regular weeknight turns into a memory. And yes, sometimes it's where the marinade ends up in my eyeball. Those stories are in here too."],
      ["Why I wrote it all down", "This book started as a way to keep our family's favorite recipes in one place, so they wouldn't live only in my head or on scraps of paper. Every recipe follows the clean food rules of Leviticus 11, beef bacon and never pork, no shellfish, and no coconut ever in our home. Each one is named from a verse in The Word of <span lang=\"he\">יהוה</span>, and behind each one is a little story of what really happened when we made it. If you read one and think, \"Oh my word, that happened to me too,\" then I did my job."],
      ["The mustard seed", "Yeshua said that faith as small as a mustard seed can move mountains, and that the smallest of seeds grows into something people can rest under. Mustard Seed is the name I've given to almost everything I build, from my work as a legal videographer and notary to the book I'm writing about my own life. I believe small things, done faithfully, can grow into something that feeds a lot of people."],
      ["Pull up a chair", "I'm a mom, and my time is precious. The moments I get with my son, my family, and with God in my scriptures mean everything to me, and I know your time is just as valuable. If these recipes save you a little time, ease a little stress, and bring your family to the table a little more often, then this book is doing exactly what I hoped. My prayer is that it becomes a small blessing in your kitchen."]
    ];
    main.innerHTML = `
    <article class="page about">
      <header class="masthead">
        <div class="rule"></div>
        <img class="emblem" src="assets/emblem.png" alt="What's Inside a Mustard Seed? emblem" width="120" height="120">
        <p class="book"><a href="#/">What's Inside a Mustard Seed?</a></p>
        <h1>A Little About Me<span class="dish">Alexis, and the Staton Family Kitchen</span></h1>
      </header>
      <figure class="about-portrait"><img src="assets/photos/about-alexis.jpg" alt="Alexis" onerror="this.closest('figure').remove()"></figure>
      <p class="about-hello">Hi there, I'm Alexis, and I'm so glad you're here.</p>
      <p class="about-intro">Mom, soon-to-be wife, child of God, and yes, a little bit of a smart mouth. If you've ever stood in a warm kitchen while something simmers on the stove, you know the feeling. The whole house smells like dinner, someone sneaks a taste before it's ready, and for a little while the rest of the world can wait.</p>
      <blockquote class="verse"><p>“Because of your lack of Emunah; for truly I say to you, if there is Emunah in you even as a grain of mustard, you will say to this mountain, ‘Move away from here,’ and it will move away; and nothing would prevail over you.”</p><cite>Matai 17:20, <a href="https://theword.link/ktuvim-shel-brit-hakhadashah-%D7%9B%D7%AA%D7%95%D7%91%D7%99%D7%9D-%D7%A9%D7%9C-%D7%91%D7%A8%D7%99%D7%AA-%D7%94%D7%97%D7%93%D7%A9%D7%94/matai-%D7%9E%D7%AA%D7%99/matai-17-%D7%9E%D7%AA%D7%99-%D7%99%D7%96/" target="_blank" rel="noopener">The Word of <span lang="he">יהוה</span></a></cite></blockquote>
      <div class="about-chapters">
        ${chapters.map(([h, t], i) => `<section class="about-ch"><p class="ch-num">${["I","II","III","IV","V","VI"][i]}</p><h2>${h}</h2><p>${t}</p>${snaps(SNAPS[i])}</section>`).join("")}
        <section class="about-ch about-bless"><p class="ch-num">VII</p><h2>Before every meal</h2><p>This is the prayer we always say before we eat. It's called HaMotzi.</p>${HAMOTZI}</section>
        <section class="about-ch"><p class="ch-num">VIII</p><h2>When I'm not in the kitchen</h2><p>You'll probably find me near the water, on a hiking trail, riding bikes with my son, or traveling somewhere new. And yes, I'm usually already thinking about what we're cooking when we get home.</p>${snaps(SNAPS[7])}</section>
      </div>
      <div class="about-close">
        <p>None of this would be possible without God, who is my strength, and my family, my biggest cheerleaders and my most honest taste testers.</p>
        <p>Thank you so much for cooking with us. I'll see you in the kitchen.</p>
        <p class="about-sign">With love, Alexis</p>
        <p class="qf-back"><a class="btn-home" href="#/">Browse the recipes</a></p>
      </div>
      <footer class="foot"><div class="rule"></div><p>What's Inside a Mustard Seed? • About the Cook</p></footer>
    </article>`;
    window.scrollTo(0, 0);
  }

  // ---------------- router ----------------
  let suppress = false;
  function route() {
    if (suppress) return;
    const { slug, params } = parseHashQuery();
    R = null; state = null;
    if (!slug) renderHome(); else if (slug === "about") renderAbout(); else renderRecipe(slug, params);
    const pm = params.get("print");
    if (pm) setPrint(pm);
    main.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", route);
  route();

  // offline support / install as an app
  try {
    if (location.protocol === "https:" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => { try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {} });
    }
  } catch (e) { /* preview frames don't allow offline mode */ }
})();
