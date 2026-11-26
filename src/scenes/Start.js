export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }

    preload() {
        this.load.image('background', 'assets/bg.png');
        this.load.image('space-bg', 'assets/space-bg.png');
        this.load.image('player', 'assets/player.png');
        this.load.image('laser', 'assets/laser.png');
        this.load.image('enemy', 'assets/enemy.png');
        this.load.image('enemy-fast', 'assets/enemy-fast.png');
        this.load.image('enemy-laser', 'assets/enemy-laser.png');
        this.load.image('explosion', 'assets/explosion.png');
        this.load.audio('shoot', 'assets/shoot.ogg');
        this.load.audio('explosion-sound', 'assets/explosion.ogg');
    }

    create() {
        this.gameOver = false;

        // background
        this.add.image(640, 360, 'space-bg')
            .setDisplaySize(1280, 720);

        // player
        this.player = this.add.image(640, 620, 'player')
            .setScale(0.7);

        // keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('A,D');

        // play settings
        this.playerSpeed = 400;
        this.last_time = 0;

        // lasers fired by the player
        this.lasers = [];
        this.sound.play('shoot', { volume: 0.3 });
        this.laserSpeed = 600;

        // spacebar shooting
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );

        // enemy
        this.enemies = [];

        // enemy spawning settings
        this.lastEnemySpawn = 0;
        this.nextEnemySpawn = 1000;
        this.enemySpawnCooldown = 1200;

        // player score
        this.score = 0;

        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold'
        });

        this.lastShotTime = 0;
        this.shootCooldown = 250; // milliseconds

        // player health
        this.health = 3;

        this.healthText = this.add.text(20, 55, 'Health: 3', {
            fontSize: '24px',
            color: '#ff6666',
            fontStyle: 'bold'
        });

        this.waveText = this.add.text(20, 90, 'Wave: 1', {
            fontSize: '24px',
            color: '#ffffff'
        });

        // projectiles fired by enemies
        this.enemyBullets = [];
        this.enemyBulletSpeed = 280;

        // enemy shooting timer
        this.lastEnemyShot = 0;
        this.enemyShootCooldown = 1000;

        // temporary protection after being hit
        this.lastPlayerHit = -1000;
        this.playerInvulnerability = 1000;

        // waves
        this.wave = 1;
        this.enemiesToSpawn = 5;
        this.enemiesSpawned = 0;
        this.waveDelay = 0;

        // restart
        this.restartKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.R
        );

        this.waveAnnouncement = this.add.text(
            640, 300, '', {
            fontSize: '48px',
            color: '#00ffff',
            fontStyle: 'bold'
        }
        ).setOrigin(0.5);

        this.waveAnnouncement.setDepth(10);
    }

    update(time) {
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.scene.restart();
            }
            return;
        }

        let dt = (time - this.last_time) / 1000;
        this.last_time = time;

        // player left and right
        if (this.cursors.left.isDown || this.keys.A.isDown) {
            this.player.x -= this.playerSpeed * dt;
        }

        if (this.cursors.right.isDown || this.keys.D.isDown) {
            this.player.x += this.playerSpeed * dt;
        }

        // keep player inside the screen
        const halfWidth = this.player.displayWidth / 2;

        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            halfWidth,
            1280 - halfWidth
        );

        // shoot while holding spacebar
        if (
            this.spaceKey.isDown &&
            time - this.lastShotTime >= this.shootCooldown
        ) {
            this.shootLaser();
            this.lastShotTime = time;
            this.sound.play('shoot', { volume: 0.3 });
        }

        // move lasers upward and remove lasers off-screen
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];

            laser.y -= this.laserSpeed * dt;

            if (laser.y < -laser.displayHeight) {
                laser.destroy();
                this.lasers.splice(i, 1);
            }
        }

        // waves difficulty increase
        if (
            this.enemiesSpawned < this.enemiesToSpawn &&
            time > this.nextEnemySpawn
        ) {
            this.spawnEnemy();
            this.enemiesSpawned++;
            this.nextEnemySpawn = time + 1200;
        }

        // move enemies
        const waveSpeedMultiplier = 1 + (this.wave - 1) * 0.1;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.y += enemy.speed * waveSpeedMultiplier * dt;

            // zigzag movement for the fast enemy
            if (enemy.type === 'fast') {
                enemy.x += Math.sin(time / 150) * 180 * waveSpeedMultiplier * dt;
                enemy.x = Phaser.Math.Clamp(enemy.x, 30, 1250);
            }

            // each enemy fire at intervals
            if (time >= enemy.nextShot) {
                const bullet = this.add.image(
                    enemy.x,
                    enemy.y + enemy.displayHeight / 2,
                    'enemy-laser'
                );

                // point the laser downward
                bullet.setRotation(Math.PI);
                bullet.setScale(0.8);

                this.enemyBullets.push(bullet);

                // enemy's next shot
                enemy.nextShot = time + Phaser.Math.Between(1200, 2200);
            }

            // remove enemies that leave the bottom
            if (enemy.y > 760) {
                enemy.destroy();
                this.enemies.splice(i, 1);
            }
        }


        // check collisions between lasers and enemies
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];

            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];

                // check whether the laser overlaps the enemy
                if (
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        laser.getBounds(),
                        enemy.getBounds()
                    )
                ) {
                    // destroy both objects
                    laser.destroy();
                    const explosion = this.add.image(
                        enemy.x,
                        enemy.y,
                        'explosion'
                    );

                    explosion.setScale(0.5);
                    explosion.setDepth(5);

                    this.tweens.add({
                        targets: explosion,
                        scale: 1,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => explosion.destroy()
                    });
                    enemy.destroy();
                    this.sound.play('explosion-sound', { volume: 0.5 });

                    // remove them from their arrays
                    this.lasers.splice(i, 1);
                    this.enemies.splice(j, 1);

                    // award points
                    if (enemy.type === 'fast') {
                        this.score += 20;
                    } else {
                        this.score += 10;
                    }

                    // update the score display
                    this.scoreText.setText('Score: ' + this.score);

                    break;

                }
            }
        }


        // move enemy bullets and check for player hits
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];

            bullet.y += this.enemyBulletSpeed * dt;

            // remove bullets that leave the screen
            if (bullet.y > 760) {
                bullet.destroy();
                this.enemyBullets.splice(i, 1);
                continue;
            }

            // damage the player if hit, with temporary invulnerability
            if (
                time - this.lastPlayerHit >= this.playerInvulnerability &&
                Phaser.Geom.Intersects.RectangleToRectangle(
                    bullet.getBounds(),
                    this.player.getBounds()
                )
            ) {
                bullet.destroy();
                this.enemyBullets.splice(i, 1);

                this.health--;
                this.healthText.setText('Health: ' + this.health);
                this.lastPlayerHit = time;
                this.tweens.killTweensOf(this.player);

                this.player.setAlpha(1);

                this.tweens.add({
                    targets: this.player,
                    alpha: 0.3,
                    duration: 150,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => {
                        this.player.setAlpha(1);
                    }
                });

                if (this.health <= 0) {
                    this.gameOver = true;

                    this.add.text(640, 360, 'GAME OVER', {
                        fontSize: '64px',
                        color: '#ff4444',
                        fontStyle: 'bold'
                    }).setOrigin(0.5);

                    this.add.text(640, 420, 'Final Score: ' + this.score, {
                        fontSize: '28px',
                        color: '#ffffff'
                    }).setOrigin(0.5);

                    this.add.text(640, 480, 'Press R to Restart', {
                        fontSize: '28px',
                        color: '#ffffff'
                    }).setOrigin(0.5);
                }
            }
        }
        if (
            this.enemiesSpawned >= this.enemiesToSpawn &&
            this.enemies.length === 0
        ) {
            this.wave++;
            this.enemiesToSpawn += 2;
            this.enemiesSpawned = 0;

            this.waveText.setText('Wave: ' + this.wave);

            this.waveAnnouncement.setText('WAVE ' + this.wave);
            this.waveAnnouncement.setAlpha(1);

            this.tweens.killTweensOf(this.waveAnnouncement);

            this.tweens.add({
                targets: this.waveAnnouncement,
                alpha: 0,
                duration: 1500,
                delay: 500
            });

            this.nextEnemySpawn = time + 2000;
        }

    }

    shootLaser() {
        const laser = this.add.image(
            this.player.x,
            this.player.y - this.player.displayHeight / 2,
            'laser'
        );

        laser.setScale(0.8);
        this.lasers.push(laser);
    }

    spawnEnemy() {
        // choose an enemy type randomly
        const isFast = Math.random() < 0.4;
        const type = isFast ? 'fast' : 'normal';
        const texture = isFast ? 'enemy-fast' : 'enemy';

        const enemy = this.add.image(
            Phaser.Math.Between(50, 1230),
            -40,
            texture
        );

        enemy.setScale(0.7);
        enemy.type = type;
        enemy.speed = isFast ? 180 : 100;

        enemy.nextShot = this.time.now + Phaser.Math.Between(800, 1800);
        this.enemies.push(enemy);
    }
}
