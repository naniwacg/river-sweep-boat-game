// ==========================================
// UI更新・設定ドロワー・モーダル制御
// （合計数カウント・ABC評価を削除し、ごみ種類ごとの回収数のみを表示）
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  let onStartGameCallback = null;

  // HUD 左上の種類別回収数表示を更新
  function updateScoreUI() {
    const state = app.state;
    const variants = app.TRASH_VARIANTS || [];
    const container = document.getElementById('hud-type-counts');
    if (!state || !container) return;

    container.innerHTML = variants.map((v) => {
      const count = (state.collectedByType && state.collectedByType[v.id]) || 0;
      return `
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1 text-slate-200 truncate">
            <span>${v.icon}</span>
            <span class="truncate">${v.shortLabel}</span>
          </span>
          <span class="font-black text-sky-300 tabular-nums">${count}</span>
        </div>
      `;
    }).join('');
  }

  // 船体耐久ゲージ更新
  function updateHullHpUI() {
    const state = app.state;
    if (!state) return;
    const hpText = document.getElementById('hull-hp-text');
    const hpBar = document.getElementById('hull-hp-bar');

    const hp = Math.max(0, Math.round(state.shipHp));
    const maxHp = state.shipMaxHp || 100;
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

    if (hpText) {
      hpText.textContent = `${hp} / ${maxHp}`;
      hpText.className = pct > 50 ? 'text-emerald-300' : pct > 25 ? 'text-amber-300' : 'text-red-400';
    }
    if (hpBar) {
      hpBar.style.width = `${pct}%`;
      hpBar.className = `h-full transition-all duration-150 ${
        pct > 50 ? 'bg-emerald-400' : pct > 25 ? 'bg-amber-400' : 'bg-red-500'
      }`;
    }
  }

  // 残り時間タイマー更新
  function updateTimerUI() {
    const state = app.state;
    const timerEl = document.getElementById('timer-display');
    if (!state || !timerEl) return;
    timerEl.textContent = Math.max(0, Math.ceil(state.timeLeft));
  }

  // モーダル非表示
  function hideModals() {
    const titleModal = document.getElementById('title-modal');
    const resultModal = document.getElementById('result-modal');
    if (titleModal) titleModal.classList.add('hidden');
    if (resultModal) resultModal.classList.add('hidden');
  }

  // ゲーム終了時のリザルト表示（合計カウント・ABC評価なし、種類ごとの回収数のみ）
  function endGame(reason) {
    const state = app.state;
    const variants = app.TRASH_VARIANTS || [];
    const resultModal = document.getElementById('result-modal');
    const badge = document.getElementById('result-reason-badge');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const breakdownEl = document.getElementById('result-type-breakdown');

    if (badge && title && subtitle) {
      if (reason === 'capsize') {
        badge.textContent = '⚠️ 転覆事故';
        badge.className = 'inline-block px-3 py-1 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-bold mb-2';
        title.textContent = '清掃船が転覆！';
        subtitle.textContent = '転覆までに回収した種類別ごみ数';
      } else if (reason === 'hull_destroyed') {
        badge.textContent = '💥 船体大破';
        badge.className = 'inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold mb-2';
        title.textContent = '船体耐久が限界に！';
        subtitle.textContent = '大破までに回収した種類別ごみ数';
      } else {
        badge.textContent = '✅ 清掃完了';
        badge.className = 'inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-2';
        title.textContent = '清掃業務終了！';
        subtitle.textContent = '種類ごとのごみ回収数';
      }
    }

    if (breakdownEl && state) {
      breakdownEl.innerHTML = variants.map((v) => {
        const count = (state.collectedByType && state.collectedByType[v.id]) || 0;
        return `
          <div class="flex items-center justify-between bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">${v.icon}</span>
              <span class="text-sm font-bold text-slate-100">${v.label}</span>
            </div>
            <div class="text-lg font-black text-sky-300 tabular-nums">
              ${count}<span class="text-xs font-bold text-slate-400 ml-1">個</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (resultModal) {
      resultModal.classList.remove('hidden');
    }
  }

  // UIイベント初期化
  function initUI(options = {}) {
    onStartGameCallback = options.onStartGame || null;

    const startBtn = document.getElementById('start-btn');
    const retryBtn = document.getElementById('retry-btn');
    const settingsBtn = document.getElementById('settings-toggle-btn');
    const settingsDrawer = document.getElementById('settings-drawer');
    const crewToggle = document.getElementById('crew-toggle');
    const crewCountRow = document.getElementById('crew-count-row');
    const crewNumBtns = document.querySelectorAll('.crew-num-btn');
    const speedSlider = document.getElementById('river-speed-slider');
    const speedLabel = document.getElementById('speed-value-label');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (typeof onStartGameCallback === 'function') onStartGameCallback();
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (typeof onStartGameCallback === 'function') onStartGameCallback();
      });
    }

    if (settingsBtn && settingsDrawer) {
      settingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.toggle('hidden');
      });
    }

    if (crewToggle) {
      crewToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (app.state) {
          app.state.crewEnabled = enabled;
          app.state.crewCount = enabled ? (app.state.crewCount || 1) : 0;
        }
        if (crewCountRow) {
          crewCountRow.classList.toggle('hidden', !enabled);
          crewCountRow.classList.toggle('flex', enabled);
        }
        if (app.ship && typeof app.ship.resetShipAndCrew === 'function') {
          app.ship.resetShipAndCrew();
        }
      });
    }

    crewNumBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.crewNum, 10) || 1;
        if (app.state) {
          app.state.crewCount = num;
        }
        crewNumBtns.forEach((b) => {
          const active = parseInt(b.dataset.crewNum, 10) === num;
          b.className = `crew-num-btn px-2.5 py-1 rounded-lg font-bold ${
            active ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-200'
          }`;
        });
        if (app.ship && typeof app.ship.resetShipAndCrew === 'function') {
          app.ship.resetShipAndCrew();
        }
      });
    });

    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (app.state) {
          app.state.riverSpeed = val;
          app.state.savedRiverSpeed = val;
        }
        if (speedLabel) {
          speedLabel.textContent = val.toFixed(1);
        }
      });
    }

    updateScoreUI();
    updateHullHpUI();
    updateTimerUI();
  }

  app.ui = {
    initUI,
    updateScoreUI,
    updateHullHpUI,
    updateTimerUI,
    hideModals,
    endGame
  };
})(window.GameApp);