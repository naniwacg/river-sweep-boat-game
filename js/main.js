// ==========================================
// 操船・入力処理・ゲーム進行制御・メインループ
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, CONSTANTS, world, ship, trash, ui } = app;
  const { canvas, scene, camera, renderer, bridges, getBankLimitAtZ, updateWorld, resetBridges } = world;
  const {
    shipParent,
    shipVisual,
    hullMat,
    orangeMat,
    pontoonL,
    pontoonR,
    deck,
    boxBase,
    boxGroup,
    shipHitBox,
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

  // 操船物理パラメータ
  const shipPhysics = {
    vx: 0,
    moveForce: 75,
    maxSpeed: 13,
    dragSensitivity: 1.4,
    accumulatedInputX: 0,
    swipeVelocityInput: 0
  };

  let isPointerDown = false;
  let isShipDragging = false;
  let lastPointerX = 0;
  let activeNetCrew = null;

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function setPointerNDC(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
  }

  function checkShipHit(clientX, clientY) {
    setPointerNDC(clientX, clientY);
    const hits = raycaster.intersectObjects([shipHitBox, pontoonL, pontoonR, deck, boxBase], false);
    return hits.length > 0;
  }

  function findHitNetCrew(clientX, clientY) {
    if (!state.crewEnabled) return null;
    setPointerNDC(clientX, clientY);

    let closestCrew = null;
    let minDist = Infinity;
    for (const crew of crewMembers) {
      if (!crew.isDeployed) continue;
      const hits = raycaster.intersectObjects([crew.netHitArea, crew.netRing, crew.poleMesh], false);
      if (hits.length > 0 && hits[0].distance < minDist) {
        minDist = hits[0].distance;
        closestCrew = crew;
      }
    }
    return closestCrew;
  }

  function handleCrewNetAim(crew, clientX, clientY) {
    setPointerNDC(clientX, clientY);
    const intersectPt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(waterPlane, intersectPt)) {
      updateCrewNetAim(crew, intersectPt);
    }
  }

  function executeCrewNetCatch(crew) {
    netAimLine.visible = false;
    netTargetMarker.visible = false;

    if (!crew || !state.crewEnabled || !state.isPlaying || state.crewFalling) return;
    trash.catchTrashWithCrewNet(crew);
    crew.swingTimer = 0.45;
  }

  // ポインター操作イベント
  canvas.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    lastPointerX = e.clientX;
    activeNetCrew = null;
    isShipDragging = false;

    if (!state.isPlaying || state.crewFalling) return;

    const hitCrew = findHitNetCrew(e.clientX, e.clientY);
    if (hitCrew) {
      activeNetCrew = hitCrew;
      handleCrewNetAim(activeNetCrew, e.clientX, e.clientY);
    } else if (checkShipHit(e.clientX, e.clientY)) {
      isShipDragging = true;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPointerDown || !state.isPlaying) return;

    if (activeNetCrew) {
      handleCrewNetAim(activeNetCrew, e.clientX, e.clientY);
      return;
    }

    if (!isShipDragging) return;

    const deltaX = e.clientX - lastPointerX;
    lastPointerX = e.clientX;

    if (Math.abs(deltaX) > 0.2) {
      const normalized = (-deltaX / Math.max(window.innerWidth, 320)) * 28 * shipPhysics.dragSensitivity;
      const clamped = THREE.MathUtils.clamp(normalized, -1, 1);
      if (Math.abs(clamped) > Math.abs(shipPhysics.accumulatedInputX)) {
        shipPhysics.accumulatedInputX = clamped;
      }
      const swipeSpeedFactor = THREE.MathUtils.clamp(
        (-deltaX / Math.max(window.innerWidth, 320)) * 45 * shipPhysics.dragSensitivity,
        -1.6,
        1.6
      );
      if (Math.abs(swipeSpeedFactor) > Math.abs(shipPhysics.swipeVelocityInput)) {
        shipPhysics.swipeVelocityInput = swipeSpeedFactor;
      }
    }
  });

  window.addEventListener('pointerup', () => {
    if (activeNetCrew) {
      executeCrewNetCatch(activeNetCrew);
      activeNetCrew = null;
    }
    isShipDragging = false;
    isPointerDown = false;
  });

  // ダメージ・ゲームオーバー処理
  function applyShipDamage(amount, contactSideSign) {
    if (!state.isPlaying || state.isGameOver || state.shipCapsizing) return;
    state.shipHp = Math.max(0, state.shipHp - amount);
    state.damageFlashTimer = 0.22;
    ui.updateHullHpUI(true);
    spawnTiltSpray(contactSideSign, 0.85);

    if (state.shipHp <= 0) {
      triggerGameOver('HULL_BROKEN');
    }
  }

  function triggerGameOver(reason) {
    if (state.isGameOver) return;
    state.isPlaying = false;
    state.isGameOver = true;
    ui.showResultModal(reason);
  }

  function resetGame(isNextMission = false) {
    if (isNextMission) {
      state.dayCount++;
      ui.generateDailyMission();
    }
    state.isPlaying = true;
    state.isGameOver = false;
    state.shipCapsizing = false;
    state.capsizeDir = 1;
    state.capsizeProgress = 0;
    state.shipHp = state.shipMaxHp;
    state.bankDamageCooldown = 0;
    state.pierDamageCooldown = 0;
    state.damageFlashTimer = 0;
    ui.updateHullHpUI(false);

    state.crewFalling = false;
    state.fallingCrew = null;
    state.crewFallVelocity.set(0, 0, 0);
    state.score = 0;
    state.collectedByType = { bottle: 0, foam: 0, can: 0, plastic: 0 };
    state.timeLeft = CONSTANTS.GAME_DURATION;
    ui.updateHudRecoveryCounts();

    ui.dom.timerEl.textContent = String(CONSTANTS.GAME_DURATION);
    ui.dom.timerEl.classList.remove('text-rose-500');
    if (ui.dom.debugTimeSlider) ui.dom.debugTimeSlider.value = String(CONSTANTS.GAME_DURATION);
    if (ui.dom.debugTimeVal) ui.dom.debugTimeVal.textContent = `${CONSTANTS.GAME_DURATION}s`;
    ui.dom.titleModal.classList.add('hidden');
    ui.dom.resultModal.classList.add('hidden');

    resetShipAndCrew();
    ui.applyCrewDeployment(state.crewCount);
    activeNetCrew = null;
    isShipDragging = false;

    shipPhysics.vx = 0;
    shipPhysics.accumulatedInputX = 0;
    shipPhysics.swipeVelocityInput = 0;

    resetBridges();
    trash.populateInitialTrash();
  }

  ui.initUIEvents(
    () => resetGame(false),
    () => {
      state.dayCount++;
      ui.generateDailyMission();
      ui.dom.resultModal.classList.add('hidden');
      ui.dom.titleModal.classList.remove('hidden');
    }
  );

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // メインアニメーションループ
  const clock = new THREE.Clock();
  let prevShipRollZ = 0;

  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    // 1. タイマー更新
    if (state.isPlaying) {
      state.timeLeft -= dt;
      ui.dom.timerEl.classList.toggle('text-rose-500', state.timeLeft <= 10);
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        triggerGameOver('TIMEUP');
      }
      const displaySec = Math.ceil(state.timeLeft);
      ui.dom.timerEl.textContent = String(displaySec);
      if (!ui.dom.debugPanel.classList.contains('hidden') && document.activeElement !== ui.dom.debugTimeSlider) {
        ui.dom.debugTimeSlider.value = String(Math.max(1, displaySec));
        ui.dom.debugTimeVal.textContent = `${displaySec}s`;
      }
    }

    // 2. ワールド（水面・護岸・街並み・橋）更新
    updateWorld(dt, elapsed);

    // 3. 船の左右物理移動・衝突判定
    const inputX = state.isPlaying ? shipPhysics.accumulatedInputX : 0;
    shipPhysics.accumulatedInputX = 0;

    shipPhysics.vx += inputX * shipPhysics.moveForce * dt;
    shipPhysics.vx *= Math.pow(0.06, dt);
    shipPhysics.vx = THREE.MathUtils.clamp(shipPhysics.vx, -shipPhysics.maxSpeed, shipPhysics.maxSpeed);
    shipParent.position.x += shipPhysics.vx * dt;

    const leftLimitX = Math.max(
      getBankLimitAtZ(-1, shipParent.position.z - 2.0),
      getBankLimitAtZ(-1, shipParent.position.z + 0.5),
      getBankLimitAtZ(-1, shipParent.position.z + 2.8)
    );
    const rightLimitX = Math.min(
      getBankLimitAtZ(1, shipParent.position.z - 2.0),
      getBankLimitAtZ(1, shipParent.position.z + 0.5),
      getBankLimitAtZ(1, shipParent.position.z + 2.8)
    );

    if (state.bankDamageCooldown > 0) state.bankDamageCooldown -= dt;
    if (state.pierDamageCooldown > 0) state.pierDamageCooldown -= dt;

    let isTouchingBank = false;
    let bankContactSide = 0;
    if (shipParent.position.x <= leftLimitX) {
      isTouchingBank = true;
      bankContactSide = -1;
      const impactSpeed = Math.abs(Math.min(0, shipPhysics.vx));
      shipParent.position.x = leftLimitX;
      shipPhysics.vx = Math.max(1.8, impactSpeed * 0.45);
    } else if (shipParent.position.x >= rightLimitX) {
      isTouchingBank = true;
      bankContactSide = 1;
      const impactSpeed = Math.abs(Math.max(0, shipPhysics.vx));
      shipParent.position.x = rightLimitX;
      shipPhysics.vx = -Math.max(1.8, impactSpeed * 0.45);
    }

    if (state.isPlaying && isTouchingBank && state.bankDamageCooldown <= 0) {
      if (ui.dom.hullDamageAlertEl) ui.dom.hullDamageAlertEl.textContent = '⚠️ BANK COLLISION!';
      applyShipDamage(12, bankContactSide);
      state.bankDamageCooldown = 0.42;
    }

    // 橋脚との接触判定
    let isTouchingPier = false;
    const shipHalfWidth = 1.48;
    const shipBowZ = shipParent.position.z + 3.25;
    const shipSternZ = shipParent.position.z - 2.55;

    bridges.forEach((b) => {
      const bz = b.group.position.z;
      b.piers.forEach((pier) => {
        if (bz >= shipSternZ - pier.radius && bz <= shipBowZ + pier.radius) {
          const dx = shipParent.position.x - pier.x;
          const minSafeDist = shipHalfWidth + pier.radius;
          if (Math.abs(dx) < minSafeDist) {
            isTouchingPier = true;
            const pushDir = dx >= 0 ? 1 : -1;
            shipParent.position.x = pier.x + pushDir * minSafeDist;
            shipPhysics.vx = pushDir * Math.max(3.2, Math.abs(shipPhysics.vx) * 0.55);

            if (state.isPlaying && state.pierDamageCooldown <= 0) {
              if (ui.dom.hullDamageAlertEl) ui.dom.hullDamageAlertEl.textContent = '⚠️ BRIDGE PIER HIT!';
              applyShipDamage(18, -pushDir);
              state.pierDamageCooldown = 0.55;
            }
          }
        }
      });
    });

    if (state.damageFlashTimer > 0) {
      state.damageFlashTimer -= dt;
      const flashIntensity = Math.max(0, state.damageFlashTimer / 0.22);
      hullMat.emissive.setRGB(0.65 * flashIntensity, 0.05 * flashIntensity, 0.05 * flashIntensity);
      orangeMat.emissive.setRGB(0.55 * flashIntensity, 0.04 * flashIntensity, 0.04 * flashIntensity);
      if (state.damageFlashTimer <= 0 && !isTouchingBank && !isTouchingPier) {
        hullMat.emissive.setHex(0x000000);
        orangeMat.emissive.setHex(0x000000);
        ui.updateHullHpUI(false);
      }
    }

    // カメラ追従
    const targetCamX = shipParent.position.x * 0.72;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, dt * 6.5);
    camera.lookAt(camera.position.x * 0.85, 0.5, 10);

    // ロール傾斜・転覆判定
    shipPhysics.swipeVelocityInput = THREE.MathUtils.lerp(shipPhysics.swipeVelocityInput, 0, dt * 5.0);
    const targetRollZ = THREE.MathUtils.clamp(
      shipPhysics.vx * 0.022 + shipPhysics.swipeVelocityInput * 0.24,
      -0.42,
      0.42
    );
    if (!state.shipCapsizing) {
      shipVisual.rotation.z = THREE.MathUtils.lerp(shipVisual.rotation.z, targetRollZ, dt * 8.5);
      shipVisual.rotation.x = Math.sin(elapsed * 3.2) * 0.025;
      shipVisual.position.y = Math.sin(elapsed * 2.6) * 0.06;
    }

    const currentRollZ = shipVisual.rotation.z;
    const tiltDelta = currentRollZ - prevShipRollZ;
    prevShipRollZ = currentRollZ;

    const FALL_THRESHOLD_RAD = THREE.MathUtils.degToRad(CONSTANTS.FALL_THRESHOLD_DEG);
    const WARN_THRESHOLD_RAD = THREE.MathUtils.degToRad(CONSTANTS.WARN_THRESHOLD_DEG);
    const SPRAY_THRESHOLD_RAD = THREE.MathUtils.degToRad(CONSTANTS.SPRAY_THRESHOLD_DEG);

    if (state.shipCapsizing) {
      updateCapsizeAnimation(dt);
      if (state.capsizeProgress >= 1.35 && !state.isGameOver) {
        triggerGameOver('CAPSIZE');
      }
    } else if (!state.crewFalling) {
      const absRoll = Math.abs(currentRollZ);

      if (state.isPlaying && absRoll >= SPRAY_THRESHOLD_RAD) {
        const splashSide = currentRollZ >= 0 ? 1 : -1;
        const intensity = THREE.MathUtils.clamp(
          (absRoll - SPRAY_THRESHOLD_RAD) / (FALL_THRESHOLD_RAD - SPRAY_THRESHOLD_RAD),
          0.2,
          1.0
        );
        spawnTiltSpray(splashSide, intensity);
      }

      if (state.isPlaying && absRoll >= FALL_THRESHOLD_RAD) {
        state.shipCapsizing = true;
        state.capsizeDir = currentRollZ >= 0 ? 1 : -1;
        state.capsizeProgress = 0;
        state.isPlaying = false;
        activeNetCrew = null;
        isShipDragging = false;
        netAimLine.visible = false;
        netTargetMarker.visible = false;
      } else if (state.crewEnabled) {
        const isDangerTilt = state.isPlaying && absRoll >= WARN_THRESHOLD_RAD;
        updateCrewStability(dt, elapsed, currentRollZ, tiltDelta, activeNetCrew, isDangerTilt);
      }
    } else {
      state.crewFallVelocity.y -= 14.0 * dt;
      const fallingCrew = state.fallingCrew;
      if (fallingCrew) {
        fallingCrew.group.position.addScaledVector(state.crewFallVelocity, dt);
        fallingCrew.group.rotation.z += (state.crewFallVelocity.x > 0 ? -5.5 : 5.5) * dt;
        fallingCrew.group.rotation.x += 2.5 * dt;

        if (fallingCrew.group.position.y < -1.8 && !state.isGameOver) {
          triggerGameOver('OVERBOARD');
        }
      }
    }

    // 4. 漂流ゴミ更新
    trash.updateTrash(dt, elapsed, (typeId) => {
      state.score++;
      if (typeId && state.collectedByType[typeId] !== undefined) {
        state.collectedByType[typeId]++;
      }
      ui.updateHudRecoveryCounts();
      boxGroup.scale.set(1.14, 1.14, 1.14);
    });

    // 5. パーティクル更新 & レンダリング
    updateTiltParticles(dt);
    renderer.render(scene, camera);
  }

  window.addEventListener('load', () => {
    animate();
  });
})(window.GameApp);