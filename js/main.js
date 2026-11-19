// ==========================================
// 入力処理・衝突判定・ゲーム進行・メインアニメーションループ
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
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
    const renderer = app.world && app.world.renderer;
    if (!renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  // タッチ対象判定（有効な船員の網ヒットエリア優先、それ以外は船体操船）
  function detectTouchTarget(clientX, clientY) {
    const state = app.state;
    const camera = app.world && app.world.camera;
    const crewMembers = app.ship && app.ship.crewMembers;

    if (state && state.crewEnabled && camera && Array.isArray(crewMembers)) {
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
    const renderer = app.world && app.world.renderer;
    if (!renderer) return;
    const canvas = renderer.domElement;

    canvas.addEventListener('pointerdown', (e) => {
      const state = app.state;
      if (!state || !state.isPlaying || state.isGameOver || state.shipCapsizing) return;
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

      const camera = app.world && app.world.camera;
      if (target.mode === 'net' && target.crew && camera && app.ship && app.ship.updateCrewNetAim) {
        updatePointerNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.ray.intersectPlane(waterPlane, planeHitPoint)) {
          app.ship.updateCrewNetAim(target.crew, planeHitPoint);
        }
      }
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      if (!pointerState.active || e.pointerId !== pointerState.id) return;
      const state = app.state;
      if (!state || !state.isPlaying || state.isGameOver || state.shipCapsizing) return;
      e.preventDefault();

      const now = performance.now();
      const dtMs = Math.max(12, now - pointerState.lastTime);
      const dx = e.clientX - pointerState.lastX;
      const baseWidth = Math.max(320, canvas.clientWidth || window.innerWidth);

      if (pointerState.mode === 'ship') {
        // 順方向スワイプ操船
        const normDx = (-dx / baseWidth) * 16.5;
        const swipeSpeed = normDx / (dtMs / 1000);

        shipPhysics.targetVx += normDx * 2.25;
        shipPhysics.targetVx = THREE.MathUtils.clamp(shipPhysics.targetVx, -13.5, 13.5);

        // 高速スワイプ時の傾きブースト入力
        shipPhysics.tiltBoostInput += swipeSpeed * 0.015;
        shipPhysics.tiltBoostInput = THREE.MathUtils.clamp(shipPhysics.tiltBoostInput, -0.95, 0.95);
      } else if (pointerState.mode === 'net' && pointerState.activeCrew) {
        const camera = app.world && app.world.camera;
        if (camera && app.ship && app.ship.updateCrewNetAim) {
          updatePointerNdc(e.clientX, e.clientY);
          raycaster.setFromCamera(pointerNdc, camera);
          if (raycaster.ray.intersectPlane(waterPlane, planeHitPoint)) {
            app.ship.updateCrewNetAim(pointerState.activeCrew, planeHitPoint);
          }
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
        if (app.trash && typeof app.trash.catchTrashWithCrewNet === 'function') {
          app.trash.catchTrashWithCrewNet(pointerState.activeCrew);
        }
      }

      if (app.ship) {
        if (app.ship.netAimLine) app.ship.netAimLine.visible = false;
        if (app.ship.netTargetMarker) app.ship.netTargetMarker.visible = false;
      }
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
    const state = app.state;
    if (!state || !state.isPlaying || state.isGameOver) return;
    state.score += 1;
    if (state.collectedByType && state.collectedByType[typeId] !== undefined) {
      state.collectedByType[typeId] += 1;
    }
    if (app.ship && app.ship.boxGroup) {
      app.ship.boxGroup.scale.set(1.26, 1.26, 1.26);
    }

    if (app.ui && typeof app.ui.updateScoreUI === 'function') {
      app.ui.updateScoreUI();
    }
  }

  // 船体接触ダメージ適用
  function applyShipDamage(amount) {
    const state = app.state;
    if (!state || !state.isPlaying || state.isGameOver || state.shipCapsizing) return;

    state.shipHp = Math.max(0, state.shipHp - amount);
    state.damageFlashTimer = 0.35;

    if (app.ship) {
      if (app.ship.hullMat) app.ship.hullMat.emissive.setHex(0x991b1b);
      if (app.ship.orangeMat) app.ship.orangeMat.emissive.setHex(0x991b1b);
    }

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
    const state = app.state;
    if (!state || state.shipCapsizing || state.isGameOver) return;
    state.shipCapsizing = true;
    state.capsizeDir = rollDir >= 0 ? 1 : -1;
    state.capsizeProgress = 0;

    if (app.ship) {
      if (app.ship.netAimLine) app.ship.netAimLine.visible = false;
      if (app.ship.netTargetMarker) app.ship.netTargetMarker.visible = false;
    }
    pointerState.active = false;
    pointerState.activeCrew = null;
  }

  // ゲーム開始・リセット処理
  function startGame() {
    const state = app.state;
    const CONSTANTS = app.CONSTANTS || {};
    if (!state) return;

    state.isPlaying = true;
    state.isGameOver = false;
    state.score = 0;
    state.timeLeft = CONSTANTS.GAME_DURATION || 60;
    state.shipHp = state.shipMaxHp || 100;
    state.bankDamageCooldown = 0;
    state.pierDamageCooldown = 0;
    state.damageFlashTimer = 0;
    state.shipCapsizing = false;
    state.capsizeProgress = 0;
    state.crewFalling = false;
    state.fallingCrew = null;

    if (Array.isArray(app.TRASH_VARIANTS)) {
      app.TRASH_VARIANTS.forEach((v) => {
        state.collectedByType[v.id] = 0;
      });
    }

    // 船体物理リセット
    shipPhysics.x = 0;
    shipPhysics.vx = 0;
    shipPhysics.targetVx = 0;
    shipPhysics.delayedVelInput = 0;
    shipPhysics.tiltBoostInput = 0;
    shipPhysics.delayedTiltBoost = 0;
    shipPhysics.currentRollZ = 0;
    shipPhysics.prevRollZ = 0;

    if (app.ship && typeof app.ship.resetShipAndCrew === 'function') {
      app.ship.resetShipAndCrew();
    }
    if (app.world && typeof app.world.resetBridges === 'function') {
      app.world.resetBridges();
    }
    if (app.trash && typeof app.trash.populateInitialTrash === 'function') {
      app.trash.populateInitialTrash();
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
    const state = app.state;
    const CONSTANTS = app.CONSTANTS || {};
    const world = app.world;
    const ship = app.ship;
    if (!state || !world || !ship) return;

    if (state.shipCapsizing) {
      if (typeof ship.updateCapsizeAnimation === 'function') {
        ship.updateCapsizeAnimation(dt);
      }
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

    // 護岸との接触判定
    const shipHalfBeam = 1.45;
    const minX = typeof world.getBankLimitAtZ === 'function'
      ? world.getBankLimitAtZ(-1, 0) + shipHalfBeam
      : -(CONSTANTS.BANK_LIMIT_X || 6.2) + shipHalfBeam;
    const maxX = typeof world.getBankLimitAtZ === 'function'
      ? world.getBankLimitAtZ(1, 0) - shipHalfBeam
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

    // 水中橋脚との接触判定
    if (Array.isArray(world.bridges)) {
      for (const b of world.bridges) {
        const dzPier = ship.shipParent.position.z - b.group.position.z;
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

    // 目標ロール角
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
    const baseWaveY = typeof world.getCurvedY === 'function' ? world.getCurvedY(0) : 0;
    const bobY = Math.sin(elapsed * 3.4) * 0.05;
    ship.shipParent.position.set(shipPhysics.x, baseWaveY + bobY, 0);
    ship.shipVisual.rotation.z = shipPhysics.currentRollZ;
    ship.shipVisual.rotation.y = -shipPhysics.vx * 0.03;
    ship.shipVisual.rotation.x = Math.cos(elapsed * 2.8) * 0.025;

    // 水しぶきパーティクル発生
    const sprayDeg = CONSTANTS.SPRAY_THRESHOLD_DEG || 12.0;
    if (rollDeg > sprayDeg && typeof ship.spawnTiltSpray === 'function') {
      const splashSide = shipPhysics.currentRollZ > 0 ? 1 : -1;
      const intensity = THREE.MathUtils.clamp((rollDeg - sprayDeg) / 30.0, 0.25, 1.0);
      ship.spawnTiltSpray(splashSide, intensity);
    }

    // 船員バランス・警告アイコン更新
    const warnDeg = CONSTANTS.WARN_THRESHOLD_DEG || 38.0;
    const isDangerTilt = rollDeg >= warnDeg;
    if (typeof ship.updateCrewStability === 'function') {
      ship.updateCrewStability(dt, elapsed, shipPhysics.currentRollZ, tiltDelta, pointerState.activeCrew, isDangerTilt);
    }

    // 50度超で転覆判定
    const fallDeg = CONSTANTS.FALL_THRESHOLD_DEG || 50.0;
    if (rollDeg > fallDeg) {
      triggerCapsize(shipPhysics.currentRollZ >= 0 ? 1 : -1);
    }
  }

  // キャンバスサイズ同期
  function resizeRenderer() {
    const world = app.world;
    if (!world || !world.renderer || !world.camera) return;
    const width = window.innerWidth || document.documentElement.clientWidth || 360;
    const height = window.innerHeight || document.documentElement.clientHeight || 640;
    world.camera.aspect = width / height;
    world.camera.updateProjectionMatrix();
    world.renderer.setSize(width, height);
  }

  // メインアニメーションループ
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);

    const state = app.state;
    const world = app.world;
    const ship = app.ship;
    const trash = app.trash;
    if (!state || !world || !world.renderer || !world.scene || !world.camera) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    const elapsed = now * 0.001;
    lastTime = now;

    if (state.bankDamageCooldown > 0) state.bankDamageCooldown = Math.max(0, state.bankDamageCooldown - dt);
    if (state.pierDamageCooldown > 0) state.pierDamageCooldown = Math.max(0, state.pierDamageCooldown - dt);
    if (state.damageFlashTimer > 0) {
      state.damageFlashTimer = Math.max(0, state.damageFlashTimer - dt);
      if (state.damageFlashTimer <= 0 && ship) {
        if (ship.hullMat) ship.hullMat.emissive.setHex(0x000000);
        if (ship.orangeMat) ship.orangeMat.emissive.setHex(0x000000);
      }
    }

    if (typeof world.updateWorld === 'function') {
      world.updateWorld(dt, elapsed);
    }

    if (ship && typeof ship.updateTiltParticles === 'function') {
      ship.updateTiltParticles(dt);
    }

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

      if (!state.shipCapsizing && trash && typeof trash.updateTrash === 'function') {
        trash.updateTrash(dt, elapsed, handleTrashCollected);
      }
    } else if (ship && ship.shipParent && ship.shipVisual) {
      // タイトル・リザルト画面でのアイドル揺れ
      shipPhysics.x = 0;
      const baseWaveY = typeof world.getCurvedY === 'function' ? world.getCurvedY(0) : 0;
      ship.shipParent.position.set(0, baseWaveY + Math.sin(elapsed * 2.4) * 0.06, 0);
      ship.shipVisual.rotation.z = Math.sin(elapsed * 1.8) * 0.04;
      if (trash && typeof trash.updateTrash === 'function') {
        trash.updateTrash(dt, elapsed, null);
      }
    }

    world.renderer.render(world.scene, world.camera);
  }

  window.addEventListener('resize', resizeRenderer);

  // 起動初期化
  function init() {
    resizeRenderer();
    initInputEvents();

    if (app.ship && typeof app.ship.resetShipAndCrew === 'function') {
      app.ship.resetShipAndCrew();
    }

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.GameApp);