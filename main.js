import * as THREE from "three";
import SpriteText from './sprite/index.js';
import { FireSimulation } from './fire.js';

/********************
 * Audio setup      *
 ********************/
let backgroundAudio = null;
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let isAudioPlaying = false;
let audioInitialized = false;
let audioStartTime = 0;
let audioPauseTime = 0;

async function initializeAudio() {
  try {
    // Create both HTML5 Audio and Web Audio API instances
    backgroundAudio = new Audio('public/audio.mp3');
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.5;
    
    // Initialize Web Audio API
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load audio file for Web Audio API
    const response = await fetch('public/audio.mp3');
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('Audio loaded successfully');
    audioInitialized = true;
    updateAudioButtonState();
    
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    // Fallback to HTML5 Audio only
    try {
      backgroundAudio = new Audio('public/audio.mp3');
      backgroundAudio.loop = true;
      backgroundAudio.volume = 0.5;
      audioInitialized = true;
      updateAudioButtonState();
    } catch (fallbackError) {
      console.error('Fallback audio initialization failed:', fallbackError);
    }
  }
}



function startWebAudioLoop() {
  if (!audioContext || !audioBuffer) return;
  
  // Stop any existing source
  if (audioSource) {
    try {
      audioSource.stop();
    } catch (e) {
      // Source might already be stopped
    }
    audioSource = null;
  }
  
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(audioContext.destination);
  audioSource.loop = true;
  
  // Calculate offset for resume
  const offset = audioPauseTime > 0 ? audioPauseTime % audioBuffer.duration : 0;
  audioSource.start(0, offset);
  
  // Update timing
  audioStartTime = audioContext.currentTime - offset;
  audioPauseTime = 0;
  
  // Handle when the loop ends (shouldn't happen with loop=true, but just in case)
  audioSource.onended = () => {
    if (isAudioPlaying) {
      startWebAudioLoop();
    }
  };
}

function pauseWebAudio() {
  if (audioSource && audioContext) {
    audioPauseTime = audioContext.currentTime - audioStartTime;
    try {
      audioSource.stop();
    } catch (e) {
      // Source might already be stopped
    }
    audioSource = null;
  }
}







const container = document.getElementById("three-container");
const textarea = document.getElementById("text-input");
const instructions = document.getElementById("instructions");
const audioBtn = document.getElementById("audio-btn");



// Update audio button state
function updateAudioButtonState() {
  if (!audioBtn) return;
  
  if (isAudioPlaying) {
    audioBtn.textContent = '🔊';
    audioBtn.classList.add('playing');
    audioBtn.classList.remove('muted');
    audioBtn.title = 'Audio is playing';
  } else if (audioInitialized) {
    audioBtn.textContent = '🔇';
    audioBtn.classList.remove('playing');
    audioBtn.classList.add('muted');
    audioBtn.title = 'Click to start audio';
  } else {
    audioBtn.textContent = '⏳';
    audioBtn.classList.remove('playing', 'muted');
    audioBtn.title = 'Loading audio...';
  }
}

// Add audio button click handler
if (audioBtn) {
  audioBtn.addEventListener('click', async () => {
    if (!audioInitialized) {
      console.log('Audio not initialized yet');
      return;
    }
    
    if (isAudioPlaying) {
      // Pause audio
      if (audioContext && audioSource) {
        pauseWebAudio();
      }
      if (backgroundAudio) {
        backgroundAudio.pause();
      }
      isAudioPlaying = false;
      console.log('Audio paused');
    } else {
      // Start audio
      if (audioContext && audioBuffer) {
        // Use Web Audio API for better control
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        startWebAudioLoop();
        isAudioPlaying = true;
        console.log('Audio started via Web Audio API');
      } else if (backgroundAudio) {
        // Fallback to HTML5 Audio
        await backgroundAudio.play();
        isAudioPlaying = true;
        console.log('Audio started via HTML5 Audio');
      }
    }
    
    updateAudioButtonState();
  });
}



// Initially disable textarea during intro sequence
if (textarea) {
  textarea.disabled = true;
  textarea.style.opacity = "0.3";
  textarea.style.cursor = "not-allowed";
  textarea.blur(); // Remove focus to hide cursor
}

/********************
 * Three.js setup   *
 ********************/
const scene = new THREE.Scene();

// Orthographic camera so world units map 1:1 to screen pixels
let camera = createOrthoCamera();

function createOrthoCamera() {
  const cam = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    -1000,
    1000
  );
  cam.position.z = 10;
  return cam;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// after renderer set up, instantiate fire simulation
let fireSim = new FireSimulation(scene, renderer, () => {
  // Fire scene is ready, start fade-in animation
  startFireFadeIn();
});

// Fire fade-in animation
let fireOpacity = 0;
let isFadingInFire = false;

function startFireFadeIn() {
  if (isFadingInFire) return;
  
  isFadingInFire = true;
  fireSim.root.visible = true; // Make visible
  console.log('Starting fire scene fade-in');
  
  // Start smooth fade-in animation
  animateFireFadeIn();
}

function animateFireFadeIn() {
  if (fireOpacity >= 1.0) {
    fireOpacity = 1.0;
    isFadingInFire = false;
    console.log('Fire scene fade-in complete');
    return;
  }
  
  // Smooth fade over 3 seconds
  fireOpacity += 1.0 / (60 * 3); // 60fps * 3 seconds
  fireOpacity = Math.min(1.0, fireOpacity);
  
  // Apply opacity to all materials in the fire scene
  fireSim.root.traverse((child) => {
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (!mat.userData.originalOpacity) {
            mat.userData.originalOpacity = mat.opacity || 1.0;
          }
          mat.transparent = true;
          mat.opacity = fireOpacity * mat.userData.originalOpacity;
        });
      } else {
        if (!child.material.userData.originalOpacity) {
          child.material.userData.originalOpacity = child.material.opacity || 1.0;
        }
        child.material.transparent = true;
        child.material.opacity = fireOpacity * child.material.userData.originalOpacity;
      }
    }
  });
  
  // Apply opacity to particle system renderer materials
  [fireSim.embersSystem, fireSim.baseFlameSystem, fireSim.brightFlameSystem].forEach(system => {
    if (system && system.renderer && system.renderer.material) {
      const mat = system.renderer.material;
      if (!mat.userData.originalOpacity) {
        mat.userData.originalOpacity = mat.opacity || 1.0;
      }
      mat.transparent = true;
      mat.opacity = fireOpacity * mat.userData.originalOpacity;
    }
  });
  
  // Continue animation
  requestAnimationFrame(animateFireFadeIn);
}

window.addEventListener("resize", () => {
  camera = createOrthoCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Update screen bottom for particle cleanup
  SCREEN_BOTTOM = -window.innerHeight / 2 - 100;
  // inside window resize listener, after SCREEN_BOTTOM update
  fireSim.onResize();
});

/********************
 * Instruction cycling *
 ********************/
const instructionPrompts = [
  "write a thought, then press enter", 
  "send another thought",
  "make an offering",
  "make another offering",
  "your thoughts won't last",
  "declutter your brain",
  "what's on your mind?",
  "a thought shouldn't stay in your head forever",
  "offer your thoughts",
  "anything to say?",
  "what are you thinking about?",
  "anything worrying you?"
];

let currentPromptIndex = 0;
let introSequenceComplete = false; // Track if intro sequence has finished

function cycleToNextPrompt() {
  // Only cycle if intro sequence is complete
  if (!introSequenceComplete) return;
  
  currentPromptIndex = (currentPromptIndex + 1) % instructionPrompts.length;
  if (instructions) {
    instructions.style.opacity = "0";
    setTimeout(() => {
      instructions.textContent = instructionPrompts[currentPromptIndex];
      instructions.style.opacity = "1";
    }, 500); // Fade transition timing
  }
}

/********************
 * Particle helpers *
 ********************/
const PARTICLE_COLOR = 0xf8cc30; // navy

// Timing controls for dissolve
const DELAY_PER_CHARACTER = 0.05; // faster delay per character

// Measure cache canvas for layout calculations
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");


// Get actual line breaks as they appear in the textarea using browser's native layout
function getActualTextLineBreaks(text, textareaStyles, contentWidth) {
  // Create a temporary element with identical styling to measure actual line breaks
  const testElement = document.createElement('div');
  testElement.style.position = 'absolute';
  testElement.style.left = '-9999px';
  testElement.style.top = '-9999px';
  
  // Set width to content width (padding already subtracted)
  testElement.style.width = `${contentWidth}px`;
  testElement.style.fontSize = textareaStyles.fontSize;
  testElement.style.fontFamily = textareaStyles.fontFamily;
  testElement.style.fontWeight = textareaStyles.fontWeight;
  testElement.style.lineHeight = textareaStyles.lineHeight;
  
  // Don't add padding to test element since we already adjusted the width
  testElement.style.padding = '0';
  testElement.style.margin = '0';
  testElement.style.border = 'none';
  testElement.style.wordWrap = 'break-word';
  testElement.style.whiteSpace = 'pre-wrap';
  testElement.style.overflow = 'hidden';
  testElement.style.boxSizing = 'content-box';
  
  document.body.appendChild(testElement);
  
  const lines = [];
  const paragraphs = text.split('\n');
  
  paragraphs.forEach(paragraph => {
    if (paragraph.trim() === '') {
      lines.push({ text: '', widths: [] });
      return;
    }
    
    // Start with empty content and progressively add words
    testElement.textContent = '';
    const words = paragraph.split(' ');
    let currentLine = '';
    let currentHeight = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testText = currentLine === '' ? word : currentLine + ' ' + word;
      
      testElement.textContent = testText;
      const newHeight = testElement.offsetHeight;
      
      // If height increased, we've wrapped to a new line
      if (currentHeight > 0 && newHeight > currentHeight) {
        // Finalize current line and measure character widths
        if (currentLine.trim()) {
          const lineWidths = measureLineCharacterWidths(currentLine, testElement);
          lines.push({ text: currentLine.trim(), widths: lineWidths });
        }
        
        // Start new line with current word
        currentLine = word;
        testElement.textContent = word;
        currentHeight = testElement.offsetHeight;
      } else {
        // Add word to current line
        currentLine = testText;
        currentHeight = newHeight;
      }
    }
    
    // Add the final line
    if (currentLine.trim()) {
      const lineWidths = measureLineCharacterWidths(currentLine, testElement);
      lines.push({ text: currentLine.trim(), widths: lineWidths });
    }
  });
  
  document.body.removeChild(testElement);
  return lines;
}

// Helper function to measure character widths for a line
function measureLineCharacterWidths(lineText, parentElement) {
  measureCtx.font = window.getComputedStyle(parentElement).font;
  return [...lineText].map(char => measureCtx.measureText(char).width);
}

// Convert DOM pixel coordinates (origin top-left) to orthographic world coordinates (origin center)
function domToWorld(pxX, pxY) {
  return {
    x: pxX - window.innerWidth / 2,
    y: window.innerHeight / 2 - pxY,
  };
}

// Store animated sprites and particles
const animatedSprites = [];
const particleSystems = [];

// Particle system configuration
const PARTICLE_COUNT_PER_SPRITE = 15; // Number of particles per character
const FIRE_ATTRACTION_STRENGTH = 250; // Attraction force toward fire (pixels/second²)
const PARTICLE_SPREAD = 100; // Initial velocity spread
const FIRE_ABSORPTION_DISTANCE = 70; // Distance at which particles disappear into fire
let SCREEN_BOTTOM = -window.innerHeight / 2 - 100; // Bottom of screen plus buffer

function createParticlesFromSprite(sprite, worldX, worldY) {
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = PARTICLE_COUNT_PER_SPRITE;
  
  // Create arrays for particle attributes
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  

  
  // Initialize particle attributes
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // Start all particles at the sprite position with small random offset
    positions[i3] = worldX + (Math.random() - 0.5) * 10;
    positions[i3 + 1] = worldY + (Math.random() - 0.5) * 10;
    positions[i3 + 2] = 0;
    
    // Random initial velocities (upward and outward)
    velocities[i3] = (Math.random() - 0.5) * PARTICLE_SPREAD;
    velocities[i3 + 1] = Math.random() * PARTICLE_SPREAD * 0.5; // Slight upward bias
    velocities[i3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD * 0.2;
    
    // Random particle size
    sizes[i] = Math.random() * 3 + 1;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Create particle material using the predefined color
  const particleMaterial = new THREE.PointsMaterial({
    size: 2,
    color: PARTICLE_COLOR,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: false
  });
  
  // Create particle system
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  
  // Store particle system data
  particleSystems.push({
    particles,
    velocities,
    startTime: performance.now() / 1000
  });
  

  
  // Remove the original sprite immediately
  scene.remove(sprite);
  sprite.material.dispose();
  if (sprite.material.map) sprite.material.map.dispose();
}

function updateParticles() {
  for (let i = particleSystems.length - 1; i >= 0; i--) {
    const system = particleSystems[i];
    const { particles, velocities } = system;
    
    // Update particle positions with physics
    const positions = particles.geometry.attributes.position.array;
    const deltaTime = 1 / 60; // Assume 60fps for stable physics
    
    // Get fire position for attraction
    const firePosition = fireSim.root.position;
    const fireY = firePosition.y;
    
    let allParticlesAbsorbed = true;
    
    for (let j = 0; j < positions.length / 3; j++) {
      const j3 = j * 3;
      
      // Calculate vector from particle to fire
      const particleX = positions[j3];
      const particleY = positions[j3 + 1];
      const particleZ = positions[j3 + 2];
      
      // Check if particle has reached or passed the fire's y position
      if (particleY <= fireY) {
        // Mark particle as absorbed by setting it very far away (will be cleaned up)
        positions[j3] = -999999;
        positions[j3 + 1] = -999999;
        positions[j3 + 2] = -999999;
        continue;
      }
      
      // Particle is still active
      allParticlesAbsorbed = false;
      
      const directionX = firePosition.x - particleX;
      const directionY = firePosition.y - particleY;
      const directionZ = firePosition.z - particleZ;
      
      // Calculate distance to fire for attraction force calculation
      const distance = Math.sqrt(directionX * directionX + directionY * directionY + directionZ * directionZ);
      
      // Normalize direction vector
      if (distance > 0) {
        const normalizedX = directionX / distance;
        const normalizedY = directionY / distance;
        const normalizedZ = directionZ / distance;
        
        // Apply attraction force toward fire (stronger when closer)
        const attractionForce = FIRE_ATTRACTION_STRENGTH * (1.5 + 1 / Math.max(distance * 0.01, 0.1));
        
        // Funnel effect: Create much stronger X-axis pull when particles get close to fire
        // This makes particles converge into a tight stream rather than spreading horizontally
        // When distance < 150px: X-force scales from 1x (at 150px) to 4x (at fire center)
        // When distance >= 150px: normal 1x force (no extra convergence)
        const xFunnelMultiplier = distance < 150 ? (5 + 10 * (150 - distance) / 150) : 1;
        
        velocities[j3] += normalizedX * attractionForce * deltaTime * xFunnelMultiplier;
        velocities[j3 + 1] += normalizedY * attractionForce * deltaTime;
        velocities[j3 + 2] += normalizedZ * attractionForce * deltaTime;
      }
      
      // Update positions based on velocity
      positions[j3] += velocities[j3] * deltaTime;
      positions[j3 + 1] += velocities[j3 + 1] * deltaTime;
      positions[j3 + 2] += velocities[j3 + 2] * deltaTime;
    }
    
    // Mark geometry for update
    particles.geometry.attributes.position.needsUpdate = true;
    
    // Remove particle systems where all particles have been absorbed
    if (allParticlesAbsorbed) {
      scene.remove(particles);
      particles.geometry.dispose();
      particles.material.dispose();
      particleSystems.splice(i, 1);
    }
  }
}


function animateSprites() {
  const now = performance.now() / 1000;
  
  for (let i = animatedSprites.length - 1; i >= 0; i--) {
    const item = animatedSprites[i];
    const { sprite, delay, startTime, worldX, worldY } = item;
    const elapsed = now - startTime - delay;
    
    if (elapsed <= 0) continue;
    
    // Convert sprite to particles immediately when animation starts
    createParticlesFromSprite(sprite, worldX, worldY);
    animatedSprites.splice(i, 1);
  }
  // Increase fire intensity when character is converted to particles
  fireSim.increaseIntensityForCharacter(0.001 * animatedSprites.length);
  // Update particle physics
  updateParticles();
  
  // Check if all animations are complete and re-enable textarea
  if (animatedSprites.length === 0 && particleSystems.length === 0 && textarea.disabled) {
    textarea.disabled = false;
    textarea.style.opacity = "1";
    textarea.style.cursor = "text";
    
    // Cycle to next instruction prompt
    cycleToNextPrompt();
  }
}

/********************
 * Main loop        *
 ********************/
function tick() {
  requestAnimationFrame(tick);
  animateSprites();
  // inside tick function before renderer.render call
  fireSim.update();
  renderer.render(scene, camera);
  // after that line, call fireSim.render
  fireSim.render(renderer, camera);
}
requestAnimationFrame(tick);

/********************
 * Intro sequence   *
 ********************/
function startIntroSequence() {
  const messages = [
    "but it won't last forever.",
    "if you'd like, you can help keep it going by offering some of your thoughts to it."
  ];
  
  let currentIndex = 0;
  const fadeDuration = 2000; // 2 seconds
  const displayDuration = 3000; // 3 seconds
  
  function showNextMessage() {
    if (currentIndex >= messages.length) {
      // All intro messages shown, now show final instruction and enable textarea
      finishIntroSequence();
      return;
    }
    
    const message = messages[currentIndex];
    currentIndex++;
    
    // Fade out current message
    instructions.style.opacity = "0";
    
    // After fade out, change text and fade in
    setTimeout(() => {
      instructions.textContent = message;
      instructions.style.opacity = "1";
      
      // Schedule next message
      setTimeout(showNextMessage, displayDuration);
    }, fadeDuration / 2);
  }
  
  function finishIntroSequence() {
    // Show final instruction after a delay
    setTimeout(() => {
      instructions.style.opacity = "0";
      setTimeout(() => {
        // Show the final instruction
        instructions.textContent = instructionPrompts[0]; // "write a thought, then press enter"
        instructions.style.opacity = "1";
        
        // Enable textarea only after the final instruction is visible
        setTimeout(() => {
          if (textarea) {
            textarea.disabled = false;
            textarea.style.opacity = "1";
            textarea.style.cursor = "text";
            textarea.focus(); // Give it focus to indicate it's ready
          }
          
          introSequenceComplete = true; // Mark intro sequence as complete
          console.log('Intro sequence complete - textarea enabled');
        }, 500); // Small delay after instruction appears
        
      }, fadeDuration / 2);
    }, displayDuration);
  }
  
  // Start the sequence after a brief delay
  setTimeout(showNextMessage, displayDuration);
}

// Initialize audio and start intro sequence when page loads
initializeAudio();
startIntroSequence();

// Prevent textarea from being focused during intro sequence
if (textarea) {
  textarea.addEventListener('focus', function preventFocusDuringIntro() {
    if (textarea.disabled || !introSequenceComplete) {
      textarea.blur();
    }
  });
  
  // Prevent any input during intro sequence
  textarea.addEventListener('keydown', function preventInputDuringIntro(e) {
    if (textarea.disabled || !introSequenceComplete) {
      e.preventDefault();
    }
  });
}

/********************
 * About modal      *
 ********************/
const aboutBtn = document.getElementById('about-btn');
const aboutModal = document.getElementById('about-modal');
const closeBtn = document.querySelector('.close-btn');

function showAboutModal() {
  aboutModal.style.display = 'block';
  // Trigger reflow to ensure the display change takes effect
  aboutModal.offsetHeight;
  aboutModal.classList.add('show');
}

function hideAboutModal() {
  aboutModal.classList.remove('show');
  setTimeout(() => {
    aboutModal.style.display = 'none';
  }, 300); // Wait for fade transition to complete
}

// Event listeners
if (aboutBtn) {
  aboutBtn.addEventListener('click', showAboutModal);
}

if (closeBtn) {
  closeBtn.addEventListener('click', hideAboutModal);
}

// Close modal when clicking outside the content
if (aboutModal) {
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      hideAboutModal();
    }
  });
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aboutModal.classList.contains('show')) {
    hideAboutModal();
  }
});

/********************
 * User interaction *
 ********************/
if (textarea) {
  textarea.addEventListener("keydown", (e) => {
    // Prevent Shift+Enter from creating manual line breaks
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = textarea.value.trim();
      if (!value) return;
      instructions.style.opacity = "0";

      const computed = window.getComputedStyle(textarea);
      const fontSizePx = parseFloat(computed.fontSize);
      const lineHeightPx = parseFloat(computed.lineHeight) || fontSizePx * 1.4;
      const fontFamily = computed.fontFamily;
      const fontWeight = computed.fontWeight;
      const paddingLeft = parseFloat(computed.paddingLeft) || 0;
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const textAlign = computed.textAlign;

      // Overlay original text so it can fade out gracefully
      const overlay = document.createElement("div");
      overlay.className = "overlay-text";
      overlay.innerHTML = value.replace(/\n/g, "<br>");
      const rect = textarea.getBoundingClientRect();
      // Make overlay fade timing match sprite conversion timing
      const transitionTime = 1; // 1-second quick fade
      Object.assign(overlay.style, {
        position: "absolute",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        color: computed.color,
        font: computed.font,
        textAlign: computed.textAlign,
        lineHeight: computed.lineHeight,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        transition: `opacity ${transitionTime}s ease-out`,
      });
      document.body.appendChild(overlay);

      // Fade overlay out after a short delay
      requestAnimationFrame(() => {
        overlay.style.opacity = "0";
      });
      setTimeout(() => overlay.remove(), 2);

      // Clear textarea for next input but keep cursor hidden until user focuses again
      textarea.value = "";
      // instructions.style.opacity = 0.0;

      // Disable textarea during animation
      textarea.disabled = true;
      textarea.style.opacity = "0.5";
      textarea.style.cursor = "not-allowed";

      // Keep a minimal failsafe timeout just in case something goes very wrong
      setTimeout(() => {
        // Emergency failsafe: only re-enable if something went wrong with tracking
        if (textarea.disabled) {
          console.warn("Emergency failsafe activated - cleaning up remaining sprites/particles");
          textarea.disabled = false;
          textarea.style.opacity = "1";
          textarea.style.cursor = "text";
          instructions.style.opacity = 1.0;
          
          // Clean up any remaining sprites and particles as a failsafe
          animatedSprites.forEach(item => {
            scene.remove(item.sprite);
            item.sprite.material.dispose();
            if (item.sprite.material.map) item.sprite.material.map.dispose();
          });
          animatedSprites.length = 0;
          
          particleSystems.forEach(system => {
            scene.remove(system.particles);
            system.particles.geometry.dispose();
            system.particles.material.dispose();
          });
          particleSystems.length = 0;
        }
      }, 60000); // 60 second emergency failsafe only

      // Get actual line breaks using browser's native text layout
      const paddingRight = parseFloat(computed.paddingRight) || 0;
      const contentWidth = rect.width - paddingLeft - paddingRight;
      const actualLines = getActualTextLineBreaks(value, computed, contentWidth);
      console.log('Actual lines:', actualLines);

      actualLines.forEach((wrappedLine, visualLineIndex) => {
        const lineText = wrappedLine.text;
        const widths = wrappedLine.widths;
        const totalWidth = widths.reduce((a, b) => a + b, 0);

        // Calculate line position accounting for text alignment and padding
        let lineStartX;
        if (textAlign === 'center') {
          lineStartX = rect.left + paddingLeft + (rect.width - paddingLeft * 2 - totalWidth) / 2;
        } else if (textAlign === 'right') {
          lineStartX = rect.left + rect.width - paddingLeft - totalWidth;
        } else {
          // left align (default)
          lineStartX = rect.left + paddingLeft;
        }

        // First pass: collect all non-space characters and their positions
        const lineCharacters = [];
        let xCursor = lineStartX;

        [...lineText].forEach((char, idx) => {
          const charWidth = widths[idx];
          if (char !== " ") {
            const charCenterPxX = xCursor + charWidth / 2;
            const charCenterPxY = rect.top + paddingTop + visualLineIndex * lineHeightPx + lineHeightPx / 2;
            const { x: worldX, y: worldY } = domToWorld(charCenterPxX, charCenterPxY);

            lineCharacters.push({
              char,
              worldX,
              worldY,
              charCenterPxX
            });
          }
          xCursor += charWidth;
        });

        // Second pass: create sprites with right-to-left delays
        lineCharacters.forEach((charData, charIndex) => {
          const { char, worldX, worldY } = charData;

          // Create sprite for the character
          const sprite = new SpriteText(char);
          sprite.textHeight = fontSizePx;
          sprite.color = computed.color;
          sprite.fontFace = fontFamily.split(',')[0].replace(/['"]/g, '');
          sprite.fontWeight = fontWeight;
          sprite.material.depthWrite = false;
          sprite.material.transparent = true;
          sprite.position.set(worldX, worldY, 0);
          scene.add(sprite);

          // Calculate delay from right to left within this line
          // Rightmost character (highest index) gets delay 0, leftmost gets highest delay
          const rightToLeftIndex = lineCharacters.length - 1 - charIndex;
          const delay = rightToLeftIndex * DELAY_PER_CHARACTER;

          animatedSprites.push({
            sprite,
            delay,
            startTime: performance.now() / 1000,
            worldX,
            worldY,
          });
        });
      });
    }
  });
}
