// 1. Initialize Kontra.js, Pointer, and Keys
kontra.init('gameCanvas');
kontra.initPointer();
kontra.initKeys();

// Helper to get canvas context and dimensions
const { canvas, context } = kontra;

// --- Game States ---
let gameState = 'startScreen'; // 'startScreen', 'playing', 'gameOver'

// --- Game Variables ---
let score = 0;
let gameTimeRemaining = 60;
let birds = [];
let particles = [];
let spawnTimer = 0;
let frameCount = 0; // General frame counter

// Difficulty Progression Variables
const initialBirdSpeed = -2;
const maxBirdSpeed = -5;
const initialSpawnInterval = 1.5 * 60; // frames
const minSpawnInterval = 0.5 * 60;   // frames
let currentBirdSpeed = initialBirdSpeed;
let currentSpawnInterval = initialSpawnInterval;
let difficultyIncreaseTimer = 0;
const difficultyIncreaseInterval = 10 * 60; // frames (10 seconds)


// --- Visuals Configuration ---
const discoPalette = ['#FF00FF', '#FFFF00', '#00FFFF', '#FF69B4', '#7D05F2', '#F8CA00', '#FFFFFF'];
const uiFont = 'bold 24px Arial';
const titleFont = 'bold 48px Arial';
const subTitleFont = 'bold 20px Arial';
const gameOverFont = 'bold 48px Arial';
const textPopColor = '#FFFFFF';
const textShadowColor = discoPalette[0];

// --- Audio System ---
let backgroundMusic = null;

function loadAndPlayBackgroundMusic(filePath = "sounds/disco_music.mp3") {
  if (backgroundMusic && !backgroundMusic.paused) return; 
  if (!backgroundMusic) {
    backgroundMusic = new Audio(filePath);
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.4; 
  }
  backgroundMusic.play().catch(error => {
    console.warn("Background music playback failed initially. User interaction may be required.", error);
    // Setup listener to play on first interaction if autoplay fails
    let playOnFirstInteraction = () => {
        if (backgroundMusic.paused) { 
            backgroundMusic.play().catch(e => console.error("Music playback failed after interaction.", e));
        }
        canvas.removeEventListener('pointerdown', playOnFirstInteraction); // Clean up
    };
    canvas.addEventListener('pointerdown', playOnFirstInteraction, { once: true });
  });
}

function toggleBackgroundMusic() {
  if (!backgroundMusic) { 
    loadAndPlayBackgroundMusic(); 
    return;
  }
  if (backgroundMusic.paused) {
    backgroundMusic.play().catch(e => console.warn("Could not resume music.", e));
  } else {
    backgroundMusic.pause();
  }
}

function playSound(soundPath) {
  // Optional: Could check if music is paused (as a proxy for global mute)
  // if (backgroundMusic && backgroundMusic.paused && gameState !== 'startScreen') return;
  const sound = new Audio(soundPath);
  sound.volume = 0.6;
  sound.play().catch(error => console.warn(`Could not play sound: ${soundPath}`, error));
}

kontra.onKey('m', function() { toggleBackgroundMusic(); });

// --- Game Logic ---
function resetGame() {
  score = 0;
  gameTimeRemaining = 60;
  birds = [];
  particles = [];
  spawnTimer = 0;
  frameCount = 0;
  difficultyIncreaseTimer = 0;
  currentBirdSpeed = initialBirdSpeed;
  currentSpawnInterval = initialSpawnInterval;

  scoreText.text = 'Score: 0';
  timerText.text = 'Time: ' + Math.ceil(gameTimeRemaining);
  gameOverText.ttl = 0; 
  restartText.ttl = 0;
  
  if (backgroundMusic && backgroundMusic.paused) {
    // Music remains paused if user paused it. It will start on click if game starts.
  } else if (backgroundMusic) {
      backgroundMusic.currentTime = 0; 
      backgroundMusic.play().catch(e=>console.warn("Error re-playing music on reset.", e));
  }
  canvas.style.cursor = 'crosshair'; // Set cursor for playing state
}

kontra.onPointerDown(function(event, object) {
  if (gameState === 'startScreen') {
    gameState = 'playing';
    resetGame(); 
    if (!backgroundMusic || backgroundMusic.paused) {
        loadAndPlayBackgroundMusic(); 
    }
  } else if (gameState === 'playing') {
    playSound("sounds/shoot.wav");
  } else if (gameState === 'gameOver') {
    gameState = 'startScreen';
    canvas.style.cursor = 'default'; // Reset cursor for start screen
    // resetGame() is called when transitioning from startScreen to playing
  }
});

// --- Background Rendering ---
const tileSize = 50; let backgroundAnimationTimer = 0;
function drawDiscoBackground() { 
  backgroundAnimationTimer++;
  for (let i = 0; i < canvas.width / tileSize; i++) {
    for (let j = 0; j < canvas.height / tileSize; j++) {
      const colorIndex = Math.floor(backgroundAnimationTimer / 10 + i + j) % (discoPalette.length -1) ;
      context.fillStyle = discoPalette[colorIndex];
      context.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
    }
  }
  const gradientCenterX = canvas.width / 2 + Math.sin(backgroundAnimationTimer / 200) * (canvas.width / 3);
  const gradientCenterY = canvas.height / 2 + Math.cos(backgroundAnimationTimer / 200) * (canvas.height / 3);
  const outerRadius = canvas.width / 2;
  const radialGradient = context.createRadialGradient(
    gradientCenterX, gradientCenterY, 0,
    gradientCenterX, gradientCenterY, outerRadius
  );
  radialGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
  radialGradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.1)');
  radialGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
  radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = radialGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

// --- Bird Sprite ---
const birdWidth = 40; const birdHeight = 30; const birdMainColor = discoPalette[2]; const birdOutlineColor = discoPalette[1];
function createDiscoBird(x, y) {
  let shineTime = 0;
  return kontra.Sprite({
    x: x, y: y, anchor: { x: 0.5, y: 0.5 }, width: birdWidth, height: birdHeight,
    dx: currentBirdSpeed,
    startY: y, amplitude: Math.random() * 40 + 20, 
    frequency: (Math.random() * 0.02 + 0.015) * (Math.random() < 0.5 ? 1 : -1),
    rotation: 0, rotationSpeed: 0.03,
    render: function() { 
      this.context.save(); this.context.translate(this.x, this.y); this.context.rotate(this.rotation);
      this.context.fillStyle = birdMainColor; this.context.beginPath();
      this.context.moveTo(0, -this.height / 2); this.context.lineTo(this.width / 2, 0);
      this.context.lineTo(this.width / 3, this.height / 2); this.context.lineTo(-this.width / 3, this.height / 2);
      this.context.lineTo(-this.width / 2, 0); this.context.closePath(); this.context.fill();
      this.context.strokeStyle = birdOutlineColor;
      this.context.lineWidth = 2 + Math.sin(shineTime * 0.2) * 1.5;
      this.context.stroke(); this.context.restore();
    },
    update: function() {
      if (gameState !== 'playing') { this.dx = 0; return; } 
      this.rotation += this.rotationSpeed; shineTime += 0.1;
      this.x += this.dx; this.y = this.startY + Math.sin(this.x * this.frequency) * this.amplitude;
      if (this.y < this.height / 2) this.y = this.height / 2;
      if (this.y > canvas.height - this.height / 2) this.y = canvas.height - this.height/2;
      if (this.x < -this.width) { this.ttl = 0; }
    },
    onDown: function() {
      if (gameState !== 'playing') return;
      this.ttl = 0; score += 10; scoreText.text = 'Score: ' + score;
      createHitEffect(this.x, this.y); playSound("sounds/hit.wav");
    }
  });
}

// --- UI Text Styling ---
function applyTextStyles(txtObj, shadowColor = textShadowColor, shadowBlur = 5) { 
    txtObj.context.font = txtObj.font; txtObj.context.fillStyle = txtObj.color;
    txtObj.context.shadowColor = shadowColor; txtObj.context.shadowBlur = shadowBlur;
    txtObj.context.shadowOffsetX = 2; txtObj.context.shadowOffsetY = 2;
}
function clearTextStyles(txtObj) { 
    txtObj.context.shadowColor = 'transparent'; txtObj.context.shadowBlur = 0;
    txtObj.context.shadowOffsetX = 0; txtObj.context.shadowOffsetY = 0;
}

// --- UI Elements ---
const scoreText = kontra.Text({
  text: 'Score: 0', font: uiFont, color: textPopColor, x: 10, y: 30, anchor: {x: 0, y: 0.5},
  render: function() { applyTextStyles(this); this.draw(); clearTextStyles(this); }
});
const timerText = kontra.Text({
  text: 'Time: ' + Math.ceil(gameTimeRemaining), font: uiFont, color: textPopColor, x: canvas.width - 10, y: 30, anchor: {x: 1, y: 0.5},
  render: function() { applyTextStyles(this); this.draw(); clearTextStyles(this); }
});
const gameOverText = kontra.Text({
  text: 'GAME OVER', font: gameOverFont, color: discoPalette[0], x: canvas.width / 2, y: canvas.height / 2 - 30, anchor: {x: 0.5, y: 0.5}, ttl: 0,
  render: function() { applyTextStyles(this, discoPalette[1], 10); this.draw(); clearTextStyles(this); }
});
const restartText = kontra.Text({ 
    text: 'Click to Restart', font: subTitleFont, color: textPopColor, x: canvas.width / 2, y: canvas.height / 2 + 30, anchor: {x: 0.5, y: 0.5}, ttl: 0,
    render: function() { applyTextStyles(this, discoPalette[2], 5); this.draw(); clearTextStyles(this); }
});
const titleText = kontra.Text({
    text: 'DISCO BIRD SHOOTOUT', font: titleFont, color: discoPalette[1], x: canvas.width/2, y: canvas.height/2 - 60, anchor: {x:0.5, y:0.5},
    render: function() { applyTextStyles(this, discoPalette[0], 10); this.draw(); clearTextStyles(this); }
});
const clickToStartText = kontra.Text({
    text: 'Click to Start!', font: subTitleFont, color: textPopColor, x: canvas.width/2, y: canvas.height/2 + 20, anchor: {x:0.5, y:0.5},
    render: function() { applyTextStyles(this); this.draw(); clearTextStyles(this); }
});
const instructionsText = kontra.Text({
    text: "'M' to Toggle Music", font: subTitleFont, color: textPopColor, x: canvas.width/2, y: canvas.height/2 + 60, anchor: {x:0.5, y:0.5},
    render: function() { applyTextStyles(this); this.draw(); clearTextStyles(this); }
});

// --- Hit Effects ---
function createHitEffect(x, y) { 
  const particleCount = 15; const baseSpeed = 2;
  for (let i = 0; i < particleCount; i++) {
    particles.push(kontra.Sprite({
      x: x, y: y, width: 5, height: 5, color: discoPalette[Math.floor(Math.random() * discoPalette.length)],
      dx: (Math.random() - 0.5) * baseSpeed * 2 + Math.sign(Math.random()-0.5)*baseSpeed*0.5,
      dy: (Math.random() - 0.5) * baseSpeed * 2 + Math.sign(Math.random()-0.5)*baseSpeed*0.5,
      ttl: Math.random() * 30 + 20,
      update: function() { this.x += this.dx; this.y += this.dy; this.opacity = this.ttl / (this.initialTtl || 30); this.width = this.height = (this.ttl / (this.initialTtl || 30)) * 5; },
      render: function() { this.context.save(); this.context.globalAlpha = this.opacity; this.context.fillStyle = this.color; this.context.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height); this.context.restore(); }
    }));
    particles[particles.length-1].initialTtl = particles[particles.length-1].ttl;
  }
}

// --- Bird Spawning ---
function spawnBird() {
  if (gameState !== 'playing') return;
  const randomY = Math.random() * (canvas.height - tileSize * 2 - birdHeight) + tileSize + birdHeight / 2;
  const newBird = createDiscoBird(canvas.width + birdWidth / 2, randomY);
  birds.push(newBird);
}

// --- Game Loop ---
const loop = kontra.GameLoop({
  update: function() {
    frameCount++; 

    if (gameState === 'playing') {
      difficultyIncreaseTimer++;
      if (difficultyIncreaseTimer >= difficultyIncreaseInterval) {
        difficultyIncreaseTimer = 0;
        if (currentSpawnInterval > minSpawnInterval) {
          currentSpawnInterval -= 5; 
        }
        if (currentBirdSpeed > maxBirdSpeed) {
          currentBirdSpeed -= 0.15; 
        }
      }

      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnBird();
        spawnTimer = currentSpawnInterval; 
      }

      if (frameCount % 60 === 0) { 
        gameTimeRemaining--;
        timerText.text = 'Time: ' + Math.ceil(gameTimeRemaining);
        if (gameTimeRemaining <= 0) {
          gameState = 'gameOver';
          timerText.text = 'Time: 0';
          gameOverText.ttl = Infinity;
          restartText.ttl = Infinity; 
          playSound("sounds/gameover.wav");
          if(backgroundMusic && !backgroundMusic.paused) backgroundMusic.pause();
          canvas.style.cursor = 'default'; // Reset cursor for game over screen
        }
      }
      birds.forEach(bird => bird.update());
    } 
    
    particles.forEach(particle => particle.update());
    birds = birds.filter(bird => bird.isAlive());
    particles = particles.filter(particle => particle.isAlive());
  },
  render: function() {
    drawDiscoBackground();

    if (gameState === 'startScreen') {
      titleText.render();
      clickToStartText.render();
      instructionsText.render();
    } else if (gameState === 'playing') {
      birds.forEach(bird => bird.render());
      particles.forEach(particle => particle.render());
      scoreText.render();
      timerText.render();
    } else if (gameState === 'gameOver') {
      birds.forEach(bird => bird.render()); 
      particles.forEach(particle => particle.render());
      scoreText.render(); 
      timerText.render(); 
      gameOverText.render();
      restartText.render();
    }
  }
});

// Initial setup
canvas.style.cursor = 'default'; // Default cursor for start screen
loop.start();
console.log("Disco Bird Shootout loaded! Press 'M' to toggle music. Click to start.");
