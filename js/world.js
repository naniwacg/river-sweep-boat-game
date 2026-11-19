// ==========================================
// 3Dシーン・水面・道頓堀風護岸＆街並み・橋と橋脚
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  const { state, CONSTANTS } = app;

  const canvas = document.getElementById('game-canvas');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x38bdf8);
  scene.fog = new THREE.FogExp2(0x7dd3fc, 0.011);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 180);
  camera.position.set(0, 7.5, -10.5);
  camera.lookAt(0, 0.5, 10);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ライティング
  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f766e, 0.95);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(12, 22, -8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 70;
  dirLight.shadow.camera.left = -18;
  dirLight.shadow.camera.right = 18;
  dirLight.shadow.camera.top = 35;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);

  // ワールドカーブ計算
  function getCurvedY(z) {
    const dist = Math.max(0, z + 5);
    return -state.curvature * (dist * dist);
  }

  function getCurvedPitch(z) {
    const dist = Math.max(0, z + 5);
    const slope = -2 * state.curvature * dist;
    return -Math.atan(slope);
  }

  // 水面メッシュ
  const waterGeo = new THREE.PlaneGeometry(36, 130, 36, 130);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, 0, 45);
  const waterBasePos = Float32Array.from(waterGeo.attributes.position.array);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.22,
    metalness: 0.25,
    flatShading: true
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // 護岸ライン計算
  let bankScrollOffset = 0;

  function getBankIndentation(sideSign, worldZ) {
    const z = worldZ + bankScrollOffset;
    const period = 34.0;
    const phase = ((z + (sideSign < 0 ? 0 : 17.0)) % period + period) % period;
    if (phase > 8.0 && phase < 18.0) {
      const edge = Math.min((phase - 8.0) / 1.2, (18.0 - phase) / 1.2, 1.0);
      return 0.65 * edge;
    }
    if (phase > 23.0 && phase < 30.0) {
      const edge = Math.min((phase - 23.0) / 1.2, (30.0 - phase) / 1.2, 1.0);
      return -0.45 * edge;
    }
    return 0;
  }

  function getBankLimitAtZ(sideSign, worldZ) {
    const indent = getBankIndentation(sideSign, worldZ);
    return sideSign * (CONSTANTS.BANK_LIMIT_X - indent);
  }

  function updateBankGeometry(bankObj) {
    const { geometry, basePos, sideSign } = bankObj;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = basePos[i * 3];
      const by = basePos[i * 3 + 1];
      const bz = basePos[i * 3 + 2];

      const innerWeight = sideSign < 0
        ? THREE.MathUtils.clamp((bx + 16.8) / 8.0, 0.2, 1.0)
        : THREE.MathUtils.clamp((16.8 - bx) / 8.0, 0.2, 1.0);
      const indent = getBankIndentation(sideSign, bz) * innerWeight;
      const x = bx - sideSign * indent;

      const zDist = Math.max(0, bz + 5);
      const yOffset = -state.curvature * (zDist * zDist);
      pos.setXYZ(i, x, by + yOffset, bz);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  function createBank(sideX) {
    const sideSign = Math.sign(sideX);
    const bankGeo = new THREE.BoxGeometry(10, 2.3, 130, 8, 2, 160);
    bankGeo.translate(sideX, 0.75, 45);
    const basePos = Float32Array.from(bankGeo.attributes.position.array);
    const bankMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.78,
      metalness: 0.08,
      flatShading: true
    });
    const mesh = new THREE.Mesh(bankGeo, bankMat);
    mesh.receiveShadow = true;
    scene.add(mesh);

    const bankObj = { mesh, geometry: bankGeo, basePos, sideSign };
    updateBankGeometry(bankObj);
    return bankObj;
  }

  const leftBankObj = createBank(-11.8);
  const rightBankObj = createBank(11.8);

  // 道頓堀イメージの街並みオブジェクト
  const urbanProps = [];
  const fencePostGeo = new THREE.BoxGeometry(0.12, 0.95, 0.12);
  const fenceRailGeo = new THREE.BoxGeometry(0.08, 0.08, 5.2);
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 });

  const lampPoleGeo = new THREE.CylinderGeometry(0.07, 0.1, 2.6, 8);
  const lampGlobeGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9
  });

  const buildingPalette = [0x334155, 0x475569, 0x1e293b, 0x64748b, 0x3f3f46];
  const neonColors = [0xef4444, 0x38bdf8, 0xfacc15, 0xf43f5e, 0x10b981, 0xf97316];

  for (let i = 0; i < 24; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const propGroup = new THREE.Group();

    const post = new THREE.Mesh(fencePostGeo, fenceMat);
    post.position.set(0, 0.45, 0);
    const topRail = new THREE.Mesh(fenceRailGeo, fenceMat);
    topRail.position.set(0, 0.85, 0);
    const midRail = new THREE.Mesh(fenceRailGeo, fenceMat);
    midRail.position.set(0, 0.48, 0);
    propGroup.add(post, topRail, midRail);

    if (i % 2 === 0) {
      const pole = new THREE.Mesh(lampPoleGeo, fenceMat);
      pole.position.set(side * 0.45, 1.3, 0.6);
      const globe = new THREE.Mesh(lampGlobeGeo, lampMat);
      globe.position.set(side * 0.45, 2.65, 0.6);
      propGroup.add(pole, globe);
    }

    const bWidth = 3.6 + (i % 3) * 0.8;
    const bHeight = 5.5 + ((i * 7) % 5) * 1.4;
    const bDepth = 4.6;
    const bMat = new THREE.MeshStandardMaterial({
      color: buildingPalette[i % buildingPalette.length],
      roughness: 0.65
    });
    const building = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), bMat);
    building.position.set(side * (2.6 + bWidth * 0.5), bHeight * 0.5 - 0.1, 0);
    building.castShadow = true;
    building.receiveShadow = true;
    propGroup.add(building);

    const winColor = i % 3 === 0 ? 0xfef08a : 0xbae6fd;
    const winMat = new THREE.MeshStandardMaterial({
      color: winColor,
      emissive: winColor,
      emissiveIntensity: 0.45
    });
    const winPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, bHeight * 0.65, bDepth * 0.72), winMat);
    winPanel.position.set(side * 2.58, bHeight * 0.52, 0);
    propGroup.add(winPanel);

    const signColor1 = neonColors[i % neonColors.length];
    const signMat1 = new THREE.MeshStandardMaterial({
      color: signColor1,
      emissive: signColor1,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });
    const mainSign = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.8 + (i % 2) * 0.8, 3.0), signMat1);
    mainSign.position.set(side * 2.45, 2.4 + (i % 3) * 0.7, 0);
    propGroup.add(mainSign);

    const signColor2 = neonColors[(i + 2) % neonColors.length];
    const signMat2 = new THREE.MeshStandardMaterial({
      color: signColor2,
      emissive: signColor2,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });
    const subSign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), signMat2);
    subSign.position.set(side * 2.35, bHeight + 0.45, i % 2 === 0 ? 1.1 : -1.1);
    propGroup.add(subSign);

    const z = -10 + i * 5.2;
    const x = getBankLimitAtZ(side, z) + side * 0.35;
    propGroup.userData = { side };
    propGroup.position.set(x, 1.85 + getCurvedY(z), z);
    propGroup.rotation.x = getCurvedPitch(z);
    scene.add(propGroup);
    urbanProps.push(propGroup);
  }

  // 道頓堀の橋 ＆ 水中橋脚
  const bridges = [];
  const bridgeDeckMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
  const bridgeRailMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.5 });
  const pierConcreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  const pierBumperMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const pierStripeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const bridgeLampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.95
  });

  function createBridge(initialZ, pierPattern) {
    const group = new THREE.Group();
    const deckHeight = 4.35;
    const bridgeWidth = 17.5;
    const bridgeDepth = 3.2;

    const deckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeWidth, 0.55, bridgeDepth),
      bridgeDeckMat
    );
    deckMesh.position.set(0, deckHeight, 0);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    [-1, 1].forEach((zSign) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeWidth, 0.72, 0.14),
        bridgeRailMat
      );
      rail.position.set(0, deckHeight + 0.62, zSign * (bridgeDepth * 0.46));
      group.add(rail);

      [-4.2, 0, 4.2].forEach((lx) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), bridgeRailMat);
        post.position.set(lx, deckHeight + 1.1, zSign * (bridgeDepth * 0.46));
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bridgeLampMat);
        globe.position.set(lx, deckHeight + 1.62, zSign * (bridgeDepth * 0.46));
        group.add(post, globe);
      });
    });

    const pierXs = pierPattern === 'CENTER' ? [0] : [-2.35, 2.35];
    const piers = [];

    pierXs.forEach((px) => {
      const pierGroup = new THREE.Group();
      pierGroup.position.set(px, 0, 0);

      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.55, deckHeight + 0.6, 14),
        pierConcreteMat
      );
      col.position.y = (deckHeight - 0.3) * 0.5;
      col.castShadow = true;
      col.receiveShadow = true;
      pierGroup.add(col);

      const bumper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.85, 16),
        pierBumperMat
      );
      bumper.position.y = 0.42;
      pierGroup.add(bumper);

      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.635, 0.635, 0.24, 16),
        pierStripeMat
      );
      stripe.position.y = 0.42;
      pierGroup.add(stripe);

      group.add(pierGroup);
      piers.push({ x: px, radius: 0.64 });
    });

    group.position.set(0, getCurvedY(initialZ), initialZ);
    group.rotation.x = getCurvedPitch(initialZ);
    scene.add(group);

    return { group, piers, pierPattern };
  }

  bridges.push(createBridge(38, 'DOUBLE'));
  bridges.push(createBridge(100, 'CENTER'));

  function updateWorld(dt, elapsed) {
    const wPos = waterGeo.attributes.position;
    const speedRatio = state.riverSpeed / 14.0;
    for (let i = 0; i < wPos.count; i++) {
      const bx = waterBasePos[i * 3];
      const bz = waterBasePos[i * 3 + 2];
      const wave = Math.sin(bx * 0.7 + elapsed * 3.0) * 0.08 + Math.cos(bz * 0.4 - elapsed * 6.0 * speedRatio) * 0.1;
      wPos.setY(i, wave + getCurvedY(bz));
    }
    wPos.needsUpdate = true;

    bankScrollOffset += state.riverSpeed * dt;
    updateBankGeometry(leftBankObj);
    updateBankGeometry(rightBankObj);

    urbanProps.forEach((prop) => {
      prop.position.z -= state.riverSpeed * dt;
      if (prop.position.z < -12) {
        prop.position.z += 124;
      }
      const { side } = prop.userData;
      prop.position.x = getBankLimitAtZ(side, prop.position.z) + side * 0.35;
      prop.position.y = 1.85 + getCurvedY(prop.position.z);
      prop.rotation.x = getCurvedPitch(prop.position.z);
    });

    bridges.forEach((b) => {
      b.group.position.z -= state.riverSpeed * dt;
      if (b.group.position.z < -16) {
        b.group.position.z += 124;
      }
      b.group.position.y = getCurvedY(b.group.position.z);
      b.group.rotation.x = getCurvedPitch(b.group.position.z);
    });
  }

  function resetBridges() {
    bridges.forEach((b, idx) => {
      const startZ = idx === 0 ? 38 : 100;
      b.group.position.set(0, getCurvedY(startZ), startZ);
      b.group.rotation.x = getCurvedPitch(startZ);
    });
  }

  app.world = {
    canvas,
    scene,
    camera,
    renderer,
    bridges,
    getCurvedY,
    getCurvedPitch,
    getBankLimitAtZ,
    updateWorld,
    resetBridges
  };
})(window.GameApp);