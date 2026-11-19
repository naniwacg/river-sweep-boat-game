// ==========================================
// 漂流ゴミの生成・物理挙動・網キャッチ・コンベア搬送
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, TRASH_VARIANTS, CONSTANTS, world, ship } = app;
  const { scene, bridges, getCurvedY, getBankLimitAtZ } = world;
  const { shipParent, boxGroup } = ship;

  const trashList = [];
  const trashMeshes = [];
  let spawnTimer = 0;

  function spawnTrash() {
    const variant = TRASH_VARIANTS[Math.floor(Math.random() * TRASH_VARIANTS.length)];
    const mat = new THREE.MeshStandardMaterial({ color: variant.color, roughness: 0.35 });
    const mesh = new THREE.Mesh(variant.geo, mat);
    mesh.castShadow = true;

    const spawnX = (Math.random() - 0.5) * 10.2;
    const spawnZ = 58 + Math.random() * 10;
    const scale = 0.85 + Math.random() * 0.45;
    mesh.scale.set(scale, scale, scale);
    mesh.rotation.set(
      THREE.MathUtils.degToRad((Math.random() - 0.5) * 60),
      Math.random() * Math.PI * 2,
      THREE.MathUtils.degToRad((Math.random() - 0.5) * 60)
    );
    mesh.position.set(spawnX, getCurvedY(spawnZ), spawnZ);

    scene.add(mesh);

    const item = {
      mesh,
      typeId: variant.id,
      state: 'NORMAL',
      vx: 0,
      phase: Math.random() * 100,
      progress: 0,
      startPos: new THREE.Vector3(),
      initialScale: scale
    };
    mesh.userData.trashItem = item;
    trashList.push(item);
    trashMeshes.push(mesh);
  }

  function removeTrashAt(index) {
    const item = trashList[index];
    scene.remove(item.mesh);
    const meshIdx = trashMeshes.indexOf(item.mesh);
    if (meshIdx !== -1) trashMeshes.splice(meshIdx, 1);
    trashList.splice(index, 1);
  }

  function populateInitialTrash() {
    trashList.forEach((t) => scene.remove(t.mesh));
    trashList.length = 0;
    trashMeshes.length = 0;
    spawnTimer = 0;

    for (let i = 0; i < 12; i++) {
      spawnTrash();
      const t = trashList[trashList.length - 1];
      t.mesh.position.z = 8 + i * 3.8;
      t.mesh.position.y = getCurvedY(t.mesh.position.z);
    }
  }

  function catchTrashWithCrewNet(crew) {
    const crewWorldPos = new THREE.Vector3();
    crew.group.getWorldPosition(crewWorldPos);
    const maxAngleRad = THREE.MathUtils.degToRad(45);
    const catchRadius = 1.45;
    let caughtCount = 0;

    trashList.forEach((item) => {
      if (item.state !== 'NORMAL') return;
      const outwardDx = (item.mesh.position.x - crewWorldPos.x) * crew.sideSign;
      const dz = item.mesh.position.z - crewWorldPos.z;
      if (outwardDx <= 0.3) return;
      const itemAngle = Math.atan2(dz, outwardDx);
      if (Math.abs(itemAngle) > maxAngleRad + THREE.MathUtils.degToRad(8)) return;

      const dist = Math.hypot(
        item.mesh.position.x - crew.targetWorldPos.x,
        item.mesh.position.z - crew.targetWorldPos.z
      );
      if (dist <= catchRadius) {
        item.state = 'PULLING';
        item.progress = 0;
        item.startPos.copy(item.mesh.position);
        caughtCount++;
      }
    });

    return caughtCount;
  }

  function updateTrash(dt, elapsed, onTrashCollected) {
    if (state.isPlaying) {
      spawnTimer -= dt * (state.riverSpeed / CONSTANTS.DEFAULT_RIVER_SPEED);
      if (spawnTimer <= 0) {
        spawnTrash();
        spawnTimer = 0.85 + Math.random() * 0.65;
      }
    }

    const bowWorldPos = new THREE.Vector3(0, 0.6, 2.8).applyMatrix4(shipParent.matrixWorld);
    const boxWorldPos = new THREE.Vector3(0, 1.2, -1.55).applyMatrix4(shipParent.matrixWorld);

    for (let i = trashList.length - 1; i >= 0; i--) {
      const item = trashList[i];
      const m = item.mesh;

      if (item.state === 'NORMAL') {
        m.position.z -= state.riverSpeed * dt;
        m.position.x += item.vx * dt;
        item.vx *= Math.pow(0.1, dt);

        // 護岸バウンド
        const trashLeftLimit = getBankLimitAtZ(-1, m.position.z) - 0.15;
        const trashRightLimit = getBankLimitAtZ(1, m.position.z) + 0.15;
        if (m.position.x < trashLeftLimit) {
          m.position.x = trashLeftLimit;
          item.vx = Math.abs(item.vx) * 0.6 + 1.2;
        } else if (m.position.x > trashRightLimit) {
          m.position.x = trashRightLimit;
          item.vx = -Math.abs(item.vx) * 0.6 - 1.2;
        }

        // 橋脚回避
        bridges.forEach((b) => {
          const dzPier = m.position.z - b.group.position.z;
          if (Math.abs(dzPier) < 0.85) {
            b.piers.forEach((pier) => {
              const dxPier = m.position.x - pier.x;
              const avoidDist = pier.radius + 0.35;
              if (Math.abs(dxPier) < avoidDist) {
                const sideDir = dxPier >= 0 ? 1 : -1;
                m.position.x = pier.x + sideDir * avoidDist;
                item.vx += sideDir * 1.4;
              }
            });
          }
        });

        const floatY = Math.sin(elapsed * 2.5 + item.phase) * 0.08;
        m.position.y = getCurvedY(m.position.z) + floatY;
        m.rotation.y += 0.8 * dt;

        const dx = m.position.x - shipParent.position.x;
        const dz = m.position.z - shipParent.position.z;

        // 船首コンベア正面（回収ゾーン）
        if (dz >= 2.2 && dz <= 3.5 && Math.abs(dx) <= 1.15) {
          item.state = 'CONVEYOR';
          item.progress = 0;
          item.startPos.copy(m.position);
        }
        // 船首以外の側面（弾き飛ばし）
        else if (dz > -2.5 && dz < 2.2 && Math.abs(dx) < 1.75) {
          const pushDir = dx >= 0 ? 1 : -1;
          item.vx = pushDir * 9.5;
          m.position.x = shipParent.position.x + pushDir * 1.8;
        }

        if (m.position.z < -13) {
          removeTrashAt(i);
        }
      } else if (item.state === 'PULLING') {
        item.progress += dt * 3.0;
        const t = Math.min(item.progress, 1);
        m.position.lerpVectors(item.startPos, bowWorldPos, t);
        m.position.y += Math.sin(t * Math.PI) * 0.5;

        if (t >= 1) {
          item.state = 'CONVEYOR';
          item.progress = 0;
          item.startPos.copy(m.position);
        }
      } else if (item.state === 'CONVEYOR') {
        item.progress += dt * 2.1;
        const t = Math.min(item.progress, 1);
        m.position.lerpVectors(item.startPos, boxWorldPos, t);
        m.position.y += Math.sin(t * Math.PI) * 0.45;

        const s = item.initialScale * (1 - t * 0.65);
        m.scale.set(s, s, s);

        if (t >= 1) {
          if (state.isPlaying && typeof onTrashCollected === 'function') {
            onTrashCollected(item.typeId);
          }
          removeTrashAt(i);
        }
      }
    }

    boxGroup.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 12);
  }

  populateInitialTrash();

  app.trash = {
    trashList,
    trashMeshes,
    populateInitialTrash,
    catchTrashWithCrewNet,
    updateTrash
  };
})(window.GameApp);