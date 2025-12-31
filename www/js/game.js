// Knife Hit - Expert Edition
class KnifeHit {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Game state
        this.gameState = 'start'; // start, playing, stageClear, gameover
        this.level = 1;
        this.score = 0;
        this.bestStage = parseInt(localStorage.getItem('knifeHitBest')) || 1;
        this.gamesPlayed = 0;
        this.canRevive = true;

        // Target (log)
        this.target = {
            x: 0,
            y: 0,
            radius: 80,
            rotation: 0,
            rotationSpeed: 0.02,
            direction: 1,
            knives: [],
            apples: []
        };

        // Player knife
        this.knife = {
            x: 0,
            y: 0,
            width: 12,
            height: 70,
            throwing: false,
            throwSpeed: 25,
            stuck: false
        };

        // Level config
        this.knivesToThrow = 5;
        this.knivesRemaining = 5;
        this.applesCollected = 0;

        // Effects
        this.particles = [];
        this.screenShake = 0;
        this.hitEffect = 0;

        // Boss levels
        this.bossLevels = [5, 10, 15, 20, 25];

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Input
        this.canvas.addEventListener('click', (e) => this.handleTap(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap(e);
        }, { passive: false });

        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('revive-btn').addEventListener('click', () => this.revive());

        // Stage clear tap
        document.getElementById('stage-complete').addEventListener('click', () => {
            if (this.gameState === 'stageClear') this.nextLevel();
        });

        this.updateBestDisplay();
        this.render();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Position target and knife start
        this.target.x = this.canvas.width / 2;
        this.target.y = this.canvas.height * 0.35;
        this.target.radius = Math.min(80, this.canvas.width * 0.18);

        this.resetKnifePosition();
    }

    resetKnifePosition() {
        this.knife.x = this.canvas.width / 2;
        this.knife.y = this.canvas.height - 150;
        this.knife.throwing = false;
        this.knife.stuck = false;
    }

    startGame() {
        this.gameState = 'playing';
        this.level = 1;
        this.score = 0;
        this.canRevive = true;
        this.gamesPlayed++;

        this.setupLevel();

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('stage-complete').classList.add('hidden');

        this.updateUI();
    }

    setupLevel() {
        // Clear target
        this.target.knives = [];
        this.target.apples = [];
        this.target.rotation = 0;

        // Level difficulty
        const isBoss = this.bossLevels.includes(this.level);

        if (isBoss) {
            this.knivesToThrow = 8 + Math.floor(this.level / 5);
            this.target.rotationSpeed = 0.025 + (this.level * 0.002);
            // Add existing knives on boss
            const existingKnives = 3 + Math.floor(this.level / 10);
            for (let i = 0; i < existingKnives; i++) {
                this.target.knives.push({
                    angle: (Math.PI * 2 * i) / existingKnives,
                    length: 50
                });
            }
            // Add apples on boss
            const appleCount = 2;
            for (let i = 0; i < appleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                // Make sure apple doesn't overlap with knives
                this.target.apples.push({ angle: angle });
            }
        } else {
            this.knivesToThrow = 4 + Math.floor(this.level / 3);
            this.target.rotationSpeed = 0.015 + (this.level * 0.003);

            // Occasional direction changes at higher levels
            if (this.level > 3 && Math.random() > 0.7) {
                this.target.direction = Math.random() > 0.5 ? 1 : -1;
            }
        }

        // Cap values
        this.target.rotationSpeed = Math.min(this.target.rotationSpeed, 0.08);
        this.knivesToThrow = Math.min(this.knivesToThrow, 15);

        this.knivesRemaining = this.knivesToThrow;
        this.applesCollected = 0;
        this.resetKnifePosition();
        this.updateKnivesUI();
    }

    handleTap(e) {
        if (this.gameState === 'start') {
            this.startGame();
            return;
        }

        if (this.gameState !== 'playing') return;
        if (this.knife.throwing || this.knife.stuck) return;

        this.throwKnife();
    }

    throwKnife() {
        this.knife.throwing = true;
        this.knife.stuck = false;
    }

    update() {
        if (this.gameState !== 'playing') return;

        // Rotate target
        this.target.rotation += this.target.rotationSpeed * this.target.direction;

        // Occasional direction change at higher levels
        if (this.level > 5 && Math.random() < 0.002) {
            this.target.direction *= -1;
        }

        // Update throwing knife
        if (this.knife.throwing && !this.knife.stuck) {
            this.knife.y -= this.knife.throwSpeed;

            // Check collision with target
            const dist = this.getDistance(
                this.knife.x, this.knife.y - this.knife.height / 2,
                this.target.x, this.target.y
            );

            if (dist <= this.target.radius + 10) {
                // Check collision with other knives
                if (this.checkKnifeCollision()) {
                    this.gameOver();
                    return;
                }

                // Check apple collection
                this.checkAppleCollection();

                // Stick knife to target
                this.stickKnife();
            }
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life -= 0.02;
            return p.life > 0;
        });

        // Decay effects
        this.screenShake *= 0.9;
        this.hitEffect *= 0.9;
    }

    checkKnifeCollision() {
        const knifeAngle = Math.atan2(
            this.knife.y - this.target.y,
            this.knife.x - this.target.x
        ) - this.target.rotation;

        for (const knife of this.target.knives) {
            let angleDiff = Math.abs(knifeAngle - knife.angle);
            // Normalize angle difference
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (angleDiff < 0.2) { // Collision threshold
                return true;
            }
        }
        return false;
    }

    checkAppleCollection() {
        const knifeAngle = Math.atan2(
            this.knife.y - this.target.y,
            this.knife.x - this.target.x
        ) - this.target.rotation;

        this.target.apples = this.target.apples.filter(apple => {
            let angleDiff = Math.abs(knifeAngle - apple.angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (angleDiff < 0.3) {
                // Collected!
                this.applesCollected++;
                this.score += 50;
                this.createAppleParticles(apple.angle);
                return false;
            }
            return true;
        });
    }

    stickKnife() {
        this.knife.stuck = true;
        this.knife.throwing = false;

        // Calculate angle relative to target
        const angle = Math.atan2(
            this.knife.y - this.target.y,
            this.knife.x - this.target.x
        ) - this.target.rotation;

        this.target.knives.push({
            angle: angle,
            length: 50
        });

        this.knivesRemaining--;
        this.score += 10;
        this.screenShake = 8;
        this.hitEffect = 1;

        this.createHitParticles();
        this.updateUI();
        this.updateKnivesUI();

        if (this.knivesRemaining <= 0) {
            // Stage complete!
            setTimeout(() => this.stageComplete(), 300);
        } else {
            // Reset for next throw
            setTimeout(() => this.resetKnifePosition(), 150);
        }
    }

    stageComplete() {
        this.gameState = 'stageClear';

        const bonus = this.level * 50 + this.applesCollected * 100;
        this.score += bonus;

        document.getElementById('stage-points').textContent = bonus;
        document.getElementById('stage-complete').classList.remove('hidden');

        // Update best
        if (this.level > this.bestStage) {
            this.bestStage = this.level;
            localStorage.setItem('knifeHitBest', this.bestStage);
        }
    }

    nextLevel() {
        this.level++;
        this.gameState = 'playing';
        document.getElementById('stage-complete').classList.add('hidden');
        this.setupLevel();
        this.updateUI();
    }

    gameOver() {
        this.gameState = 'gameover';
        this.screenShake = 20;

        // Explosion effect
        this.createExplosionParticles();

        // Update best
        if (this.level > this.bestStage) {
            this.bestStage = this.level;
            localStorage.setItem('knifeHitBest', this.bestStage);
        }

        setTimeout(() => {
            document.getElementById('final-stage').textContent = this.level;
            document.getElementById('final-score').textContent = this.score;
            document.getElementById('gameover-screen').classList.remove('hidden');
            document.getElementById('revive-btn').style.display = this.canRevive ? 'block' : 'none';

            // Show ad every 3 games
            if (this.gamesPlayed % 3 === 0 && window.AdManager) {
                window.AdManager.showInterstitial();
            }
        }, 500);
    }

    revive() {
        if (window.AdManager) {
            window.AdManager.showRewarded(() => this.doRevive());
        } else {
            this.doRevive();
        }
    }

    doRevive() {
        this.canRevive = false;
        this.gameState = 'playing';
        this.knivesRemaining = 3; // Give 3 more knives
        document.getElementById('gameover-screen').classList.add('hidden');
        this.resetKnifePosition();
        this.updateKnivesUI();
    }

    createHitParticles() {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: this.knife.x,
                y: this.knife.y - this.knife.height / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                size: Math.random() * 4 + 2,
                color: '#8B4513',
                life: 1
            });
        }
    }

    createAppleParticles(angle) {
        const x = this.target.x + Math.cos(angle + this.target.rotation) * (this.target.radius + 20);
        const y = this.target.y + Math.sin(angle + this.target.rotation) * (this.target.radius + 20);

        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: Math.random() * 6 + 3,
                color: i % 2 === 0 ? '#ff4444' : '#44ff44',
                life: 1
            });
        }
    }

    createExplosionParticles() {
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            this.particles.push({
                x: this.target.x,
                y: this.target.y,
                vx: Math.cos(angle) * (5 + Math.random() * 5),
                vy: Math.sin(angle) * (5 + Math.random() * 5),
                size: Math.random() * 8 + 4,
                color: '#ff6b6b',
                life: 1
            });
        }
    }

    getDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    updateUI() {
        document.getElementById('level').textContent = this.level;
        document.getElementById('score').textContent = this.score;
    }

    updateBestDisplay() {
        document.getElementById('best-stage').textContent = this.bestStage;
    }

    updateKnivesUI() {
        const container = document.getElementById('knives-left');
        container.innerHTML = '';

        for (let i = 0; i < this.knivesToThrow; i++) {
            const div = document.createElement('div');
            div.className = 'knife-indicator' + (i >= this.knivesRemaining ? ' used' : '');
            container.appendChild(div);
        }
    }

    render() {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Screen shake
        ctx.save();
        if (this.screenShake > 0.5) {
            ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }

        // Draw target (log)
        this.drawTarget();

        // Draw knife being thrown or ready
        if (!this.knife.stuck && this.gameState === 'playing') {
            this.drawKnife(this.knife.x, this.knife.y, 0);
        }

        // Draw particles
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Hit effect (white flash)
        if (this.hitEffect > 0.1) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.hitEffect * 0.3})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        ctx.restore();

        this.update();
        requestAnimationFrame(() => this.render());
    }

    drawTarget() {
        const ctx = this.ctx;
        const { x, y, radius, rotation } = this.target;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Log shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(4, 4, radius, 0, Math.PI * 2);
        ctx.fill();

        // Log main (wood texture)
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, '#8B5A2B');
        gradient.addColorStop(0.7, '#6B4423');
        gradient.addColorStop(1, '#4a3520');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Wood rings
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        for (let r = 20; r < radius; r += 20) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Center dot
        ctx.fillStyle = '#4a3520';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw apples
        this.target.apples.forEach(apple => {
            const ax = Math.cos(apple.angle) * (radius + 25);
            const ay = Math.sin(apple.angle) * (radius + 25);

            // Apple
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(ax, ay, 15, 0, Math.PI * 2);
            ctx.fill();

            // Stem
            ctx.fillStyle = '#4a3520';
            ctx.fillRect(ax - 2, ay - 20, 4, 8);

            // Leaf
            ctx.fillStyle = '#44aa44';
            ctx.beginPath();
            ctx.ellipse(ax + 6, ay - 16, 6, 4, 0.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw stuck knives
        this.target.knives.forEach(knife => {
            ctx.save();
            ctx.rotate(knife.angle);
            this.drawKnife(0, -radius - knife.length + 15, 0, true);
            ctx.restore();
        });

        ctx.restore();
    }

    drawKnife(x, y, rotation, isStuck = false) {
        const ctx = this.ctx;
        const { width, height } = this.knife;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Blade shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-width / 2 + 2, -height / 2 + 2, width, height * 0.6);

        // Blade
        const bladeGradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
        bladeGradient.addColorStop(0, '#aaa');
        bladeGradient.addColorStop(0.5, '#fff');
        bladeGradient.addColorStop(1, '#aaa');
        ctx.fillStyle = bladeGradient;
        ctx.beginPath();
        ctx.moveTo(-width / 2, height * 0.1);
        ctx.lineTo(0, -height / 2);
        ctx.lineTo(width / 2, height * 0.1);
        ctx.lineTo(width / 2, height * 0.1);
        ctx.closePath();
        ctx.fill();

        // Handle
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(-width / 2, height * 0.05, width, height * 0.45);

        // Handle detail
        ctx.fillStyle = '#6B4423';
        ctx.fillRect(-width / 2 + 2, height * 0.15, width - 4, 5);
        ctx.fillRect(-width / 2 + 2, height * 0.3, width - 4, 5);

        ctx.restore();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.game = new KnifeHit();
});
