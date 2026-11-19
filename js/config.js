// ==========================================
// ゲーム定数・ゴミ種別定義・グローバル状態管理
// ==========================================
window.GameApp = window.GameApp || {};

(function (app) {
  app.CONSTANTS = {
    DEFAULT_RIVER_SPEED: 4.5,
    GAME_DURATION: 60,
    BANK_LIMIT_X: 6.2,
    INITIAL_NET_YAW_ABS: Math.PI / 4,
    TILT_PARTICLE_COUNT: 240,
    FALL_THRESHOLD_DEG: 50.0,       // 50度超で船が転覆（ゲームオーバー）
    CREW_FALL_THRESHOLD_DEG: 40.0,  // 40度到達で船員が落水＆船が一時停止
    WARN_THRESHOLD_DEG: 30.0,       // 30度以上で危険警告アイコン表示
    SPRAY_THRESHOLD_DEG: 12.0
  };

  app.TRASH_VARIANTS = [
    {
      id: 'bottle',
      icon: '🧴',
      label: 'ペットボトル',
      shortLabel: 'ペットボトル',
      dotColor: 'bg-sky-400',
      geo: new THREE.CylinderGeometry(0.18, 0.18, 0.55, 10),
      color: 0x38bdf8
    },
    {
      id: 'foam',
      icon: '🧊',
      label: '発泡スチロール',
      shortLabel: '発泡スチロール',
      dotColor: 'bg-red-500',
      geo: new THREE.BoxGeometry(0.55, 0.4, 0.55),
      color: 0xef4444
    },
    {
      id: 'can',
      icon: '🥫',
      label: '空き缶',
      shortLabel: '空き缶',
      dotColor: 'bg-slate-200',
      geo: new THREE.CylinderGeometry(0.22, 0.22, 0.35, 10),
      color: 0xe2e8f0
    },
    {
      id: 'plastic',
      icon: '🛍️',
      label: '漂流プラごみ',
      shortLabel: 'プラごみ',
      dotColor: 'bg-amber-400',
      geo: new THREE.DodecahedronGeometry(0.32, 0),
      color: 0xfbbf24
    }
  ];

  app.state = {
    isPlaying: false,
    isGameOver: false,
    dayCount: 1,
    score: 0,
    missionTarget: 15,
    missionTypeTargets: { bottle: 0, foam: 0, can: 0, plastic: 0 },
    collectedByType: { bottle: 0, foam: 0, can: 0, plastic: 0 },
    timeLeft: app.CONSTANTS.GAME_DURATION,
    riverSpeed: app.CONSTANTS.DEFAULT_RIVER_SPEED,
    savedRiverSpeed: app.CONSTANTS.DEFAULT_RIVER_SPEED,
    curvature: 0.0022,
    crewCount: 0,
    crewEnabled: false,
    crewCostPerPerson: 5000,
    crewFalling: false,
    crewFallTimer: 0,
    fallingCrew: null,
    crewFallVelocity: new THREE.Vector3(),
    shipCapsizing: false,
    capsizeDir: 1,
    capsizeProgress: 0,
    shipMaxHp: 100,
    shipHp: 100,
    bankDamageCooldown: 0,
    pierDamageCooldown: 0,
    damageFlashTimer: 0
  };
})(window.GameApp);