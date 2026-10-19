import * as THREE from "three";
import { gsap } from "gsap";
import { createCricketPlayer, TEAM_PALETTES } from "./CharacterBuilder";

export class RetentionScene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // 2. Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x070918, 0.032);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 150);
    this.camera.position.set(0, 6, 13);
    this.cameraTarget = new THREE.Vector3(0, 1.4, 0);
    this.camera.lookAt(this.cameraTarget);

    // Texture loader cache
    this.textureLoader = new THREE.TextureLoader();
    this.logoTextures = {};

    // Group containers
    this.arenaGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);

    this.lightsGroup = new THREE.Group();
    this.scene.add(this.lightsGroup);

    this.teamShieldGroup = new THREE.Group();
    this.scene.add(this.teamShieldGroup);

    this.playersGroup = new THREE.Group();
    this.scene.add(this.playersGroup);

    this.activePlayers = [];
    this.activeTeamId = null;

    // Build static stadium world
    this._initLighting();
    this._initStadiumArena();
    this._initParticles();

    // Clock & RAF
    this.clock = new THREE.Clock();
    this.isRunning = true;
    this._animate = this._animate.bind(this);
    this.rafId = requestAnimationFrame(this._animate);

    // Resize handler
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);
  }

  _initLighting() {
    // Ambient light (subtle stadium glow)
    this.ambientLight = new THREE.AmbientLight(0x222a44, 1.2);
    this.lightsGroup.add(this.ambientLight);

    // Directional main stadium key light
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.keyLight.position.set(5, 12, 8);
    this.lightsGroup.add(this.keyLight);

    // Dynamic Team Spotlights that sweep and highlight center stage
    this.spotLeft = new THREE.SpotLight(0xF3CA3E, 6.0, 30, Math.PI / 5, 0.4, 1.2);
    this.spotLeft.position.set(-8, 10, 6);
    this.spotLeft.target.position.set(0, 1, 0);
    this.lightsGroup.add(this.spotLeft);
    this.lightsGroup.add(this.spotLeft.target);

    this.spotRight = new THREE.SpotLight(0x9B51E0, 6.0, 30, Math.PI / 5, 0.4, 1.2);
    this.spotRight.position.set(8, 10, 6);
    this.spotRight.target.position.set(0, 1, 0);
    this.lightsGroup.add(this.spotRight);
    this.lightsGroup.add(this.spotRight.target);

    // Rim backlight for cinematic silhouette
    this.rimLight = new THREE.DirectionalLight(0x4488ff, 1.8);
    this.rimLight.position.set(0, 6, -8);
    this.lightsGroup.add(this.rimLight);
  }

  _initStadiumArena() {
    // Stadium Ground Pitch (Circular dark turf)
    const pitchGeo = new THREE.CircleGeometry(16, 64);
    const pitchMat = new THREE.MeshStandardMaterial({
      color: 0x0B1220,
      roughness: 0.75,
      metalness: 0.15,
    });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0;
    this.arenaGroup.add(pitch);

    // Raised Circular Center Dais / Stage
    const daisGeo = new THREE.CylinderGeometry(4.2, 4.5, 0.22, 48);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x0e172a,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.dais = new THREE.Mesh(daisGeo, daisMat);
    this.dais.position.y = 0.11;
    this.arenaGroup.add(this.dais);

    // Glowing LED Ring on the dais rim
    const ringGeo = new THREE.TorusGeometry(4.35, 0.05, 8, 64);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x9B51E0,
      transparent: true,
      opacity: 0.9,
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.22;
    this.arenaGroup.add(this.ring);

    // Outer Stadium Boundary Rope (Glowing LED Torus)
    const boundaryGeo = new THREE.TorusGeometry(12.5, 0.08, 12, 80);
    this.boundaryMat = new THREE.MeshBasicMaterial({
      color: 0x3A225D,
      transparent: true,
      opacity: 0.7,
    });
    this.boundary = new THREE.Mesh(boundaryGeo, this.boundaryMat);
    this.boundary.rotation.x = Math.PI / 2;
    this.boundary.position.y = 0.04;
    this.arenaGroup.add(this.boundary);

    // Radial Broadcast Grid Markers on Pitch
    const gridHelper = new THREE.PolarGridHelper(15, 6, 8, 64, 0x1E293B, 0x0F172A);
    gridHelper.position.y = 0.02;
    this.arenaGroup.add(gridHelper);

    // 4 Corner Stadium Floodlight Towers
    const towerCoords = [
      [-14, 0, -10],
      [14, 0, -10],
      [-14, 0, 10],
      [14, 0, 10],
    ];

    towerCoords.forEach(([tx, ty, tz]) => {
      const tower = this._createTower(tx, ty, tz);
      this.arenaGroup.add(tower);
    });
  }

  _createTower(x, y, z) {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, y, z);

    // Metal Truss Pylon
    const pylonGeo = new THREE.CylinderGeometry(0.2, 0.45, 14, 6);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1E2538,
      metalness: 0.8,
      roughness: 0.4,
    });
    const pylon = new THREE.Mesh(pylonGeo, pylonMat);
    pylon.position.y = 7;
    towerGroup.add(pylon);

    // Floodlight Bank Header
    const bankGeo = new THREE.BoxGeometry(2.2, 1.2, 0.4);
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x111625 });
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.position.set(0, 14, 0);
    bank.lookAt(0, 2, 0);
    towerGroup.add(bank);

    // Glowing Light Bank Face
    const lightFaceGeo = new THREE.PlaneGeometry(2.0, 1.0);
    const lightFaceMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const lightFace = new THREE.Mesh(lightFaceGeo, lightFaceMat);
    lightFace.position.set(0, 0, 0.21);
    bank.add(lightFace);

    // Volumetric Light Cone Mesh (God-ray beam)
    const coneGeo = new THREE.ConeGeometry(3.5, 18, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x5588ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, -9, 0);
    cone.rotation.x = Math.PI;
    bank.add(cone);

    return towerGroup;
  }

  _initParticles() {
    // 1. Floating stadium ambient embers
    const count = 900;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = Math.random() * 12 + 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 26;

      colors[i * 3]     = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 2] = 0.2 + Math.random() * 0.8;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);

    // 2. Celebration Spark Explosion Emitters
    this.burstGeo = new THREE.BufferGeometry();
    this.burstCount = 450;
    this.burstPositions = new Float32Array(this.burstCount * 3);
    this.burstVelocities = new Float32Array(this.burstCount * 3);
    this.burstColors = new Float32Array(this.burstCount * 3);

    for (let i = 0; i < this.burstCount; i++) {
      this.burstPositions[i * 3] = 0;
      this.burstPositions[i * 3 + 1] = -10; // offstage initially
      this.burstPositions[i * 3 + 2] = 0;

      this.burstVelocities[i * 3] = (Math.random() - 0.5) * 12;
      this.burstVelocities[i * 3 + 1] = Math.random() * 10 + 4;
      this.burstVelocities[i * 3 + 2] = (Math.random() - 0.5) * 12;

      this.burstColors[i * 3] = 1;
      this.burstColors[i * 3 + 1] = 0.8;
      this.burstColors[i * 3 + 2] = 0.2;
    }

    this.burstGeo.setAttribute("position", new THREE.BufferAttribute(this.burstPositions, 3));
    this.burstGeo.setAttribute("color", new THREE.BufferAttribute(this.burstColors, 3));

    this.burstMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.burstPoints = new THREE.Points(this.burstGeo, this.burstMat);
    this.scene.add(this.burstPoints);
    this.burstActive = false;
    this.burstAge = 0;
  }

  /**
   * Triggers a fireworks / spark explosion in team colors
   */
  triggerCelebrationBurst(teamColorHex) {
    const col = new THREE.Color(teamColorHex);
    const pos = this.burstGeo.attributes.position.array;
    const vel = this.burstVelocities;
    const cArr = this.burstGeo.attributes.color.array;

    for (let i = 0; i < this.burstCount; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = 1.0 + Math.random() * 0.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      vel[i * 3]     = Math.cos(angle) * speed;
      vel[i * 3 + 1] = Math.random() * 9 + 4;
      vel[i * 3 + 2] = Math.sin(angle) * speed;

      // Color variation between team color and gold/white
      const mix = Math.random();
      cArr[i * 3]     = mix > 0.5 ? col.r : 1.0;
      cArr[i * 3 + 1] = mix > 0.5 ? col.g : 0.85;
      cArr[i * 3 + 2] = mix > 0.5 ? col.b : 0.3;
    }

    this.burstGeo.attributes.position.needsUpdate = true;
    this.burstGeo.attributes.color.needsUpdate = true;
    this.burstMat.opacity = 1;
    this.burstActive = true;
    this.burstAge = 0;
  }

  /**
   * Sets up the 3D rotating holographic team shield
   */
  _setupTeamShield(teamId) {
    // Clear previous shield
    while (this.teamShieldGroup.children.length > 0) {
      const obj = this.teamShieldGroup.children[0];
      this.teamShieldGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }

    const teamPalette = TEAM_PALETTES[teamId] || TEAM_PALETTES.kkr;

    // Load or reuse team logo texture
    if (!this.logoTextures[teamId]) {
      this.logoTextures[teamId] = this.textureLoader.load(`/images/${teamId}.webp`);
    }
    const logoTex = this.logoTextures[teamId];
    logoTex.colorSpace = THREE.SRGBColorSpace;

    // 1. Holographic Shield Disc
    const shieldGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.14, 32);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: teamPalette.primary,
      metalness: 0.7,
      roughness: 0.25,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.rotation.x = Math.PI / 2;
    this.teamShieldGroup.add(shieldMesh);

    // Front Logo Plane
    const frontGeo = new THREE.CircleGeometry(1.35, 32);
    const frontMat = new THREE.MeshBasicMaterial({
      map: logoTex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const frontLogo = new THREE.Mesh(frontGeo, frontMat);
    frontLogo.position.set(0, 0, 0.08);
    this.teamShieldGroup.add(frontLogo);

    // Back Logo Plane
    const backLogo = new THREE.Mesh(frontGeo, frontMat);
    backLogo.rotation.y = Math.PI;
    backLogo.position.set(0, 0, -0.08);
    this.teamShieldGroup.add(backLogo);

    // Glowing Neon Aura Ring around the shield
    const ringGeo = new THREE.TorusGeometry(1.6, 0.04, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: teamPalette.secondary,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.teamShieldGroup.add(ring);

    this.teamShieldGroup.position.set(0, 3.2, 0);
    this.teamShieldGroup.scale.set(0.01, 0.01, 0.01);
  }

  /**
   * Phase 1: Team Introduction (3D Scene transition)
   */
  introTeam(teamId) {
    this.activeTeamId = teamId;
    const teamPalette = TEAM_PALETTES[teamId] || TEAM_PALETTES.kkr;

    // Shift background and fog to deep team-colored stadium atmosphere
    const bgCol = new THREE.Color(teamPalette.primary).multiplyScalar(0.08);
    gsap.to(this.scene.background, {
      r: bgCol.r,
      g: bgCol.g,
      b: bgCol.b,
      duration: 1.5,
    });
    gsap.to(this.scene.fog.color, {
      r: bgCol.r,
      g: bgCol.g,
      b: bgCol.b,
      duration: 1.5,
    });

    // Animate stage lighting to team signature colors
    gsap.to(this.spotLeft.color, {
      r: (teamPalette.primary >> 16 & 255) / 255,
      g: (teamPalette.primary >> 8 & 255) / 255,
      b: (teamPalette.primary & 255) / 255,
      duration: 1.2,
    });

    gsap.to(this.spotRight.color, {
      r: (teamPalette.secondary >> 16 & 255) / 255,
      g: (teamPalette.secondary >> 8 & 255) / 255,
      b: (teamPalette.secondary & 255) / 255,
      duration: 1.2,
    });

    gsap.to(this.ringMat.color, {
      r: (teamPalette.secondary >> 16 & 255) / 255,
      g: (teamPalette.secondary >> 8 & 255) / 255,
      b: (teamPalette.secondary & 255) / 255,
      duration: 1.2,
    });

    gsap.to(this.boundaryMat.color, {
      r: (teamPalette.primary >> 16 & 255) / 255,
      g: (teamPalette.primary >> 8 & 255) / 255,
      b: (teamPalette.primary & 255) / 255,
      duration: 1.2,
    });

    // Clear any previous players from stage
    this._clearPlayers();

    // Setup and animate 3D Team Shield
    this._setupTeamShield(teamId);

    // Dramatic wide camera swooping down
    this.camera.position.set(0, 7.5, 13);
    this.cameraTarget.set(0, 2.5, 0);

    gsap.to(this.camera.position, {
      x: 1.5,
      y: 4.2,
      z: 9.5,
      duration: 2.4,
      ease: "power2.out",
    });

    gsap.to(this.teamShieldGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.4,
      ease: "back.out(1.4)",
    });

    gsap.to(this.teamShieldGroup.position, {
      y: 3.2,
      duration: 1.4,
      ease: "power2.out",
    });

    this.triggerCelebrationBurst(teamPalette.secondary);
  }

  /**
   * Phase 2: Retained Player(s) Reveal
   */
  revealPlayers(retainedPlayers = [], teamId) {
    this.activeTeamId = teamId;
    const teamPalette = TEAM_PALETTES[teamId] || TEAM_PALETTES.kkr;

    // Shrink / elevate the holographic shield slightly to give players stage spotlight
    gsap.to(this.teamShieldGroup.position, {
      y: 4.8,
      duration: 1.0,
      ease: "power2.inOut",
    });
    gsap.to(this.teamShieldGroup.scale, {
      x: 0.65,
      y: 0.65,
      z: 0.65,
      duration: 1.0,
      ease: "power2.inOut",
    });

    this._clearPlayers();

    if (retainedPlayers.length === 1) {
      // 1 Player: Center Stage
      const p = retainedPlayers[0];
      const playerMesh = createCricketPlayer({
        name: p.name,
        role: p.role,
        teamId,
        position: "center",
      });

      playerMesh.position.set(0, 0.22, 0);
      playerMesh.scale.set(0.01, 0.01, 0.01);
      this.playersGroup.add(playerMesh);
      this.activePlayers.push(playerMesh);

      // Hero camera zoom closer to character
      gsap.to(this.camera.position, {
        x: 0,
        y: 1.6,
        z: 3.8,
        duration: 1.8,
        ease: "power2.out",
      });
      gsap.to(this.cameraTarget, {
        x: 0,
        y: 1.25,
        z: 0,
        duration: 1.8,
        ease: "power2.out",
      });

      // Character entrance jump animation
      gsap.to(playerMesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.0,
        ease: "back.out(1.5)",
      });

      gsap.fromTo(
        playerMesh.position,
        { y: 2.5 },
        { y: 0.22, duration: 0.9, ease: "bounce.out" }
      );

      this.triggerCelebrationBurst(teamPalette.primary);

    } else if (retainedPlayers.length >= 2) {
      // 2 Players: Split Left & Right
      const pLeft = retainedPlayers[0];
      const pRight = retainedPlayers[1];

      const meshLeft = createCricketPlayer({
        name: pLeft.name,
        role: pLeft.role,
        teamId,
        position: "left",
      });
      meshLeft.position.set(-1.9, 0.22, 0.1);
      meshLeft.scale.set(0.01, 0.01, 0.01);
      this.playersGroup.add(meshLeft);
      this.activePlayers.push(meshLeft);

      const meshRight = createCricketPlayer({
        name: pRight.name,
        role: pRight.role,
        teamId,
        position: "right",
      });
      meshRight.position.set(1.9, 0.22, 0.1);
      meshRight.scale.set(0.01, 0.01, 0.01);
      this.playersGroup.add(meshRight);
      this.activePlayers.push(meshRight);

      // Wide hero camera framing both players majestically
      gsap.to(this.camera.position, {
        x: 0,
        y: 1.7,
        z: 5.2,
        duration: 1.8,
        ease: "power2.out",
      });
      gsap.to(this.cameraTarget, {
        x: 0,
        y: 1.2,
        z: 0,
        duration: 1.8,
        ease: "power2.out",
      });

      // Dual entrances with slight stagger
      gsap.to(meshLeft.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.9,
        ease: "back.out(1.5)",
      });
      gsap.fromTo(
        meshLeft.position,
        { y: 2.5 },
        { y: 0.22, duration: 0.8, ease: "bounce.out" }
      );

      gsap.to(meshRight.scale, {
        x: 1,
        y: 1,
        z: 1,
        delay: 0.15,
        duration: 0.9,
        ease: "back.out(1.5)",
      });
      gsap.fromTo(
        meshRight.position,
        { y: 2.5 },
        { y: 0.22, delay: 0.15, duration: 0.8, ease: "bounce.out" }
      );

      this.triggerCelebrationBurst(teamPalette.secondary);

    } else {
      // 0 Players: Dramatic Empty Dais with searching spotlights
      gsap.to(this.camera.position, {
        x: 0,
        y: 2.2,
        z: 7.5,
        duration: 1.6,
        ease: "power2.out",
      });
      gsap.to(this.cameraTarget, {
        x: 0,
        y: 1.0,
        z: 0,
        duration: 1.6,
        ease: "power2.out",
      });

      // Dramatic sweeping spotlights scanning empty dais
      gsap.to(this.spotLeft.target.position, {
        x: 2.5,
        duration: 1.5,
        yoyo: true,
        repeat: 3,
        ease: "sine.inOut",
      });
      gsap.to(this.spotRight.target.position, {
        x: -2.5,
        duration: 1.5,
        yoyo: true,
        repeat: 3,
        ease: "sine.inOut",
      });
    }
  }

  _clearPlayers() {
    while (this.playersGroup.children.length > 0) {
      const p = this.playersGroup.children[0];
      this.playersGroup.remove(p);
      this._disposeNode(p);
    }
    this.activePlayers = [];
  }

  _disposeNode(node) {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
      else node.material.dispose();
    }
    if (node.children) {
      node.children.forEach((c) => this._disposeNode(c));
    }
  }

  _animate() {
    if (!this.isRunning) return;
    this.rafId = requestAnimationFrame(this._animate);

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Subtle camera breathing
    this.camera.lookAt(this.cameraTarget);

    // 2. Rotate 3D Team Hologram Shield
    if (this.teamShieldGroup) {
      this.teamShieldGroup.rotation.y += delta * 0.9;
    }

    // 3. Floating ambient stadium dust / embers
    if (this.particles) {
      this.particles.rotation.y = time * 0.04;
      const pos = this.particles.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += Math.sin(time + pos[i - 1]) * 0.003;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Celebration Spark Particles
    if (this.burstActive) {
      this.burstAge += delta;
      const pos = this.burstGeo.attributes.position.array;
      const vel = this.burstVelocities;

      for (let i = 0; i < this.burstCount; i++) {
        pos[i * 3]     += vel[i * 3] * delta;
        pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
        pos[i * 3 + 2] += vel[i * 3 + 2] * delta;

        // Gravity & air drag
        vel[i * 3 + 1] -= 9.8 * delta;
        vel[i * 3]     *= 0.985;
        vel[i * 3 + 2] *= 0.985;

        // Bounce on floor
        if (pos[i * 3 + 1] < 0.05) {
          pos[i * 3 + 1] = 0.05;
          vel[i * 3 + 1] *= -0.4;
        }
      }

      this.burstGeo.attributes.position.needsUpdate = true;
      this.burstMat.opacity = Math.max(0, 1 - this.burstAge / 2.2);

      if (this.burstAge > 2.2) {
        this.burstActive = false;
        this.burstMat.opacity = 0;
      }
    }

    // 5. Procedural 3D Character Skeletal Idle Animations
    this.activePlayers.forEach((player) => {
      const ud = player.userData;
      if (!ud) return;
      const t = time * 3 + ud.timeOffset;

      // Subtle breathing on torso
      if (ud.torsoNode) {
        ud.torsoNode.position.y = 1.5 + Math.sin(t) * 0.015;
      }

      // Subtle arm / equipment sways
      if (ud.leftArm) {
        ud.leftArm.rotation.z += Math.cos(t * 0.8) * 0.003;
      }
      if (ud.rightArm) {
        ud.rightArm.rotation.x += Math.sin(t * 0.8) * 0.003;
      }

      // Subtle aura ring pulse
      if (ud.aura) {
        ud.aura.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    if (!this.canvas) return;
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  destroy() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this._onResize);

    this._clearPlayers();

    // Dispose all scene objects
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
      this._disposeNode(obj);
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
