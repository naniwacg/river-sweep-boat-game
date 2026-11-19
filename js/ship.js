// ==========================================
// 清掃船3Dモデル・船員＆タモ網・水しぶきパーティクル
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, CONSTANTS, world } = app;
  const { scene, camera, getCurvedY } = world;

  const shipParent = new THREE.Group();
  scene.add(shipParent);

  const shipVisual = new THREE.Group();
  shipParent.add(shipVisual);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6 });

  // 双胴船（カタマラン）左右フロート
  const pontoonGeo = new THREE.BoxGeometry(0.65, 0.85, 5.2);
  const pontoonL = new THREE.Mesh(pontoonGeo, hullMat);
  pontoonL.position.set(-1.15, 0.25, 0);
  pontoonL.castShadow = true;

  const pontoonR = pontoonL.clone();
  pontoonR.position.set(1.15, 0.25, 0);
  shipVisual.add(pontoonL, pontoonR);

  // 船首先端コーン
  const noseGeo = new THREE.ConeGeometry(0.46, 1.2, 4);
  const noseL = new THREE.Mesh(noseGeo, orangeMat);
  noseL.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  noseL.position.set(-1.15, 0.25, 3.1);
  const noseR = noseL.clone();
  noseR.position.set(1.15, 0.25, 3.1);
  shipVisual.add(noseL, noseR);

  // 甲板デッキ
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 4.0), deckMat);
  deck.position.set(0, 0.6, -0.4);
  deck.castShadow = true;
  deck.receiveShadow = true;
  shipVisual.add(deck);

  // 船首コンベア
  const conveyorGroup = new THREE.Group();
  conveyorGroup.position.set(0, 0.55, 1.8);
  conveyorGroup.rotation.x = Math.PI / 7;
  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.18, 2.7),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
  );
  const railGeo = new THREE.BoxGeometry(0.12, 0.38, 2.7);
  const railL = new THREE.Mesh(railGeo, orangeMat);
  railL.position.set(-0.75, 0.15, 0);
  const railR = railL.clone();
  railR.position.set(0.75, 0.15, 0);
  conveyorGroup.add(beltMesh, railL, railR);
  shipVisual.add(conveyorGroup);

  // 船尾側のゴミ回収ボックス
  const boxGroup = new THREE.Group();
  boxGroup.position.set(0, 1.0, -1.55);
  const boxBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.75, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 })
  );
  boxBase.castShadow = true;
  boxBase.receiveShadow = true;
  boxGroup.add(boxBase);
  shipVisual.add(boxGroup);

  // 船体のタッチ判定用ヒットボックス
  const shipHitBox = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.4, 6.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  shipHitBox.position.set(0, 0.8, 0.3);
  shipVisual.add(shipHitBox);

  // 船員生成
  function createCrewMember(sideSign) {
    const group = new THREE.Group();
    const homePos = new THREE.Vector3(sideSign * 0.95, 0.72, -0.35);
    group.position.copy(homePos);
    shipVisual.add(group);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: sideSign > 0 ? 0x0284c7 : 0x0d9488 })
    );
    body.position.y = 0.35;
    body.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfde68a })
    );
    head.position.y = 0.82;

    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.21, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    hat.position.y = 0.96;

    const alertIcon = new THREE.Group();
    alertIcon.position.set(0, 1.32, 0);
    alertIcon.visible = false;

    const alertBg = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );

    const angerShapeGroup = new THREE.Group();
    angerShapeGroup.position.z = 0.01;
    const angerMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.28), angerMat);
    const hBar = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.055), angerMat);
    angerShapeGroup.add(vBar, hBar);
    angerShapeGroup.rotation.z = THREE.MathUtils.degToRad(12);
    alertIcon.add(alertBg, angerShapeGroup);

    const initialYaw = sideSign * CONSTANTS.INITIAL_NET_YAW_ABS;
    const netPivot = new THREE.Group();
    netPivot.position.set(sideSign * 0.22, 0.55, 0.1);
    netPivot.rotation.y = initialYaw;

    const poleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    poleMesh.rotation.x = Math.PI / 3;
    poleMesh.position.set(0, 0.1, 0.55);

    const netRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.03, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc })
    );
    netRing.rotation.x = Math.PI / 2;
    netRing.position.set(0, 0.42, 1.15);

    const netHitArea = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    netHitArea.position.set(0, 0.35, 0.95);

    netPivot.add(poleMesh, netRing, netHitArea);
    group.add(body, head, hat, netPivot, alertIcon);

    return {
      sideSign,
      homePos,
      group,
      alertIcon,
      netPivot,
      poleMesh,
      netRing,
      netHitArea,
      initialYaw,
      swingTimer: 0,
      targetWorldPos: new THREE.Vector3(),
      isDeployed: false,
      fallVel: new THREE.Vector3(),
      hasSplashed: false
    };
  }

  const crewMembers = [
    createCrewMember(1),
    createCrewMember(-1)
  ];

  // スワイプ軌跡・網投げガイドライン
  const netAimLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)
  ]);
  const netAimLineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 3 });
  const netAimLine = new THREE.Line(netAimLineGeo, netAimLineMat);
  netAimLine.visible = false;
  scene.add(netAimLine);

  const netTargetMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.65, 24),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide })
  );
  netTargetMarker.rotation.x = -Math.PI / 2;
  netTargetMarker.visible = false;
  scene.add(netTargetMarker);

  // 水しぶきパーティクルシステム
  const TILT_PARTICLE_COUNT = CONSTANTS.TILT_PARTICLE_COUNT;
  const tiltParticleGeo = new THREE.BufferGeometry();
  const tiltParticlePos = new Float32Array(TILT_PARTICLE_COUNT * 3);
  const tiltParticleVel = [];
  const tiltParticleLife = new Float32Array(TILT_PARTICLE_COUNT);
  for (let i = 0; i < TILT_PARTICLE_COUNT; i++) {
    tiltParticlePos[i * 3 + 1] = -50;
    tiltParticleVel.push(new THREE.Vector3());
  }
  tiltParticleGeo.setAttribute('position', new THREE.BufferAttribute(tiltParticlePos, 3));
  const tiltParticleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.24,
    transparent: false
  });
  const tiltParticleSystem = new THREE.Points(tiltParticleGeo, tiltParticleMat);
  tiltParticleSystem.frustumCulled = false;
  scene.add(tiltParticleSystem);

  let tiltParticleCursor = 0;

  function spawnTiltSpray(splashSideSign, intensity) {
    const count = intensity > 0.6 ? 12 : 6;
    shipParent.updateMatrixWorld(true);
    for (let n = 0; n < count; n++) {
      const idx = tiltParticleCursor;
      tiltParticleCursor = (tiltParticleCursor + 1) % TILT_PARTICLE_COUNT;

      const localPoint = new THREE.Vector3(
        splashSideSign * (1.42 + (Math.random() - 0.5) * 0.16),
        0.32 + Math.random() * 0.28,
        (Math.random() - 0.35) * 4.4
      );
      localPoint.applyMatrix4(shipVisual.matrixWorld);

      tiltParticlePos[idx * 3] = localPoint.x;
      tiltParticlePos[idx * 3 + 1] = localPoint.y;
      tiltParticlePos[idx * 3 + 2] = localPoint.z;

      tiltParticleVel[idx].set(
        splashSideSign * (1.6 + Math.random() * 2.5),
        2.0 + Math.random() * 2.5 * intensity,
        -state.riverSpeed * 0.3 + (Math.random() - 0.5) * 1.8
      );
      tiltParticleLife[idx] = 0.5 + Math.random() * 0.3;
    }
    tiltParticleGeo.attributes.position.needsUpdate = true;
  }

  // 船員落水地点の水しぶき
  function spawnSplashAtWorldPos(worldPos) {
    for (let n = 0; n < 24; n++) {
      const idx = tiltParticleCursor;
      tiltParticleCursor = (tiltParticleCursor + 1) % TILT_PARTICLE_COUNT;

      tiltParticlePos[idx * 3] = worldPos.x + (Math.random() - 0.5) * 0.5;
      tiltParticlePos[idx * 3 + 1] = worldPos.y + 0.15;
      tiltParticlePos[idx * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.5;

      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3.0;
      tiltParticleVel[idx].set(
        Math.cos(angle) * spd,
        2.8 + Math.random() * 2.8,
        Math.sin(angle) * spd
      );
      tiltParticleLife[idx] = 0.65 + Math.random() * 0.35;
    }
    tiltParticleGeo.attributes.position.needsUpdate = true;
  }

  function updateTiltParticles(dt) {
    for (let i = 0; i < TILT_PARTICLE_COUNT; i++) {
      if (tiltParticleLife[i] > 0) {
        tiltParticleLife[i] -= dt;
        tiltParticlePos[i * 3] += tiltParticleVel[i].x * dt;
        tiltParticlePos[i * 3 + 1] += tiltParticleVel[i].y * dt;
        tiltParticlePos[i * 3 + 2] += tiltParticleVel[i].z * dt;
        tiltParticleVel[i].y -= 7.5 * dt;

        if (tiltParticleLife[i] <= 0 || tiltParticlePos[i * 3 + 1] < -0.3) {
          tiltParticleLife[i] = 0;
          tiltParticlePos[i * 3 + 1] = -50;
        }
      }
    }
    tiltParticleGeo.attributes.position.needsUpdate = true;
  }

  function resetTiltParticles() {
    for (let i = 0; i < TILT_PARTICLE_COUNT; i++) {
      tiltParticlePos[i * 3 + 1] = -50;
      tiltParticleLife[i] = 0;
    }
    tiltParticleGeo.attributes.position.needsUpdate = true;
  }

  function updateCrewNetAim(crew, intersectPt) {
    if (!crew) return;
    const crewWorldPos = new THREE.Vector3();
    crew.group.getWorldPosition(crewWorldPos);

    const offset = intersectPt.clone().sub(crewWorldPos);
    offset.y = 0;

    const outwardDist = Math.max(offset.x * crew.sideSign, 0.001);
    const maxAngleRad = THREE.MathUtils.degToRad(45);
    const rawAngle = Math.atan2(offset.z, outwardDist);
    const clampedAngle = THREE.MathUtils.clamp(rawAngle, -maxAngleRad, maxAngleRad);
    const fixedReach = 1.65;

    offset.x = crew.sideSign * Math.cos(clampedAngle) * fixedReach;
    offset.z = Math.sin(clampedAngle) * fixedReach;

    crew.targetWorldPos.copy(crewWorldPos).add(offset);
    crew.targetWorldPos.y = getCurvedY(crew.targetWorldPos.z) + 0.08;

    netTargetMarker.position.copy(crew.targetWorldPos);
    netTargetMarker.visible = true;

    const startPt = crewWorldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
    netAimLineGeo.setFromPoints([startPt, crew.targetWorldPos]);
    netAimLine.visible = true;

    crew.netPivot.lookAt(crew.targetWorldPos);
    crew.netPivot.scale.set(1, 1, 1);
  }

  // 40度到達時の船員振り落とし開始
  function triggerCrewFallOut(rollZ) {
    if (!state.crewEnabled) return false;
    const deployedCrews = crewMembers.filter((c) => c.isDeployed);
    if (deployedCrews.length === 0) return false;

    // 沈み込んでいる側（rollZ > 0 なら -X 側、rollZ < 0 なら +X 側）の船員を優先的に振り落とす
    const lowSideSign = rollZ > 0 ? -1 : 1;
    let targetCrew = deployedCrews.find((c) => c.sideSign === lowSideSign) || deployedCrews[0];

    shipParent.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    targetCrew.group.getWorldPosition(worldPos);
    targetCrew.group.getWorldQuaternion(worldQuat);

    scene.add(targetCrew.group);
    targetCrew.group.position.copy(worldPos);
    targetCrew.group.quaternion.copy(worldQuat);
    targetCrew.alertIcon.visible = true;
    targetCrew.hasSplashed = false;
    targetCrew.fallVel.set(lowSideSign * 3.4, 3.2, -0.4);

    state.fallingCrew = targetCrew;
    return true;
  }

  // 船員落水中の落下・水面浮上・救助復帰アニメーション
  function updateCrewFallOut(dt, elapsed) {
    const crew = state.fallingCrew;
    if (!crew) return;

    const waterY = typeof getCurvedY === 'function' ? getCurvedY(crew.group.position.z) : 0;

    if (state.crewFallTimer < 1.35) {
      // 落下＆着水後のバタつき
      if (!crew.hasSplashed) {
        crew.fallVel.y -= 13.5 * dt;
        crew.group.position.addScaledVector(crew.fallVel, dt);
        crew.group.rotation.z += crew.fallVel.x * 2.2 * dt;

        if (crew.group.position.y <= waterY - 0.15) {
          crew.group.position.y = waterY - 0.15;
          crew.hasSplashed = true;
          spawnSplashAtWorldPos(crew.group.position);
        }
      } else {
        // 水面で浮き沈みしながら救助待ち
        crew.group.position.y = waterY - 0.15 + Math.sin(elapsed * 12) * 0.08;
        crew.group.rotation.z = Math.sin(elapsed * 10) * 0.35;
        if (Math.random() < 0.35) {
          spawnSplashAtWorldPos(crew.group.position);
        }
      }
    } else {
      // 救助引き上げ（船の定位置へ戻る）
      shipParent.updateMatrixWorld(true);
      const targetWorld = crew.homePos.clone().applyMatrix4(shipVisual.matrixWorld);
      crew.group.position.lerp(targetWorld, Math.min(1, dt * 6.5));
      crew.group.rotation.x = THREE.MathUtils.lerp(crew.group.rotation.x, 0, dt * 8);
      crew.group.rotation.y = THREE.MathUtils.lerp(crew.group.rotation.y, 0, dt * 8);
      crew.group.rotation.z = THREE.MathUtils.lerp(crew.group.rotation.z, 0, dt * 8);
    }

    if (crew.alertIcon) {
      crew.alertIcon.visible = true;
      crew.alertIcon.lookAt(camera.position);
    }
  }

  // 落水した船員を甲板へ完全に復帰させる
  function restoreFallenCrew() {
    const crew = state.fallingCrew;
    if (crew) {
      if (crew.group.parent !== shipVisual) {
        shipVisual.add(crew.group);
      }
      crew.group.position.copy(crew.homePos);
      crew.group.rotation.set(0, 0, 0);
      crew.alertIcon.visible = false;
      crew.hasSplashed = false;
    }
    state.fallingCrew = null;
  }

  function updateCapsizeAnimation(dt) {
    state.capsizeProgress += dt;
    const targetCapsizeRoll = state.capsizeDir * Math.PI;
    shipVisual.rotation.z = THREE.MathUtils.lerp(shipVisual.rotation.z, targetCapsizeRoll, dt * 4.8);
    shipVisual.position.y = THREE.MathUtils.lerp(shipVisual.position.y, -0.45, dt * 2.5);
    shipVisual.rotation.x = THREE.MathUtils.lerp(shipVisual.rotation.x, 0.14, dt * 3.0);

    if (state.capsizeProgress < 0.75) {
      spawnTiltSpray(state.capsizeDir, 1.0);
      spawnTiltSpray(-state.capsizeDir, 0.8);
    }

    if (state.crewEnabled) {
      crewMembers.forEach((crew, idx) => {
        if (!crew.isDeployed) return;
        if (crew.group.parent === shipVisual) {
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          crew.group.getWorldPosition(worldPos);
          crew.group.getWorldQuaternion(worldQuat);
          scene.add(crew.group);
          crew.group.position.copy(worldPos);
          crew.group.quaternion.copy(worldQuat);
          crew.alertIcon.visible = true;
          crew.userData = {
            fallVel: new THREE.Vector3(state.capsizeDir * (3.2 + idx * 1.4), 3.6, -2.0)
          };
        }
        if (crew.userData && crew.userData.fallVel) {
          crew.userData.fallVel.y -= 14.0 * dt;
          crew.group.position.addScaledVector(crew.userData.fallVel, dt);
          crew.group.rotation.z += (state.capsizeDir > 0 ? -6.0 : 6.0) * dt;
          crew.group.rotation.x += 3.0 * dt;
        }
      });
    }
  }

  function updateCrewStability(dt, elapsed, currentRollZ, tiltDelta, activeNetCrew, isDangerTilt) {
    const counterLeanZ = -currentRollZ * 0.65;

    crewMembers.forEach((crew, idx) => {
      if (!crew.isDeployed) return;
      if (state.fallingCrew === crew) return;

      crew.alertIcon.visible = isDangerTilt;
      if (isDangerTilt) {
        crew.alertIcon.lookAt(camera.position);
        const pulse = 1.0 + Math.sin(elapsed * 28 + idx) * 0.14;
        crew.alertIcon.scale.set(pulse, pulse, pulse);
        crew.alertIcon.position.set(Math.sin(elapsed * 45 + idx) * 0.03, 1.32, 0);
      } else {
        crew.alertIcon.position.set(0, 1.32, 0);
      }

      const wobble = Math.sin(elapsed * 4.5 + idx * 1.4) * 0.08;
      const targetCrewZ = THREE.MathUtils.clamp(counterLeanZ + wobble - tiltDelta * 1.2, -0.35, 0.35);
      crew.group.rotation.z = THREE.MathUtils.lerp(crew.group.rotation.z, targetCrewZ, dt * 8);

      if (activeNetCrew !== crew) {
        if (crew.swingTimer > 0) {
          crew.swingTimer -= dt;
          crew.netPivot.rotation.x = Math.sin((1 - crew.swingTimer / 0.45) * Math.PI) * 0.9;
        } else {
          crew.netPivot.rotation.x = THREE.MathUtils.lerp(crew.netPivot.rotation.x, 0, dt * 10);
          crew.netPivot.rotation.y = THREE.MathUtils.lerp(crew.netPivot.rotation.y, crew.initialYaw, dt * 10);
          crew.netPivot.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
        }
      }
    });
  }

  function resetShipAndCrew() {
    hullMat.emissive.setHex(0x000000);
    orangeMat.emissive.setHex(0x000000);
    state.fallingCrew = null;
    state.crewFalling = false;
    state.crewFallTimer = 0;

    crewMembers.forEach((crew, idx) => {
      if (crew.group.parent !== shipVisual) {
        shipVisual.add(crew.group);
      }
      const isActiveCrew = state.crewEnabled && idx < state.crewCount;
      crew.isDeployed = isActiveCrew;
      crew.group.visible = isActiveCrew;
      crew.group.position.copy(crew.homePos);
      crew.group.rotation.set(0, 0, 0);
      crew.netPivot.rotation.set(0, crew.initialYaw, 0);
      crew.netPivot.scale.set(1, 1, 1);
      crew.swingTimer = 0;
      crew.hasSplashed = false;
      crew.alertIcon.visible = false;
    });

    netAimLine.visible = false;
    netTargetMarker.visible = false;
    resetTiltParticles();

    shipParent.position.set(0, 0, 0);
    shipVisual.rotation.set(0, 0, 0);
    boxGroup.scale.set(1, 1, 1);
  }

  app.ship = {
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
    triggerCrewFallOut,
    updateCrewFallOut,
    restoreFallenCrew,
    updateCapsizeAnimation,
    updateCrewStability,
    resetShipAndCrew
  };
})(window.GameApp);