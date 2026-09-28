/* Lazy adapter: the only layer that knows Dice Box. Results come from its physics. */
(function (root) {
  'use strict';
  const base = new URL('./vendor/dice-box/', document.currentScript.src);
  let box, initializing, failure, busy = false, clearWhenDone = false;
  function deadline(promise, milliseconds) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Silnik kości nie odpowiedział. Zamknij panel i odśwież stronę, aby spróbować ponownie.')), milliseconds);
    })]).finally(() => clearTimeout(timer));
  }
  function visualScale(container) {
    // The fixed camera projects world units proportionally to canvas CSS height.
    // Keep scale × height constant (~60 CSS px per die), independent of the sheet,
    // window height and device pixel ratio. Physics and meshes receive the same scale.
    return (4400 / 1.5) / Math.max(1, container.clientHeight);
  }
  async function init(container) {
    if (box) return box;
    if (!initializing) initializing = (async () => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl');
      if (!gl) throw new Error('Rzuty 3D wymagają obsługi WebGL w przeglądarce.');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const { default: DiceBox } = await import(new URL('dice-box.es.js', base).href);
      const candidate = new DiceBox({
        container: '#' + container.id, id: 'tor-dice-canvas',
        origin: base.origin, assetPath: new URL('assets/', base).pathname,
        theme: 'tor-hero', themeColor: '#efe0bf',
        offscreen: false, scale: visualScale(container), settleTimeout: 2000,
        mass: 2.4, gravity: 2.3, friction: 0.95, restitution: 0.05,
        angularDamping: 0.78, linearDamping: 0.68, spinForce: 3, throwForce: 4,
        enableShadows: true, lightIntensity: 1.2,
        suspendSimulation: false
      });
      await candidate.init();
      box = candidate;
      return box;
    })().catch(error => { initializing = null; throw error; });
    return initializing;
  }
  root.DiceEngine = Object.freeze({
    async roll({ container, actor, featCount, successCount }) {
      if (failure) throw failure;
      if (busy) throw new Error('Poprzedni rzut jeszcze trwa.');
      if (![1, 2].includes(featCount) || !Number.isInteger(successCount) || successCount < 0 || successCount > 14) throw new Error('Nieprawidłowa pula kości.');
      busy = true;
      clearWhenDone = false;
      try {
        return await deadline((async () => {
          const engine = await init(container);
          const enemy = actor === 'enemy';
          await engine.updateConfig({scale: visualScale(container), theme: enemy ? 'tor-enemy' : 'tor-hero', themeColor: enemy ? '#23252b' : '#efe0bf'});
          // The dialog can change the tray size between setup and rolling.
          window.dispatchEvent(new Event('resize'));
          const notation = [`${featCount}d12`];
          if (successCount) notation.push(`${successCount}d6`);
          const dice = await engine.roll(notation);
          return { feat: dice.filter(d => d.sides === 12).map(d => d.value), success: dice.filter(d => d.sides === 6).map(d => d.value) };
        })(), 30000);
      } catch (error) {
        // Dice Box has no public disposal API. Never start a second world after a timeout.
        failure = new Error(`${error.message} Odśwież stronę, aby ponownie uruchomić silnik 3D.`);
        throw failure;
      } finally {
        busy = false;
        if (clearWhenDone && box && !failure) box.clear();
      }
    },
    clear() {
      // Clearing a live Dice Box roll discards its promise; defer until settlement.
      if (busy) clearWhenDone = true;
      else if (box && !failure) box.clear();
    }
  });
})(window);
