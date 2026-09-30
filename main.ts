// ============================================================
// 隕石シューター
// micro:bit V2 + micro:bit Retro Arcade 向け 縦型シューティング
// MakeCode Arcade（JavaScript / TypeScript モード）用
// ============================================================

// ---------- スプライトの種類 ----------
// Player と Projectile は標準で用意されているので、隕石と文字表示用を追加する
namespace SpriteKind {
    export const Meteor = SpriteKind.create()
    export const Label = SpriteKind.create()
}

// ---------- 定数（ゲームバランスの調整用） ----------
const PLAYER_SPEED = 90              // 飛行船の左右移動速度
const PLAYER_START_LIFE = 3          // 開始時のライフ
const INVINCIBLE_TIME_MS = 1000      // ダメージ後の無敵時間（ミリ秒）
const BLINK_INTERVAL_MS = 100        // 無敵中の点滅間隔（ミリ秒）

// 当たり判定の大きさ（数字を小さくすると判定が狭くなる）
const PLAYER_HITBOX_HALF_WIDTH = 4   // 飛行船の判定の横幅の半分（4なら幅8ピクセル）
const PLAYER_HITBOX_HALF_HEIGHT = 5  // 飛行船の判定の高さの半分（5なら高さ10ピクセル）
const METEOR_HITBOX_MARGIN = 2       // 隕石の見た目より何ピクセル内側で判定するか
const LASER_HITBOX_HALF_WIDTH = 1    // 弾の判定の横幅の半分
const LASER_HITBOX_HALF_HEIGHT = 3   // 弾の判定の高さの半分

const PROJECTILE_SPEED = 120         // 弾の速度
const SHOT_COOLDOWN_MS = 180         // 連射間隔の最小値（ミリ秒）
const MAX_PROJECTILES = 4            // 画面内に存在できる弾の最大数

const MAX_METEORS = 12               // 画面内に存在できる隕石の最大数
const BASE_METEOR_SPEED = 30         // 隕石の基本落下速度
const METEOR_SPEED_STEP = 6          // レベルアップごとの速度上昇量
const MAX_METEOR_SPEED = 78          // 落下速度の上限
const BASE_SPAWN_INTERVAL_MS = 1300  // 隕石の基本生成間隔（ミリ秒）
const SPAWN_INTERVAL_STEP_MS = 100   // レベルアップごとの間隔短縮量
const MIN_SPAWN_INTERVAL_MS = 500    // 生成間隔の下限
const SCORE_PER_LEVEL = 10           // 何点ごとにレベルアップするか
const MAX_LEVEL = 8                  // レベルの上限

const START_BOMB_COUNT = 1           // ボムの初期所持数
const STAR_COUNT = 60                // 背景の星の数

// ---------- 画像 ----------
// 飛行船（16×16）
const playerImage = img`
    . . . . . . . 1 1 . . . . . . .
    . . . . . . 1 9 9 1 . . . . . .
    . . . . . . 1 9 9 1 . . . . . .
    . . . . . 1 9 8 8 9 1 . . . . .
    . . . . . 1 9 8 8 9 1 . . . . .
    . . . . 1 1 9 9 9 9 1 1 . . . .
    . . . 1 d 1 1 9 9 1 1 d 1 . . .
    . . 1 d d 1 1 1 1 1 1 d d 1 . .
    . 1 d d d 1 1 8 8 1 1 d d d 1 .
    1 d d d 1 1 8 8 8 8 1 1 d d d 1
    1 d d 1 1 1 1 1 1 1 1 1 1 d d 1
    1 d 1 . . 1 1 1 1 1 1 . . 1 d 1
    1 1 . . . . 1 d d 1 . . . . 1 1
    . . . . . . 2 4 4 2 . . . . . .
    . . . . . . . 5 5 . . . . . . .
    . . . . . . . 2 2 . . . . . . .
`

// レーザー弾（2×6）
const laserImage = img`
    5 5
    1 1
    1 1
    9 9
    9 9
    8 8
`

// 小さい隕石（8×8）
const smallMeteorImage = img`
    . . e e e e . .
    . e d d e e e .
    e d e e e c e e
    e e e e e e c e
    e e c e e e e e
    e e e e d e e e
    . e e c e e e .
    . . e e e e . .
`

// 大きい隕石（12×12）
const largeMeteorImage = img`
    . . . . e e e e . . . .
    . . e e e d d e e e . .
    . e e d d e e e e c e .
    . e d e e e e c e e e .
    e e e e c e e e e e e e
    e e e c c e e e d e c e
    e e e e e e e d e e e e
    e c e e e e e e e c e e
    . e e e d e e c e e e .
    . e e c e e e e e e e .
    . . e e e e c e e e . .
    . . . . e e e e . . . .
`

// ---------- ゲームの状態を表す変数 ----------
let playerShip: Sprite = null
let bombLabel: Sprite = null
let levelUpLabel: Sprite = null
let level = 0
let meteorSpeed = BASE_METEOR_SPEED
let spawnIntervalMs = BASE_SPAWN_INTERVAL_MS
let lastSpawnTime = 0
let lastShotTime = 0
let invincibleUntil = 0
let bombCount = START_BOMB_COUNT
let isGameOver = false

// ============================================================
// 画面・表示まわり
// ============================================================

// 黒い宇宙に星をちりばめた背景を作る
function createStarBackground() {
    const starColors = [1, 9, 13]
    const background = image.create(scene.screenWidth(), scene.screenHeight())
    background.fill(15)
    for (let i = 0; i < STAR_COUNT; i++) {
        const starColor = starColors[randint(0, starColors.length - 1)]
        background.setPixel(
            randint(0, scene.screenWidth() - 1),
            randint(0, scene.screenHeight() - 1),
            starColor
        )
    }
    scene.setBackgroundImage(background)
}

// 影付きの文字画像を作る（小さい画面でも読みやすくするため）
function createTextImage(text: string, color: number): Image {
    const textImage = image.create(text.length * 6 + 1, 9)
    textImage.print(text, 1, 1, 15)   // 影
    textImage.print(text, 0, 0, color) // 本体
    return textImage
}

// 文字表示用スプライトの共通設定
function setupLabelSprite(label: Sprite) {
    label.setFlag(SpriteFlag.Ghost, true)            // 当たり判定なし
    label.setFlag(SpriteFlag.RelativeToCamera, true) // 画面揺れの影響を受けない
    label.z = 100                                    // 最前面に表示
}

// ボム残数の表示を作る
function createBombLabel() {
    bombLabel = sprites.create(createTextImage("BOMB:" + bombCount, 5), SpriteKind.Label)
    setupLabelSprite(bombLabel)
    bombLabel.left = 2
    bombLabel.top = 13
}

// ボム残数の表示を更新する
function updateBombLabel() {
    const color = bombCount > 0 ? 5 : 13
    bombLabel.setImage(createTextImage("BOMB:" + bombCount, color))
    bombLabel.left = 2
    bombLabel.top = 13
}

// 「LEVEL UP!」を画面中央に1秒間表示する
function showLevelUp() {
    if (levelUpLabel) {
        levelUpLabel.destroy()
    }
    levelUpLabel = sprites.create(createTextImage("LEVEL UP!", 5), SpriteKind.Label)
    setupLabelSprite(levelUpLabel)
    levelUpLabel.setPosition(scene.screenWidth() / 2, scene.screenHeight() / 2)
    levelUpLabel.lifespan = 1000 // 1秒後に自動で消える
}

// ============================================================
// プレイヤー
// ============================================================

// 飛行船を作成し、画面下部に配置する
function createPlayer() {
    playerShip = sprites.create(playerImage, SpriteKind.Player)
    playerShip.setPosition(scene.screenWidth() / 2, scene.screenHeight() - 12)
    controller.moveSprite(playerShip, PLAYER_SPEED, 0) // 左右だけに移動
    playerShip.setStayInScreen(true)                    // 画面外に出ない
}

// 無敵時間中かどうか
function isInvincible(): boolean {
    return game.runtime() < invincibleUntil
}

// 無敵時間中はプレイヤーを点滅させる
function updateInvincibleBlink() {
    if (isInvincible()) {
        const hidden = Math.floor(game.runtime() / BLINK_INTERVAL_MS) % 2 == 0
        playerShip.setFlag(SpriteFlag.Invisible, hidden)
    } else {
        playerShip.setFlag(SpriteFlag.Invisible, false)
    }
}

// プレイヤーにダメージを与える（無敵中は何もしない）
function damagePlayer() {
    if (isGameOver || isInvincible()) {
        return
    }
    // 先に無敵時間を設定して、連続ダメージを防ぐ
    invincibleUntil = game.runtime() + INVINCIBLE_TIME_MS
    music.play(music.melodyPlayable(music.zapped), music.PlaybackMode.InBackground)
    scene.cameraShake(4, 300)
    info.changeLifeBy(-1)
}

// ============================================================
// 弾
// ============================================================

// 飛行船の先端から弾を発射する
function shootProjectile() {
    if (isGameOver) {
        return
    }
    const now = game.runtime()
    // 発射間隔が短すぎる場合は撃たない
    if (now - lastShotTime < SHOT_COOLDOWN_MS) {
        return
    }
    // 画面内の弾が多すぎる場合は撃たない
    if (sprites.allOfKind(SpriteKind.Projectile).length >= MAX_PROJECTILES) {
        return
    }
    lastShotTime = now
    // createProjectileFromSprite で作った弾は、画面外に出ると自動で削除される
    const laser = sprites.createProjectileFromSprite(laserImage, playerShip, 0, -PROJECTILE_SPEED)
    laser.x = playerShip.x
    laser.bottom = playerShip.top + 3
    music.play(music.melodyPlayable(music.pewPew), music.PlaybackMode.InBackground)
}

// ============================================================
// 隕石
// ============================================================

// 画面内の隕石のコピーを返す
// （ループ中に隕石を削除しても、順番が崩れないようにするため）
function getAllMeteors(): Sprite[] {
    return sprites.allOfKind(SpriteKind.Meteor).slice()
}

// 隕石を1個作成する
function createMeteor() {
    // 画面内の隕石が多すぎる場合は作らない
    if (sprites.allOfKind(SpriteKind.Meteor).length >= MAX_METEORS) {
        return
    }
    const isLarge = Math.percentChance(25)
    const meteor = sprites.create(isLarge ? largeMeteorImage : smallMeteorImage, SpriteKind.Meteor)
    const halfWidth = Math.floor(meteor.width / 2)
    meteor.x = randint(halfWidth, scene.screenWidth() - halfWidth)
    meteor.bottom = 1
    // 隕石ごとに落下速度を少し変える（大きい隕石は少し遅め）
    let speed = meteorSpeed + randint(-5, 10)
    if (isLarge) {
        speed -= 6
    }
    meteor.vy = Math.max(speed, 15)
}

// 生成間隔が経過していたら新しい隕石を作る
function spawnMeteorsIfNeeded() {
    const now = game.runtime()
    if (now - lastSpawnTime >= spawnIntervalMs) {
        lastSpawnTime = now
        createMeteor()
    }
}

// 隕石に「処理済み」の印を付ける
// すでに処理済みなら false を返す（同じ隕石で二重に処理しないため）
// sprite.data はスプライトごとに値を保存できる入れ物
function markMeteorHandled(meteor: Sprite): boolean {
    if (meteor.data["handled"]) {
        return false
    }
    meteor.data["handled"] = true
    // 消えるエフェクト中の隕石が、弾やボムに再び反応しないようにする
    meteor.setFlag(SpriteFlag.Ghost, true)
    meteor.vy = 0
    return true
}

// 隕石を破壊してスコアを加算する
function breakMeteor(meteor: Sprite, playSound: boolean) {
    if (!markMeteorHandled(meteor)) {
        return
    }
    meteor.destroy(effects.disintegrate, 200)
    if (playSound) {
        music.play(music.melodyPlayable(music.smallCrash), music.PlaybackMode.InBackground)
    }
    addScore()
}

// 弾と隕石が触れているかを、見た目より小さい判定で調べる
function isLaserHittingMeteor(laser: Sprite, meteor: Sprite): boolean {
    const meteorHalfWidth = meteor.width / 2 - METEOR_HITBOX_MARGIN
    const meteorHalfHeight = meteor.height / 2 - METEOR_HITBOX_MARGIN
    const distanceX = Math.abs(meteor.x - laser.x)
    const distanceY = Math.abs(meteor.y - laser.y)
    return distanceX < LASER_HITBOX_HALF_WIDTH + meteorHalfWidth
        && distanceY < LASER_HITBOX_HALF_HEIGHT + meteorHalfHeight
}

// 弾に当たった隕石を破壊する
function checkProjectileMeteorCollision() {
    for (const laser of sprites.allOfKind(SpriteKind.Projectile).slice()) {
        for (const meteor of getAllMeteors()) {
            if (!meteor.data["handled"] && isLaserHittingMeteor(laser, meteor)) {
                laser.destroy()
                breakMeteor(meteor, true)
                break // この弾はもう消えたので次の弾へ
            }
        }
    }
}

// 飛行船と隕石が触れているかを、見た目より小さい判定で調べる
// 中心どうしの距離が「判定の半分の大きさの合計」より小さければ当たり
function isHittingPlayer(meteor: Sprite): boolean {
    const meteorHalfWidth = meteor.width / 2 - METEOR_HITBOX_MARGIN
    const meteorHalfHeight = meteor.height / 2 - METEOR_HITBOX_MARGIN
    const distanceX = Math.abs(meteor.x - playerShip.x)
    const distanceY = Math.abs(meteor.y - playerShip.y)
    return distanceX < PLAYER_HITBOX_HALF_WIDTH + meteorHalfWidth
        && distanceY < PLAYER_HITBOX_HALF_HEIGHT + meteorHalfHeight
}

// 飛行船に当たった隕石を削除し、ダメージを与える
function checkPlayerMeteorCollision() {
    for (const meteor of getAllMeteors()) {
        if (isHittingPlayer(meteor) && markMeteorHandled(meteor)) {
            meteor.destroy(effects.fire, 200)
            damagePlayer()
        }
    }
}

// 画面下に抜けた隕石をこっそり削除する（避けたのでダメージもスコアもなし）
function removeMeteorsPassedBottom() {
    for (const meteor of getAllMeteors()) {
        if (meteor.top >= scene.screenHeight()) {
            meteor.destroy()
        }
    }
}

// ============================================================
// ボム
// ============================================================

// 画面内の隕石をすべて破壊する（所持数があるときだけ）
function useBomb() {
    if (isGameOver || bombCount <= 0) {
        return
    }
    bombCount -= 1
    updateBombLabel()
    music.play(music.melodyPlayable(music.bigCrash), music.PlaybackMode.InBackground)
    scene.cameraShake(6, 500)
    for (const meteor of getAllMeteors()) {
        breakMeteor(meteor, false) // 効果音はボムの音だけにする
    }
}

// ============================================================
// スコアと難易度
// ============================================================

// スコアを1点加算し、必要ならレベルアップする
function addScore() {
    info.changeScoreBy(1)
    const targetLevel = Math.min(Math.floor(info.score() / SCORE_PER_LEVEL), MAX_LEVEL)
    while (level < targetLevel) {
        increaseDifficulty()
    }
}

// 難易度を1段階上げる（上限あり）
function increaseDifficulty() {
    level += 1
    meteorSpeed = Math.min(BASE_METEOR_SPEED + level * METEOR_SPEED_STEP, MAX_METEOR_SPEED)
    spawnIntervalMs = Math.max(BASE_SPAWN_INTERVAL_MS - level * SPAWN_INTERVAL_STEP_MS, MIN_SPAWN_INTERVAL_MS)
    showLevelUp()
    music.play(music.melodyPlayable(music.powerUp), music.PlaybackMode.InBackground)
}

// ============================================================
// ゲームオーバー
// ============================================================

function endGame() {
    if (isGameOver) {
        return
    }
    isGameOver = true
    controller.moveSprite(playerShip, 0, 0)          // 操作を止める
    playerShip.setFlag(SpriteFlag.Invisible, false)  // 点滅を止めて表示
    for (const meteor of getAllMeteors()) {
        meteor.destroy()
    }
    music.play(music.melodyPlayable(music.powerDown), music.PlaybackMode.UntilDone)
    game.over(false) // 標準のゲームオーバー画面（最終スコアも表示される）
}

// ============================================================
// イベントの登録（1回だけ行う）
// ============================================================

function setupEvents() {
    // Aボタン：押した瞬間だけ発射（押し続けても連射されない）
    controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
        shootProjectile()
    })

    // Bボタン：ボム
    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        useBomb()
    })

    // ライフが0になったらゲームオーバー
    info.onLifeZero(function () {
        endGame()
    })

    // 毎フレームの更新処理（タイマーはこれ1つだけ）
    // 飛行船と隕石の当たり判定もここで行う
    game.onUpdate(function () {
        if (isGameOver) {
            return
        }
        spawnMeteorsIfNeeded()
        checkProjectileMeteorCollision()
        checkPlayerMeteorCollision()
        removeMeteorsPassedBottom()
        updateInvincibleBlink()
    })
}

// ============================================================
// ゲーム開始
// ============================================================

function startGame() {
    // 状態を初期化
    level = 0
    meteorSpeed = BASE_METEOR_SPEED
    spawnIntervalMs = BASE_SPAWN_INTERVAL_MS
    bombCount = START_BOMB_COUNT
    invincibleUntil = 0
    lastShotTime = 0
    isGameOver = false

    createStarBackground()
    info.setScore(0)
    info.setLife(PLAYER_START_LIFE)
    createPlayer()
    createBombLabel()
    lastSpawnTime = game.runtime()
}

// ---------- プログラムの開始 ----------
setupEvents()
startGame()
