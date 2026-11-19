// UI表示・ミッション生成・ABC評価ロジック・デバッグ制御

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

// 船体耐久ゲージ更新
function updateHullHpUI() {
  const ratio = Math.max(0, Math.min(100, (state.hullHp / state.maxHullHp) * 100));
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
}

// 船員数選択UIの更新
function setSelectedCrewCount(count) {
  const normalized = Math.max(0, Math.min(2, Math.round(count)));
  state.selectedCrewCount = normalized;
  state.crewEnabled = normalized > 0;

  dom.crewSelectButtons.forEach((btn) => {
    const btnCount = parseInt(btn.getAttribute('data-crew-count'), 10);
    if (btnCount === normalized) {
      btn.className = 'crew-select-btn bg-sky-500/20 text-sky-300 border border-sky-400 rounded-lg py-1 px-1.5 text-center transition-all cursor-pointer shadow-sm';
    } else {
      btn.className = 'crew-select-btn bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-1 px-1.5 text-center transition-all cursor-pointer';
    }
  });

  const totalCost = normalized * CREW_UNIT_COST;
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

// 船員有効/無効の表示同期
function syncCrewEnabledUI() {
  if (dom.debugCrewToggle) {
    if (state.crewEnabled) {
      dom.debugCrewToggle.textContent = `有効 (${state.selectedCrewCount}名)`;
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
  if (typeof syncCrewVisibility === 'function') {
    syncCrewVisibility();
  }
}

// HUD左上のゴミ種別ごとのリアルタイム回収カウントを更新（アイコンのみ）
function updateHudTypeCounts() {
  if (!dom.hudTypeCounts) return;
  dom.hudTypeCounts.innerHTML = '';

  TRASH_TYPES.forEach((type) => {
    const current = state.collectedByType[type.id] || 0;
    const quota = state.mission.quotas[type.id] || 0;
    const isCleared = quota > 0 && current >= quota;

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2';
    row.title = type.name;

    const countText = quota > 0 ? `${current}/${quota}` : `${current}`;
    const countClass = quota > 0
      ? (isCleared ? 'text-emerald-400 font-extrabold' : 'text-amber-300 font-bold')
      : 'text-slate-300 font-semibold';

    row.innerHTML = `
      <span class="inline-flex items-center gap-1 text-slate-200">
        <span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color: ${type.badgeColor}"></span>
        <span class="text-sm leading-none" aria-label="${type.name}">${type.icon}</span>
      </span>
      <span class="${countClass} tabular-nums">${countText}${isCleared ? ' ✓' : ''}</span>
    `;
    dom.hudTypeCounts.appendChild(row);
  });
}

// 日替わりミッション生成（総数目標 ＋ 種別回収ノルマ）
function generateDailyMission() {
  const totalTarget = Math.min(14, 7 + Math.floor((state.day - 1) * 1.5) + Math.floor(Math.random() * 3));
  const shuffled = [...TRASH_TYPES].sort(() => Math.random() - 0.5);
  const pickedTypes = shuffled.slice(0, 2);

  const quotas = {};
  let quotaSum = 0;
  pickedTypes.forEach((t, idx) => {
    const q = idx === 0
      ? Math.max(2, Math.round(totalTarget * 0.32))
      : Math.max(2, Math.round(totalTarget * 0.25));
    quotas[t.id] = q;
    quotaSum += q;
  });

  state.mission = {
    totalTarget: Math.max(totalTarget, quotaSum + 2),
    quotas
  };

  if (dom.missionDayBadge) dom.missionDayBadge.textContent = `${state.day}日目`;
  if (dom.missionTargetText) {
    dom.missionTargetText.innerHTML = `ゴミ総数 <span class="text-sky-400">${state.mission.totalTarget}</span> 個以上`;
  }
  if (dom.hudTotalTarget) {
    dom.hudTotalTarget.textContent = `/ ${state.mission.totalTarget}`;
  }

  if (dom.missionTypeQuotas) {
    dom.missionTypeQuotas.innerHTML = '';
    pickedTypes.forEach((t) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between bg-slate-800/90 border border-slate-700/70 rounded-lg px-2.5 py-1.5';
      item.title = t.name;
      item.innerHTML = `
        <span class="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
          <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background-color: ${t.badgeColor}"></span>
          <span class="text-base leading-none" aria-label="${t.name}">${t.icon}</span>
        </span>
        <span class="font-extrabold text-amber-300 tabular-nums">${quotas[t.id]}個</span>
      `;
      dom.missionTypeQuotas.appendChild(item);
    });
  }

  updateHudTypeCounts();
}

// 総合評価ランク（A / B / C）計算（船員配置コスト加味）
function evaluateMissionResult() {
  const target = state.mission.totalTarget;
  const totalRatio = target > 0 ? state.score / target : 1;

  const quotaEntries = Object.entries(state.mission.quotas);
  let clearedQuotas = 0;
  let quotaRatioSum = 0;

  quotaEntries.forEach(([typeId, req]) => {
    const got = state.collectedByType[typeId] || 0;
    if (got >= req) clearedQuotas++;
    quotaRatioSum += req > 0 ? Math.min(1.2, got / req) : 1;
  });

  const avgQuotaRatio = quotaEntries.length > 0 ? quotaRatioSum / quotaEntries.length : 1;
  const allQuotasCleared = clearedQuotas === quotaEntries.length;

  const activeCrew = state.crewEnabled ? state.selectedCrewCount : 0;
  const crewCost = activeCrew * CREW_UNIT_COST;

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

// ゲーム終了・リザルト画面表示
function endGame(reason = 'timeup') {
  state.phase = 'gameover';
  dom.resultMissionTarget.textContent = state.mission.totalTarget;

  const evalRes = evaluateMissionResult();
  const pct = Math.round((state.score / Math.max(1, state.mission.totalTarget)) * 100);
  dom.resultProgressDetail.textContent = `回収 ${state.score}個（達成率 ${pct}%）`;

  if (dom.resultCostDetail) {
    dom.resultCostDetail.textContent = `船員費用: ¥${evalRes.crewCost.toLocaleString()} (${evalRes.activeCrew}名)`;
    dom.resultCostDetail.className = evalRes.activeCrew === 0
      ? 'text-xs font-bold text-emerald-400 mt-0.5'
      : (evalRes.activeCrew === 1 ? 'text-xs font-bold text-amber-300 mt-0.5' : 'text-xs font-bold text-rose-400 mt-0.5');
  }

  dom.resultQuotaSummary.textContent = `${evalRes.clearedQuotas} / ${evalRes.totalQuotas} 達成`;

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
      dom.resultComment.textContent = evalRes.activeCrew > 0
        ? '業務完了！（船員コストを抑えるとA評価を狙えます）'
        : 'お疲れさまでした！あと少しでA評価です';
      dom.resultComment.className = 'text-xs font-semibold text-sky-400 mb-3';
    } else {
      dom.resultComment.textContent = '目標未達…次はノルマ達成を目指そう';
      dom.resultComment.className = 'text-xs font-semibold text-amber-400 mb-3';
    }

    state.day += 1;
  }

  dom.resultBreakdown.innerHTML = '';
  TRASH_TYPES.forEach(type => {
    const count = state.collectedByType[type.id] || 0;
    const quota = state.mission.quotas[type.id] || 0;
    const isQuotaTarget = quota > 0;
    const isCleared = isQuotaTarget && count >= quota;

    const item = document.createElement('div');
    item.className = isQuotaTarget
      ? (isCleared
          ? 'flex items-center justify-between bg-emerald-950/60 border border-emerald-500/50 rounded-xl px-2.5 py-1.5'
          : 'flex items-center justify-between bg-amber-950/50 border border-amber-500/40 rounded-xl px-2.5 py-1.5')
      : 'flex items-center justify-between bg-slate-900/80 border border-slate-700/50 rounded-xl px-2.5 py-1.5';
    item.title = type.name;

    const valueHtml = isQuotaTarget
      ? `<span class="font-extrabold ${isCleared ? 'text-emerald-400' : 'text-amber-300'} tabular-nums">${count}/${quota}個 ${isCleared ? '✓' : ''}</span>`
      : `<span class="font-extrabold text-white tabular-nums">${count}個</span>`;

    item.innerHTML = `
      <span class="flex items-center gap-1.5 text-slate-200 font-medium">
        <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background-color: ${type.badgeColor}"></span>
        <span class="text-base leading-none" aria-label="${type.name}">${type.icon}</span>
      </span>
      ${valueHtml}
    `;
    dom.resultBreakdown.appendChild(item);
  });

  dom.resultModal.classList.remove('hidden');
}

// デバッグパネルのイベント初期化
function initDebugUI() {
  if (dom.debugToggleBtn && dom.debugPanel) {
    dom.debugToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.debugPanel.classList.toggle('hidden');
    });
  }

  if (dom.debugSpeedSlider && dom.debugSpeedVal) {
    dom.debugSpeedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.baseScrollSpeed = val;
      dom.debugSpeedVal.textContent = val.toFixed(1);
    });
  }

  if (dom.debugSpeedReset && dom.debugSpeedSlider && dom.debugSpeedVal) {
    dom.debugSpeedReset.addEventListener('click', () => {
      state.baseScrollSpeed = DEFAULT_SCROLL_SPEED;
      dom.debugSpeedSlider.value = DEFAULT_SCROLL_SPEED.toString();
      dom.debugSpeedVal.textContent = DEFAULT_SCROLL_SPEED.toFixed(1);
    });
  }

  function applyDebugTime(seconds) {
    const clamped = Math.max(1, Math.min(120, Math.round(seconds)));
    state.timeLeft = clamped;
    dom.timer.textContent = clamped;
    if (dom.debugTimeSlider) dom.debugTimeSlider.value = clamped.toString();
    if (dom.debugTimeVal) dom.debugTimeVal.textContent = `${clamped}秒`;
    if (clamped <= 10) {
      dom.timer.classList.add('text-rose-400');
    } else {
      dom.timer.classList.remove('text-rose-400');
    }
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
      const nextCount = state.crewEnabled ? 0 : (state.selectedCrewCount > 0 ? state.selectedCrewCount : 1);
      setSelectedCrewCount(nextCount);
    });
  }

  dom.crewSelectButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const count = parseInt(btn.getAttribute('data-crew-count'), 10);
      if (!isNaN(count)) setSelectedCrewCount(count);
    });
  });
}