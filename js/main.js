// 入力処理・衝突判定・ゲーム進行・メインアニメーションループ

// ポインター座標から船体または左右タモ網の操作対象を判定
function detectControlTarget(clientX, clientY) {
  if (!state.crewEnabled) return 'ship';

  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const targets = [];
  if (state.selectedCrewCount >= 1 && typeof leftNetGroup !== 'undefined' && leftNetGroup.visible) {
    targets.push({ name: 'leftNet', obj: leftNetGroup });
  }
  if (state.selectedCrewCount >= 2 && typeof rightNetGroup !== 'undefined' && rightNetGroup.visible) {
    targets.push({ name: 'rightNet', obj: rightNetGroup });
  }

  for (const t of targets) {
    const hits = raycaster.intersectObject(t.obj, true);
    if (hits.length > 0) return t.name;
  }

  // スクリーン投影距離による補助判定（モバイル指タッチの拾いやすさ向上）
  const shipScreen = shipGroup.position.clone().project(camera);
  const shipPxX = (shipScreen.x * 0.5 + 0.5) * rect.width + rect.left;
  const shipPxY = (-shipScreen.y * 0.5 + 0.5) * rect.height + rect.top;

  const dx = clientX - shipPxX;
  const dy = clientY - shipPxY;

  if (Math.abs(dy) < 95) {
    if (dx < -38 && dx > -160 && state.selectedCrewCount >= 1) return 'leftNet';
    if (dx > 38 && dx < 160 && state.selectedCrewCount >= 2) return 'rightNet';
  }

  return 'ship';
}

// ポインター／スワイプイベント初期化
function initInputEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'playing') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const mode = detectControlTarget(e.clientX, e.clientY);
    state.pointer = {
      active: true,
      id: e.pointerId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: performance.now()
    };
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.pointer.active || e.pointerId !== state.pointer.id) return;
    if (state.phase !== 'playing') return;
    e.preventDefault();

    const now = performance.now();
    const dtMs = Math.max(12, now - state.pointer.lastTime);
    const dx = e.clientX - state.pointer.lastX;
    const totalDx = e.clientX - state.pointer.startX;
    const baseWidth = Math.max(320, canvas.clientWidth || window.innerWidth);

    if (state.pointer.mode === 'ship') {
      // 逆方向スワイプ操船
      const normDx = (-dx / baseWidth) * 16.0;
      const swipeSpeed = normDx / (dtMs / 1000);

      state.shipPhysics.targetVx += normDx * 2.2;
      state.shipPhysics.targetVx = Math.max(-13, Math.min(13, state.shipPhysics.targetVx));

      // 高速スワイプ時の傾きブースト（急激すぎる即転覆を抑えつつ大きく傾く係数）
      state.shipPhysics.tiltBoostInput += swipeSpeed * 0.013;
      state.shipPhysics.tiltBoostInput = Math.max(-0.85, Math.min(0.85, state.shipPhysics.tiltBoostInput));
    } else if (state.pointer.mode === 'leftNet' && state.nets?.left) {
      const extend = Math.max(0, Math.min(1, -totalDx / 110));
      state.nets.left.targetExtend = extend;
    } else if (state.pointer.mode === 'rightNet' && state.nets?.right) {
      const extend = Math.max(0, Math.min(1, totalDx / 110));
      state.nets.right.targetExtend = extend;
    }

    state.pointer.lastX = e.clientX;
    state.pointer.lastY = e.clientY;
    state.pointer.lastTime = now;
  }, { passive: false });

  const releasePointer = (e) => {
    if (!state.pointer.active || e.pointerId !== state.pointer.id) return;
    if (state.pointer.mode === 'leftNet' && state.nets?.left) {
      state.nets.left.targetExtend = 0;
    } else if (state.pointer.mode === 'rightNet' && state.nets?.right) {
      state.nets.right.targetExtend = 0;
    }
    state.pointer.active = false;
    state.pointer.id = null;
    state.pointer.mode = null;
  };

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
}

// 船体ダメージ適用＆HUDフラッシュ演出
function applyHullDamage(amount) {
  if (state.phase !== 'playing') return;
  if (state.damageCooldown > 0) return;

  state.hullHp = Math.max(0, state.hullHp - amount);
  state.damageCooldown = 0.55;
  updateHullHpUI();

  if (dom.hullHpPanel) {
    dom.hullHpPanel.classList.add('border-rose-500', 'bg-rose-950/80');
  }
  if (dom.hullDamageAlert) {
    dom.hullDamageAlert.classList.remove('hidden');
  }

  setTimeout(() => {
    if (dom.hullHpPanel) {
      dom.hullHpPanel.classList.remove('border-rose-500', 'bg-rose-950/80');
    }
    if (dom.hullDamageAlert) {
      dom.hullDamageAlert.classList.add('hidden');
    }
  }, 450);

  if (state.hullHp <= 0) {
    endGame('hull_destroyed');
  }
}

// ゲーム開始・リセット処理
function startGame() {
  state.phase = 'playing';
  state.score = 0;
  state.timeLeft = GAME_DURATION;
  state.hullHp = state.maxHullHp;
  state.damageCooldown = 0;
  state.worldDistance = 0;

  TRASH_TYPES.forEach(t => {
    state.collectedByType[t.id] = 0;
  });

  // 船体位置・物理状態リセット（x の undefined による NaN を防止）
  shipGroup.position.set(0, 0, SHIP_Z);
  shipGroup.rotation.set(0, 0, 0);
  state.shipPhysics = {
    x: 0,
    vx: 0,
    targetVx: 0,
    delayedVelInput: 0,
    tiltBoostInput: 0,
    delayedTiltBoost: 0,
    currentRollZ: 0
  };

  // タモ網状態リセット
  if (state.nets?.left) {
    state.nets.left.extend = 0;
    state.nets.left.targetExtend = 0;
  }
  if (state.nets?.right) {
    state.nets.right.extend = 0;
    state.nets.right.targetExtend = 0;
  }

  // 既存ゴミオブジェクトのクリア
  if (typeof clearAllTrash === 'function') {
    clearAllTrash();
  }

  // UI更新
  dom.score.textContent = '0';
  dom.timer.textContent = Math.ceil(state.timeLeft);
  dom.timer.classList.remove('text-rose-400');
  if (dom.debugTimeSlider) dom.debugTimeSlider.value = Math.ceil(state.timeLeft).toString();
  if (dom.debugTimeVal) dom.debugTimeVal.textContent = `${Math.ceil(state.timeLeft)}秒`;

  updateHullHpUI();
  updateHudTypeCounts();
  syncCrewEnabledUI();

  dom.titleModal.classList.add('hidden');
  dom.resultModal.classList.add('hidden');
}

// 船体物理・水しぶき・護岸および橋脚との衝突更新
function updateShipAndCollisions(dt) {
  const phys = state.shipPhysics;
  if (typeof phys.x !== 'number' || Number.isNaN(phys.x)) {
    phys.x = shipGroup.position.x || 0;
  }

  // 入力減衰
  phys.targetVx *= Math.pow(0.04, dt);
  phys.tiltBoostInput *= Math.pow(0.03, dt);

  // ワンテンポ遅れる2段階慣性追従
  const lagFactor = 1 - Math.exp(-7.5 * dt);
  phys.delayedVelInput += (phys.targetVx - phys.delayedVelInput) * lagFactor;
  phys.vx += (phys.delayedVelInput - phys.vx) * (1 - Math.exp(-9.0 * dt));

  phys.delayedTiltBoost += (phys.tiltBoostInput - phys.delayedTiltBoost) * (1 - Math.exp(-8.0 * dt));

  // 横移動更新
  phys.x += phys.vx * dt;

  // 川のカーブ中心と有効川幅の取得
  const riverCenter = typeof getRiverCenterX === 'function' ? getRiverCenterX(state.worldDistance + SHIP_Z) : 0;
  const halfRiverWidth = typeof getRiverHalfWidth === 'function' ? getRiverHalfWidth(state.worldDistance + SHIP_Z) : 6.2;
  const shipHalfBeam = 1.15;

  const minX = riverCenter - halfRiverWidth + shipHalfBeam;
  const maxX = riverCenter + halfRiverWidth - shipHalfBeam;

  // 左右護岸との接触判定
  if (phys.x < minX) {
    phys.x = minX;
    phys.vx = Math.abs(phys.vx) * 0.45 + 1.5;
    phys.targetVx = 0;
    applyHullDamage(18);
  } else if (phys.x > maxX) {
    phys.x = maxX;
    phys.vx = -Math.abs(phys.vx) * 0.45 - 1.5;
    phys.targetVx = 0;
    applyHullDamage(18);
  }

  // 水中橋脚との接触判定（activeBridges / bridges の両変数名に対応）
  const bridgeList = typeof activeBridges !== 'undefined'
    ? activeBridges
    : (typeof bridges !== 'undefined' ? bridges : null);

  if (Array.isArray(bridgeList)) {
    for (const bridge of bridgeList) {
      if (!bridge.piers) continue;
      for (const pier of bridge.piers) {
        const worldZ = (bridge.group ? bridge.group.position.z : (bridge.z || 0)) + (pier.z || 0);
        const worldX = pier.x;
        const dz = Math.abs(worldZ - SHIP_Z);
        const dx = phys.x - worldX;
        const hitX = shipHalfBeam + (pier.halfW || 0.55);
        const hitZ = 2.1 + (pier.halfD || 0.7);

        if (dz < hitZ && Math.abs(dx) < hitX) {
          const pushDir = dx >= 0 ? 1 : -1;
          phys.x = worldX + pushDir * (hitX + 0.08);
          phys.vx = pushDir * Math.max(2.5, Math.abs(phys.vx) * 0.6);
          phys.targetVx = 0;
          applyHullDamage(25);
        }
      }
    }
  }

  // 目標ロール角の算出（横移動速度 ＋ 高速スワイプブースト）
  const targetRollZ = Math.max(
    -1.05,
    Math.min(1.05, -phys.vx * 0.075 - phys.delayedTiltBoost * 0.62)
  );
  phys.currentRollZ += (targetRollZ - phys.currentRollZ) * (1 - Math.exp(-10.0 * dt));

  // 船体の位置・姿勢反映（水面のうねりに追従）
  const waveY = typeof getWaterHeightAt === 'function'
    ? getWaterHeightAt(phys.x, SHIP_Z, state.worldDistance)
    : Math.sin(state.worldDistance * 0.35) * 0.06;

  shipGroup.position.set(phys.x, waveY, SHIP_Z);
  shipGroup.rotation.z = phys.currentRollZ;
  shipGroup.rotation.y = -phys.vx * 0.032;
  shipGroup.rotation.x = Math.cos(state.worldDistance * 0.45) * 0.025;

  // 左右移動・傾きに応じた側面水しぶきパーティクル発生
  if (typeof updateSideWaterSpray === 'function') {
    updateSideWaterSpray(dt, phys.x, waveY, SHIP_Z, phys.vx, phys.currentRollZ);
  }

  // タモ網の伸縮アニメーション更新
  if (typeof updateCrewNets === 'function') {
    updateCrewNets(dt);
  }

  // 50度超の傾きで転覆判定
  const fallRad = typeof FALL_THRESHOLD_RAD !== 'undefined' ? FALL_THRESHOLD_RAD : (50 * Math.PI) / 180;
  if (state.phase === 'playing' && Math.abs(phys.currentRollZ) > fallRad) {
    endGame('capsize');
  }
}

// メインアニメーションループ
let lastFrameTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
  lastFrameTime = now;

  if (state.damageCooldown > 0) {
    state.damageCooldown = Math.max(0, state.damageCooldown - dt);
  }

  const scrollSpeed = state.phase === 'playing' ? state.baseScrollSpeed : state.baseScrollSpeed * 0.45;
  state.worldDistance += scrollSpeed * dt;

  // 環境・水面・街並み・橋の更新
  if (typeof updateWorld === 'function') {
    updateWorld(dt, scrollSpeed, state.worldDistance);
  }

  if (state.phase === 'playing') {
    // タイマー更新
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const ceilSec = Math.ceil(state.timeLeft);
    dom.timer.textContent = ceilSec;
    if (dom.debugTimeSlider) dom.debugTimeSlider.value = ceilSec.toString();
    if (dom.debugTimeVal) dom.debugTimeVal.textContent = `${ceilSec}秒`;

    if (state.timeLeft <= 10) {
      dom.timer.classList.add('text-rose-400');
    } else {
      dom.timer.classList.remove('text-rose-400');
    }

    // 船体移動・衝突・水しぶき更新
    updateShipAndCollisions(dt);

    // ゴミのスポーン・移動・回収処理
    if (typeof updateTrashSystem === 'function') {
      updateTrashSystem(dt, scrollSpeed);
    }

    if (state.timeLeft <= 0) {
      endGame('timeup');
    }
  } else {
    // タイトル・リザルト画面でのアイドル揺れアニメーション
    const idleWave = Math.sin(now * 0.0025) * 0.06;
    shipGroup.position.y = idleWave;
    shipGroup.rotation.z = Math.sin(now * 0.0018) * 0.04;
    if (typeof updateSideWaterSpray === 'function') {
      updateSideWaterSpray(dt, shipGroup.position.x, idleWave, SHIP_Z, 0, shipGroup.rotation.z);
    }
  }

  renderer.render(scene, camera);
}

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
  const width = renderer.domElement.clientWidth || window.innerWidth;
  const height = renderer.domElement.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
});

// 初期化シーケンス
function initApp() {
  initDebugUI();
  initInputEvents();
  setSelectedCrewCount(state.selectedCrewCount || 0);
  generateDailyMission();
  updateHullHpUI();

  if (dom.startBtn) {
    dom.startBtn.addEventListener('click', () => {
      startGame();
    });
  }

  if (dom.retryBtn) {
    dom.retryBtn.addEventListener('click', () => {
      generateDailyMission();
      dom.resultModal.classList.add('hidden');
      dom.titleModal.classList.remove('hidden');
      state.phase = 'title';
    });
  }

  requestAnimationFrame(animate);
}

initApp();