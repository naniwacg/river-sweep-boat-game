// ==========================================
// 入力処理・衝突判定・ゲーム進行・メインアニメーションループ
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, CONSTANTS, world, ship, trash } = app;
  const {
    camera,
    renderer,
    bridges,
    getCurvedY,
    getBankLimitAtZ,
    updateWorld,
    resetBridges
  } = world;

  const {
    shipParent,
    shipVisual,
    hullMat,
    orangeMat,
    boxGroup,
    crewMembers,
    netAimLine,
    netTargetMarker,
    spawnTiltSpray,
    updateTiltParticles,
    updateCrewNetAim,
    updateCapsizeAnimation,
    updateCrewStability,
    resetShipAndCrew
  } = ship;

  const {
    populateInitialTrash,
    catchTrashWithCrewNet,
    updateTrash
  } = trash;

  // 操船物理ステート（ワンテンポ遅れる慣性追従 ＋ 高速スワイプ傾き増幅）
  const shipPhysics = {
    x: 0,
    vx: 0,
    targetVx: 0,
    delayedVelInput: 0,
    tiltBoostInput: 0,
    delayedTiltBoost: 0,
    currentRollZ: 0,
    prevRollZ: 0
  };

  // ポインター・スワイプ管理
  const pointerState = {
    active: false,
    id: null,
    mode: null, // 'ship' | 'net'
    activeCrew: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0
  };

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHitPoint = new THREE.Vector3();

  function updatePointerNdc(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // タッチ対象判定（有効な船員の網ヒットエリア優先、それ以外は船体操船）
  function detectTouchTarget(clientX, clientY) {
    if (state.crewEnabled) {
      updatePointerNdc(clientX, clientY);
      raycaster.setFromCamera(pointerNdc, camera);

      for (const crew of crewMembers) {
        if (crew.isDeployed && crew.netHitArea) {
          const hits = raycaster.intersectObject(crew.netHitArea, false);
          if (hits.length > 0) {
            return { mode: 'net', crew };
          }
        }
      }
    }

    return { mode: 'ship', crew: null };
  }

  // ポインターイベント初期化
  function initInputEvents() {
    const canvas = renderer.domElement;

    canvas.addEventListener('pointerdown', (e) => {
      if (!state.isPlaying || state.isGameOver || state.shipCapsizing) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);

      const target = detectTouchTarget(e.clientX, e.clientY);
      pointerState.active = true;
      pointerState.id = e.pointerId;
      pointerState.mode = target.mode;
      pointerState.activeCrew = target.crew;
      pointerState.lastX = e.clientX;
      pointerState.lastY = e.clientY;
      pointerState.lastTime = performance.now();

      if (target.mode === 'net' && target.crew) {
        updatePointerNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.ray.intersectPlane(waterPlane, planeHitPoint)) {
          updateCrewNetAim(target.crew, planeHitPoint);
        }
      }
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      if (!pointerState.active || e.pointerId !== pointerState.id) return;
      if (!state.isPlaying || state.isGameOver || state.shipCapsizing) return;
      e.preventDefault();

      const now = performance.now();
      const dtMs = Math.max(12, now - pointerState.lastTime);
      const dx = e.clientX - pointerState.lastX;
      const baseWidth = Math.max(320, canvas.clientWidth || window.innerWidth);

      if (pointerState.mode === 'ship') {
        // 順方向スワイプ操船（右スワイプ dx > 0 → 画面右側 -X へ移動）
        const normDx = (-dx / baseWidth) * 16.5;
        const swipeSpeed = normDx / (dtMs / 1000);

        shipPhysics.targetVx += normDx * 2.25;
        shipPhysics.targetVx = THREE.MathUtils.clamp(shipPhysics.targetVx, -13.5, 13.5);

        // 高速スワイプ時の傾きブースト入力
        shipPhysics.tiltBoostInput += swipeSpeed * 0.015;
        shipPhysics.tiltBoostInput = THREE.MathUtils.clamp(shipPhysics.tiltBoostInput, -0.95, 0.95);
      } else if (pointerState.mode === 'net' && pointerState.activeCrew) {
        updatePointerNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.ray.intersectPlane(waterPlane, planeHitPoint)) {
          updateCrewNetAim(pointerState.activeCrew, planeHitPoint);
        }
      }

      pointerState.lastX = e.clientX;
      pointerState.lastY = e.clientY;
      pointerState.lastTime = now;
    }, { passive: false });

    const endPointer = (e) => {
      if (!pointerState.active || e.pointerId !== pointerState.id) return;

      if (pointerState.mode === 'net' && pointerState.activeCrew) {
        pointerState.activeCrew.swingTimer = 0.45;
        if (typeof catchTrashWithCrewNet === 'function') {
          catchTrashWithCrewNet(pointerState.activeCrew);
        }
      }

      netAimLine.visible = false;
      netTargetMarker.visible = false;
      pointerState.active = false;
      pointerState.id = null;
      pointerState.mode = null;
      pointerState.activeCrew = null;
    };

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
  }

  // ゴミ回収ボックス収納時のコールバック
  function handleTrashCollected(typeId) {
    if (!state.isPlaying || state.isGameOver) return;
    state.score += 1;
    if (state.collectedByType[typeId] !== undefined) {
      state.collectedByType[typeId] += 1;
    }
    boxGroup.scale.set(1.26, 1.26, 1.26);

    if (app.ui && typeof app.ui.updateScoreUI === 'function') {
      app.ui.updateScoreUI();
    }
  }

  // 船体接触ダメージ適用
  function applyShipDamage(amount) {
    if (!state.isPlaying || state.isGameOver || state.shipCapsizing) return;

    state.shipHp = Math.max(0, state.shipHp - amount);
    state.damageFlashTimer = 0.35;

    hullMat.emissive.setHex(0x991b1b);
    orangeMat.emissive.setHex(0x991b1b);

    if (app.ui && typeof app.ui.updateHullHpUI === 'function') {
      app.ui.updateHullHpUI();
    }

    if (state.shipHp <= 0) {
      state.isGameOver = true;
      state.isPlaying = false;
      if (app.ui && typeof app.ui.endGame === 'function') {
        app.ui.endGame('hull_destroyed');
      }
    }
  }

  // 転覆シーケンス開始（50度超の傾きで発生）
  function triggerCapsize(rollDir) {
    if (state.shipCapsizing || state.isGameOver) return;
    state.shipCapsizing = true;
    state.capsizeDir = rollDir >= 0 ? 1 : -1;
    state.capsizeProgress = 0;

    netAimLine.visible = false;
    netTargetMarker.visible = false;
    pointerState.active = false;
    pointerState.activeCrew = null;
  }

  // ゲーム開始・リセット処理
  function startGame() {
    state.isPlaying = true;
    state.isGameOver = false;
    state.score = 0;
    state.timeLeft = CONSTANTS.GAME_DURATION;
    state.shipHp = state.shipMaxHp;
    state.bankDamageCooldown = 0;
    state.pierDamageCooldown = 0;
    state.damageFlashTimer = 0;
    state.shipCapsizing = false;
    state.capsizeProgress = 0;
    state.crewFalling = false;
    state.fallingCrew = null;

    app.TRASH_VARIANTS.forEach((v) => {
      state.collectedByType[v.id] = 0;
    });

    // 船体物理リセット
    shipPhysics.x = 0;
    shipPhysics.vx = 0;
    shipPhysics.targetVx = 0;
    shipPhysics.delayedVelInput = 0;
    shipPhysics.tiltBoostInput = 0;
    shipPhysics.delayedTiltBoost = 0;
    shipPhysics.currentRollZ = 0;
    shipPhysics.prevRollZ = 0;

    resetShipAndCrew();
    if (typeof resetBridges === 'function') {
      resetBridges();
    }
    if (typeof populateInitialTrash === 'function') {
      populateInitialTrash();
    }

    if (app.ui) {
      if (typeof app.ui.updateScoreUI === 'function') app.ui.updateScoreUI();
      if (typeof app.ui.updateHullHpUI === 'function') app.ui.updateHullHpUI();
      if (typeof app.ui.updateTimerUI === 'function') app.ui.updateTimerUI();
      if (typeof app.ui.hideModals === 'function') app.ui.hideModals();
    }
  }

  // 船体移動・ワンテンポ遅れる傾き・衝突・水しぶき更新
  function updateShipPhysics(dt, elapsed) {
    if (state.shipCapsizing) {
      updateCapsizeAnimation(dt);
      if (state.capsizeProgress >= 1.35 && !state.isGameOver) {
        state.isGameOver = true;
        state.isPlaying = false;
        if (app.ui && typeof app.ui.endGame === 'function') {
          app.ui.endGame('capsize');
        }
      }
      return;
    }

    // 入力減衰
    shipPhysics.targetVx *= Math.pow(0.04, dt);
    shipPhysics.tiltBoostInput *= Math.pow(0.03, dt);

    // ワンテンポ遅れる2段階慣性追従
    shipPhysics.delayedVelInput += (shipPhysics.targetVx - shipPhysics.delayedVelInput) * (1 - Math.exp(-7.2 * dt));
    shipPhysics.vx += (shipPhysics.delayedVelInput - shipPhysics.vx) * (1 - Math.exp(-8.8 * dt));
    shipPhysics.delayedTiltBoost += (shipPhysics.tiltBoostInput - shipPhysics.delayedTiltBoost) * (1 - Math.exp(-7.8 * dt));

    // X座標更新
    shipPhysics.x += shipPhysics.vx * dt;

    // 護岸との接触判定（getBankLimitAtZ(-1) は負、getBankLimitAtZ(1) は正を返す）
    const shipHalfBeam = 1.45;
    const minX = typeof getBankLimitAtZ === 'function'
      ? getBankLimitAtZ(-1, 0) + shipHalfBeam
      : -(CONSTANTS.BANK_LIMIT_X || 6.2) + shipHalfBeam;
    const maxX = typeof getBankLimitAtZ === 'function'
      ? getBankLimitAtZ(1, 0) - shipHalfBeam
      : (CONSTANTS.BANK_LIMIT_X || 6.2) - shipHalfBeam;

    if (shipPhysics.x < minX) {
      shipPhysics.x = minX;
      shipPhysics.vx = Math.abs(shipPhysics.vx) * 0.45 + 1.4;
      shipPhysics.targetVx = 0;
      if (state.bankDamageCooldown <= 0) {
        state.bankDamageCooldown = 0.6;
        applyShipDamage(18);
      }
    } else if (shipPhysics.x > maxX) {
      shipPhysics.x = maxX;
      shipPhysics.vx = -Math.abs(shipPhysics.vx) * 0.45 - 1.4;
      shipPhysics.targetVx = 0;
      if (state.bankDamageCooldown <= 0) {
        state.bankDamageCooldown = 0.6;
        applyShipDamage(18);
      }
    }

    // 水中橋脚との接触判定（world.bridges 準拠）
    if (Array.isArray(bridges)) {
      for (const b of bridges) {
        const dzPier = shipParent.position.z - b.group.position.z;
        if (Math.abs(dzPier) < 3.1 && Array.isArray(b.piers)) {
          for (const pier of b.piers) {
            const dxPier = shipPhysics.x - pier.x;
            const hitX = shipHalfBeam + (pier.radius || 0.64);
            if (Math.abs(dxPier) < hitX) {
              const pushDir = dxPier >= 0 ? 1 : -1;
              shipPhysics.x = pier.x + pushDir * (hitX + 0.08);
              shipPhysics.vx = pushDir * Math.max(2.4, Math.abs(shipPhysics.vx) * 0.55);
              shipPhysics.targetVx = 0;
              if (state.pierDamageCooldown <= 0) {
                state.pierDamageCooldown = 0.65;
                applyShipDamage(25);
              }
            }
          }
        }
      }
    }

    // 目標ロール角（左右反転後：正の符号で計算）
    const targetRollZ = THREE.MathUtils.clamp(
      shipPhysics.vx * 0.075 + shipPhysics.delayedTiltBoost * 0.66,
      -1.08,
      1.08
    );
    shipPhysics.prevRollZ = shipPhysics.currentRollZ;
    shipPhysics.currentRollZ += (targetRollZ - shipPhysics.currentRollZ) * (1 - Math.exp(-9.5 * dt));

    const rollDeg = THREE.MathUtils.radToDeg(Math.abs(shipPhysics.currentRollZ));
    const tiltDelta = shipPhysics.currentRollZ - shipPhysics.prevRollZ;

    // 船体の位置・姿勢反映
    const baseWaveY = typeof getCurvedY === 'function' ? getCurvedY(0) : 0;
    const bobY = Math.sin(elapsed * 3.4) * 0.05;
    shipParent.position.set(shipPhysics.x, baseWaveY + bobY, 0);
    shipVisual.rotation.z = shipPhysics.currentRollZ;
    shipVisual.rotation.y = -shipPhysics.vx * 0.03;
    shipVisual.rotation.x = Math.cos(elapsed * 2.8) * 0.025;

    // 水しぶきパーティクル発生（反転後の傾き方向に連動）
    const sprayDeg = CONSTANTS.SPRAY_THRESHOLD_DEG || 12.0;
    if (rollDeg > sprayDeg) {
      const splashSide = shipPhysics.currentRollZ > 0 ? 1 : -1;
      const intensity = THREE.MathUtils.clamp((rollDeg - sprayDeg) / 30.0, 0.25, 1.0);
      spawnTiltSpray(splashSide, intensity);
    }

    // 船員バランス・警告アイコン更新
    const warnDeg = CONSTANTS.WARN_THRESHOLD_DEG || 38.0;
    const isDangerTilt = rollDeg >= warnDeg;
    updateCrewStability(dt, elapsed, shipPhysics.currentRollZ, tiltDelta, pointerState.activeCrew, isDangerTilt);

    // 50度超で転覆判定
    const fallDeg = CONSTANTS.FALL_THRESHOLD_DEG || 50.0;
    if (rollDeg > fallDeg) {
      triggerCapsize(shipPhysics.currentRollZ >= 0 ? 1 : -1);
    }
  }

  // メインアニメーションループ
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    const elapsed = now * 0.001;
    lastTime = now;

    if (state.bankDamageCooldown > 0) state.bankDamageCooldown = Math.max(0, state.bankDamageCooldown - dt);
    if (state.pierDamageCooldown > 0) state.pierDamageCooldown = Math.max(0, state.pierDamageCooldown - dt);
    if (state.damageFlashTimer > 0) {
      state.damageFlashTimer = Math.max(0, state.damageFlashTimer - dt);
      if (state.damageFlashTimer <= 0) {
        hullMat.emissive.setHex(0x000000);
        orangeMat.emissive.setHex(0x000000);
      }
    }

    if (typeof updateWorld === 'function') {
      updateWorld(dt, elapsed);
    }

    updateTiltParticles(dt);

    if (state.isPlaying && !state.isGameOver) {
      if (!state.shipCapsizing) {
        state.timeLeft = Math.max(0, state.timeLeft - dt);
        if (app.ui && typeof app.ui.updateTimerUI === 'function') {
          app.ui.updateTimerUI();
        }
        if (state.timeLeft <= 0) {
          state.isGameOver = true;
          state.isPlaying = false;
          if (app.ui && typeof app.ui.endGame === 'function') {
            app.ui.endGame('timeup');
          }
        }
      }

      updateShipPhysics(dt, elapsed);

      if (!state.shipCapsizing && typeof updateTrash === 'function') {
        updateTrash(dt, elapsed, handleTrashCollected);
      }
    } else {
      // タイトル・リザルト画面でのアイドル揺れ
      const baseWaveY = typeof getCurvedY === 'function' ? getCurvedY(0) : 0;
      shipParent.position.set(0, baseWaveY + Math.sin(elapsed * 2.4) * 0.06, 0);
      shipVisual.rotation.z = Math.sin(elapsed * 1.8) * 0.04;
      if (typeof updateTrash === 'function') {
        updateTrash(dt, elapsed, null);
      }
    }

    renderer.render(scene, camera);
  }

  // リサイズ追従
  window.addEventListener('resize', () => {
    const width = renderer.domElement.clientWidth || window.innerWidth;
    const height = renderer.domElement.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });

  // 起動初期化
  function init() {
    initInputEvents();
    resetShipAndCrew();

    if (app.ui && typeof app.ui.initUI === 'function') {
      app.ui.initUI({ onStartGame: startGame });
    }

    requestAnimationFrame(animate);
  }

  app.main = {
    startGame,
    applyShipDamage,
    triggerCapsize
  };

  init();
})(window.GameApp);