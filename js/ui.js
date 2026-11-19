// ==========================================
// HUD・耐久ゲージ・ミッション生成・ABC評価リザルト・デバッグUI
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, TRASH_VARIANTS, CONSTANTS, ship } = app;

  const dom = {
    scoreEl: document.getElementById('score-display'),
    hudTotalTargetEl: document.getElementById('hud-total-target'),
    hudTypeCountsEl: document.getElementById('hud-type-counts'),
    hullHpPanelEl: document.getElementById('hull-hp-panel'),
    hullHpTextEl: document.getElementById('hull-hp-text'),
    hullHpBarEl: document.getElementById('hull-hp-bar'),
    hullDamageAlertEl: document.getElementById('hull-damage-alert'),
    timerEl: document.getElementById('timer-display'),
    crewStatusEl: document.getElementById('crew-status'),

    debugToggleBtn: document.getElementById('debug-toggle-btn'),
    debugPanel: document.getElementById('debug-panel'),
    debugSpeedSlider: document.getElementById('debug-speed-slider'),
    debugSpeedVal: document.getElementById('debug-speed-val'),
    debugSpeedReset: document.getElementById('debug-speed-reset'),
    debugTimeSlider: document.getElementById('debug-time-slider'),
    debugTimeVal: document.getElementById('debug-time-val'),
    debugTimePresetBtns: document.querySelectorAll('.debug-time-preset'),
    debugCrewToggleBtn: document.getElementById('debug-crew-toggle'),

    titleModal: document.getElementById('title-modal'),
    missionDayBadgeEl: document.getElementById('mission-day-badge'),
    missionTargetTextEl: document.getElementById('mission-target-text'),
    missionTypeQuotasEl: document.getElementById('mission-type-quotas'),
    missionCrewCostBadgeEl: document.getElementById('mission-crew-cost-badge'),
    missionCrewNoteEl: document.getElementById('mission-crew-note'),
    crewSelectBtns: document.querySelectorAll('.crew-select-btn'),
    startBtn: document.getElementById('start-btn'),

    resultModal: document.getElementById('result-modal'),
    resultBadgeEl: document.getElementById('result-badge'),
    resultTitleEl: document.getElementById('result-title'),
    resultCommentEl: document.getElementById('result-comment'),
    resultMissionTargetEl: document.getElementById('result-mission-target'),
    resultProgressDetailEl: document.getElementById('result-progress-detail'),
    resultCostDetailEl: document.getElementById('result-cost-detail'),
    resultRankEl: document.getElementById('result-rank'),
    resultRankLabelEl: document.getElementById('result-rank-label'),
    resultQuotaSummaryEl: document.getElementById('result-quota-summary'),
    resultBreakdownEl: document.getElementById('result-breakdown'),
    retryBtn: document.getElementById('retry-btn')
  };

  function updateHullHpUI(isColliding = false) {
    const pct = Math.max(0, Math.round((state.shipHp / state.shipMaxHp) * 100));
    if (dom.hullHpTextEl) dom.hullHpTextEl.textContent = `${pct}%`;
    if (dom.hullHpBarEl) {
      dom.hullHpBarEl.style.width = `${pct}%`;
      dom.hullHpBarEl.className = pct <= 25
        ? 'h-full bg-rose-500 rounded-full transition-all duration-150'
        : pct <= 55
          ? 'h-full bg-amber-400 rounded-full transition-all duration-150'
          : 'h-full bg-emerald-400 rounded-full transition-all duration-150';
    }
    if (dom.hullHpPanelEl) {
      dom.hullHpPanelEl.className = isColliding
        ? 'bg-rose-950/85 backdrop-blur-md border border-rose-500 rounded-2xl px-4 py-2.5 shadow-lg shadow-rose-500/20 min-w-[155px] sm:min-w-[210px] transition-colors duration-150'
        : 'bg-slate-900/75 backdrop-blur-md border border-slate-700/60 rounded-2xl px-4 py-2.5 shadow-lg min-w-[155px] sm:min-w-[210px] transition-colors duration-150';
    }
    if (dom.hullDamageAlertEl) {
      dom.hullDamageAlertEl.classList.toggle('hidden', !isColliding);
    }
  }

  function updateHudRecoveryCounts() {
    if (dom.scoreEl) dom.scoreEl.textContent = String(state.score);
    if (dom.hudTotalTargetEl) {
      dom.hudTotalTargetEl.textContent = `/ ${state.missionTarget}`;
      dom.hudTotalTargetEl.className = state.score >= state.missionTarget
        ? 'text-xs font-extrabold text-emerald-400 tabular-nums'
        : 'text-xs font-bold text-slate-400 tabular-nums';
    }
    if (dom.hudTypeCountsEl) {
      dom.hudTypeCountsEl.innerHTML = TRASH_VARIANTS.map((v) => {
        const count = state.collectedByType[v.id] || 0;
        const quota = state.missionTypeTargets[v.id] || 0;
        const hasQuota = quota > 0;
        const isMet = hasQuota && count >= quota;

        const countHtml = hasQuota
          ? `<span class="${isMet ? 'text-emerald-400' : 'text-amber-300'} font-extrabold tabular-nums ml-3">${count}/${quota}</span>`
          : `<span class="text-slate-200 font-bold tabular-nums ml-3">${count}</span>`;

        return `
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${v.dotColor} shrink-0"></span>
              <span class="text-slate-300">${v.shortLabel}</span>
            </div>
            ${countHtml}
          </div>
        `;
      }).join('');
    }
  }

  function renderMissionCard() {
    if (dom.missionDayBadgeEl) dom.missionDayBadgeEl.textContent = `DAY ${state.dayCount}`;
    if (dom.missionTargetTextEl) {
      dom.missionTargetTextEl.innerHTML = `ゴミ総数 <span class="text-sky-400">${state.missionTarget}</span> 個以上回収！`;
    }
    if (dom.missionTypeQuotasEl) {
      const activeQuotas = TRASH_VARIANTS.filter((v) => (state.missionTypeTargets[v.id] || 0) > 0);
      dom.missionTypeQuotasEl.innerHTML = activeQuotas.map((v) => `
        <div class="flex items-center justify-between bg-slate-800/90 border border-slate-700/60 rounded-lg px-2.5 py-1.5">
          <div class="flex items-center gap-1.5 truncate">
            <span class="w-2 h-2 rounded-full ${v.dotColor} shrink-0"></span>
            <span class="text-slate-200 font-medium truncate">${v.label}</span>
          </div>
          <span class="text-amber-300 font-extrabold tabular-nums ml-1">${state.missionTypeTargets[v.id]}<span class="text-[12px] text-slate-400 font-normal ml-0.5">個</span></span>
        </div>
      `).join('');
    }
  }

  function generateDailyMission() {
    state.missionTarget = 14 + Math.floor(Math.random() * 5);
    const shuffled = [...TRASH_VARIANTS].sort(() => Math.random() - 0.5);
    const typeTargets = { bottle: 0, foam: 0, can: 0, plastic: 0 };
    typeTargets[shuffled[0].id] = 3 + Math.floor(Math.random() * 2);
    typeTargets[shuffled[1].id] = 2 + Math.floor(Math.random() * 2);
    state.missionTypeTargets = typeTargets;

    renderMissionCard();
    updateHudRecoveryCounts();
  }

  function applyCrewDeployment(count) {
    const normalized = THREE.MathUtils.clamp(Number(count) || 0, 0, 2);
    state.crewCount = normalized;
    state.crewEnabled = normalized > 0;

    dom.crewSelectBtns.forEach((btn) => {
      const btnCount = Number(btn.dataset.crewCount);
      btn.className = btnCount === normalized
        ? 'crew-select-btn bg-sky-500/20 text-sky-300 border border-sky-400 rounded-lg py-1.5 px-2 text-center transition-all cursor-pointer shadow-sm'
        : 'crew-select-btn bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-1.5 px-2 text-center transition-all cursor-pointer';
    });

    const totalCost = normalized * state.crewCostPerPerson;
    if (dom.missionCrewCostBadgeEl) {
      if (normalized === 0) {
        dom.missionCrewCostBadgeEl.textContent = '船員費用: ¥0（低コスト・高評価）';
        dom.missionCrewCostBadgeEl.className = 'text-[13px] font-bold text-emerald-400';
      } else if (normalized === 1) {
        dom.missionCrewCostBadgeEl.textContent = `船員費用: ¥${totalCost.toLocaleString()}（コスト中）`;
        dom.missionCrewCostBadgeEl.className = 'text-[13px] font-bold text-amber-300';
      } else {
        dom.missionCrewCostBadgeEl.textContent = `船員費用: ¥${totalCost.toLocaleString()}（コスト高）`;
        dom.missionCrewCostBadgeEl.className = 'text-[13px] font-bold text-rose-400';
      }
    }

    if (dom.missionCrewNoteEl) {
      if (normalized === 0) {
        dom.missionCrewNoteEl.textContent = '船首コンベアのみで清掃します。船員費用ゼロのため高評価（Aランク）を狙えます！';
      } else if (normalized === 1) {
        dom.missionCrewNoteEl.textContent = '左舷に船員1名を配置。費用¥5,000が発生し、A評価にはノルマ+25%以上の回収が必要です。';
      } else {
        dom.missionCrewNoteEl.textContent = '両舷に船員2名を配置。網は強力ですが費用¥10,000により清掃コストが上がり、最高評価はBになります。';
      }
    }

    if (dom.debugCrewToggleBtn) {
      dom.debugCrewToggleBtn.textContent = state.crewEnabled ? `ON (${normalized}名)` : 'OFF';
      dom.debugCrewToggleBtn.className = state.crewEnabled
        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer'
        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer';
    }

    ship.crewMembers.forEach((crew, idx) => {
      const isActiveCrew = state.crewEnabled && idx < normalized;
      crew.isDeployed = isActiveCrew;
      crew.group.visible = isActiveCrew;
      if (!isActiveCrew) crew.alertIcon.visible = false;
    });

    if (!state.crewEnabled) {
      ship.netAimLine.visible = false;
      ship.netTargetMarker.visible = false;
    }
  }

  function renderResultBreakdown() {
    if (!dom.resultBreakdownEl) return;
    dom.resultBreakdownEl.innerHTML = TRASH_VARIANTS.map((v) => {
      const count = state.collectedByType[v.id] || 0;
      const quota = state.missionTypeTargets[v.id] || 0;
      const hasQuota = quota > 0;
      const isMet = hasQuota && count >= quota;

      const borderClass = hasQuota
        ? (isMet ? 'border-emerald-500/60 bg-emerald-950/25' : 'border-amber-500/50 bg-slate-900/90')
        : 'border-slate-700/50 bg-slate-900/70';

      const countDisplay = hasQuota
        ? `<span class="${isMet ? 'text-emerald-400' : 'text-amber-300'} font-extrabold tabular-nums">${count}/${quota}<span class="text-[12px] text-slate-400 font-normal ml-0.5">個</span></span>`
        : `<span class="text-white font-extrabold tabular-nums">${count}<span class="text-[12px] text-slate-400 font-normal ml-0.5">個</span></span>`;

      return `
        <div class="flex items-center justify-between border ${borderClass} rounded-xl px-3 py-2">
          <div class="flex items-center gap-2 truncate">
            <span class="w-2.5 h-2.5 rounded-full ${v.dotColor} shrink-0"></span>
            <span class="text-slate-200 font-medium truncate">${v.label}</span>
          </div>
          <div class="ml-1 shrink-0">${countDisplay}</div>
        </div>
      `;
    }).join('');
  }

  function showResultModal(reason) {
    const target = state.missionTarget;
    const ratio = target > 0 ? state.score / target : 0;
    const pct = Math.round(ratio * 100);

    const quotaVariants = TRASH_VARIANTS.filter((v) => (state.missionTypeTargets[v.id] || 0) > 0);
    const metQuotaCount = quotaVariants.filter((v) => (state.collectedByType[v.id] || 0) >= state.missionTypeTargets[v.id]).length;
    const allTypeQuotasMet = metQuotaCount === quotaVariants.length;
    const validMission = reason !== 'OVERBOARD' && reason !== 'CAPSIZE' && reason !== 'HULL_BROKEN';
    const isTotalMet = state.score >= target;
    const isMissionCleared = validMission && isTotalMet && allTypeQuotasMet;
    const crewCost = state.crewCount * state.crewCostPerPerson;

    dom.resultMissionTargetEl.textContent = `${state.score} / ${target}`;
    dom.resultProgressDetailEl.textContent = `総数達成率 ${pct}% ・ 種別 ${metQuotaCount}/${quotaVariants.length}`;
    if (dom.resultCostDetailEl) {
      dom.resultCostDetailEl.textContent = `船員費用: ¥${crewCost.toLocaleString()} (${state.crewCount}名配置)`;
      dom.resultCostDetailEl.className = state.crewCount === 0
        ? 'text-[13px] font-bold text-emerald-400 mt-1'
        : state.crewCount === 1
          ? 'text-[13px] font-bold text-amber-300 mt-1'
          : 'text-[13px] font-bold text-rose-400 mt-1';
    }
    if (dom.resultQuotaSummaryEl) {
      dom.resultQuotaSummaryEl.textContent = `種別ノルマ ${metQuotaCount} / ${quotaVariants.length} 達成`;
      dom.resultQuotaSummaryEl.className = allTypeQuotasMet
        ? 'text-[13px] font-bold text-emerald-400'
        : 'text-[13px] font-bold text-amber-400';
    }
    renderResultBreakdown();

    let rank = 'C';
    let rankLabel = 'TRY AGAIN';
    let rankColorClass = 'text-rose-400';
    let rankSubColorClass = 'text-rose-300';

    if (validMission) {
      if (state.crewCount === 0) {
        if (isMissionCleared && ratio >= 1.1) {
          rank = 'A';
          rankLabel = 'LOW COST & PERFECT!';
          rankColorClass = 'text-emerald-400';
          rankSubColorClass = 'text-emerald-300';
        } else if (isMissionCleared) {
          rank = 'B';
          rankLabel = 'MISSION CLEAR';
          rankColorClass = 'text-sky-400';
          rankSubColorClass = 'text-sky-300';
        } else {
          rank = 'C';
          rankLabel = 'SHORTFALL';
          rankColorClass = 'text-amber-400';
          rankSubColorClass = 'text-amber-300';
        }
      } else if (state.crewCount === 1) {
        if (isMissionCleared && ratio >= 1.35) {
          rank = 'A';
          rankLabel = 'HIGH EFFICIENCY!';
          rankColorClass = 'text-emerald-400';
          rankSubColorClass = 'text-emerald-300';
        } else if (isMissionCleared) {
          rank = 'B';
          rankLabel = 'COST OFFSET (-1 RANK)';
          rankColorClass = 'text-sky-400';
          rankSubColorClass = 'text-sky-300';
        } else {
          rank = 'C';
          rankLabel = 'COST OVERRUN';
          rankColorClass = 'text-amber-400';
          rankSubColorClass = 'text-amber-300';
        }
      } else {
        if (isMissionCleared && ratio >= 1.25) {
          rank = 'B';
          rankLabel = 'HIGH CREW COST (-1 RANK)';
          rankColorClass = 'text-sky-400';
          rankSubColorClass = 'text-sky-300';
        } else if (isMissionCleared) {
          rank = 'C';
          rankLabel = 'HIGH COST PENALTY';
          rankColorClass = 'text-amber-400';
          rankSubColorClass = 'text-amber-300';
        } else {
          rank = 'C';
          rankLabel = 'BUDGET DEFICIT';
          rankColorClass = 'text-rose-400';
          rankSubColorClass = 'text-rose-300';
        }
      }
    }

    dom.resultRankEl.textContent = rank;
    dom.resultRankEl.className = `text-5xl sm:text-6xl font-black ${rankColorClass} leading-none tracking-tight`;
    dom.resultRankLabelEl.textContent = rankLabel;
    dom.resultRankLabelEl.className = `text-[13px] font-bold ${rankSubColorClass} mt-1`;

    if (reason === 'HULL_BROKEN') {
      dom.resultBadgeEl.textContent = 'HULL DESTROYED!';
      dom.resultBadgeEl.className = 'inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold tracking-widest uppercase mb-2';
      dom.resultTitleEl.textContent = '船体が大破しました！';
      dom.resultCommentEl.textContent = '川岸や橋脚への接触ダメージで耐久が0になった！（評価: C）';
      dom.resultCommentEl.className = 'text-sm font-semibold text-rose-400 mb-5';
    } else if (reason === 'CAPSIZE') {
      dom.resultBadgeEl.textContent = 'CAPSIZED!';
      dom.resultBadgeEl.className = 'inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold tracking-widest uppercase mb-2';
      dom.resultTitleEl.textContent = '船が転覆しました！';
      dom.resultCommentEl.textContent = '急な左右移動で傾きすぎた！（評価: C）';
      dom.resultCommentEl.className = 'text-sm font-semibold text-rose-400 mb-5';
    } else if (reason === 'OVERBOARD') {
      dom.resultBadgeEl.textContent = 'GAME OVER';
      dom.resultBadgeEl.className = 'inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold tracking-widest uppercase mb-2';
      dom.resultTitleEl.textContent = '船員が転落しました！';
      dom.resultCommentEl.textContent = '操船の傾きに注意しよう！（評価: C）';
      dom.resultCommentEl.className = 'text-sm font-semibold text-rose-400 mb-5';
    } else {
      dom.resultBadgeEl.textContent = isMissionCleared ? 'MISSION CLEAR!' : 'TIME UP!';
      dom.resultBadgeEl.className = isMissionCleared
        ? 'inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-2'
        : 'inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase mb-2';
      dom.resultTitleEl.textContent = isMissionCleared ? '当日の仕事 達成！' : 'ノルマ未達…';
      dom.resultCommentEl.textContent = rank === 'A'
        ? `低コスト＆ノルマ完全達成！（船員費用 ¥${crewCost.toLocaleString()}）`
        : rank === 'B'
          ? (state.crewCount > 0
              ? `ノルマ達成！船員${state.crewCount}名の費用（¥${crewCost.toLocaleString()}）により評価が1段階ダウン`
              : '総数・種別ノルマをすべてクリア！')
          : isMissionCleared
            ? `ノルマ達成も船員2名の費用（¥${crewCost.toLocaleString()}）でコスト超過によりC評価…`
            : !isTotalMet
              ? `ゴミ総数ノルマまであと ${target - state.score}個`
              : `種別ノルマが未達成（${metQuotaCount}/${quotaVariants.length}達成）`;
      dom.resultCommentEl.className = rank === 'A'
        ? 'text-sm font-semibold text-emerald-400 mb-5'
        : rank === 'B'
          ? 'text-sm font-semibold text-sky-400 mb-5'
          : 'text-sm font-semibold text-amber-400 mb-5';
    }

    dom.resultModal.classList.remove('hidden');
  }

  function initUIEvents(onStartGame, onRetryMission) {
    dom.crewSelectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyCrewDeployment(Number(btn.dataset.crewCount));
      });
    });

    if (dom.debugCrewToggleBtn) {
      dom.debugCrewToggleBtn.addEventListener('click', () => {
        applyCrewDeployment(state.crewEnabled ? 0 : (state.crewCount > 0 ? state.crewCount : 2));
      });
    }

    dom.startBtn.addEventListener('click', onStartGame);
    dom.retryBtn.addEventListener('click', onRetryMission);

    dom.debugToggleBtn.addEventListener('click', () => {
      dom.debugPanel.classList.toggle('hidden');
    });

    dom.debugSpeedSlider.addEventListener('input', (e) => {
      state.riverSpeed = parseFloat(e.target.value);
      dom.debugSpeedVal.textContent = state.riverSpeed.toFixed(1);
    });

    dom.debugSpeedReset.addEventListener('click', () => {
      state.riverSpeed = CONSTANTS.DEFAULT_RIVER_SPEED;
      dom.debugSpeedSlider.value = String(CONSTANTS.DEFAULT_RIVER_SPEED);
      dom.debugSpeedVal.textContent = CONSTANTS.DEFAULT_RIVER_SPEED.toFixed(1);
    });

    dom.debugTimeSlider.addEventListener('input', (e) => {
      const sec = parseInt(e.target.value, 10);
      state.timeLeft = sec;
      dom.debugTimeVal.textContent = `${sec}s`;
      dom.timerEl.textContent = String(sec);
    });

    dom.debugTimePresetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.debugTime, 10);
        state.timeLeft = sec;
        dom.debugTimeSlider.value = String(sec);
        dom.debugTimeVal.textContent = `${sec}s`;
        dom.timerEl.textContent = String(sec);
      });
    });
  }

  generateDailyMission();
  applyCrewDeployment(state.crewCount);

  app.ui = {
    dom,
    updateHullHpUI,
    updateHudRecoveryCounts,
    generateDailyMission,
    applyCrewDeployment,
    showResultModal,
    initUIEvents
  };
})(window.GameApp);