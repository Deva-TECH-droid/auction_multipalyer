import * as THREE from "three";

// Color palettes for IPL franchises
export const TEAM_PALETTES = {
  csk:  { primary: 0xFDB913, secondary: 0x002B49, accent: 0xFFFFFF, glow: "#FDB913" },
  mi:   { primary: 0x004BA0, secondary: 0xD4AF37, accent: 0xFFFFFF, glow: "#0078FF" },
  rcb:  { primary: 0xEC1C24, secondary: 0x1A1A1A, accent: 0xE6A100, glow: "#EC1C24" },
  kkr:  { primary: 0x3A225D, secondary: 0xF3CA3E, accent: 0xFFFFFF, glow: "#9B51E0" },
  gt:   { primary: 0x1B2133, secondary: 0xCBA92B, accent: 0x4879B5, glow: "#CBA92B" },
  lsg:  { primary: 0x2474BA, secondary: 0xE55B13, accent: 0xA0CEF8, glow: "#A0CEF8" },
  rr:   { primary: 0xEA1A85, secondary: 0x254AA5, accent: 0xFFFFFF, glow: "#EA1A85" },
  srh:  { primary: 0xF76E1A, secondary: 0x111111, accent: 0xFFFFFF, glow: "#F76E1A" },
  dc:   { primary: 0x0078BC, secondary: 0xD71920, accent: 0xFFFFFF, glow: "#0078BC" },
  pbks: { primary: 0xDD1F2D, secondary: 0xD4AF37, accent: 0xFFFFFF, glow: "#DD1F2D" },
};

// Skin tones
const SKIN_TONES = [0xD29B71, 0xC58C5A, 0x8D5524, 0xBF8257, 0x9B6338];

function getPlayerSkin(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return SKIN_TONES[Math.abs(hash) % SKIN_TONES.length];
}

/**
 * Creates a stylized 3D cricket player dummy character in Three.js
 */
export function createCricketPlayer({
  name = "Player",
  role = "All-Rounder",
  teamId = "kkr",
  position = "center", // 'left' | 'right' | 'center'
}) {
  const teamPalette = TEAM_PALETTES[teamId] || TEAM_PALETTES.kkr;
  const skinColor = name.toLowerCase().includes("narine") ? 0x8D5524 : getPlayerSkin(name);

  const group = new THREE.Group();
  group.name = `Player_${name}`;

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.55,
    metalness: 0.1,
  });

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: teamPalette.primary,
    roughness: 0.35,
    metalness: 0.15,
  });

  const jerseyAccentMat = new THREE.MeshStandardMaterial({
    color: teamPalette.secondary,
    roughness: 0.25,
    metalness: 0.4,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: teamPalette.primary,
    roughness: 0.4,
    metalness: 0.1,
  });

  const padsMat = new THREE.MeshStandardMaterial({
    color: 0xF2F2F5,
    roughness: 0.45,
    metalness: 0.05,
  });

  const shoesMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.3,
    metalness: 0.2,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xFFD700,
    metalness: 0.9,
    roughness: 0.15,
  });

  // 1. Soft Shadow on grass
  const shadowGeo = new THREE.CircleGeometry(0.7, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // 2. Pedestal aura ring
  const auraGeo = new THREE.RingGeometry(0.68, 0.74, 32);
  const auraMat = new THREE.MeshBasicMaterial({
    color: teamPalette.secondary,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.015;
  group.add(aura);

  // Root node for animations (breathing, jumping)
  const rootNode = new THREE.Group();
  rootNode.position.y = 0;
  group.add(rootNode);

  // 3. Legs & Cricket Pads
  const leftLeg = createLeg({ isLeft: true, pantsMat, padsMat, shoesMat, teamPalette });
  leftLeg.position.set(-0.25, 0, 0);
  rootNode.add(leftLeg);

  const rightLeg = createLeg({ isLeft: false, pantsMat, padsMat, shoesMat, teamPalette });
  rightLeg.position.set(0.25, 0, 0);
  rootNode.add(rightLeg);

  // 4. Pelvis / Trouser top
  const pelvisGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.3, 16);
  const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
  pelvis.position.y = 1.35;
  rootNode.add(pelvis);

  // Belt
  const beltGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.06, 16);
  const belt = new THREE.Mesh(beltGeo, jerseyAccentMat);
  belt.position.y = 1.48;
  rootNode.add(belt);

  // 5. Torso & Jersey
  const torsoNode = new THREE.Group();
  torsoNode.position.y = 1.5;
  rootNode.add(torsoNode);

  // Athletic athletic chest taper
  const chestGeo = new THREE.CylinderGeometry(0.42, 0.32, 0.75, 16);
  const chest = new THREE.Mesh(chestGeo, jerseyMat);
  chest.position.y = 0.38;
  torsoNode.add(chest);

  // Jersey Side Stripes
  const stripeGeo = new THREE.BoxGeometry(0.06, 0.72, 0.36);
  const leftStripe = new THREE.Mesh(stripeGeo, jerseyAccentMat);
  leftStripe.position.set(-0.35, 0.38, 0);
  torsoNode.add(leftStripe);

  const rightStripe = new THREE.Mesh(stripeGeo, jerseyAccentMat);
  rightStripe.position.set(0.35, 0.38, 0);
  torsoNode.add(rightStripe);

  // V-Collar / Trim
  const collarGeo = new THREE.TorusGeometry(0.18, 0.035, 8, 16, Math.PI);
  const collar = new THREE.Mesh(collarGeo, jerseyAccentMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.75, 0.06);
  torsoNode.add(collar);

  // Team Chest Crest Badge
  const badgeGeo = new THREE.CircleGeometry(0.08, 16);
  const badgeMat = new THREE.MeshStandardMaterial({
    color: teamPalette.secondary,
    metalness: 0.8,
    roughness: 0.2,
  });
  const badge = new THREE.Mesh(badgeGeo, badgeMat);
  badge.position.set(0.16, 0.52, 0.35);
  badge.rotation.y = 0.2;
  torsoNode.add(badge);

  // 6. Neck & Head
  const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.2, 12);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.82;
  torsoNode.add(neck);

  const headNode = new THREE.Group();
  headNode.position.y = 1.05;
  torsoNode.add(headNode);

  // Stylized Head
  const headGeo = new THREE.SphereGeometry(0.24, 20, 20);
  headGeo.scale(1, 1.15, 1.05);
  const head = new THREE.Mesh(headGeo, skinMat);
  headNode.add(head);

  // Chin / Jawline definition
  const chinGeo = new THREE.BoxGeometry(0.16, 0.12, 0.16);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.position.set(0, -0.16, 0.12);
  headNode.add(chin);

  // 7. Signature Hairstyles & Details
  const isNarine = name.toLowerCase().includes("narine");
  const isKohli = name.toLowerCase().includes("kohli");
  const isDhoni = name.toLowerCase().includes("dhoni");
  const isRussell = name.toLowerCase().includes("russell");
  const isBumrah = name.toLowerCase().includes("bumrah");
  const isKlaasen = name.toLowerCase().includes("klaasen");
  const isCummins = name.toLowerCase().includes("cummins");

  if (isNarine) {
    // SUNIL NARINE: Iconic Spiky Mohawk Hairstyle!
    buildNarineSpikyHair(headNode, goldMat);
  } else if (isKohli) {
    // VIRAT KOHLI: Slick Modern Pompadour Fade + Styled Stubble Beard
    buildKohliHair(headNode);
  } else if (isDhoni) {
    // MS DHONI: Sleek Captain cool swept hair & iconic yellow headband
    buildDhoniHair(headNode, teamPalette);
  } else if (isRussell) {
    // ANDRE RUSSELL: Blonde-tipped spiky mohawk
    buildRussellHair(headNode);
  } else if (isBumrah) {
    // JASPRIT BUMRAH: Textured tight crop
    buildBumrahHair(headNode);
  } else if (isKlaasen) {
    // HEINRICH KLAASEN: South African power-hitter blonde crop
    buildKlaasenHair(headNode);
  } else if (isCummins) {
    // PAT CUMMINS: Australian captain slick athletic blonde swept hair
    buildCumminsHair(headNode);
  } else {
    // Default athletic cricket crop
    buildDefaultHair(headNode, teamPalette);
  }

  // 8. Arms & Equipment
  const armsGroup = new THREE.Group();
  torsoNode.add(armsGroup);

  // Pose selection based on role & position
  const isBatsman = role.toLowerCase().includes("bat") || role.toLowerCase().includes("keeper");
  const isBowler = role.toLowerCase().includes("bowl");

  // Left Arm
  const leftArm = createArm({
    isLeft: true,
    skinMat,
    jerseyMat,
    jerseyAccentMat,
    teamPalette,
  });
  leftArm.position.set(-0.46, 0.65, 0);
  armsGroup.add(leftArm);

  // Right Arm
  const rightArm = createArm({
    isLeft: false,
    skinMat,
    jerseyMat,
    jerseyAccentMat,
    teamPalette,
  });
  rightArm.position.set(0.46, 0.65, 0);
  armsGroup.add(rightArm);

  // Attach Cricket Bat / Ball based on player role & iconic style
  if (isNarine) {
    // Sunil Narine: Master all-rounder holding his mystery spin ball in right hand + bat in left hand!
    const cricketBall = createCricketBall();
    cricketBall.position.set(0, -0.65, 0.12);
    rightArm.add(cricketBall);

    const cricketBat = createCricketBat(teamPalette);
    cricketBat.position.set(0, -0.65, 0);
    cricketBat.rotation.set(-0.3, 0.2, -0.4);
    leftArm.add(cricketBat);

    // Sunil Narine Poses
    rightArm.rotation.set(0.3, -0.2, 0.4);
    leftArm.rotation.set(-0.2, 0.3, -0.3);
  } else if (isKohli) {
    // Virat Kohli: Iconic heroic raised bat celebration to the stadium crowd!
    const cricketBat = createCricketBat(teamPalette);
    cricketBat.position.set(0, -0.65, 0);
    cricketBat.rotation.set(-0.4, 0, 0.2);
    rightArm.add(cricketBat);

    rightArm.rotation.set(-1.2, 0, 0.3);
    leftArm.rotation.set(0.1, 0, -0.3);
  } else if (isBatsman || position === "left") {
    // Power batsman raising cricket bat
    const cricketBat = createCricketBat(teamPalette);
    cricketBat.position.set(0, -0.65, 0);
    cricketBat.rotation.set(-0.2, 0, 0.3);
    rightArm.add(cricketBat);

    rightArm.rotation.set(-0.5, 0, 0.4);
    leftArm.rotation.set(0.2, 0, -0.3);
  } else if (isBowler) {
    // Bowler ready to run up or celebrating with ball held high
    const cricketBall = createCricketBall();
    cricketBall.position.set(0, -0.65, 0.08);
    rightArm.add(cricketBall);

    rightArm.rotation.set(-0.8, -0.2, 0.3);
    leftArm.rotation.set(0.3, 0.2, -0.4);
  } else {
    // Classic all-rounder stance
    const cricketBat = createCricketBat(teamPalette);
    cricketBat.position.set(0, -0.65, 0);
    cricketBat.rotation.set(-0.2, 0, 0);
    rightArm.add(cricketBat);

    rightArm.rotation.set(-0.2, 0, 0.2);
    leftArm.rotation.set(0.2, 0, -0.2);
  }

  // Adjust overall orientation based on screen position
  if (position === "left") {
    group.rotation.y = 0.35; // Face inwards towards center
  } else if (position === "right") {
    group.rotation.y = -0.35; // Face inwards towards center
  }

  // Store references for dynamic animation loop
  group.userData = {
    rootNode,
    torsoNode,
    headNode,
    leftArm,
    rightArm,
    aura,
    initialY: 0,
    timeOffset: Math.random() * 10,
  };

  return group;
}

/**
 * Leg with trousers, cricket batting pads, and shoes
 */
function createLeg({ isLeft, pantsMat, padsMat, shoesMat, teamPalette }) {
  const leg = new THREE.Group();

  // Upper leg (thigh)
  const thighGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.65, 12);
  const thigh = new THREE.Mesh(thighGeo, pantsMat);
  thigh.position.y = 1.05;
  leg.add(thigh);

  // Knee
  const kneeGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const knee = new THREE.Mesh(kneeGeo, padsMat);
  knee.position.y = 0.72;
  leg.add(knee);

  // Shin (under pad)
  const shinGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.65, 12);
  const shin = new THREE.Mesh(shinGeo, pantsMat);
  shin.position.y = 0.38;
  leg.add(shin);

  // Cricket Batting Pad (Shield attached to front of shin)
  const padNode = new THREE.Group();
  padNode.position.set(0, 0.52, 0.08);

  // Main vertical curved pad body
  const padGeo = new THREE.BoxGeometry(0.24, 0.82, 0.12);
  const padMesh = new THREE.Mesh(padGeo, padsMat);
  padNode.add(padMesh);

  // 3 Horizontal Knee Roll Ridges on pad
  const strapMat = new THREE.MeshStandardMaterial({
    color: teamPalette.secondary,
    roughness: 0.5,
  });

  for (let i = -1; i <= 1; i++) {
    const ridgeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
    const ridge = new THREE.Mesh(ridgeGeo, strapMat);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set(0, 0.2 + i * 0.08, 0.07);
    padNode.add(ridge);
  }

  leg.add(padNode);

  // Cricket Shoe / Spikes
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.12, 0.34);
  const shoe = new THREE.Mesh(shoeGeo, shoesMat);
  shoe.position.set(0, 0.06, 0.06);
  leg.add(shoe);

  // Sole trim
  const soleGeo = new THREE.BoxGeometry(0.17, 0.03, 0.35);
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, 0.015, 0.06);
  leg.add(sole);

  return leg;
}

/**
 * Arm with jersey sleeve, elbow, forearm, wristband, and batting glove
 */
function createArm({ isLeft, skinMat, jerseyMat, jerseyAccentMat, teamPalette }) {
  const arm = new THREE.Group();

  // Shoulder & Jersey Sleeve
  const shoulderGeo = new THREE.SphereGeometry(0.16, 12, 12);
  const shoulder = new THREE.Mesh(shoulderGeo, jerseyMat);
  arm.add(shoulder);

  const bicepGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.35, 12);
  const bicep = new THREE.Mesh(bicepGeo, jerseyMat);
  bicep.position.y = -0.2;
  arm.add(bicep);

  // Forearm (skin)
  const forearmGeo = new THREE.CylinderGeometry(0.1, 0.085, 0.35, 12);
  const forearm = new THREE.Mesh(forearmGeo, skinMat);
  forearm.position.y = -0.48;
  arm.add(forearm);

  // Team Wristband
  const wristGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.08, 12);
  const wristband = new THREE.Mesh(wristGeo, jerseyAccentMat);
  wristband.position.y = -0.56;
  arm.add(wristband);

  // Cricket Batting Glove Hand
  const gloveGeo = new THREE.BoxGeometry(0.14, 0.16, 0.14);
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0xEAEAEA,
    roughness: 0.4,
  });
  const glove = new THREE.Mesh(gloveGeo, gloveMat);
  glove.position.y = -0.68;
  arm.add(glove);

  // Knuckle protection ridges
  const knuckleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.13, 8);
  const knuckle = new THREE.Mesh(knuckleGeo, jerseyAccentMat);
  knuckle.rotation.z = Math.PI / 2;
  knuckle.position.set(0, -0.66, 0.075);
  arm.add(knuckle);

  return arm;
}

/**
 * English willow cricket bat in 3D
 */
function createCricketBat(teamPalette) {
  const batNode = new THREE.Group();

  // Wooden blade
  const bladeGeo = new THREE.BoxGeometry(0.14, 0.72, 0.045);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xDEB887,
    roughness: 0.35,
    metalness: 0.05,
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = -0.32;
  batNode.add(blade);

  // Curved back swell of the bat
  const swellGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.65, 8);
  const swell = new THREE.Mesh(swellGeo, bladeMat);
  swell.position.set(0, -0.32, -0.025);
  batNode.add(swell);

  // Bat face sponsor sticker
  const stickerGeo = new THREE.PlaneGeometry(0.11, 0.28);
  const stickerMat = new THREE.MeshStandardMaterial({
    color: teamPalette.secondary,
    roughness: 0.3,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  const sticker = new THREE.Mesh(stickerGeo, stickerMat);
  sticker.position.set(0, -0.22, 0.024);
  batNode.add(sticker);

  // Handle (cane with rubber grip)
  const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.32, 12);
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x1A1A1A,
    roughness: 0.8,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.y = 0.12;
  batNode.add(handle);

  // Handle rubber grip ridges
  for (let i = 0; i < 4; i++) {
    const ringGeo = new THREE.TorusGeometry(0.024, 0.003, 6, 12);
    const ring = new THREE.Mesh(ringGeo, stickerMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04 + i * 0.06;
    batNode.add(ring);
  }

  // Handle cap
  const capGeo = new THREE.CylinderGeometry(0.026, 0.024, 0.03, 12);
  const cap = new THREE.Mesh(capGeo, stickerMat);
  cap.position.y = 0.28;
  batNode.add(cap);

  return batNode;
}

/**
 * 3D Cricket Ball with seam
 */
function createCricketBall() {
  const ballNode = new THREE.Group();

  const ballGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0x991111,
    roughness: 0.22,
    metalness: 0.3,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ballNode.add(ball);

  // White stitched seam ring
  const seamGeo = new THREE.TorusGeometry(0.081, 0.006, 6, 24);
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.4,
  });
  const seam = new THREE.Mesh(seamGeo, seamMat);
  ballNode.add(seam);

  return ballNode;
}

/**
 * SUNIL NARINE: Signature Spiky Mohawk Hairstyle!
 * Beautiful ridge of tall spikes from forehead to crown + gold earrings
 */
function buildNarineSpikyHair(headNode, goldMat) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0E0E12,
    roughness: 0.7,
    metalness: 0.2,
  });

  // Dark shaved sides base
  const sideBaseGeo = new THREE.SphereGeometry(0.245, 16, 16);
  sideBaseGeo.scale(1, 1.16, 1.05);
  const sideBase = new THREE.Mesh(sideBaseGeo, hairMat);
  hairGroup.add(sideBase);

  // Central ridge of sharp cones (The Narine Mohawk!)
  const spikeHeights = [0.12, 0.16, 0.20, 0.22, 0.21, 0.18, 0.14, 0.10];
  const zPositions   = [0.18, 0.14, 0.08, 0.00, -0.08, -0.15, -0.20, -0.23];
  const yPositions   = [0.22, 0.27, 0.30, 0.31, 0.30,  0.27,  0.22,  0.16];

  for (let i = 0; i < spikeHeights.length; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.045, spikeHeights[i], 7);
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(0, yPositions[i], zPositions[i]);
    // Angle spikes slightly forward in front, straight in mid, back in rear
    spike.rotation.x = (zPositions[i] - 0.05) * 1.4;
    hairGroup.add(spike);

    // Flanking micro-spikes for extra density
    const subGeo = new THREE.ConeGeometry(0.03, spikeHeights[i] * 0.75, 5);
    const subLeft = new THREE.Mesh(subGeo, hairMat);
    subLeft.position.set(-0.04, yPositions[i] - 0.02, zPositions[i]);
    subLeft.rotation.z = 0.2;
    hairGroup.add(subLeft);

    const subRight = new THREE.Mesh(subGeo, hairMat);
    subRight.position.set(0.04, yPositions[i] - 0.02, zPositions[i]);
    subRight.rotation.z = -0.2;
    hairGroup.add(subRight);
  }

  // Sunil Narine's iconic Gold Stud Earring
  const earringGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const earring = new THREE.Mesh(earringGeo, goldMat);
  earring.position.set(-0.25, -0.05, 0.02);
  hairGroup.add(earring);
}

/**
 * VIRAT KOHLI: Modern Pompadour Fade + Styled Stubble Beard
 */
function buildKohliHair(headNode) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.6,
  });

  // Base head crop
  const baseGeo = new THREE.SphereGeometry(0.246, 16, 16);
  baseGeo.scale(1, 1.16, 1.05);
  const base = new THREE.Mesh(baseGeo, hairMat);
  hairGroup.add(base);

  // Styled Pompadour top
  const pompGeo = new THREE.BoxGeometry(0.26, 0.12, 0.32);
  const pomp = new THREE.Mesh(pompGeo, hairMat);
  pomp.position.set(0, 0.28, 0.02);
  pomp.rotation.x = -0.15;
  hairGroup.add(pomp);

  // Kohli's iconic Beard / Stubble along jaw
  const beardMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.9,
  });
  const beardGeo = new THREE.TorusGeometry(0.2, 0.045, 8, 16, Math.PI);
  const beard = new THREE.Mesh(beardGeo, beardMat);
  beard.rotation.x = Math.PI * 0.7;
  beard.position.set(0, -0.12, 0.1);
  hairGroup.add(beard);
}

/**
 * MS DHONI: Sleek Captain cool swept hair & iconic yellow headband
 */
function buildDhoniHair(headNode, teamPalette) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x18120C,
    roughness: 0.65,
  });

  // Swept back mane
  const hairGeo = new THREE.SphereGeometry(0.25, 16, 16);
  hairGeo.scale(1.02, 1.18, 1.15);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.02, -0.04);
  hairGroup.add(hair);

  // Dhoni's iconic Headband / Sweatband
  const bandGeo = new THREE.TorusGeometry(0.245, 0.03, 8, 20);
  const bandMat = new THREE.MeshStandardMaterial({
    color: teamPalette.primary,
    roughness: 0.4,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.12, 0.02);
  hairGroup.add(band);
}

/**
 * ANDRE RUSSELL: Bleached Blonde-tipped spiky mohawk
 */
function buildRussellHair(headNode) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const blondeMat = new THREE.MeshStandardMaterial({ color: 0xE8C868, roughness: 0.5 });

  for (let i = 0; i < 6; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.045, 0.18, 6);
    const spike = new THREE.Mesh(spikeGeo, blondeMat);
    spike.position.set(0, 0.28, 0.12 - i * 0.06);
    hairGroup.add(spike);
  }
}

/**
 * JASPRIT BUMRAH: Textured tight curly crop
 */
function buildBumrahHair(headNode) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0A0A0A, roughness: 0.9 });
  const hairGeo = new THREE.SphereGeometry(0.25, 14, 14);
  hairGeo.scale(1.02, 1.17, 1.08);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.03, 0);
  hairGroup.add(hair);
}

/**
 * HEINRICH KLAASEN: South African power-hitter blonde crop
 */
function buildKlaasenHair(headNode) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({ color: 0xD8B268, roughness: 0.6 });
  const hairGeo = new THREE.SphereGeometry(0.248, 16, 16);
  hairGeo.scale(1.02, 1.18, 1.08);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.03, 0);
  hairGroup.add(hair);

  const topGeo = new THREE.BoxGeometry(0.22, 0.1, 0.28);
  const top = new THREE.Mesh(topGeo, hairMat);
  top.position.set(0, 0.28, 0);
  hairGroup.add(top);
}

/**
 * PAT CUMMINS: Australian captain slick athletic blonde swept hair
 */
function buildCumminsHair(headNode) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({ color: 0xC8A252, roughness: 0.55 });
  const hairGeo = new THREE.SphereGeometry(0.248, 16, 16);
  hairGeo.scale(1.02, 1.16, 1.06);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.02, -0.02);
  hairGroup.add(hair);

  const sweepGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.24, 8);
  const sweep = new THREE.Mesh(sweepGeo, hairMat);
  sweep.rotation.z = Math.PI / 4;
  sweep.position.set(0.04, 0.26, 0);
  hairGroup.add(sweep);
}

/**
 * Default athletic cricket crop
 */
function buildDefaultHair(headNode, teamPalette) {
  const hairGroup = new THREE.Group();
  headNode.add(hairGroup);

  const hairMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 });
  const hairGeo = new THREE.SphereGeometry(0.248, 14, 14);
  hairGeo.scale(1.02, 1.16, 1.06);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.02, 0);
  hairGroup.add(hair);
}
