(function (root) {
  'use strict';

  const config = { actor: 'hero', baseDice: 0, featMode: 'normal', exhausted: false,
    miserable: false, bonus: 0, hope: false, inspired: false, target: '' };
  let dialog, launch, setup, resultPanel, stage, opener, pending = null, generation = 0;

  function element(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function mount() {
    if (dialog || !document.body) return;
    launch = element('<button type="button" class="dice-launch" aria-label="Otwórz rzut kośćmi">⚄ <span>Rzuć kośćmi</span></button>');
    dialog = element(`<dialog class="dice-dialog" aria-label="Rzut kośćmi">
      <div class="dice-dialog-layout">
        <div class="dice-table" aria-label="Stół do rzutu kośćmi"><div id="dice-stage"></div></div>
        <section class="dice-sheet" aria-live="polite">
          <div class="dice-sheet-head"><h2 id="dice-heading">Rzut</h2><button type="button" class="dice-close" aria-label="Zamknij rzut">×</button></div>
          <div class="dice-setup">
            <fieldset class="dice-field"><legend>Kto rzuca?</legend><div class="dice-options" data-choice="actor"><button type="button" data-value="hero">Bohater</button><button type="button" data-value="enemy">Wróg</button></div></fieldset>
            <fieldset class="dice-field"><legend>Kości sukcesu</legend><div class="dice-options dice-counts" data-choice="baseDice"><button type="button" data-value="0">0</button><button type="button" data-value="1">1</button><button type="button" data-value="2">2</button><button type="button" data-value="3">3</button><button type="button" data-value="4">4</button><button type="button" data-value="5">5</button><button type="button" data-value="6">6</button></div></fieldset>
            <fieldset class="dice-field"><legend>Kość działania</legend><div class="dice-options" data-choice="featMode"><button type="button" data-value="weary">Osłabiona</button><button type="button" data-value="normal">Normalna</button><button type="button" data-value="favoured">Wzmocniona</button></div></fieldset>
            <div class="dice-checks"><label><input type="checkbox" data-check="exhausted"> Wyczerpany</label><label class="dice-miserable"><input type="checkbox" data-check="miserable"> Przygnębiony</label></div>
            <div class="dice-lower"><div class="dice-bonus"><span>Premia / kara</span><div class="dice-stepper"><button type="button" data-step="-1" aria-label="Zmniejsz premię">−</button><output class="dice-bonus-value">0k</output><button type="button" data-step="1" aria-label="Zwiększ premię">+</button></div></div>
              <label class="dice-target">PT <span>(opcjonalnie)</span><input type="number" min="0" step="1" inputmode="numeric" data-target></label></div>
            <div class="dice-hope"><label><input type="checkbox" data-check="hope"> Wydaj Nadzieję <span>+1k</span></label><label class="dice-inspired"><input type="checkbox" data-check="inspired"> Natchniony <span>→ +2k</span></label></div>
            <div class="dice-pool" role="status"></div><div class="dice-preview" aria-hidden="true"></div>
            <p class="dice-error" role="alert" hidden></p><button type="button" class="dice-roll">Rzuć</button>
          </div>
          <div class="dice-result" hidden></div>
        </section>
      </div>
    </dialog>`);
    document.body.append(launch, dialog);
    setup = dialog.querySelector('.dice-setup');
    resultPanel = dialog.querySelector('.dice-result');
    stage = dialog.querySelector('#dice-stage');
    launch.addEventListener('click', open);
    dialog.querySelector('.dice-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.classList.contains('dice-dialog-layout')) close();
    });
    setup.addEventListener('click', event => {
      const choice = event.target.closest('[data-choice] button');
      if (choice) {
        const field = choice.parentElement.dataset.choice;
        config[field] = field === 'baseDice' ? Number(choice.dataset.value) : choice.dataset.value;
        renderSetup();
      }
      const step = event.target.closest('[data-step]');
      if (step) { config.bonus = Math.max(-6, Math.min(6, config.bonus + Number(step.dataset.step))); renderSetup(); }
    });
    setup.addEventListener('change', event => {
      if (event.target.dataset.check) { config[event.target.dataset.check] = event.target.checked; renderSetup(); }
      if (event.target.matches('[data-target]')) { config.target = event.target.value; renderSetup(); }
    });
    setup.querySelector('.dice-roll').addEventListener('click', roll);
    renderSetup();
  }

  function renderSetup() {
    if (!dialog) return;
    dialog.dataset.actor = config.actor;
    setup.querySelectorAll('[data-choice]').forEach(group => {
      const field = group.dataset.choice;
      group.querySelectorAll('button').forEach(button => {
        const selected = String(config[field]) === button.dataset.value;
        button.setAttribute('aria-pressed', String(selected));
      });
    });
    setup.querySelectorAll('[data-check]').forEach(input => { input.checked = !!config[input.dataset.check]; });
    setup.querySelector('.dice-miserable').hidden = config.actor === 'enemy';
    setup.querySelector('.dice-hope').hidden = config.actor === 'enemy';
    setup.querySelector('.dice-inspired').hidden = !config.hope;
    setup.querySelector('[data-target]').value = config.target;
    setup.querySelector('.dice-bonus-value').textContent = `${config.bonus > 0 ? '+' : ''}${config.bonus}k`;
    setup.querySelectorAll('button, input').forEach(control => { control.disabled = !!pending; });
    setup.querySelector('[data-step="-1"]').disabled = !!pending || config.bonus <= -6;
    setup.querySelector('[data-step="1"]').disabled = !!pending || config.bonus >= 6;
    const pool = root.DiceRules.calculatePool(config);
    const featCount = config.featMode === 'normal' ? 1 : 2;
    setup.querySelector('.dice-pool').textContent = `Pula: ${featCount} × kość działania · ${pool} × kość sukcesu`;
    const preview = setup.querySelector('.dice-preview');
    preview.replaceChildren();
    for (let i = 0; i < featCount + pool; i++) {
      const die = document.createElement('span');
      die.className = `dice-preview-die ${i < featCount ? 'dice-feat' : 'dice-success'}`;
      die.textContent = i < featCount ? '✦' : '6';
      preview.append(die);
    }
    setup.querySelector('.dice-roll').disabled = !!pending;
  }

  function resizeStage() {
    requestAnimationFrame(() => {
      if (dialog && dialog.open) window.dispatchEvent(new Event('resize'));
    });
  }

  function showError(message) {
    const error = setup.querySelector('.dice-error');
    error.textContent = message;
    error.hidden = false;
  }

  function open() {
    mount();
    if (!dialog || dialog.open) return;
    opener = document.activeElement;
    if (!pending) dialog.querySelector('.dice-sheet').style.minHeight = '';
    setup.hidden = false;
    resultPanel.hidden = true;
    dialog.querySelector('#dice-heading').textContent = 'Rzut';
    dialog.showModal();
    renderSetup();
    resizeStage();
    setup.querySelector('[data-choice="actor"] button[aria-pressed="true"]').focus();
  }

  function close() {
    if (!dialog || !dialog.open) return;
    generation++;
    dialog.close();
    if (root.DiceEngine && typeof root.DiceEngine.clear === 'function') root.DiceEngine.clear();
    if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
  }

  function resultDie(face, selected) {
    const node = document.createElement('span');
    node.className = `dice-result-die${selected ? ' is-selected' : ''}`;
    const label = root.DiceRules.featLabel(face);
    node.textContent = label;
    if (selected) {
      const selectedLabel = document.createElement('small');
      selectedLabel.textContent = 'wykorzystana';
      node.append(selectedLabel);
      node.setAttribute('aria-label', `${label}, wykorzystana`);
    }
    return node;
  }

  function showResult(outcome) {
    resultPanel.replaceChildren();
    const featTitle = element('<h3>Kość działania</h3>');
    const featRow = element('<div class="dice-result-row"></div>');
    outcome.feat.forEach((face, index) => featRow.append(resultDie(face, index === outcome.selectedFeatIndex)));
    const successTitle = element('<h3>Kości sukcesu</h3>');
    const successRow = element('<div class="dice-result-row"></div>');
    outcome.successDice.forEach(die => {
      const item = element('<span class="dice-result-die"></span>');
      item.textContent = die.value === die.raw ? String(die.raw) : `${die.raw} → 0`;
      successRow.append(item);
    });
    const summary = element('<div class="dice-result-summary"></div>');
    const total = element('<p class="dice-total"></p>');
    total.textContent = `Suma: ${outcome.sum}`;
    const marks = element('<p></p>');
    marks.textContent = `Znaki sukcesu: ${outcome.marks}`;
    summary.append(total, marks);
    if (outcome.target !== null) {
      const verdict = element('<p class="dice-verdict"></p>');
      const reason = outcome.automaticFailure ? ' · Oko Saurona: automatyczna porażka' :
        outcome.automaticSuccess ? ` · ${outcome.selectedFeatLabel}: automatyczny sukces` : '';
      verdict.textContent = `${outcome.passed ? 'Sukces' : 'Porażka'} · PT ${outcome.target}${reason}`;
      summary.append(verdict);
    }
    const again = element('<button type="button" class="dice-again">Przygotuj kolejny rzut</button>');
    again.addEventListener('click', () => {
      dialog.querySelector('.dice-sheet').style.minHeight = '';
      resultPanel.hidden = true;
      setup.hidden = false;
      dialog.querySelector('#dice-heading').textContent = 'Rzut';
      if (root.DiceEngine && typeof root.DiceEngine.clear === 'function') root.DiceEngine.clear();
      renderSetup();
      resizeStage();
      setup.querySelector('.dice-roll').focus();
    });
    resultPanel.append(featTitle, featRow, successTitle, successRow, summary, again);
    setup.hidden = true;
    resultPanel.hidden = false;
    dialog.querySelector('#dice-heading').textContent = 'Wynik';
    again.focus();
  }

  async function roll() {
    if (pending || !dialog.open) return;
    const targetInput = setup.querySelector('[data-target]');
    if (!targetInput.checkValidity()) { targetInput.reportValidity(); return; }
    config.target = targetInput.value;
    setup.querySelector('.dice-error').hidden = true;
    if (!root.DiceEngine || typeof root.DiceEngine.roll !== 'function') {
      showError('Silnik kości jest niedostępny.');
      return;
    }
    // Keep the tray dimensions stable when setup is replaced by the result.
    const sheet = dialog.querySelector('.dice-sheet');
    sheet.style.minHeight = `min(${sheet.getBoundingClientRect().height}px, var(--dice-sheet-max))`;
    const token = ++generation;
    const snapshot = { ...config };
    const pool = root.DiceRules.calculatePool(snapshot);
    const button = setup.querySelector('.dice-roll');
    button.disabled = true;
    button.textContent = 'Kości w ruchu…';
    dialog.dataset.rolling = 'true';
    try {
      pending = Promise.resolve(root.DiceEngine.roll({
        container: stage, actor: snapshot.actor,
        featCount: snapshot.featMode === 'normal' ? 1 : 2, successCount: pool
      }));
      renderSetup();
      const raw = await pending;
      if (token !== generation || !dialog.open) return;
      showResult(root.DiceRules.interpretRoll(snapshot, raw));
    } catch (error) {
      if (token === generation && dialog.open) showError(`Rzut się nie powiódł: ${error && error.message ? error.message : 'nieznany błąd. Spróbuj ponownie.'}`);
    } finally {
      pending = null;
      button.textContent = 'Rzuć';
      dialog.dataset.rolling = 'false';
      if (dialog.open) renderSetup();
    }
  }

  root.DiceRoller = { open, close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(globalThis);
