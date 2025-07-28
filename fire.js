import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as Photons from './lib/photons2/src/index.js';
import { FogMaterial } from './fogmaterial.js';

// Simple fire simulation built with Photons2
// Instantiates three stacked particle systems (embers, base flame, bright flame)
// inspired by demos from Photons2.  Designed to be used alongside any existing
// THREE.Scene / THREE.WebGLRenderer setup.

export class FireSimulation {
  constructor(scene, threeRenderer, onReady = null) {
    this.scene = scene;
    this.renderer = threeRenderer;
    this.particleSystems = [];
    this.manager = new Photons.Manager();
    this.instancedParticleSystems = false;
    this.pitModel = null; // Store reference to the pit model
    this.onReady = onReady; // Callback for when fire scene is ready
    
    // Store particle systems and original emission rates for intensity control
    this.embersSystem = null;
    this.baseFlameSystem = null;
    this.brightFlameSystem = null;
    this.originalEmissionRates = {
      embers: 15,
      baseFlame: 10,
      brightFlame: 5
    };
    this.currentIntensity = 0.35; // Start dim, brighten with text animation
    this.dimmingInterval = null; // Track dimming timer
    this.brighteningInterval = null; // Track brightening timer
    this.pendingIntensityIncrease = 0; // Queue of intensity to add gradually
    
    // add some ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 10);
    this.scene.add(ambientLight);

    // Parent object for the fire so we can reposition easily
    this.root = new THREE.Object3D();
    this.root.visible = false; // Start invisible, will be shown by main.js
    this.scene.add(this.root);

    // Initial placement
    this.updateRootPosition();

    // Load the pit model FIRST, then set up particle systems
    this.loadPitAndInitialize();
  }

  /**
   * Increase fire intensity when a character is converted to particles
   * @param {number} amount - Amount to queue for gradual increase (default: 0.02)
   */
  increaseIntensityForCharacter(amount = 0.02) {
    // Add to pending queue instead of immediately increasing
    this.pendingIntensityIncrease += amount;
    
    // Start the brightening process if not already running
    if (!this.brighteningInterval) {
      this.startBrightening();
    }
  }

  /**
   * Start the gradual brightening effect (applies pending increases slowly)
   */
  startBrightening() {
    if (this.brighteningInterval) {
      clearInterval(this.brighteningInterval);
    }
    
    this.brighteningInterval = setInterval(() => {
      if (this.pendingIntensityIncrease > 0) {
        // Apply a small portion of the pending increase
        const incrementThisSecond = Math.min(0.01, this.pendingIntensityIncrease);
        this.pendingIntensityIncrease -= incrementThisSecond;
        
        const newIntensity = Math.min(10, this.currentIntensity + incrementThisSecond);
        this.setIntensity(newIntensity);
      } else {
        // No more pending increases, stop the brightening timer
        clearInterval(this.brighteningInterval);
        this.brighteningInterval = null;
      }
    }, 500); // Every second
  }

  /**
   * Stop the gradual brightening effect
   */
  stopBrightening() {
    if (this.brighteningInterval) {
      clearInterval(this.brighteningInterval);
      this.brighteningInterval = null;
    }
    this.pendingIntensityIncrease = 0; // Clear any pending increases
  }

  /**
   * Start the gradual dimming effect (reduces intensity by 0.01 every 2.5 seconds, minimum 0.3)
   */
  startDimming() {
    if (this.dimmingInterval) {
      clearInterval(this.dimmingInterval);
    }
    
    this.dimmingInterval = setInterval(() => {
      const newIntensity = Math.max(0.33, this.currentIntensity - 0.01);
      this.setIntensity(newIntensity);
    }, 2500); // Every 2.5 seconds
  }

  /**
   * Stop the gradual dimming effect
   */
  stopDimming() {
    if (this.dimmingInterval) {
      clearInterval(this.dimmingInterval);
      this.dimmingInterval = null;
    }
  }

  /**
   * Set the flame intensity dynamically
   * @param {number} intensity - Intensity multiplier (0.3 = minimum, 1.0 = normal, >1.0 = intense)
   */
  setIntensity(intensity) {
    this.currentIntensity = Math.max(0.3, intensity); // Ensure minimum of 0.3
    
    // Update emission rates for all particle systems
    if (this.embersSystem && this.embersSystem.particleEmitter) {
      this.embersSystem.particleEmitter.emissionRate = this.originalEmissionRates.embers * this.currentIntensity;
    }
    
    if (this.baseFlameSystem && this.baseFlameSystem.particleEmitter) {
      this.baseFlameSystem.particleEmitter.emissionRate = this.originalEmissionRates.baseFlame * this.currentIntensity;
    }
    
    if (this.brightFlameSystem && this.brightFlameSystem.particleEmitter) {
      this.brightFlameSystem.particleEmitter.emissionRate = this.originalEmissionRates.brightFlame * this.currentIntensity * 0.7;
    }
    
    console.log(`Fire intensity set to: ${this.currentIntensity}`);
  }

  /**
   * Get the current flame intensity
   * @returns {number} Current intensity value
   */
  getIntensity() {
    return this.currentIntensity;
  }

  /** Load the GLB model for the fire container, then initialize particle systems */
  loadPitAndInitialize() {
    const loader = new GLTFLoader();
    loader.load(
      'textures/fire_pit.glb',
      (gltf) => {
        const model = gltf.scene;
        this.pitModel = model; // Store reference
        
        // Scale the model appropriately - adjust as needed
        model.scale.set(20, 20, 20);
        
        // Position the model at the exact same position as the fire particles (0, 0, 0)
        model.position.set(85, -25, 0);
        
        // Add the model to the fire's root object
        this.root.add(model);
        
        console.log('Fire pit model loaded successfully');
        
        // Now that the pit is loaded, set up the particle systems
        this.setupParticleSystems();
        
        // Start the gradual dimming effect (brightening starts automatically when characters are queued)
        this.startDimming();
        
        // Notify that fire scene is ready
        if (this.onReady) {
          this.onReady();
        }
        
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading fire pit model:', error);
        // Even if pit fails to load, set up particle systems so the fire still works
        this.setupParticleSystems();
        this.startDimming();
        
        // Notify that fire scene is ready (even without pit)
        if (this.onReady) {
          this.onReady();
        }
      }
    );
  }

  /** Update root object so the fire stays pinned to the bottom */
  updateRootPosition() {
    const worldY = -window.innerHeight / 2.5;
    const worldX = 0;
    console.log(`updating worldY: ${worldY}`);
    this.root.position.set(worldX, worldY, 5);
  }

  onResize() {
    this.updateRootPosition();
  }

  /** Per-frame update */
  update() {
    this.manager.update();
  }

  /** Per-frame render – should be invoked AFTER the main scene render */
  render(renderer, camera) {
    this.manager.render(renderer, camera);
  }

  /******************************
   *  Internal helpers below    *
   ******************************/

  setupParticleSystems() {
    let scale = 100.0;
    let flamePosition = new THREE.Vector3(0, 0, 0);
    
    this.embersSystem = this.setupEmbers(scale, flamePosition);
    this.manager.addParticleSystem(this.embersSystem);
    this.baseFlameSystem = this.setupBaseFlame(scale, flamePosition);
    this.manager.addParticleSystem(this.baseFlameSystem);
    this.brightFlameSystem = this.setupBrightFlame(scale/2, flamePosition);
    this.manager.addParticleSystem(this.brightFlameSystem);

    const fogParent = new THREE.Object3D();
    const fogGeometry = new THREE.PlaneGeometry(0, 0);
    const fogMaterial = new FogMaterial({
        side: THREE.DoubleSide
    });
    fogMaterial.transparent = true;
    fogMaterial.depthWrite = false;
    const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
    fogPlane.scale.set(scale/2, scale/2, 0);
    fogPlane.rotateX(-Math.PI / 2);
    fogParent.add(fogPlane);
    fogParent.position.y += 1.0;
    this.scene.add(fogParent);
    
    // Apply the current intensity immediately to prevent initial burst
    this.setIntensity(this.currentIntensity);
  }

  setupEmbers(scale, position) {
    const embersRoot = new THREE.Object3D();
    embersRoot.position.copy(position);
    this.root.add(embersRoot);

    const texturePath = 'textures/ember.png';
    const embersTexture = new THREE.TextureLoader().load(texturePath);
    const embersAtlas = new Photons.Atlas(embersTexture, texturePath);
    embersAtlas.addFrameSet(1, 0.0, 0.0, 1.0, 1.0);
    const embersRenderer = new Photons.AnimatedSpriteRenderer(
      this.instancedParticleSystems, 
      embersAtlas, 
      true, 
      THREE.AdditiveBlending
    );

    const embersParticleSystem = new Photons.ParticleSystem(embersRoot, embersRenderer);
    embersParticleSystem.init(450);
    embersParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(18));

    const sizeInitializerGenerator = new Photons.RandomGenerator(
      THREE.Vector2,
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(scale * 0.15, scale * 0.15),
      0.0, 0.0, false
    );

    embersParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(1.8, 0.6, 0.0, 0.0, false));
    embersParticleSystem.addParticleStateInitializer(new Photons.SizeInitializer(sizeInitializerGenerator));
    embersParticleSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
      new THREE.Vector3(0.05 * scale, 0.0, 0.05 * scale),
      new THREE.Vector3(-0.025 * scale, 0.0, -0.025 * scale)
    ));
    embersParticleSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
      new THREE.Vector3(0.4 * scale, 0.5 * scale, 0.4 * scale),
      new THREE.Vector3(-0.2 * scale, 0.8 * scale, -0.2 * scale),
      0.6 * scale, 0.8 * scale, false
    ));

    const embersOpacityOperator = embersParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    embersOpacityOperator.addElements([
      [0.0, 0.0],
      [0.7, 0.25],
      [0.9, 0.75],
      [0.0, 1.0]
    ]);

    const embersColorOperator = embersParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    embersColorOperator.addElementsFromParameters([
      [[1.0, 0.7, 0.0], 0.0],
      [[1.0, 0.6, 0.0], 0.5],
      [[1.0, 0.4, 0.0], 1.0]
    ]);

    const acceleratorOperatorGenerator = new Photons.SphereRandomGenerator(
      Math.PI * 2.0, 0.0, Math.PI, -Math.PI / 2, 20.0, -8,
      scale, scale, scale, 0.0, 0.0, 0.0
    );

    embersParticleSystem.addParticleStateOperator(new Photons.AccelerationOperator(acceleratorOperatorGenerator));
    embersParticleSystem.setSimulateInWorldSpace(true);
    embersParticleSystem.start();

    return embersParticleSystem;
  }

  setupBaseFlame(scale, position) {
    const baseFlameRoot = new THREE.Object3D();
    baseFlameRoot.position.copy(position);
    this.root.add(baseFlameRoot);

    const texturePath = 'textures/base_flame.png';
    const baseFlameTexture = new THREE.TextureLoader().load(texturePath);
    const baseFlameAtlas = new Photons.Atlas(baseFlameTexture, texturePath);
    baseFlameAtlas.addFrameSet(18, 0.0, 0.0, 128.0 / 1024.0, 128.0 / 512.0);
    const baseFlameRenderer = new Photons.AnimatedSpriteRenderer(
      this.instancedParticleSystems, 
      baseFlameAtlas, 
      true, 
      THREE.AdditiveBlending
    );

    const baseFlameParticleSystem = new Photons.ParticleSystem(baseFlameRoot, baseFlameRenderer);
    baseFlameParticleSystem.init(150);
    baseFlameParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(30));

    baseFlameParticleSystem.addParticleSequence(0, 18);
    const baseFlameParticleSequences = baseFlameParticleSystem.getParticleSequences();

    baseFlameParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(1.5, 0.6, 0.0, 0.0, false));
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.RotationInitializer(
      new Photons.RandomGenerator(0, Math.PI / 2.0, -Math.PI / 2.0, 0.0, 0.0, false)
    ));
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.RotationalSpeedInitializer(1.0, -1.0, 0.0, 0.0, false));
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.SizeInitializer(
      new Photons.RandomGenerator(THREE.Vector2,
        new THREE.Vector2(0.25 * scale, 0.25 * scale),
        new THREE.Vector2(0.5 * scale, 0.5 * scale),
        0.0, 0.0, false
      )
    ));

    baseFlameParticleSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
      new THREE.Vector3(0.05 * scale, 0.0, 0.05 * scale),
      new THREE.Vector3(-0.025 * scale, 0.0, -0.025 * scale)
    ));
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
      new THREE.Vector3(0.05 * scale, 0.4 * scale, 0.05 * scale),
      new THREE.Vector3(-0.025 * scale, 0.8 * scale, -0.025 * scale),
      0.35 * scale, 0.5 * scale, false
    ));
    baseFlameParticleSystem.addParticleStateInitializer(new Photons.SequenceInitializer(baseFlameParticleSequences));

    baseFlameParticleSystem.addParticleStateOperator(new Photons.SequenceOperator(baseFlameParticleSequences, 0.07, false));

    const baseFlameOpacityOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    baseFlameOpacityOperator.addElements([
      [0.0, 0.0],
      [0.8, 0.25],
      [0.8, 0.5],
      [0.0, 1.0]
    ]);

    const baseFlameSizeOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    baseFlameSizeOperator.addElementsFromParameters([
      [[0.6, 0.6], 0.0],
      [[1.0, 1.0], 0.4],
      [[1.0, 1.0], 1.0]
    ]);

    const baseFlameColorOperator = baseFlameParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    baseFlameColorOperator.addElementsFromParameters([
      [[1.0, 1.0, 1.0], 0.0],
      [[1.5, 1.5, 1.5], 0.5],
      [[1.0, 1.0, 1.0], 1.0]
    ]);

    baseFlameParticleSystem.addParticleStateOperator(new Photons.AccelerationOperator(
      new Photons.RandomGenerator(THREE.Vector3, 
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.0, 1.5 * scale, 0.0),
        0.0, 0.0, false
      )
    ));

    baseFlameParticleSystem.setSimulateInWorldSpace(true);
    baseFlameParticleSystem.start();

    return baseFlameParticleSystem;
  }

  setupBrightFlame(scale, position) {
    const brightFlameRoot = new THREE.Object3D();
    brightFlameRoot.position.copy(position);
    this.root.add(brightFlameRoot);

    const texturePath = 'textures/bright_flame.png';
    const brightFlameTexture = new THREE.TextureLoader().load(texturePath);
    const brightFlameAtlas = new Photons.Atlas(brightFlameTexture, texturePath);
    brightFlameAtlas.addFrameSet(16, 0.0, 0.0, 212.0 / 1024.0, 256.0 / 1024.0);
    const brightFlameRenderer = new Photons.AnimatedSpriteRenderer(
      this.instancedParticleSystems, 
      brightFlameAtlas, 
      true, 
      THREE.AdditiveBlending
    );

    const brightFlameParticleSystem = new Photons.ParticleSystem(brightFlameRoot, brightFlameRenderer);
    brightFlameParticleSystem.init(60);
    brightFlameParticleSystem.setEmitter(new Photons.ConstantParticleEmitter(15));

    brightFlameParticleSystem.addParticleSequence(0, 16);
    const brightFlameParticleSequences = brightFlameParticleSystem.getParticleSequences();

    brightFlameParticleSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(1.2, 0.5, 0.0, 0.0, false));
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.RotationInitializer(
      new Photons.RandomGenerator(0, Math.PI, -Math.PI / 2.0, 0.0, 0.0, false)
    ));
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.RotationalSpeedInitializer(Math.PI / 2.0, -Math.PI / 4.0, 0.0, 0.0, false));
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.SizeInitializer(
      new Photons.RandomGenerator(THREE.Vector2,
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.0, 0.0),
        0.2 * scale, 0.65 * scale, false
      )
    ));

    brightFlameParticleSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
      new THREE.Vector3(0.1 * scale, 0.0, 0.1 * scale),
      new THREE.Vector3(-0.05 * scale, 0.0, -0.05 * scale)
    ));
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
      new THREE.Vector3(0.02 * scale, 0.4 * scale, 0.02 * scale),
      new THREE.Vector3(-0.01 * scale, 0.4 * scale, -0.01 * scale),
      0.1 * scale, .2 * scale, false
    ));
    brightFlameParticleSystem.addParticleStateInitializer(new Photons.SequenceInitializer(brightFlameParticleSequences));

    brightFlameParticleSystem.addParticleStateOperator(new Photons.SequenceOperator(brightFlameParticleSequences, 0.1, false));

    const brightFlameOpacityOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    brightFlameOpacityOperator.addElements([
      [0.0, 0.0],
      [0.6, 0.2],
      [0.5, 0.75],
      [0.0, 1.0]
    ]);

    const brightFlameSizeOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    brightFlameSizeOperator.addElementsFromParameters([
      [[0.3, 0.3], 0.0],
      [[1.0, 1.0], 0.4],
      [[1.0, 1.0], 0.55],
      [[0.65, 0.65], 0.75],
      [[0.1, 0.1], 1.0]
    ]);

    const brightFlameColorOperator = brightFlameParticleSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    brightFlameColorOperator.addElementsFromParameters([
      [[1.0, 1.0, 1.0], 0.0],
      [[2.0, 2.0, 2.0], 0.3],
      [[2.0, 2.0, 2.0], 0.4],
      [[0.9, 0.6, 0.3], 0.65],
      [[0.75, 0.0, 0.0], 1.0]
    ]);

    brightFlameParticleSystem.addParticleStateOperator(new Photons.AccelerationOperator(
      new Photons.RandomGenerator(THREE.Vector3,
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.0, 1.5 * scale, 0.0),
        0.0, 0.0, false
      )
    ));

    brightFlameParticleSystem.setSimulateInWorldSpace(true);
    brightFlameParticleSystem.start();

    return brightFlameParticleSystem;
  }
} 