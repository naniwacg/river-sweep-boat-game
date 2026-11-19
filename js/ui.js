// ==========================================
// UI表示・ミッション生成・ABC評価ロジック・デバッグ制御
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, CONSTANTS, TRASH_VARIANTS } = app;

  const dom = {
    score: document.getElementById('score-display'),
    hudTotalTarget: document.getElementById('hud-total-target'),
    hudTypeCounts: document.getElementById('hud-type-counts'),
    hullHpPanel: document.getElementById('hull-hp-panel'),
    hullHpText: document.getElementById('hull-hp-text'),
    hullHpBar: document.getElementById('hull-hp-bar'),
    hullDamageAlert: document.getElementById('hull-damage-alert'),
    timer: document.getElementById('timer-display'),
    guide: document.getElementById('guide-pill'),
    titleModal: document.getElementById('title-modal'),
    resultModal: document.getElementById('result-modal'),
    resultBadge: document.getElementById('result-badge'),
    resultTitle: document.getElementById('result-title'),
    resultComment: document.getElementById('result-comment'),
    resultBreakdown: document.getElementById('result-breakdown'),
    resultMissionTarget: document.getElementById('result-mission-target'),
    resultProgressDetail: document.getElementById('result-progress-detail'),
    resultCostDetail: document.getElementById('result-cost-detail'),
    resultQuotaSummary: document.getElementById('result-quota-summary'),
    resultRank: document.getElementById('result-rank'),
    resultRankLabel: document.getElementById('result-rank-label'),
    missionDayBadge: document.getElementById('mission-day-badge'),
    missionTargetText: document.getElementById('mission-target-text'),
    missionTypeQuotas: document.getElementById('mission-type-quotas'),
    missionCrewCostBadge: document.getElementById('mission-crew-cost-badge'),
    missionCrewNote: document.getElementById('mission-crew-note'),
    crewSelectButtons: document.querySelectorAll('.crew-select-btn'),
    startBtn: document.getElementById('start-btn'),
    retryBtn: document.getElementById('retry-btn'),
    debugToggleBtn: document.getElementById('debug-toggle-btn'),
    debugPanel: document.getElementById('debug-panel'),
    debugSpeedSlider: document.getElementById('debug-speed-slider'),
    debugSpeedVal: document.getElementById('debug-speed-val'),
    debugSpeedReset: document.getElementById('debug-speed-reset'),
    debugTimeSlider: document.getElementById('debug-time-slider'),
    debugTimeVal: document.getElementById('debug-time-val'),
    debugTimePresets: document.querySelectorAll('.debug-time-preset'),
    debugCrewToggle: document.getElementById('debug-crew-toggle')
  };

  let onStartGameCallback = null;

  // 船体耐久ゲージ更新
  function updateHullHpUI() {
    const maxHp = state.shipMaxHp || 100;
    const currentHp = typeof state.shipHp === 'number' ? state.shipHp : maxHp;
    const ratio = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

    if (dom.hullHpText) dom.hullHpText.textContent = `${Math.ceil(ratio)}%`;
    if (dom.hullHpBar) {
      dom.hullHpBar.style.width = `${ratio}%`;
      dom.hullHpBar.classList.remove('bg-emerald-400', 'bg-amber-400', 'bg-rose-500');
      if (ratio > 55) {
        dom.hullHpBar.classList.add('bg-emerald-400');
      } else if (ratio > 25) {
        dom.hullHpBar.classList.add('bg-amber-400');
      } else {
        dom.hullHpBar.classList.add('bg-rose-500');
      }
    }

    if (dom.hullHpPanel && dom.hullDamageAlert) {
      if (state.damageFlashTimer > 0) {
        dom.hullHpPanel.classList.add('border-rose-500', 'bg-rose-950/80');
        dom.hullDamageAlert.classList.remove('hidden');
        setTimeout(() => {
          if (dom.hullHpPanel) dom.hullHpPanel.classList.remove('border-rose-500', 'bg-rose-950/80');
          if (dom.hullDamageAlert) dom.hullDamageAlert.classList.add('hidden');
        }, 420);
      }
    }
  }

  // スコア＆種別カウント更新
  function updateScoreUI() {
    if (dom.score) dom.score.textContent = state.score.toString();
    updateHudTypeCounts();
  }

  // タイマー＆デバッグ時間スライダー同期
  function updateTimerUI() {
    const ceilSec = Math.ceil(state.timeLeft);
    if (dom.timer) {
      dom.timer.textContent = ceilSec.toString();
      if (state.timeLeft <= 10) {
        dom.timer.classList.add('text-rose-400');
      } else {
        dom.timer.classList.remove('text-rose-400');
      }
    }
    if (dom.debugTimeSlider) dom.debugTimeSlider.value = ceilSec.toString();
    if (dom.debugTimeVal) dom.debugTimeVal.textContent = `${ceilSec}秒`;
  }

  // モーダル非表示
  function hideModals() {
    if (dom.titleModal) dom.titleModal.classList.add('hidden');
    if (dom.resultModal) dom.resultModal.classList.add('hidden');
  }

  // 船員配置数の選択とコスト・説明文更新
  function setSelectedCrewCount(count) {
    const normalized = Math.max(0, Math.min(2, Math.round(count)));
    state.crewCount = normalized;
    state.crewEnabled = normalized > 0;

    dom.crewSelectButtons.forEach((btn) => {
      const btnCount = parseInt(btn.getAttribute('data-crew-count'), 10);
      if (btnCount === normalized) {
        btn.className = 'crew-select-btn bg-sky-500/20 text-sky-300 border border-sky-400 rounded-lg py-1 px-1.5 text-center transition-all cursor-pointer shadow-sm';
      } else {
        btn.className = 'crew-select-btn bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-1 px-1.5 text-center transition-all cursor-pointer';
      }
    });

    const unitCost = state.crewCostPerPerson || 5000;
    const totalCost = normalized * unitCost;
    if (dom.missionCrewCostBadge && dom.missionCrewNote) {
      if (normalized === 0) {
        dom.missionCrewCostBadge.textContent = '費用 ¥0（高評価狙い）';
        dom.missionCrewCostBadge.className = 'text-[11px] font-bold text-emerald-400';
        dom.missionCrewNote.textContent = 'コンベアのみで清掃（低コストでA評価狙い）';
      } else if (normalized === 1) {
        dom.missionCrewCostBadge.textContent = `費用 ¥${totalCost.toLocaleString()}（中コスト）`;
        dom.missionCrewCostBadge.className = 'text-[11px] font-bold text-amber-300';
        dom.missionCrewNote.textContent = '左舷の網で回収可（A評価には+25%回収が必要）';
      } else {
        dom.missionCrewCostBadge.textContent = `費用 ¥${totalCost.toLocaleString()}（高コスト）`;
        dom.missionCrewCostBadge.className = 'text-[11px] font-bold text-rose-400';
        dom.missionCrewNote.textContent = '両舷の網で強力回収（費用増により最高B評価）';
      }
    }

    syncCrewEnabledUI();
  }

  // 船員有効状態の同期
  function syncCrewEnabledUI() {
    const activeCount = state.crewEnabled ? Math.max(1, state.crewCount || 1) : 0;

    if (dom.debugCrewToggle) {
      if (state.crewEnabled) {
        dom.debugCrewToggle.textContent = `有効 (${activeCount}名)`;
        dom.debugCrewToggle.className = 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-xs font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer';
      } else {
        dom.debugCrewToggle.textContent = '無効';
        dom.debugCrewToggle.className = 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 text-xs font-extrabold px-2.5 py-1 rounded-xl transition-all cursor-pointer';
      }
    }

    if (dom.guide) {
      dom.guide.textContent = state.crewEnabled
        ? '船を左右スワイプで操船 ・ 網を外側スワイプでゴミ回収！'
        : '船を左右スワイプで操船して船首コンベアでゴミを回収しよう！';
    }

    if (app.ship && typeof app.ship.resetShipAndCrew === 'function' && !state.isPlaying) {
      app.ship.resetShipAndCrew();
    } else if (app.ship && Array.isArray(app.ship.crewMembers)) {
      app.ship.crewMembers.forEach((crew, idx) => {
        const isDeployed = state.crewEnabled && idx < activeCount;
        crew.isDeployed = isDeployed;
        crew.group.visible = isDeployed;
      });
    }
  }

  // 左上HUDの種別リアルタイム回収カウント（アイコンのみ表示）
  function updateHudTypeCounts() {
    if (!dom.hudTypeCounts) return;
    dom.hudTypeCounts.innerHTML = '';

    TRASH_VARIANTS.forEach((variant) => {
      const current = state.collectedByType[variant.id] || 0;
      const quota = (state.missionTypeTargets && state.missionTypeTargets[variant.id]) || 0;
      const isCleared = quota > 0 && current >= quota;

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2';
      row.title = variant.label;

      const countText = quota > 0 ? `${current}/${quota}` : `${current}`;
      const countClass = quota > 0
        ? (isCleared ? 'text-emerald-400 font-extrabold' : 'text-amber-300 font-bold')
        : 'text-slate-300 font-semibold';

      row.innerHTML = `
        <span class="inline-flex items-center gap-1 text-slate-200">
          <span class="w-2 h-2 rounded-full inline-block shrink-0 ${variant.dotColor}"></span>
          <span class="text-sm leading-none" aria-label="${variant.label}">${variant.icon}</span>
        </span>
        <span class="${countClass} tabular-nums">${countText}${isCleared ? ' ✓' : ''}</span>
      `;
      dom.hudTypeCounts.appendChild(row);
    });
  }

  // 日替わりミッション生成
  function generateDailyMission() {
    const day = state.dayCount || 1;
    const totalTarget = Math.min(14, 7 + Math.floor((day - 1) * 1.5) + Math.floor(Math.random() * 3));
    const shuffled = [...TRASH_VARIANTS].sort(() => Math.random() - 0.5);
    const pickedVariants = shuffled.slice(0, 2);

    TRASH_VARIANTS.forEach((v) => {
      state.missionTypeTargets[v.id] = 0;
    });

    let quotaSum = 0;
    pickedVariants.forEach((v, idx) => {
      const q = idx === 0
        ? Math.max(2, Math.round(totalTarget * 0.32))
        : Math.max(2, Math.round(totalTarget * 0.25));
      state.missionTypeTargets[v.id] = q;
      quotaSum += q;
    });

    state.missionTarget = Math.max(totalTarget, quotaSum + 2);

    if (dom.missionDayBadge) dom.missionDayBadge.textContent = `${day}日目`;
    if (dom.missionTargetText) {
      dom.missionTargetText.innerHTML = `ゴミ総数 <span class="text-sky-400">${state.missionTarget}</span> 個以上`;
    }
    if (dom.hudTotalTarget) {
      dom.hudTotalTarget.textContent = `/ ${state.missionTarget}`;
    }

    if (dom.missionTypeQuotas) {
      dom.missionTypeQuotas.innerHTML = '';
      pickedVariants.forEach((v) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-slate-800/90 border border-slate-700/70 rounded-lg px-2.5 py-1.5';
        item.title = v.label;
        item.innerHTML = `
          <span class="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
            <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0 ${v.dotColor}"></span>
            <span class="text-base leading-none" aria-label="${v.label}">${v.icon}</span>
          </span>
          <span class="font-extrabold text-amber-300 tabular-nums">${state.missionTypeTargets[v.id]}個</span>
        `;
        dom.missionTypeQuotas.appendChild(item);
      });
    }

    updateHudTypeCounts();
  }

  // 総合評価ランク（A / B / C）計算
  function evaluateMissionResult() {
    const target = state.missionTarget || 15;
    const totalRatio = target > 0 ? state.score / target : 1;

    const quotaEntries = Object.entries(state.missionTypeTargets || {}).filter(([, req]) => req > 0);
    let clearedQuotas = 0;
    let quotaRatioSum = 0;

    quotaEntries.forEach(([typeId, req]) => {
      const got = state.collectedByType[typeId] || 0;
      if (got >= req) clearedQuotas++;
      quotaRatioSum += req > 0 ? Math.min(1.2, got / req) : 1;
    });

    const avgQuotaRatio = quotaEntries.length > 0 ? quotaRatioSum / quotaEntries.length : 1;
    const allQuotasCleared = clearedQuotas === quotaEntries.length;

    const unitCost = state.crewCostPerPerson || 5000;
    const activeCrew = state.crewEnabled ? Math.max(1, state.crewCount || 1) : 0;
    const crewCost = activeCrew * unitCost;

    if (activeCrew === 0) {
      if (state.score >= target && allQuotasCleared) {
        return { rank: 'A', label: '優秀', colorClass: 'text-emerald-400', labelClass: 'text-emerald-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
      }
      if (totalRatio >= 0.7 && avgQuotaRatio >= 0.65) {
        return { rank: 'B', label: '良好', colorClass: 'text-sky-400', labelClass: 'text-sky-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
      }
      return { rank: 'C', label: '要努力', colorClass: 'text-amber-400', labelClass: 'text-amber-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
    }

    if (activeCrew === 1) {
      const highEfficiencyTarget = Math.ceil(target * 1.25);
      if (state.score >= highEfficiencyTarget && allQuotasCleared) {
        return { rank: 'A', label: '優秀', colorClass: 'text-emerald-400', labelClass: 'text-emerald-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
      }
      if (state.score >= target && allQuotasCleared) {
        return { rank: 'B', label: '良好', colorClass: 'text-sky-400', labelClass: 'text-sky-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
      }
      if (totalRatio >= 0.8 && avgQuotaRatio >= 0.75) {
        return { rank: 'B', label: '良好', colorClass: 'text-sky-400', labelClass: 'text-sky-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
      }
      return { rank: 'C', label: '要努力', colorClass: 'text-amber-400', labelClass: 'text-amber-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
    }

    if (state.score >= target && allQuotasCleared) {
      return { rank: 'B', label: '良好', colorClass: 'text-sky-400', labelClass: 'text-sky-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
    }
    if (totalRatio >= 0.85 && avgQuotaRatio >= 0.8) {
      return { rank: 'B', label: '良好', colorClass: 'text-sky-400', labelClass: 'text-sky-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
    }
    return { rank: 'C', label: '要努力', colorClass: 'text-amber-400', labelClass: 'text-amber-300', clearedQuotas, totalQuotas: quotaEntries.length, activeCrew, crewCost };
  }

  // リザルト画面表示
  function endGame(reason = 'timeup') {
    state.isGameOver = true;
    state.isPlaying = false;

    const target = state.missionTarget || 15;
    if (dom.resultMissionTarget) dom.resultMissionTarget.textContent = target.toString();

    const evalRes = evaluateMissionResult();
    const pct = Math.round((state.score / Math.max(1, target)) * 100);
    if (dom.resultProgressDetail) {
      dom.resultProgressDetail.textContent = `回収 ${state.score}個（達成率 ${pct}%）`;
    }

    if (dom.resultCostDetail) {
      dom.resultCostDetail.textContent = `船員費用: ¥${evalRes.crewCost.toLocaleString()} (${evalRes.activeCrew}名)`;
      dom.resultCostDetail.className = evalRes.activeCrew === 0
        ? 'text-xs font-bold text-emerald-400 mt-0.5'
        : (evalRes.activeCrew === 1 ? 'text-xs font-bold text-amber-300 mt-0.5' : 'text-xs font-bold text-rose-400 mt-0.5');
    }

    if (dom.resultQuotaSummary) {
      dom.resultQuotaSummary.textContent = `${evalRes.clearedQuotas} / ${evalRes.totalQuotas} 達成`;
    }

    if (reason === 'capsize' || reason === 'hull_destroyed') {
      const isHull = reason === 'hull_destroyed';
      dom.resultBadge.textContent = isHull ? '船体大破' : '転覆事故';
      dom.resultBadge.className = 'inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-bold tracking-widest mb-1.5';
      dom.resultTitle.textContent = isHull ? '船体大破！' : '船が転覆した！';
      dom.resultComment.textContent = isHull
        ? '川岸や橋脚との衝突で船体が大破しました…'
        : '急操作で船が大きく傾き転覆しました…';
      dom.resultComment.className = 'text-xs font-semibold text-rose-400 mb-3';

      dom.resultRank.textContent = 'C';
      dom.resultRank.className = 'text-4xl sm:text-5xl font-black text-rose-400 leading-none tracking-tight';
      dom.resultRankLabel.textContent = '失敗';
      dom.resultRankLabel.className = 'text-xs font-bold text-rose-300 mt-1';
    } else {
      dom.resultBadge.textContent = '業務終了';
      dom.resultBadge.className = 'inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-widest mb-1.5';
      dom.resultTitle.textContent = '業務終了！';

      dom.resultRank.textContent = evalRes.rank;
      dom.resultRank.className = `text-4xl sm:text-5xl font-black ${evalRes.colorClass} leading-none tracking-tight`;
      dom.resultRankLabel.textContent = evalRes.label;
      dom.resultRankLabel.className = `text-xs font-bold ${evalRes.labelClass} mt-1`;

      if (evalRes.rank === 'A') {
        dom.resultComment.textContent = '低コスト・高効率の素晴らしい清掃活動でした！';
        dom.resultComment.className = 'text-xs font-semibold text-emerald-400 mb-3';
      } else if (evalRes.rank === 'B') {
        dom.resultComment.textContent = evalRes.activeCrew === 1
          ? `業務完了！（1名配置のA評価は${Math.ceil(target * 1.25)}個以上）`
          : (evalRes.activeCrew > 1
              ? '業務完了！（船員コストを抑えるとA評価を狙えます）'
              : 'お疲れさまでした！あと少しでA評価です');
        dom.resultComment.className = 'text-xs font-semibold text-sky-400 mb-3';
      } else {
        dom.resultComment.textContent = '目標未達…次はノルマ達成を目指そう';
        dom.resultComment.className = 'text-xs font-semibold text-amber-400 mb-3';
      }

      state.dayCount = (state.dayCount || 1) + 1;
    }

    if (dom.resultBreakdown) {
      dom.resultBreakdown.innerHTML = '';
      TRASH_VARIANTS.forEach((variant) => {
        const count = state.collectedByType[variant.id] || 0;
        const quota = (state.missionTypeTargets && state.missionTypeTargets[variant.id]) || 0;
        const isQuotaTarget = quota > 0;
        const isCleared = isQuotaTarget && count >= quota;

        const item = document.createElement('div');
        item.className = isQuotaTarget
          ? (isCleared
              ? 'flex items-center justify-between bg-emerald-950/60 border border-emerald-500/50 rounded-xl px-2.5 py-1.5'
              : 'flex items-center justify-between bg-amber-950/50 border border-amber-500/40 rounded-xl px-2.5 py-1.5')
          : 'flex items-center justify-between bg-slate-900/80 border border-slate-700/50 rounded-xl px-2.5 py-1.5';
        item.title = variant.label;

        const valueHtml = isQuotaTarget
          ? `<span class="font-extrabold ${isCleared ? 'text-emerald-400' : 'text-amber-300'} tabular-nums">${count}/${quota}個 ${isCleared ? '✓' : ''}</span>`
          : `<span class="font-extrabold text-white tabular-nums">${count}個</span>`;

        item.innerHTML = `
          <span class="flex items-center gap-1.5 text-slate-200 font-medium">
            <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0 ${variant.dotColor}"></span>
            <span class="text-base leading-none" aria-label="${variant.label}">${variant.icon}</span>
          </span>
          ${valueHtml}
        `;
        dom.resultBreakdown.appendChild(item);
      });
    }

    if (dom.resultModal) dom.resultModal.classList.remove('hidden');
  }

  // デバッグUIイベント初期化
  function initDebugEvents() {
    if (dom.debugToggleBtn && dom.debugPanel) {
      dom.debugToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.debugPanel.classList.toggle('hidden');
      });
    }

    if (dom.debugSpeedSlider && dom.debugSpeedVal) {
      dom.debugSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.riverSpeed = val;
        dom.debugSpeedVal.textContent = val.toFixed(1);
      });
    }

    const defaultSpeed = CONSTANTS.DEFAULT_RIVER_SPEED || 4.5;
    if (dom.debugSpeedReset && dom.debugSpeedSlider && dom.debugSpeedVal) {
      dom.debugSpeedReset.addEventListener('click', () => {
        state.riverSpeed = defaultSpeed;
        dom.debugSpeedSlider.value = defaultSpeed.toString();
        dom.debugSpeedVal.textContent = defaultSpeed.toFixed(1);
      });
    }

    function applyDebugTime(seconds) {
      const clamped = Math.max(1, Math.min(120, Math.round(seconds)));
      state.timeLeft = clamped;
      updateTimerUI();
    }

    if (dom.debugTimeSlider) {
      dom.debugTimeSlider.addEventListener('input', (e) => {
        applyDebugTime(parseFloat(e.target.value));
      });
    }

    dom.debugTimePresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.getAttribute('data-debug-time'), 10);
        if (!isNaN(sec)) applyDebugTime(sec);
      });
    });

    if (dom.debugCrewToggle) {
      dom.debugCrewToggle.addEventListener('click', () => {
        state.crewEnabled = !state.crewEnabled;
        if (state.crewEnabled && (!state.crewCount || state.crewCount <= 0)) {
          state.crewCount = 1;
        }
        syncCrewEnabledUI();
      });
    }

    dom.crewSelectButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const count = parseInt(btn.getAttribute('data-crew-count'), 10);
        if (!isNaN(count)) setSelectedCrewCount(count);
      });
    });
  }

  // UI全体の初期化
  function initUI(options = {}) {
    onStartGameCallback = options.onStartGame || null;

    initDebugEvents();
    setSelectedCrewCount(state.crewCount || 0);
    generateDailyMission();
    updateHullHpUI();
    updateScoreUI();
    updateTimerUI();

    if (dom.startBtn) {
      dom.startBtn.addEventListener('click', () => {
        if (typeof onStartGameCallback === 'function') {
          onStartGameCallback();
        }
      });
    }

    if (dom.retryBtn) {
      dom.retryBtn.addEventListener('click', () => {
        generateDailyMission();
        if (dom.resultModal) dom.resultModal.classList.add('hidden');
        if (dom.titleModal) dom.titleModal.classList.remove('hidden');
      });
    }
  }

  app.ui = {
    initUI,
    updateScoreUI,
    updateHullHpUI,
    updateTimerUI,
    hideModals,
    endGame,
    generateDailyMission
  };
})(window.GameApp);