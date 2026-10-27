(function () {
  "use strict";
  const BOOK = window.BOOK;
  const BY = Object.assign(Object.create(null), Object.fromEntries(BOOK.map(r => [r.slug, r])));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $("#main");
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = s => String(s || "").replace(/<[^>]+>/g, "");

  // ---------------- Table of contents structure ----------------
  const CATS = [
    { id: "Coffee", title: "Coffee" },
    { id: "Alcoholic Drinks", title: "Alcoholic Drinks" },
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
    { id: "keto", title: "Keto", blurb: "Very low carb, with most of the energy from fat and protein. Look for the net-carb estimate on each recipe.", slugs: ["savory-food-such-as-i-love", "through-the-fire"] },
    { id: "carnivore-keto", title: "Carnivore Keto", blurb: "Animal foods only, kept fatty and close to zero carb. The strictest of the three.", slugs: [] }
  ];
  // Quick finders on the home page. Lists are hand-picked from each card's stated time and servings.
  const FINDERS = [
    { id: "quick", title: "Quick Meals", note: "45 minutes or less", blurb: "Recipes with a stated total time of 45 minutes or less, plus the coffee drinks.",
      slugs: ["manna-in-the-morning", "morning-by-morning", "my-cup-overflows", "heritage", "with-joy", "banner-of-love", "every-bitter-thing-is-sweet", "satisfy-every-living-thing", "food-for-her-household", "come-here-and-eat"] },
    { id: "crowd", title: "Feeds a Crowd", note: "10 or more servings", blurb: "Big batches for family gatherings, potlucks, and feast days.",
      slugs: ["a-portion-for-seven", "savory-food-such-as-i-love", "answer-me-speedily", "wait-patiently", "food-for-her-household", "taste-and-see", "rejoice-seven-days"] },
    { id: "ahead", title: "Make Ahead", note: "Prep early, serve later", blurb: "Recipes that chill, slow cook, or rest, so most of the work is done before guests arrive.",
      slugs: ["savory-food-such-as-i-love", "a-portion-for-seven", "wait-patiently", "taste-and-see", "fruit-in-its-season", "garden-of-spices", "good-land", "sweeter-than-honey", "majestic-trees", "park-of-pomegranates", "through-the-fire"] }
  ];
  // HaMotzi, the family's blessing before every meal (text supplied by Alexis)
  const HAMOTZI = `<div class="blessing">
      <p class="bl-he" lang="he" dir="rtl">בָּרוּךְ אַתָּה יהוה, אֱלֹהֵינוּ, מֶלֶךְ הָעוֹלָם, הַמוֹצִיא לֶחֶם מִן הַאָרֶץ, וְהוֹצִיא יֵשׁוּעַ הַמַשִׁיחַ מִן הָשְׁאוֹל.</p>
      <p class="bl-tr">Barukḥ Atah <bdi lang="he">יהוה</bdi>, Eloheinu, Melekḥ HaOlam, hamotzi lekḥem min ha’aretz, v’hotzi Yeshua HaMashi'akḥ min ha'she’ol.</p>
      <p class="bl-en">Blessed are You, O <bdi lang="he">יהוה</bdi> our Elohim, King of the Universe, who brings forth bread from the earth, and who brought forth Messiah Yeshua from the grave.</p>
    </div>`;
  const NEWEST = "of-all-clean-winged-things-little-chickies"; // update this whenever a new recipe is added
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
        <a class="plan-cta" href="#/plan"><span class="qf-t">Weekly Meal Plan</span><span class="qf-n">Plan breakfast, lunch, dinner, and snacks, see each day's nutrition, and get a shopping list sorted by store section</span></a>
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
    1: [["wyatt-chopping", "Wyatt slicing sweet potatoes at the kitchen counter"], ["kevin-bakery", "Kevin at a bakery table with pastries and iced coffee"]],
    2: [["shack-sign", "Wyatt putting the letters on his Snack Shack sign"], ["shack-proud", "Wyatt standing proud beside Wyatt's Kosher Snack Shack"], ["shack-menu", "The Wyatt's Kosher Snack Shack menu"], ["shack-cakepops", "Chocolate cake balls with sprinkles"], ["shack-coffeecake", "Cinnamon swirl coffee cake"], ["shack-donations", "Wyatt's sign: I accept donations, thank you for supporting my little business"]],
    3: [["tallit", "Kevin in his tallit with Alexis"], ["shema", "The Shema on a scroll"]],
    4: [["muffins", "A tray of fresh-baked muffins"]],
    5: [["wyatt-scroll", "Wyatt leaning over a long scroll laid out across the tables"]],
    6: [["alexis-wyatt", "Alexis kissing Wyatt on the cheek"]],
    bless: [["wyatt-shabbat-1", "Wyatt reading by the Shabbat candles"], ["wyatt-shabbat-2", "Wyatt reading his book by candlelight"]],
    away: [["rome", "Kevin and Alexis at the Colosseum in Rome"], ["venice", "Kevin and Alexis in Italy"], ["astros", "Wyatt, Alexis, and Kevin at an Astros game"], ["pool", "Alexis, Wyatt, and Kevin in the pool by the water"]]
  };
  const FORTUNES = [
    "If you think it's hard to meet new people, try picking up the wrong golf ball.",
    "Golf is a fascinating game. It has taken me nearly forty years to discover that I can't play it.",
    "You can hit a 2-acre fairway 10% of the time, and a 2-inch branch 90% of the time.",
    "A bad day of golf always beats a good day of work.",
    "Counting all your strokes is only for people who lack imagination.",
    "Water hazards are just golf balls returning to their natural habitat."
  ];
  function fortunes() {
    return `<div class="fortunes"><p class="fortunes-label">A few of the golf ball fortunes</p><div class="fortune-strips">${FORTUNES.map(f => `<p class="fortune">${f}</p>`).join("")}</div></div>`;
  }
  function snaps(list) {
    if (!list) return "";
    return `<div class="about-snaps n${list.length}">${list.map(([f, alt]) => `<figure class="snap"><img src="assets/photos/family/${f}.jpg" alt="${alt}" loading="lazy" onerror="this.closest('figure').remove()"></figure>`).join("")}</div>`;
  }
  function renderAbout() {
    document.title = "About Me | What's Inside a Mustard Seed?";
    $("#tb-toc").hidden = false;
    const chapters = [
      ["Where it started", "I've loved cooking since I was a little girl. Long before I knew what a recipe card was, the kitchen was where I felt at peace. Measuring, stirring, and waiting on something to come out of the oven let my mind rest. It was quiet, it was mine, and it made sense when other things didn't. I still cook to slow down, catch my breath, and give thanks."],
      ["Who's in my kitchen now", "These days I don't cook alone, and honestly, I don't want to. Kevin, my soon-to-be husband, is a seriously good cook. I mean it. The man can cook. My son Wyatt loves being in the kitchen as much as we do, and he'll take the heat in anything you hand him, the spicier the better. And that kid doesn't just cook, he's a businessman. More on that in a minute. Some nights it's all three of us bumping elbows at the counter, tasting as we go and laughing when something doesn't turn out quite right. That's the good stuff. That's what this book is really about."],
      ["Wyatt's Kosher Snack Shack", "Every great cook needs a side hustle, and my son found his. Wyatt opened his very own business, Wyatt's Kosher Snack Shack. He made the sign himself, letter by letter, set up shop in the yard under the tent, and put out a menu that would make any coffee shop jealous. To drink: lemonade, sweet tea, Southern sweet tea, and Arnold Palmers. Sneaky snacks: strawberry, vanilla, chocolate, and lemon cake balls, cinnamon swirl coffee cake, and golf ball fortune. Now, that one needs explaining. Back then, Wyatt and I were living with my parents, right on the golf course, and the two of us were always out collecting golf balls. So we made white chocolate golf balls and tucked a hilarious fortune inside each one, like a fortune cookie. It was awesome, and the golfers loved them. That's not a snack, that's a business model. He even had a little sign that said, \"I accept donations! Thank you for supporting my little business!\" These days we live with my fiancé, Kevin, but my parents' place on the golf course is where Wyatt's very first business got its start. Yes, my kid has a business. I'm not crying, you're crying."],
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
      <p class="about-intro">I am a woman of God. I am a soon-to-be wife and a momma. And yes, I'm a little bit sassy. If you've ever stood in a warm kitchen while something simmers on the stove, you know the feeling. The whole house smells like dinner, someone sneaks a taste before it's ready, and for a little while the rest of the world can wait.</p>
      <blockquote class="verse"><p>“Because of your lack of Emunah; for truly I say to you, if there is Emunah in you even as a grain of mustard, you will say to this mountain, ‘Move away from here,’ and it will move away; and nothing would prevail over you.”</p><cite>Matai 17:20, <a href="https://theword.link/ktuvim-shel-brit-hakhadashah-%D7%9B%D7%AA%D7%95%D7%91%D7%99%D7%9D-%D7%A9%D7%9C-%D7%91%D7%A8%D7%99%D7%AA-%D7%94%D7%97%D7%93%D7%A9%D7%94/matai-%D7%9E%D7%AA%D7%99/matai-17-%D7%9E%D7%AA%D7%99-%D7%99%D7%96/" target="_blank" rel="noopener">The Word of <span lang="he">יהוה</span></a></cite></blockquote>
      <div class="about-chapters">
        ${chapters.map(([h, t], i) => `<section class="about-ch"><p class="ch-num">${["I","II","III","IV","V","VI","VII"][i]}</p><h2>${h}</h2><p>${t}</p>${i === 2 ? fortunes() : ""}${snaps(SNAPS[i])}</section>`).join("")}
        <section class="about-ch about-bless"><p class="ch-num">VIII</p><h2>Before every meal</h2><p>This is the prayer we always say before we eat. It's called HaMotzi.</p>${HAMOTZI}${snaps(SNAPS.bless)}</section>
        <section class="about-ch"><p class="ch-num">IX</p><h2>When I'm not in the kitchen</h2><p>You'll probably find me near the water, on a hiking trail, riding bikes with my son, or traveling somewhere new. And yes, I'm usually already thinking about what we're cooking when we get home.</p>${snaps(SNAPS.away)}</section>
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

  // ---------------- WEEKLY MEAL PLAN ----------------
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const PKEY = "ms-plan";
  const PLANNABLE = BOOK.filter(r => r.groups && r.type !== "menu");
  const AISLES = [
    ["skip", /^water\b/],
    ["Coffee", /nespresso|brewed coffee|sweetener/],
    ["Frozen", /tots|cool whip|puff pastry|phyllo|^ice\b/],
    ["Canned and Jarred", /^(?!.*sprig).*broth|stock\b|diced tomatoes|tomato sauce|tomato paste|(black|pinto|kidney) beans|sun-dried|condensed milk|preserves|fig spread/],
    ["Oils", /grease|olive oil|\boil\b/],
    ["Sauces and Condiments", /ketchup|mustard|worcestershire|hot sauce|chili sauce|vinegar|balsamic|dressing|remoulade|ranch|pickled|bbq sauce/],
    ["Meat", /beef|bison|chicken|turkey|sausage|brisket|bacon/],
    ["Dairy and Eggs", /cheese|parmesan|mozzarella|ricotta|feta|cream|butter|milk|yogurt|\beggs?\b/],
    ["Spices and Seasonings", /salt|black pepper|pepper flakes|paprika|cayenne|chili powder|chili flakes|garlic powder|onion powder|seasoning|dried basil|dried parsley|basil or parsley|mrs\.? dash|cinnamon|sesame seeds|\brub\b|bay lea/],
    ["Baking and Sweets", /flour|sugar|honey|maple|pudding|wafers|crackers|caramel|vanilla/],
    ["Pasta, Rice and Grains", /pasta|farfalle|noodles|rice/],
    ["Bread and Bakery", /\bbuns?\b|rolls|bread/],
    ["Vegetables and Fruit", /onion|garlic|potato|tomato|pepper|jalape|kale|spinach|lettuce|celery|cilantro|dill|thyme|rosemary|carrot|mushroom|green beans|lime|lemon|orange|pineapple|avocado|cucumber|zucchini|broccoli|corn|brussels|banana|pomegranate|vegetables/]
  ];
  const AISLE_ORDER = ["Meat", "Dairy and Eggs", "Vegetables and Fruit", "Bread and Bakery", "Pasta, Rice and Grains", "Canned and Jarred", "Sauces and Condiments", "Spices and Seasonings", "Oils", "Baking and Sweets", "Frozen", "Coffee", "Everything Else"];
  const aisleOf = name => { const n = name.toLowerCase().replace(/\([^)]*\)/g, " ").trim(); const a = AISLES.find(([, re]) => re.test(n)); return a ? a[0] : "Everything Else"; };
  // the same grocery item written different ways in different recipes
  const ALIAS = [[/^(fine |kosher |sea )?salt$|^salt (for|or)\b/, "salt"], [/^(coarse )?black pepper$/, "black pepper"], [/^(finely )?grated parmesan( cheese)?$/, "grated Parmesan cheese"],
    [/^heavy (whipping )?cream$/, "heavy cream"], [/^chicken broth( or stock)?$/, "chicken broth"]];
  const aliasOf = n => { const a = ALIAS.find(([re]) => re.test(n)); return a ? a[1] : null; };
  const normName = s => strip(s).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[,;:].*$/, "").replace(/\b(large|medium|small|fresh|finely|optional|for garnish)\b/g, " ").replace(/\s+/g, " ").trim();
  const unitName = (r, n) => { const u = r.unit || "servings"; return n === 1 ? (u === "glasses" ? "glass" : u.replace(/s$/, "")) : u; };
  const minFor = r => (r.meat && r.meat.noSingle ? Math.ceil((r.meat.min / r.meat.baseLb) * r.base) : 1);
  const SLOTS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks and Drinks"]];
  const SLOT_SHORT = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snacks: "snack" };
  const PORTIONS = [0.5, 1, 1.5, 2, 3];
  const fracTxt = x => ({ 0.5: "½", 1: "1", 1.5: "1½", 2: "2", 3: "3" })[x] || String(x);
  const emptyDay = () => Object.fromEntries(SLOTS.map(([k]) => [k, []]));
  const freshPlan = () => ({ days: DAYS.map(emptyDay), have: [], day: 0, goal: 2000 });
  const PS = {}; const psOf = r => PS[r.slug] || (PS[r.slug] = perServing(r));
  let plan = null;
  function loadPlan() {
    try {
      const p = JSON.parse((store && store.getItem(PKEY)) || "null");
      if (p && Array.isArray(p.days) && p.days.length === 7) {
        const ok = m => m && BY[m.slug] && BY[m.slug].groups;
        const fix = m => ({ slug: m.slug, servings: m.servings || BY[m.slug].base, eat: PORTIONS.includes(m.eat) ? m.eat : 1 });
        p.days = p.days.map(d => {
          const out = emptyDay();
          if (Array.isArray(d)) out.dinner = d.filter(ok).map(fix); // plans saved before meal times existed
          else if (d) SLOTS.forEach(([k]) => (out[k] = (d[k] || []).filter(ok).map(fix)));
          return out;
        });
        p.have = p.have || []; p.day = clamp(+p.day || 0, 0, 6); p.goal = clamp(+p.goal || 2000, 800, 6000);
        return p;
      }
    } catch (e) {}
    return freshPlan();
  }
  function savePlan() { try { store && store.setItem(PKEY, JSON.stringify(plan)); } catch (e) {} }
  const eachMeal = fn => plan.days.forEach((day, d) => SLOTS.forEach(([k]) => day[k].forEach((m, i) => fn(m, d, k, i))));
  const dayMeals = d => SLOTS.flatMap(([k]) => plan.days[d][k]);
  const mealCount = () => { let n = 0; eachMeal(() => n++); return n; };
  function dayTotals(d) {
    const t = Object.fromEntries(NK.map(k => [k, 0]));
    dayMeals(d).forEach(m => { const p = psOf(BY[m.slug]); NK.forEach(k => (t[k] += (p[k] || 0) * m.eat)); });
    return t;
  }
  function both(kind, lo, hi) {
    const a = smart(kind, lo, "us"), b = smart(kind, hi, "us");
    if (a === b) return a;
    const ua = a.replace(/^\S+\s?/, ""), ub = b.replace(/^\S+\s?/, "");
    return ua && (ua === ub || ua + "s" === ub) ? a.split(" ")[0] + "–" + b : a + " to " + b;
  }
  function shoppingList() {
    const map = new Map(), prevR = R;
    eachMeal((m, d, slot) => {
      const r = BY[m.slug]; if (!r || !r.groups) return;
      const s = m.servings / r.base, opts = {};
      (r.options || []).forEach(o => (opts[o.id] = o.default));
      const onx = x => !x.option || opts[x.option];
      R = r;
      r.groups.filter(onx).forEach(g => g.items.filter(onx).forEach(it => {
        let e;
        if (it.plain || !it.q) {
          const t = strip(it.text); e = { key: "p:" + normName(t), plain: t, name: t, cls: t };
        } else {
          const q = it.q, L = ingLine(it, s, "us"), anchor = it.anchor && r.meat;
          const kind = anchor ? "wt" : q.kind, f = kind === "each" ? 1 : q.f || 1;
          const lo = anchor ? r.meat.baseLb * 16 * s : q.lo * f * s, hi = anchor ? lo : (q.hi != null ? q.hi : q.lo) * f * s;
          const base = anchor ? it.atext : q.rest;
          const nn = normName(base), al = aliasOf(nn);
          e = { key: [kind, kind === "each" ? (q.uw || "").replace(/s$/, "") : "", q.wt || "", al ? al.toLowerCase() : nn].join("|"), kind, q, lo, hi, L, base, alias: al, name: strip(L.rest), cls: base };
        }
        const aisle = aisleOf(e.cls);
        if (aisle === "skip") return;
        const use = DAYS[d].slice(0, 3) + " " + SLOT_SHORT[slot] + " · " + r.dish;
        const cur = map.get(e.key);
        if (cur) { cur.n++; cur.lo += e.lo || 0; cur.hi += e.hi || 0; cur.uses.add(use); }
        else map.set(e.key, Object.assign(e, { n: 1, uses: new Set([use]), aisle }));
      }));
    });
    R = prevR;
    const lines = [...map.values()].map(e => {
      let qty = "", name = e.name;
      if (e.plain) { qty = ""; }
      else if (e.n === 1) { qty = e.L.qty; name = strip(e.L.rest); }
      else if (e.kind === "each") {
        const c = e.q.wt ? canLine(e.q, e.lo, "us") : null;
        if (c) { qty = c.qty; name = strip(c.rest); }
        else { const nv = niceEach(e.lo); qty = nv.str + (e.q.uw ? " " + unitWord(e.q.uw, nv.val) : ""); const b = dropAside(e.base); name = e.q.uw ? b : nv.val > 1 ? pluralHead(b) : single(b); }
      } else { qty = both(e.kind, e.lo, e.hi); name = e.alias || dropAside(e.base.replace(/\s*\(\d[\d.]* (?:oz|ounces?)\)/gi, "")); }
      return { key: e.key, aisle: e.aisle, qty: String(qty).replace(/\s+/g, " ").trim(), name, uses: [...e.uses] };
    });
    return AISLE_ORDER.map(a => ({ aisle: a, items: lines.filter(l => l.aisle === a).sort((x, y) => x.name.localeCompare(y.name)) })).filter(g => g.items.length);
  }
  // breakfast-y categories first in the breakfast menu, drinks and snacks first in the snack menu
  const SLOT_FIRST = { breakfast: ["Coffee"], lunch: [], dinner: [], snacks: ["Snacks", "Desserts", "Coffee", "Sauces"] };
  function recipeOptions(slot) {
    const first = SLOT_FIRST[slot] || [];
    const cats = [...CATS].sort((a, b) => { const ia = first.findIndex(x => x === a.id || x === a.title), ib = first.findIndex(x => x === b.id || x === b.title); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    return cats.map(c => {
      const list = PLANNABLE.filter(r => r.cat === c.id);
      return list.length ? `<optgroup label="${esc(c.title)}">${list.map(r => `<option value="${r.slug}">${esc(r.dish)} (${Math.round(psOf(r).cal / 10) * 10} cal)</option>`).join("")}</optgroup>` : "";
    }).join("");
  }
  const gr = x => (x > 0 && x < 1 ? "<1" : Math.round(x)) + "g";
  const cal5 = x => Math.round(x / 5) * 5;
  // FDA daily values on a 2,000-calorie diet; scaled to the reader's own calorie goal
  const DAY_ROWS = [["protein", "Protein", 50, "min"], ["carb", "Carbs", 275], ["sugar", "Sugars", 50, "sugar"], ["fiber", "Fiber", 28, "min"], ["fat", "Total fat", 78], ["sat", "Saturated fat", 20], ["sodium", "Sodium", 2300, "fixed"]];
  function totalsHTML(d) {
    const t = dayTotals(d), n = dayMeals(d).length, goal = plan.goal, f = goal / 2000;
    if (!n) return `<p class="dt-empty">Add meals to see this day's totals.</p>`;
    const left = goal - t.cal, pc = Math.min(100, (t.cal / goal) * 100);
    const rows = DAY_ROWS.map(([k, label, dv, kind]) => {
      const lim = kind === "fixed" ? dv : Math.round(dv * f), v = t[k] || 0, p = Math.round((v / lim) * 100);
      const over = kind !== "min" && p > 100, low = kind === "min" && p < 100;
      const val = k === "sodium" ? Math.round(v / 10) * 10 + "mg" : gr(v), limTxt = k === "sodium" ? lim.toLocaleString() + "mg" : lim + "g";
      const tip = kind === "min" ? `the ${limTxt} goal` : kind === "sugar" ? `the ${limTxt} added-sugar limit` : `the ${limTxt} limit`;
      return `<li class="${over ? "over" : ""}${low ? " low" : ""}"><span class="dt-l">${label}</span><span class="dt-v">${val}</span>
        <span class="dt-bar" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></span><span class="dt-p">${p}% <small>of ${tip}</small></span></li>`;
    }).join("");
    return `<div class="dt-cal">
        <div><span class="dt-k">Calories</span><strong>${cal5(t.cal).toLocaleString()}</strong><span class="dt-of">of ${goal.toLocaleString()}</span></div>
        <p class="dt-left${left < 0 ? " over" : ""}">${left >= 0 ? `${cal5(left).toLocaleString()} left` : `${cal5(-left).toLocaleString()} over`}</p>
      </div>
      <div class="dt-calbar${left < 0 ? " over" : ""}" aria-hidden="true"><i style="width:${pc}%"></i></div>
      <ul class="dt-rows">${rows}</ul>
      <p class="dt-net">Net carbs <b>${gr(Math.max(0, t.carb - t.fiber))}</b> (carbs minus fiber)</p>`;
  }
  // ---- share links: the whole week packed into the link itself (no accounts) ----
  // each dish = 3-letter recipe code + 2-char servings + 1-digit portion; slots split by ".", days by "~"
  const codeOf = s => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return (x % 46656).toString(36).padStart(3, "0"); };
  const BY_CODE = {}; PLANNABLE.forEach(r => (BY_CODE[codeOf(r.slug)] = r.slug));
  function encodePlan(p) {
    const days = p.days.map(day => SLOTS.map(([k]) => day[k].map(m => codeOf(m.slug) + clamp(m.servings, 1, 99).toString(36).padStart(2, "0") + Math.max(0, PORTIONS.indexOf(m.eat))).join("")).join("."));
    return "1-" + p.goal.toString(36) + "-" + days.join("~").replace(/(~\.\.\.)+$/, "");
  }
  function decodePlan(str) {
    try {
      const [v, g, body = ""] = String(str).split("-");
      if (v !== "1") return null;
      const out = freshPlan(); out.goal = clamp(parseInt(g, 36) || 2000, 800, 6000);
      body.split("~").slice(0, 7).forEach((day, d) => day.split(".").slice(0, 4).forEach((slot, si) => {
        for (let i = 0; i + 6 <= slot.length; i += 6) {
          const slug = BY_CODE[slot.slice(i, i + 3)]; if (!slug) continue;
          const r = BY[slug], serv = clamp(parseInt(slot.slice(i + 3, i + 5), 36) || r.base, minFor(r), 99);
          out.days[d][SLOTS[si][0]].push({ slug, servings: serv, eat: PORTIONS[+slot[i + 5]] || 1 });
        }
      }));
      return out;
    } catch (e) { return null; }
  }
  const planLink = () => location.href.split("#")[0] + "#/plan?p=" + encodePlan(plan);
  function planText(withLink) {
    const lines = ["Weekly Meal Plan, What's Inside a Mustard Seed?", ""];
    plan.days.forEach((day, d) => {
      if (!dayMeals(d).length) return;
      const t = dayTotals(d);
      lines.push(DAYS[d].toUpperCase());
      SLOTS.forEach(([k, l]) => day[k].length && lines.push(`  ${l}: ${day[k].map(x => { const r = BY[x.slug]; return `${r.dish} (feeding ${x.servings} ${unitName(r, x.servings)}${x.eat !== 1 ? `, I eat ${fracTxt(x.eat)}` : ""})`; }).join(", ")}`));
      lines.push(`  Day totals per person: ${cal5(t.cal).toLocaleString()} cal, ${gr(t.protein)} protein, ${gr(t.carb)} carbs, ${gr(t.sugar)} sugars, ${gr(t.fiber)} fiber, ${gr(t.fat)} fat, ${gr(t.sat)} sat fat, ${Math.round(t.sodium / 10) * 10}mg sodium`, "");
    });
    lines.push(`Daily calorie goal: ${plan.goal.toLocaleString()}`, "", "SHOPPING LIST");
    shoppingList().forEach(g => { lines.push("", g.aisle.toUpperCase()); g.items.forEach(it => lines.push(`[ ] ${it.qty ? it.qty + " " : ""}${it.name}`)); });
    if (withLink) lines.push("", "Open this plan on any phone or computer:", planLink());
    return lines.join("\n");
  }
  function qrSVG(text) {
    if (typeof qrcode !== "function") return "";
    try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true }); } catch (e) { return ""; }
  }

  function renderPlan(params) {
    document.title = "Weekly Meal Plan | What's Inside a Mustard Seed?";
    $("#tb-toc").hidden = false;
    plan = loadPlan();
    const incoming = params && params.get("p") ? decodePlan(params.get("p")) : null;
    if (params && params.get("p")) { try { history.replaceState(null, "", "#/plan"); } catch (e) {} }
    let pending = null;
    if (incoming) {
      const mine = mealCount(), same = mine && encodePlan(plan) === encodePlan(incoming);
      if (!mine) { incoming.day = Math.max(0, incoming.days.findIndex((_, d) => SLOTS.some(([k]) => incoming.days[d][k].length))); plan = incoming; savePlan(); setTimeout(() => toast("Shared plan opened and saved on this device"), 300); }
      else if (!same) pending = incoming;
    }
    main.innerHTML = `
    <article class="page plan">
      <div class="plan-incoming no-print" id="plan-incoming" hidden>
        <p><b>Someone shared a meal plan with you.</b> This device already has a plan saved. Do you want to replace it with the shared one?</p>
        <div class="pi-btns"><button type="button" class="btn primary" id="pi-use">Use the shared plan</button><button type="button" class="btn" id="pi-keep">Keep my plan</button></div>
      </div>
      <header class="masthead">
        <div class="rule"></div>
        <img class="emblem" src="assets/emblem.png" alt="What's Inside a Mustard Seed? emblem" width="120" height="120">
        <p class="book"><a href="#/">What's Inside a Mustard Seed?</a></p>
        <h1>Weekly Meal Plan<span class="dish">Pick your meals, then shop it in one trip</span></h1>
      </header>
      <blockquote class="verse"><p>“She rises also while it is yet night, and gives food to her household, and a portion to her maidens.”</p><cite>Mishlei 31:15, <a href="https://dvaryahuah.org/haketuvim-%d7%94%d7%9b%d7%aa%d7%95%d7%91%d7%99%d7%9d/mishlei-shlomo-%d7%9e%d7%a9%d7%9c%d7%99-%d7%a9%d7%9c%d7%9e%d7%94/mishlim-31-%d7%9e%d7%a9%d7%9c%d7%99%d7%9d-%d7%9c%d7%90/" target="_blank" rel="noopener">The Word of <span lang="he">יהוה</span></a></cite></blockquote>
      <ol class="tips plan-how no-print">
        <li><b>Pick a day, then fill in breakfast, lunch, dinner, and snacks.</b> Add more than one dish to any meal, like a main and a side.</li>
        <li><b>Set how many you're feeding.</b> The minus and plus buttons change the shopping list.</li>
        <li><b>Set your portion.</b> "I eat" is how many servings one person eats. The day's nutrition totals add up from that, so you can swap dishes or portions until the day looks right.</li>
        <li><b>Shop the list.</b> Everything is added up and sorted by store section. Tap an item to check it off.</li>
      </ol>
      <div class="plan-goal no-print">
        <label for="plan-goal">My daily calorie goal</label>
        <input id="plan-goal" type="number" inputmode="numeric" min="800" max="6000" step="50" value="${plan.goal}">
        <span class="hint">The daily limits below adjust to this. 2,000 is the standard label amount.</span>
      </div>
      <nav class="plan-tabs no-print" id="plan-tabs" aria-label="Days of the week"></nav>
      <div id="plan-days" class="plan-days"></div>
      <p class="plan-clear no-print"><button type="button" class="link-btn" id="plan-copy">Copy this day to the next day</button><button type="button" class="link-btn" id="plan-reset">Clear the whole week</button></p>
      <section class="block plan-week" aria-labelledby="week-h">
        <div class="block-head"><h2 id="week-h">Week at a Glance</h2><span class="scale-note">per person, from your portions</span></div>
        <div class="week-wrap"><table class="week-t" id="week-t"></table></div>
      </section>
      <section class="block plan-save no-print" aria-labelledby="save-h">
        <div class="block-head"><h2 id="save-h">Save or Share Your Plan</h2></div>
        <p class="ps-lead">Your plan saves on this device by itself. To open it on another phone or computer, or to send it to someone, use a link. The whole week lives inside the link, so there's no account or password.</p>
        <div class="export-grid ps-btns" id="ps-btns">
          <button type="button" class="btn primary" id="ps-send">Send my plan</button>
          <button type="button" class="btn" id="ps-copy">Copy the link</button>
          <button type="button" class="btn" id="ps-qr" aria-expanded="false" aria-controls="ps-qrbox">Show a QR code</button>
          <button type="button" class="btn" id="ps-print">Print or save as PDF</button>
          <button type="button" class="btn" id="ps-dl">Download to my phone</button>
        </div>
        <div class="ps-qrbox" id="ps-qrbox" hidden>
          <div class="ps-qr" id="ps-qrimg"></div>
          <p>Point your phone's camera at this code to open the plan there.</p>
        </div>
        <p class="ps-empty" id="ps-empty" hidden>Add a meal first, then you can save or share your plan.</p>
        <ul class="ps-tips">
          <li><b>Keep it on your phone:</b> tap Send my plan and save it to Notes or text it to yourself. On iPhone you can also open the plan, tap Share, then Add to Home Screen. On Android, tap the menu, then Add to Home screen.</li>
          <li><b>Changed something?</b> The link holds the plan as it was when you sent it. Send a new link after you make changes.</li>
          <li><b>Shopping together?</b> Each person checks off their own list. Check marks don't travel with the link.</li>
        </ul>
      </section>
      <section class="block plan-shop" aria-labelledby="shop-h">
        <div class="block-head"><h2 id="shop-h">Shopping List</h2><span class="scale-note" id="shop-count"></span></div>
        <div id="shop"></div>
        <div class="export-grid no-print" id="shop-tools">
          <button type="button" class="btn primary" id="shop-print">Print or save as PDF</button>
          <button type="button" class="btn" id="shop-share">Share or copy the list</button>
          <button type="button" class="btn" id="shop-uncheck">Uncheck everything</button>
        </div>
        <p class="hint">Amounts are added up from each recipe at the number you're feeding. Double-check your pantry for salt, pepper, oil, and spices before you go.</p>
      </section>
      <p class="n-note plan-nnote">Nutrition numbers are estimates per serving from typical USDA values for each recipe's ingredients. Optional toppings, garnishes, and to-taste seasonings aren't counted, and brands will change them. Sugars are total sugars; the 50g line is the FDA limit for added sugars, so treat it as a guide. Limits scale with your calorie goal, except sodium, which stays at 2,300mg.</p>
      <nav class="pager no-print"><span></span><a href="#/" class="pg mid">Table of Contents</a><span></span></nav>
      <footer class="foot"><div class="rule"></div><p>What's Inside a Mustard Seed? • Weekly Meal Plan</p></footer>
      <a href="#plan-days" class="plan-mini no-print" id="plan-mini" aria-live="polite"></a>
    </article>`;
    const OPTS = Object.fromEntries(SLOTS.map(([k]) => [k, recipeOptions(k)]));
    const mealRow = (m, d, k, i) => {
      const r = BY[m.slug], mn = minFor(r), p = psOf(r), e = m.eat;
      return `<li class="pmeal" data-slot="${k}" data-i="${i}">
        <img src="assets/thumbs/${r.slug}.jpg" alt="" width="56" height="56" loading="lazy">
        <div class="pm-main">
          <a class="pm-name" href="#/${r.slug}?servings=${m.servings}"><span class="pm-dish">${esc(r.dish)}</span><span class="pm-scr">${esc(r.scripture)}</span></a>
          <p class="pm-nut"><b>${cal5(p.cal * e)} cal</b> · ${gr(p.protein * e)} protein · ${gr(p.carb * e)} carbs · ${gr(p.sugar * e)} sugars · ${gr(p.fiber * e)} fiber · ${gr(p.fat * e)} fat · ${gr(p.sat * e)} sat fat · ${Math.round((p.sodium * e) / 10) * 10}mg sodium${e !== 1 ? ` <span class="pm-for">(for ${fracTxt(e)} servings)</span>` : ""}</p>
        </div>
        <div class="pm-ctl">
          <div class="pm-serv" role="group" aria-label="How many you're feeding with ${esc(r.dish)}">
            <span class="pm-lab">Feeding</span>
            <button type="button" class="step-btn no-print" data-act="dec" aria-label="Fewer servings"${m.servings <= mn ? " disabled" : ""}>−</button>
            <span class="pm-n"><b>${m.servings}</b> ${esc(unitName(r, m.servings))}</span>
            <button type="button" class="step-btn no-print" data-act="inc" aria-label="More servings"${m.servings >= 99 ? " disabled" : ""}>+</button>
          </div>
          <label class="pm-eat"><span class="pm-lab">I eat</span>
            <select data-eat aria-label="Servings one person eats of ${esc(r.dish)}">${PORTIONS.map(x => `<option value="${x}"${x === e ? " selected" : ""}>${fracTxt(x)} ${x === 1 ? unitName(r, 1) : esc(r.unit || "servings")}</option>`).join("")}</select>
          </label>
        </div>
        <button type="button" class="pm-x no-print" data-act="del" aria-label="Remove ${esc(r.dish)}">×</button>
      </li>`;
    };
    const drawTabs = () => {
      $("#plan-tabs").innerHTML = DAYS.map((name, d) => { const n = dayMeals(d).length, c = n ? cal5(dayTotals(d).cal) : 0;
        return `<button type="button" class="ptab${d === plan.day ? " on" : ""}${n && c > plan.goal ? " over" : ""}" data-day="${d}" aria-pressed="${d === plan.day}"><span class="pt-d">${name.slice(0, 3)}</span><span class="pt-c">${n ? c.toLocaleString() + " cal" : "empty"}</span></button>`; }).join("");
    };
    const drawDays = () => {
      $("#plan-days").innerHTML = plan.days.map((day, d) => { const any = dayMeals(d).length;
        return `<section class="pday${any ? "" : " empty"}${d === plan.day ? " on" : ""}" data-day="${d}" aria-label="${DAYS[d]}">
          <h2>${DAYS[d]}</h2>
          <div class="pday-grid">
            <div class="pslots">${SLOTS.map(([k, label]) => { const meals = day[k];
              return `<div class="pslot${meals.length ? "" : " empty"}" data-slot="${k}">
                <h3>${label}</h3>
                ${meals.length ? `<ul class="pmeals">${meals.map((m, i) => mealRow(m, d, k, i)).join("")}</ul>` : ""}
                <label class="padd no-print"><span class="sr-only">Add a dish to ${DAYS[d]} ${label}</span>
                  <select data-add="${d}" data-slot="${k}"><option value="">${meals.length ? "+ Add another dish" : `+ Add ${label === "Snacks and Drinks" ? "a snack or drink" : label.toLowerCase()}`}</option>${OPTS[k]}</select>
                </label>
              </div>`; }).join("")}</div>
            <aside class="dtot" aria-label="${DAYS[d]} nutrition totals"><h3>${DAYS[d]} Totals <small>per person</small></h3>${totalsHTML(d)}</aside>
          </div>
        </section>`; }).join("");
    };
    const drawWeek = () => {
      const has = DAYS.map((_, d) => dayMeals(d).length > 0), T = DAYS.map((_, d) => dayTotals(d)), nd = has.filter(Boolean).length;
      const cols = [["cal", "Calories"], ["protein", "Protein"], ["carb", "Carbs"], ["sugar", "Sugars"], ["fiber", "Fiber"], ["fat", "Fat"], ["sat", "Sat fat"], ["sodium", "Sodium"]];
      const fmt = (k, v) => (k === "cal" ? cal5(v).toLocaleString() : k === "sodium" ? (Math.round(v / 10) * 10).toLocaleString() + "mg" : gr(v));
      const avg = k => T.reduce((a, t, d) => a + (has[d] ? t[k] : 0), 0) / (nd || 1);
      $("#week-t").innerHTML = `<thead><tr><th scope="col">Day</th>${cols.map(([, l]) => `<th scope="col">${l}</th>`).join("")}</tr></thead>
        <tbody>${DAYS.map((name, d) => `<tr${has[d] ? "" : ' class="none"'}><th scope="row"><button type="button" class="link-btn" data-goto="${d}">${name}</button></th>${cols.map(([k]) => `<td${k === "cal" && has[d] && T[d].cal > plan.goal ? ' class="over"' : ""}>${has[d] ? fmt(k, T[d][k]) : "–"}</td>`).join("")}</tr>`).join("")}</tbody>
        ${nd ? `<tfoot><tr><th scope="row">Daily average</th>${cols.map(([k]) => `<td>${fmt(k, avg(k))}</td>`).join("")}</tr></tfoot>` : ""}`;
    };
    const drawShop = () => {
      const list = shoppingList(), have = new Set(plan.have);
      const n = list.reduce((a, g) => a + g.items.length, 0), meals = mealCount();
      $("#shop-count").textContent = n ? `${n} items for ${meals} ${meals === 1 ? "dish" : "dishes"}` : "";
      $("#shop-tools").hidden = !n;
      $("#shop").innerHTML = n ? list.map(g => `
        <div class="aisle"><h3>${g.aisle}</h3><ul>${g.items.map(it => `
          <li${have.has(it.key) ? ' class="got"' : ""}><label><input type="checkbox" data-key="${esc(it.key)}"${have.has(it.key) ? " checked" : ""}>
            <span class="ing-line">${it.qty ? `<span class="qty">${esc(it.qty)}</span> ` : ""}<span class="ing-name">${esc(it.name)}</span></span>
            <span class="ing-note">${esc(it.uses.join(", "))}</span></label></li>`).join("")}</ul></div>`).join("")
        : `<p class="toc-empty">Pick a dish for any meal above and your shopping list will show up here.</p>`;
    };
    const drawMini = () => {
      const d = plan.day, n = dayMeals(d).length, t = dayTotals(d), el = $("#plan-mini");
      el.hidden = !n;
      el.innerHTML = n ? `<b>${DAYS[d].slice(0, 3)}</b><span><b>${cal5(t.cal).toLocaleString()}</b> / ${plan.goal.toLocaleString()} cal</span><span>${gr(t.protein)} protein</span><span>${gr(t.carb)} carbs</span><span>${gr(t.sugar)} sugars</span>` : "";
      el.classList.toggle("over", t.cal > plan.goal);
    };
    const redrawHooks = [];
    const redraw = () => { savePlan(); drawTabs(); drawDays(); drawWeek(); drawShop(); drawMini(); redrawHooks.forEach(f => f()); };
    const refocus = sel => { const el = $(sel); el && !el.disabled && el.focus(); };
    redraw();
    const showDay = d => { plan.day = d; savePlan(); drawTabs(); drawMini(); $$(".pday").forEach(s => s.classList.toggle("on", +s.dataset.day === d)); };
    $("#plan-tabs").addEventListener("click", e => { const b = e.target.closest(".ptab"); if (b) { showDay(+b.dataset.day); refocus(`.ptab[data-day="${b.dataset.day}"]`); } });
    $("#week-t").addEventListener("click", e => { const b = e.target.closest("[data-goto]"); if (b) { showDay(+b.dataset.goto); $("#plan-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } });
    $("#plan-goal").addEventListener("change", e => { plan.goal = clamp(Math.round(+e.target.value || 2000), 800, 6000); e.target.value = plan.goal; redraw(); });
    $("#plan-days").addEventListener("change", e => {
      const sel = e.target.closest("select[data-add]");
      if (sel && sel.value) {
        const r = BY[sel.value], d = +sel.dataset.add, k = sel.dataset.slot, label = SLOTS.find(s => s[0] === k)[1];
        plan.days[d][k].push({ slug: r.slug, servings: Math.max(r.base, minFor(r)), eat: 1 });
        redraw(); toast(`${r.dish} added to ${DAYS[d]} ${label === "Snacks and Drinks" ? "snacks" : label.toLowerCase()}`);
        refocus(`.pday[data-day="${d}"] select[data-slot="${k}"][data-add]`);
        return;
      }
      const eat = e.target.closest("select[data-eat]");
      if (eat) {
        const li = eat.closest(".pmeal"), d = +eat.closest(".pday").dataset.day, k = li.dataset.slot, i = +li.dataset.i;
        plan.days[d][k][i].eat = +eat.value; redraw();
        refocus(`.pday[data-day="${d}"] .pmeal[data-slot="${k}"][data-i="${i}"] select[data-eat]`);
      }
    });
    $("#plan-days").addEventListener("click", e => {
      const b = e.target.closest("button[data-act]"); if (!b) return;
      const li = b.closest(".pmeal"), d = +b.closest(".pday").dataset.day, k = li.dataset.slot, i = +li.dataset.i, m = plan.days[d][k][i], r = BY[m.slug];
      if (b.dataset.act === "del") plan.days[d][k].splice(i, 1);
      else m.servings = clamp(m.servings + (b.dataset.act === "inc" ? 1 : -1), minFor(r), 99);
      redraw();
      refocus(b.dataset.act === "del" ? `.pday[data-day="${d}"] select[data-slot="${k}"][data-add]` : `.pday[data-day="${d}"] .pmeal[data-slot="${k}"][data-i="${i}"] button[data-act="${b.dataset.act}"]`);
    });
    $("#shop").addEventListener("change", e => {
      const c = e.target.closest("input[data-key]"); if (!c) return;
      const have = new Set(plan.have); c.checked ? have.add(c.dataset.key) : have.delete(c.dataset.key);
      plan.have = [...have]; savePlan(); c.closest("li").classList.toggle("got", c.checked);
    });
    $("#plan-copy").onclick = () => {
      const d = plan.day, n = (d + 1) % 7;
      if (!dayMeals(d).length) return toast(`${DAYS[d]} doesn't have any meals yet`);
      if (dayMeals(n).length && !confirm(`Replace everything on ${DAYS[n]} with ${DAYS[d]}'s meals?`)) return;
      plan.days[n] = JSON.parse(JSON.stringify(plan.days[d])); plan.day = n; redraw(); toast(`${DAYS[d]} copied to ${DAYS[n]}`);
    };
    $("#plan-reset").onclick = () => { if (!mealCount() || confirm("Clear every meal from this week?")) { const g = plan.goal; plan = freshPlan(); plan.goal = g; redraw(); } };
    $("#shop-uncheck").onclick = () => { plan.have = []; redraw(); };
    $("#shop-print").onclick = () => printAs("full");
    const hasMeals = () => { if (mealCount()) return true; toast("Add a meal first"); return false; };
    const drawSave = () => { const n = mealCount(); $("#ps-empty").hidden = !!n; $$("#ps-btns .btn").forEach(b => (b.disabled = !n)); if (!n) { $("#ps-qrbox").hidden = true; $("#ps-qr").setAttribute("aria-expanded", "false"); $("#ps-qr").textContent = "Show a QR code"; } else if (!$("#ps-qrbox").hidden) $("#ps-qrimg").innerHTML = qrSVG(planLink()); };
    redrawHooks.push(drawSave); drawSave();
    const copyText = async (text, msg) => { try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { window.prompt("Copy this link:", text); } };
    $("#ps-send").onclick = async () => {
      if (!hasMeals()) return;
      const url = planLink();
      try { if (navigator.share) return await navigator.share({ title: "My Weekly Meal Plan", text: "My weekly meal plan from What's Inside a Mustard Seed?", url }); } catch (err) { if (err && err.name === "AbortError") return; }
      copyText(url, "Link copied. Paste it in a text, email, or your notes.");
    };
    $("#ps-copy").onclick = () => hasMeals() && copyText(planLink(), "Link copied");
    $("#ps-qr").onclick = () => {
      if (!hasMeals()) return;
      const box = $("#ps-qrbox"), open = box.hidden;
      box.hidden = !open; $("#ps-qr").setAttribute("aria-expanded", String(open)); $("#ps-qr").textContent = open ? "Hide the QR code" : "Show a QR code";
      if (open) { const svg = qrSVG(planLink()); $("#ps-qrimg").innerHTML = svg || "<p>The QR code couldn't load. Use Copy the link instead.</p>"; }
    };
    $("#ps-print").onclick = () => hasMeals() && printAs("full");
    $("#ps-dl").onclick = () => {
      if (!hasMeals()) return;
      const a = document.createElement("a"), blob = new Blob([planText(true)], { type: "text/plain" });
      a.href = URL.createObjectURL(blob); a.download = "Weekly Meal Plan.txt"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast("Saved as Weekly Meal Plan.txt");
    };
    if (pending) {
      const box = $("#plan-incoming"); box.hidden = false;
      $("#pi-use").onclick = () => { const g = pending; g.day = Math.max(0, g.days.findIndex((_, d) => SLOTS.some(([k]) => g.days[d][k].length))); plan = g; pending = null; box.hidden = true; redraw(); toast("Shared plan opened and saved on this device"); };
      $("#pi-keep").onclick = () => { pending = null; box.hidden = true; toast("Kept your plan"); };
    }
    $("#shop-share").onclick = async () => {
      const lines = ["Shopping List, What's Inside a Mustard Seed?", ""];
      plan.days.forEach((day, d) => { const parts = SLOTS.filter(([k]) => day[k].length).map(([k, l]) => `${l}: ${day[k].map(x => `${BY[x.slug].dish} (${x.servings} ${unitName(BY[x.slug], x.servings)})`).join(", ")}`); if (parts.length) lines.push(`${DAYS[d]}`, ...parts.map(p => "  " + p)); });
      shoppingList().forEach(g => { lines.push("", g.aisle.toUpperCase()); g.items.forEach(it => lines.push(`[ ] ${it.qty ? it.qty + " " : ""}${it.name}`)); });
      const text = lines.join("\n");
      try { if (navigator.share) return await navigator.share({ title: "Shopping List", text }); await navigator.clipboard.writeText(text); toast("Shopping list copied"); } catch (err) { if (err && err.name !== "AbortError") toast("Couldn't copy the list"); }
    };
    window.scrollTo(0, 0);
  }

  // ---------------- router ----------------
  let suppress = false;
  function route() {
    if (suppress) return;
    const { slug, params } = parseHashQuery();
    R = null; state = null;
    if (!slug) renderHome(); else if (slug === "about") renderAbout(); else if (slug === "plan") renderPlan(params); else renderRecipe(slug, params);
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
