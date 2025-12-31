// Knife Hit - Ultimate Edition with Currency & Progression
class KnifeHit {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.loadGameData();

        // Game state
        this.gameState = 'start';
        this.level = 1;
        this.score = 0;
        this.gamesPlayed = 0;
        this.canRevive = true;
        this.sessionCoins = 0;

        // Target (log)
        this.target = {
            x: 0, y: 0, radius: 80,
            rotation: 0, rotationSpeed: 0.02, direction: 1,
            knives: [], apples: [],
            reverseTimer: 0, pauseTimer: 0
        };

        // Player knife
        this.knife = {
            x: 0, y: 0, width: 12, height: 70,
            throwing: false, throwSpeed: 25, stuck: false
        };

        // Level config
        this.knivesToThrow = 5;
        this.knivesRemaining = 5;
        this.applesCollected = 0;

        // Effects
        this.particles = [];
        this.screenShake = 0;
        this.hitEffect = 0;
        this.coinPopups = [];

        // Knife skins
        this.knifeSkins = {
            default: { blade: ['#aaa', '#fff', '#aaa'], handle: '#4a3520' },
            gold: { blade: ['#ffd700', '#ffeb3b', '#ffd700'], handle: '#8B4513' },
            ice: { blade: ['#00bcd4', '#4dd0e1', '#00bcd4'], handle: '#263238' },
            fire: { blade: ['#ff5722', '#ff9800', '#ff5722'], handle: '#3e2723' },
            neon: { blade: ['#e91e63', '#f48fb1', '#e91e63'], handle: '#1a1a2e' },
            galaxy: { blade: ['#9c27b0', '#ce93d8', '#9c27b0'], handle: '#311b92' },
            blood: { blade: ['#b71c1c', '#f44336', '#b71c1c'], handle: '#1b1b1b' },
            diamond: { blade: ['#e0f7fa', '#ffffff', '#e0f7fa'], handle: '#607d8b' }
        };

        // Boss levels every 5 stages
        this.bossLevels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

        this.init();
        this.checkDailyReward();
    }

    loadGameData() {
        const saved = localStorage.getItem('knifeHitData');
        if (saved) {
            const data = JSON.parse(saved);
            this.coins = data.coins || 0;
            this.bestStage = data.bestStage || 1;
            this.totalGames = data.totalGames || 0;
            this.currentKnife = data.currentKnife || 'default';
            this.unlockedKnives = data.unlockedKnives || ['default'];
            this.achievements = data.achievements || {};
            this.lastDaily = data.lastDaily || 0;
            this.dailyStreak = data.dailyStreak || 0;
            this.totalApples = data.totalApples || 0;
            this.totalKnivesThrown = data.totalKnivesThrown || 0;
        } else {
            this.coins = 0;
            this.bestStage = 1;
            this.totalGames = 0;
            this.currentKnife = 'default';
            this.unlockedKnives = ['default'];
            this.achievements = {};
            this.lastDaily = 0;
            this.dailyStreak = 0;
            this.totalApples = 0;
            this.totalKnivesThrown = 0;
        }
    }

    saveGameData() {
        const data = {
            coins: this.coins,
            bestStage: this.bestStage,
            totalGames: this.totalGames,
            currentKnife: this.currentKnife,
            unlockedKnives: this.unlockedKnives,
            achievements: this.achievements,
            lastDaily: this.lastDaily,
            dailyStreak: this.dailyStreak,
            totalApples: this.totalApples,
            totalKnivesThrown: this.totalKnivesThrown
        };
        localStorage.setItem('knifeHitData', JSON.stringify(data));
    }

    checkDailyReward() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const lastDate = new Date(this.lastDaily).setHours(0,0,0,0);
        const today = new Date(now).setHours(0,0,0,0);

        if (today > lastDate) {
            if (today - lastDate <= dayMs * 2) {
                this.dailyStreak++;
            } else {
                this.dailyStreak = 1;
            }

            const rewards = [30, 50, 75, 100, 150, 200, 300];
            const reward = rewards[Math.min(this.dailyStreak - 1, rewards.length - 1)];

            this.coins += reward;
            this.lastDaily = now;
            this.saveGameData();

            setTimeout(() => this.showDailyReward(reward, this.dailyStreak), 500);
        }
    }

    showDailyReward(amount, streak) {
        const popup = document.createElement('div');
        popup.className = 'daily-popup';
        popup.innerHTML = `
            <h2>DAILY REWARD!</h2>
            <p class="streak">Day ${streak} Streak!</p>
            <p class="reward">+${amount} coins</p>
            <button onclick="this.parentElement.remove()">COLLECT</button>
        `;
        document.body.appendChild(popup);
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.canvas.addEventListener('click', (e) => this.handleTap(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap(e);
        }, { passive: false });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('revive-btn').addEventListener('click', () => this.revive());
        document.getElementById('shop-btn').addEventListener('click', () => this.openShop());
        document.getElementById('close-shop').addEventListener('click', () => this.closeShop());

        document.getElementById('stage-complete').addEventListener('click', () => {
            if (this.gameState === 'stageClear') this.nextLevel();
        });

        this.updateBestDisplay();
        this.render();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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

    openShop() {
        document.getElementById('shop-screen').classList.remove('hidden');
        this.renderShop();
    }

    closeShop() {
        document.getElementById('shop-screen').classList.add('hidden');
    }

    renderShop() {
        const container = document.getElementById('shop-items');
        const prices = { gold: 200, ice: 300, fire: 400, neon: 500, galaxy: 800, blood: 600, diamond: 1500 };

        let html = '<h3>KNIVES</h3><div class="shop-grid">';
        for (const [knife, price] of Object.entries(prices)) {
            const owned = this.unlockedKnives.includes(knife);
            const equipped = this.currentKnife === knife;
            const skin = this.knifeSkins[knife];
            html += `
                <div class="shop-item ${equipped ? 'equipped' : ''}" onclick="game.buyKnife('${knife}', ${price})">
                    <div class="knife-preview" style="background: linear-gradient(${skin.blade[0]}, ${skin.blade[1]}, ${skin.blade[2]})"></div>
                    <p>${knife.toUpperCase()}</p>
                    <p class="price">${owned ? (equipped ? 'EQUIPPED' : 'SELECT') : price + ' coins'}</p>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('shop-coins-display').textContent = this.coins;
    }

    buyKnife(knife, price) {
        if (this.unlockedKnives.includes(knife)) {
            this.currentKnife = knife;
            this.saveGameData();
            this.renderShop();
            return;
        }

        if (this.coins >= price) {
            this.coins -= price;
            this.unlockedKnives.push(knife);
            this.currentKnife = knife;
            this.saveGameData();
            this.updateCoinsDisplay();
            this.renderShop();
            this.showNotification(`Unlocked ${knife.toUpperCase()} knife!`);
        } else {
            this.showNotification('Not enough coins!');
        }
    }

    showNotification(text) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.textContent = text;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }

    startGame() {
        this.gameState = 'playing';
        this.level = 1;
        this.score = 0;
        this.canRevive = true;
        this.gamesPlayed++;
        this.totalGames++;
        this.sessionCoins = 0;

        this.setupLevel();

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('stage-complete').classList.add('hidden');

        this.updateUI();
        this.saveGameData();
    }

    setupLevel() {
        this.target.knives = [];
        this.target.apples = [];
        this.target.rotation = 0;
        this.target.reverseTimer = 0;
        this.target.pauseTimer = 0;

        const isBoss = this.bossLevels.includes(this.level);

        if (isBoss) {
            this.knivesToThrow = 10 + Math.floor(this.level / 5);
            this.target.rotationSpeed = 0.03 + (this.level * 0.003);

            // More existing knives on boss
            const existingKnives = 4 + Math.floor(this.level / 8);
            for (let i = 0; i < existingKnives; i++) {
                this.target.knives.push({
                    angle: (Math.PI * 2 * i) / existingKnives,
                    length: 50
                });
            }

            // More apples = more coins
            const appleCount = 3;
            for (let i = 0; i < appleCount; i++) {
                this.target.apples.push({ angle: Math.random() * Math.PI * 2 });
            }
        } else {
            this.knivesToThrow = 5 + Math.floor(this.level / 2);
            this.target.rotationSpeed = 0.02 + (this.level * 0.004);

            // Add some apples on regular levels too
            if (this.level > 2 && Math.random() > 0.5) {
                this.target.apples.push({ angle: Math.random() * Math.PI * 2 });
            }
        }

        // HARDER mechanics at higher levels
        if (this.level > 5) {
            // Direction changes
            this.target.direction = Math.random() > 0.5 ? 1 : -1;
        }

        if (this.level > 10) {
            // Existing obstacles
            const obstacles = Math.floor(this.level / 10);
            for (let i = 0; i < obstacles; i++) {
                this.target.knives.push({
                    angle: Math.random() * Math.PI * 2,
                    length: 50
                });
            }
        }

        // Cap values for sanity
        this.target.rotationSpeed = Math.min(this.target.rotationSpeed, 0.12);
        this.knivesToThrow = Math.min(this.knivesToThrow, 20);

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
        this.totalKnivesThrown++;
    }

    addCoins(amount) {
        this.sessionCoins += amount;
        this.coins += amount;
        this.coinPopups.push({ x: this.canvas.width - 80, y: 60, amount, life: 1 });
        this.updateCoinsDisplay();
    }

    update() {
        if (this.gameState !== 'playing') return;

        // Random direction reversal at higher levels
        if (this.level > 8 && Math.random() < 0.003) {
            this.target.direction *= -1;
            this.target.reverseTimer = 30;
        }

        // Random pause at higher levels
        if (this.level > 15 && Math.random() < 0.002) {
            this.target.pauseTimer = 20 + Math.random() * 30;
        }

        if (this.target.pauseTimer > 0) {
            this.target.pauseTimer--;
        } else {
            this.target.rotation += this.target.rotationSpeed * this.target.direction;
        }

        if (this.target.reverseTimer > 0) this.target.reverseTimer--;

        // Update throwing knife
        if (this.knife.throwing && !this.knife.stuck) {
            this.knife.y -= this.knife.throwSpeed;

            const dist = this.getDistance(
                this.knife.x, this.knife.y - this.knife.height / 2,
                this.target.x, this.target.y
            );

            if (dist <= this.target.radius + 10) {
                if (this.checkKnifeCollision()) {
                    this.gameOver();
                    return;
                }
                this.checkAppleCollection();
                this.stickKnife();
            }
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life -= 0.02;
            return p.life > 0;
        });

        // Coin popups
        this.coinPopups = this.coinPopups.filter(c => {
            c.y -= 1;
            c.life -= 0.03;
            return c.life > 0;
        });

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
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff < 0.18) return true; // Slightly harder collision
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
                this.applesCollected++;
                this.totalApples++;
                this.score += 50;
                this.addCoins(10);
                this.createAppleParticles(apple.angle);
                return false;
            }
            return true;
        });
    }

    stickKnife() {
        this.knife.stuck = true;
        this.knife.throwing = false;

        const angle = Math.atan2(
            this.knife.y - this.target.y,
            this.knife.x - this.target.x
        ) - this.target.rotation;

        this.target.knives.push({ angle, length: 50 });

        this.knivesRemaining--;
        this.score += 10;
        this.addCoins(1);
        this.screenShake = 8;
        this.hitEffect = 1;

        this.createHitParticles();
        this.updateUI();
        this.updateKnivesUI();

        if (this.knivesRemaining <= 0) {
            setTimeout(() => this.stageComplete(), 300);
        } else {
            setTimeout(() => this.resetKnifePosition(), 150);
        }
    }

    stageComplete() {
        this.gameState = 'stageClear';

        const bonus = this.level * 20 + this.applesCollected * 50;
        this.score += bonus;
        this.addCoins(this.level * 5);

        document.getElementById('stage-points').textContent = `+${bonus} points`;
        document.getElementById('stage-coins').textContent = `+${this.level * 5} coins`;
        document.getElementById('stage-complete').classList.remove('hidden');

        if (this.level > this.bestStage) {
            this.bestStage = this.level;
        }

        this.checkAchievements();
        this.saveGameData();
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

        this.createExplosionParticles();

        if (this.level > this.bestStage) {
            this.bestStage = this.level;
        }

        this.checkAchievements();
        this.saveGameData();

        setTimeout(() => {
            document.getElementById('final-stage').textContent = this.level;
            document.getElementById('final-score').textContent = this.score;
            document.getElementById('session-coins').textContent = `+${this.sessionCoins} coins`;
            document.getElementById('gameover-screen').classList.remove('hidden');
            document.getElementById('revive-btn').style.display = this.canRevive ? 'block' : 'none';

            if (this.gamesPlayed % 3 === 0 && window.AdManager) {
                window.AdManager.showInterstitial();
            }
        }, 500);
    }

    checkAchievements() {
        const checks = [
            { id: 'first_game', cond: this.totalGames >= 1, reward: 30 },
            { id: 'stage_10', cond: this.bestStage >= 10, reward: 100 },
            { id: 'stage_25', cond: this.bestStage >= 25, reward: 250 },
            { id: 'stage_50', cond: this.bestStage >= 50, reward: 500 },
            { id: 'apples_25', cond: this.totalApples >= 25, reward: 75 },
            { id: 'apples_100', cond: this.totalApples >= 100, reward: 200 },
            { id: 'knives_500', cond: this.totalKnivesThrown >= 500, reward: 150 },
            { id: 'games_25', cond: this.totalGames >= 25, reward: 100 },
            { id: 'games_100', cond: this.totalGames >= 100, reward: 300 }
        ];

        for (const a of checks) {
            if (a.cond && !this.achievements[a.id]) {
                this.achievements[a.id] = true;
                this.coins += a.reward;
                this.showNotification(`Achievement! +${a.reward} coins`);
            }
        }
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
        this.knivesRemaining = 3;
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
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: Math.random() * 6 + 3,
                color: i % 2 === 0 ? '#ff4444' : '#ffd700',
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

    updateCoinsDisplay() {
        const el = document.getElementById('coins-display');
        if (el) el.textContent = this.coins;
    }

    updateBestDisplay() {
        document.getElementById('best-stage').textContent = this.bestStage;
        this.updateCoinsDisplay();
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

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake > 0.5) {
            ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }

        this.drawTarget();

        if (!this.knife.stuck && this.gameState === 'playing') {
            this.drawKnife(this.knife.x, this.knife.y, 0);
        }

        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Coin popups
        this.coinPopups.forEach(c => {
            ctx.globalAlpha = c.life;
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'right';
            ctx.fillText(`+${c.amount}`, c.x, c.y);
        });
        ctx.globalAlpha = 1;

        if (this.hitEffect > 0.1) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.hitEffect * 0.3})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Direction indicator at high levels
        if (this.gameState === 'playing' && this.target.reverseTimer > 0) {
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#ff6b6b';
            ctx.textAlign = 'center';
            ctx.fillText('REVERSE!', this.canvas.width / 2, this.canvas.height - 50);
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

        // Log main
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

        // Draw apples (now with coins)
        this.target.apples.forEach(apple => {
            const ax = Math.cos(apple.angle) * (radius + 25);
            const ay = Math.sin(apple.angle) * (radius + 25);

            // Gold coin instead of apple
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(ax, ay, 15, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.arc(ax, ay, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', ax, ay);
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
        const skin = this.knifeSkins[this.currentKnife];

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Blade shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-width / 2 + 2, -height / 2 + 2, width, height * 0.6);

        // Blade
        const bladeGradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
        bladeGradient.addColorStop(0, skin.blade[0]);
        bladeGradient.addColorStop(0.5, skin.blade[1]);
        bladeGradient.addColorStop(1, skin.blade[2]);
        ctx.fillStyle = bladeGradient;
        ctx.beginPath();
        ctx.moveTo(-width / 2, height * 0.1);
        ctx.lineTo(0, -height / 2);
        ctx.lineTo(width / 2, height * 0.1);
        ctx.closePath();
        ctx.fill();

        // Handle
        ctx.fillStyle = skin.handle;
        ctx.fillRect(-width / 2, height * 0.05, width, height * 0.45);

        // Handle detail
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(-width / 2 + 2, height * 0.15, width - 4, 3);
        ctx.fillRect(-width / 2 + 2, height * 0.3, width - 4, 3);

        ctx.restore();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new KnifeHit();
});
