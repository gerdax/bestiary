(function () {
  "use strict";
  const store = window.OneRingStore;
  const host = document.getElementById("heroes"), battleList = document.getElementById("hero-battle-list");
  if (!host || !battleList || !store) return;
  const fields = ["name", "culture", "strength", "heart", "wits", "strengthTN", "heartTN", "witsTN", "endurance", "maxEndurance", "hope", "maxHope", "shadow", "load", "fatigue", "parry", "armour", "weapons", "proficiencies", "stance", "conditions", "notes"];
  const numeric = new Set(["strength", "heart", "wits", "strengthTN", "heartTN", "witsTN", "endurance", "maxEndurance", "hope", "maxHope", "shadow", "load", "fatigue", "parry", "armour"]);
  let editingId = null, draftDirty = false;
  const dirtyFields = new Set();
  const listCards = new Map();
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const heroById = id => store.getState().heroes.find(h => h.id === id);

  host.innerHTML = `<div class="section-heading hero-heading"><div><h2>Bohaterowie</h2><p>Arkusze Drużyny i gotowość do potyczki.</p></div><button type="button" class="text-button" data-hero-action="new">+ Nowy bohater</button></div><div class="heroes-layout"><div id="hero-list" class="hero-list" role="tablist" aria-label="Arkusze bohaterów"></div><div id="hero-empty-panel" class="hero-empty" hidden>Nie ma jeszcze bohaterów. Użyj „Nowy bohater”, aby utworzyć pierwszy arkusz.</div><form id="hero-editor" class="paper form-card hero-editor" role="tabpanel" aria-label="Arkusz bohatera" novalidate></form></div>`;
  const list = host.querySelector("#hero-list"), form = host.querySelector("#hero-editor");

  function field(label, name, type = "text", extra = "") { return `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`; }
  function drawEditor(hero) {
    const value = name => hero && hero[name] != null ? hero[name] : (name === "stance" ? "Wyważona" : "");
    const input = name => String(!hero && numeric.has(name) ? 0 : value(name)).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    form.innerHTML = `<div class="hero-editor-top"><p class="enemy-tier">ARKUSZ BOHATERA</p><div class="hero-editor-actions"></div></div>
      <div class="two-fields">${field("Imię", "name", "text", `required maxlength="80" value="${input("name")}"`)}${field("Rodzima kultura", "culture", "text", `maxlength="80" value="${input("culture")}"`)}</div>
      <div class="stats-inputs hero-stats">${field("Siła", "strength", "number", `min="0" value="${input("strength")}"`)}${field("Serce", "heart", "number", `min="0" value="${input("heart")}"`)}${field("Rozum", "wits", "number", `min="0" value="${input("wits")}"`)}${field("PT Siły", "strengthTN", "number", `min="0" value="${input("strengthTN")}"`)}${field("PT Serca", "heartTN", "number", `min="0" value="${input("heartTN")}"`)}${field("PT Rozumu", "witsTN", "number", `min="0" value="${input("witsTN")}"`)}</div>
      <div class="stats-inputs hero-stats">${field("Wytrzymałość", "endurance", "number", `min="0" value="${input("endurance")}"`)}${field("Maks. Wytrzymałość", "maxEndurance", "number", `min="0" value="${input("maxEndurance")}"`)}${field("Nadzieja", "hope", "number", `min="0" value="${input("hope")}"`)}${field("Maks. Nadzieja", "maxHope", "number", `min="0" value="${input("maxHope")}"`)}${field("Cień", "shadow", "number", `min="0" value="${input("shadow")}"`)}${field("Obciążenie", "load", "number", `min="0" value="${input("load")}"`)}${field("Znużenie", "fatigue", "number", `min="0" value="${input("fatigue")}"`)}${field("Obrona", "parry", "number", `min="0" value="${input("parry")}"`)}${field("Pancerz", "armour", "number", `min="0" value="${input("armour")}"`)}</div>
      <div class="two-fields"><label>Postawa<select name="stance"><option>Zapalczywa</option><option>Wyważona</option><option>Ostrożna</option><option>Bezpieczna</option></select></label><label>Stan / warunki<textarea name="conditions" rows="2" maxlength="300"></textarea></label></div>
      <label>Bronie<textarea name="weapons" rows="2" maxlength="500"></textarea></label><label>Biegłości bojowe<textarea name="proficiencies" rows="2" maxlength="500"></textarea></label><label>Notatki<textarea name="notes" rows="3" maxlength="1000"></textarea></label>
      <div class="form-actions hero-editor-footer"><div class="hero-editor-footer-actions"></div><span class="hero-save-status" role="status" aria-live="polite">Zapisano automatycznie</span></div>`;
    ["conditions", "weapons", "proficiencies", "notes"].forEach(name => form.elements[name].value = value(name));
    form.elements.stance.value = value("stance") || "Wyważona";
    if (hero) { const actions = form.querySelector(".hero-editor-actions"), footer = form.querySelector(".hero-editor-footer-actions"), inBattle = store.getState().heroParticipants.some(p => p.heroId === hero.id); const battle = el("button", "text-button", inBattle ? "W walce" : "Do walki"); battle.type = "button"; battle.dataset.heroAction = "battle"; battle.dataset.id = hero.id; battle.disabled = inBattle; actions.append(battle); const remove = el("button", "text-button danger", "Usuń"); remove.type = "button"; remove.dataset.heroAction = "delete"; remove.dataset.id = hero.id; footer.append(remove); }
    draftDirty = false; dirtyFields.clear();
  }
  function status(text) { const target = form.querySelector(".hero-save-status"); if (target) target.textContent = text; }
  function edit(id) { const hero = heroById(id); if (!hero) return; editingId = id; drawEditor(hero); renderList(); }
  function restoreEditor() { const hero = heroById(editingId); if (hero) drawEditor(hero); }
  function createHero() { if (!mayDiscard()) return; try { const saved = store.saveHero({ name: "Bohater" }); editingId = saved.id; drawEditor(saved); renderList(); } catch (_) { const prior = host.querySelector(".hero-create-status"); if (prior) prior.remove(); host.querySelector(".hero-heading").append(el("span", "hero-create-status", "Nie udało się utworzyć bohatera.")); } }
  function mayDiscard() { return !draftDirty || confirm("Niezapisany szkic zostanie porzucony."); }
  function discardDraft() { restoreEditor(); }
  function validForm(names) {
    for (const name of names) {
      const control = form.elements[name]; if (!control) continue;
      if (numeric.has(name) && (!control.value.trim() || !Number.isFinite(Number(control.value)) || Number(control.value) < 0)) { control.setCustomValidity("Podaj liczbę równą zero lub większą."); control.reportValidity(); control.setCustomValidity(""); return false; }
      if (name === "name" && !control.value.trim()) { control.setCustomValidity("Podaj imię bohatera."); control.reportValidity(); control.setCustomValidity(""); return false; }
    }
    return true;
  }
  function syncEditor() {
    if (!editingId) return;
    const hero = heroById(editingId);
    if (!hero) { editingId = null; draftDirty = false; dirtyFields.clear(); return; }
    fields.forEach(name => { const control = form.elements[name]; if (!control || dirtyFields.has(name)) return; const next = hero[name] == null ? "" : String(hero[name]); if (control.value !== next) control.value = next; });
  }
  function renderList() {
    const state = store.getState(), ids = new Set(state.heroes.map(hero => hero.id));
    listCards.forEach((card, id) => { if (!ids.has(id)) { card.remove(); listCards.delete(id); } });
    const emptyPanel = host.querySelector("#hero-empty-panel");
    if (!state.heroes.length) { form.hidden = true; emptyPanel.hidden = false; return; }
    form.hidden = false; emptyPanel.hidden = true;
    if (!editingId) { editingId = state.heroes[0].id; drawEditor(state.heroes[0]); }
    state.heroes.forEach(hero => {
      let card = listCards.get(hero.id);
      if (!card) { card = el("button", "hero-list-card"); card.type = "button"; card.role = "tab"; card.id = "hero-tab-" + hero.id; card.dataset.heroAction = "edit"; card.dataset.id = hero.id; card.setAttribute("aria-controls", "hero-editor"); listCards.set(hero.id, card); list.append(card); }
      const selected = hero.id === editingId; card.classList.toggle("is-editing", selected); card.textContent = hero.name || "Bez imienia"; card.setAttribute("aria-selected", String(selected)); card.tabIndex = selected ? 0 : -1;
    });
  }
  function renderBattle() {
    const participants = store.getParticipants().filter(p => p.type === "hero"); battleList.replaceChildren();
    participants.forEach(hero => {
      const card = el("article", "battle-card hero-battle-card" + (hero.defeated ? " defeated-card" : "")); card.dataset.id = hero.id;
      const top = el("div", "card-top"), title = el("div"); title.append(el("p", "enemy-tier", hero.culture || "BOHATER"), el("h3", "enemy-name", hero.name || "Bez imienia"), el("p", "enemy-kind", `${hero.stance || "Wyważona"}${hero.conditions ? " · " + hero.conditions : ""}`));
      const actions = el("div", "card-actions"); [ ["Edytuj arkusz", "edit"], ["×", "remove"] ].forEach(([label, action]) => { const b = el("button", action === "remove" ? "icon-button" : "text-button", label); b.type = "button"; b.dataset.heroAction = action; b.dataset.id = hero.id; b.title = action === "remove" ? "Usuń ze starcia" : "Edytuj arkusz"; actions.append(b); }); top.append(title, actions); card.append(top);
      const meters = el("div", "combat-stats"); [["WYTRZYMAŁOŚĆ", "endurance", hero.maxEndurance], ["NADZIEJA", "hope", hero.maxHope]].forEach(([label, field, max]) => { const meter = el("div", "meter"), controls = el("div", "adjusters"); meter.append(el("p", "", label), el("strong", "", `${hero[field]}/${max}`)); [-5, -1, 1, 5].forEach(delta => { const b = el("button", "", (delta > 0 ? "+" : "") + delta); b.type = "button"; b.dataset.heroResource = field; b.dataset.change = delta; b.dataset.id = hero.id; controls.append(b); }); meter.append(controls); meters.append(meter); }); card.append(meters);
      card.append(el("p", "detail", `Cień ${hero.shadow} · Obciążenie ${hero.load} · Znużenie ${hero.fatigue} · Obrona ${hero.parry} · Pancerz ${hero.armour}`));
      if (hero.weapons) card.append(el("p", "detail", `Bronie: ${hero.weapons}`));
      if (hero.proficiencies) card.append(el("p", "detail", `Biegłości bojowe: ${hero.proficiencies}`));
      const defeated = el("button", "defeated", hero.defeated ? "Przywróć do walki" : "Oznacz jako pokonanego"); defeated.type = "button"; defeated.dataset.heroAction = "defeated"; defeated.dataset.id = hero.id; card.append(defeated); battleList.append(card);
    });
  }
  function render() { const layout = host.querySelector(".heroes-layout"), priorError = host.querySelector(".hero-error"); if (store.loadError) { layout.hidden = true; if (!priorError) host.querySelector(".hero-heading").append(el("p", "hero-error", "Nie można odczytać zapisanych danych bohaterów. Przywróć poprawną pełną kopię.")); return; } layout.hidden = false; if (priorError) priorError.remove(); syncEditor(); renderList(); syncHeader(); renderBattle(); }
  host.addEventListener("click", event => { const button = event.target.closest("[data-hero-action]"); if (!button) return; const { heroAction: action, id } = button.dataset; if (action === "new") createHero(); else if (action === "edit") { if (!mayDiscard()) return; edit(id); } else if (action === "battle") store.addHero(id); else if (action === "delete" && confirm("Usunąć bohatera oraz jego udział w walce?")) { const heroes = store.getState().heroes, index = heroes.findIndex(hero => hero.id === id), next = heroes[index + 1] || heroes[index - 1]; if (editingId === id) { editingId = next ? next.id : null; draftDirty = false; dirtyFields.clear(); } store.deleteHero(id); if (editingId) edit(editingId); } });
  list.addEventListener("keydown", event => { const tabs = [...listCards.values()]; if (!tabs.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const current = tabs.indexOf(event.target.closest('[role="tab"]')); let index = current; if (event.key === "Home") index = 0; else if (event.key === "End") index = tabs.length - 1; else index = (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; const target = tabs[index]; if (target && mayDiscard()) { edit(target.dataset.id); target.focus(); } });
  battleList.addEventListener("click", event => { const button = event.target.closest("button"); if (!button) return; const id = button.dataset.id; if (button.dataset.heroResource) store.adjustResource(id, button.dataset.heroResource, Number(button.dataset.change)); else if (button.dataset.heroAction === "remove") store.removeParticipant(id); else if (button.dataset.heroAction === "defeated") store.toggleDefeated(id); else if (button.dataset.heroAction === "edit") { if (!mayDiscard()) return; if (draftDirty) discardDraft(); document.querySelector('[data-tab="heroes"]').click(); edit(id.replace(/^hero:/, "")); } });
  form.addEventListener("input", event => { if (fields.includes(event.target.name)) { draftDirty = true; dirtyFields.add(event.target.name); status("Niezapisane zmiany"); } });
  form.addEventListener("change", event => { if (!editingId) return; const name = event.target.name; if (!fields.includes(name) || !validForm([name])) { if (fields.includes(name)) status("Popraw zaznaczone pole."); return; } const value = numeric.has(name) ? Number(event.target.value) : event.target.value.trim(), current = heroById(editingId); if (current && current[name] === value) { dirtyFields.delete(name); draftDirty = dirtyFields.size > 0; status("Zapisano automatycznie"); return; } try { store.saveHero({ id: editingId, [name]: value }); dirtyFields.delete(name); draftDirty = dirtyFields.size > 0; syncEditor(); status("Zapisano automatycznie"); } catch (_) { status("Nie udało się zapisać pola."); } });
  form.addEventListener("submit", event => { event.preventDefault(); const active = document.activeElement; if (active && form.contains(active) && typeof active.blur === "function") active.blur(); });
  function syncHeader() { const hero = heroById(editingId), button = form.querySelector('[data-hero-action="battle"]'); if (!hero || !button) return; const inBattle = store.getState().heroParticipants.some(p => p.heroId === hero.id); button.textContent = inBattle ? "W walce" : "Do walki"; button.disabled = inBattle; }
  document.querySelector(".tabs").addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (tab && tab.dataset.tab === "heroes") { syncEditor(); syncHeader(); }
    if (tab && tab.dataset.tab !== "heroes" && draftDirty) { if (!confirm("Niezapisany szkic zostanie porzucony.")) { event.preventDefault(); event.stopImmediatePropagation(); } else restoreEditor(); }
  }, true);
  store.subscribe(render); render();
})();
