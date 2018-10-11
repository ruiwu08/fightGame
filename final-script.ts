import {
    Sprite,
    Container,
    Application,
    Rectangle,
    Circle,
    Graphics,
    DisplayObject,
    Text,
    interaction,
    Point,
    
} from "pixi.js";

import * as bumper from "./bump/src/bump";
import { print } from "introcs";

let b: bumper.Bump = new bumper.Bump;

// TODO: 
//     Make victory screen. 
//     Make player stocks and reset upon player death.
//     Make charging animation.
//     Make dodging animation.
//     Make UI with player name and health and rounds won.
//     Make things look prettier.
//     Balance Changes
//     Make new stages.


/* Keycodes:
*   Player 1: w: 87, s: 83, a: 65, d: 68, r: 82, t: 84 
*   Player 2: i: 73, k: 75, j: 74, l: 76, p: 80, [: 219  
*/

let appSize: number = 550;
let UIheight: number = 100;
let playerSize: number = 50;
let playerSpeed: number = 4;
let bulletDuration: number = 3;

let players: Player[] = [];
let bullets: Bullet[] = [];
let bulletCodes: number[] = [];
let bulletNum: number = 0;
let obstacles: Obstacle[] = [];

let app: Application = new Application(appSize, appSize + UIheight);
document.body.appendChild(app.view);

async function main(): Promise<void> {
    makeArena();
    makeUI();

    let kris: Player = new Player("Kris", Sprite.fromImage("./kris.png"), 100 , 100 + UIheight, 0x4A5FB4);
    kris.setKeys(87, 83, 65, 68, 82, 84);
    kris.setHealth(100);
    kris.setStamina(100);
    kris.makeBars(appSize * 1/20);
    let fred: Player = new Player("Fred", Sprite.fromImage("./fbrooks.jpg"), appSize - 100, appSize - 100 + UIheight, 0xFF6347);
    fred.setKeys(73, 75, 74, 76, 80, 219);
    fred.setHealth(100);
    fred.setStamina(100);
    fred.makeBars(appSize * 11/20);



    let mainTicker: PIXI.ticker.Ticker = app.ticker.add(function(delta: number): void{
        keyManager(kris, fred);
        fred.ticker();
        kris.ticker();
        bullets.forEach(bullet => {
            bullet.ticker();
        });
    });
};

class Player {
    upKey: number; downKey: number; leftKey: number; rightKey: number; shootKey: number; dodgeKey: number;
    name: string;
    velocity: number;

    charge: number;
    charging: boolean;
    color: number;

    dodging: boolean;
    dodgeCount: number;

    rotation: number;
    keysPressed: number[];

    health: number;
    healthBar: Graphics;
    stamina: number;
    staminaBar: Graphics;
    overheatBar: Graphics;
    overHeated: boolean;

    sprite: Sprite;
    aimIndicator: Graphics;
    bulletIndicator: Graphics[];
    constructor(name: string, sprite: Sprite, x: number, y: number, color: number){
        this.name = name;
        this.sprite = sprite;
        this.sprite.anchor.set(0.5, 0.5);
        this.sprite.width = playerSize;
        this.sprite.height = playerSize;
        this.sprite.x = x;
        this.sprite.y = y;
        app.stage.addChild(this.sprite);
        obstacles.forEach(obs => {
            b.rectangleCollision(this.sprite, obs.image);
        });
        this.makeAimIndicator(color);
        this.bulletIndicator = [];
        this.color = color;

        this.velocity = playerSpeed / (obstacles.length + 1);

        this.charge = 2;
        this.charging = false;
        this.overHeated = false;

        this.dodging = false;
        this.dodgeCount = 0;

        this.rotation = 0;
        this.keysPressed = [];  

        players.push(this);
    }

    // Makes health and stamina bars
    makeBars(x: number){
        this.healthBar = makeRectangle(x, UIheight/2 - 7.5, appSize * 2/5, 15, 0xFF0000, 0x000000, 1);
        this.staminaBar = makeRectangle(x, UIheight * 3/4 - 7.5, appSize * 2/5, 15, 0xFFFF00, 0x000000, 1);
        this.overheatBar = makeRectangle(x, UIheight * 3/4 - 7.5, appSize * 2/5, 15, 0xFFA500, 0x000000, 1)
    }

    // Creates an arrow showing the direction the player is facing
    makeAimIndicator(color: number){
        this.aimIndicator = new PIXI.Graphics();
        this.aimIndicator.lineStyle(3, color, 1);
        this.aimIndicator.moveTo(-this.sprite.width/5, -this.sprite.height/1.25);
        this.aimIndicator.lineTo(0, -this.sprite.height);
        this.aimIndicator.lineTo(this.sprite.width/5, -this.sprite.height/1.25);
        this.aimIndicator.position.x = this.sprite.x;
        this.aimIndicator.position.y = this.sprite.y;
        app.stage.addChild(this.aimIndicator);
    }

    makeBulletIndicator(){
        if(this.bulletIndicator.length >= 1){
            app.stage.removeChild(this.bulletIndicator[0]);
            this.bulletIndicator.splice(0, 1);
        }
        if(this.charging){
            this.bulletIndicator.push(makeCircle(this.sprite.x, this.sprite.y, this.charge, this.color));
        }
    }
    // Moves and orients the indicator according to player position and rotation
    moveIndicators(){
        this.aimIndicator.position.x = this.sprite.x;
        this.aimIndicator.position.y = this.sprite.y;

        this.aimIndicator.rotation = this.rotation;
    }

    // Sets player health. Useful in the future when variable healths are implemented.
    setHealth(health: number){
        this.health = health;
    }

    // Sets the stamina of the player. Useful in the future when variable staminas are implemented;
    setStamina(stamina: number){
        this.stamina = stamina;
    }

    // Helper function that removes health. Health cannot fall below 0.
    // Temporarily removes player from game as game over.
    removeHealth(x: number){
        if(this.health > 0){
            this.health -= x;
        } else {
            this.health = 0;
            app.stage.removeChild(this.sprite);
            app.stage.removeChild(this.aimIndicator);
            this.setKeys(0, 0, 0, 0, 0, 0,);
        }
    }

    // Helper function that removes stamina. Stamina cannot fall below 0.
    removeStamina(x: number){
        if(this.stamina > 0){
            this.stamina -= x;
        } else {
            this.stamina = 0;
        }

    }

    // Updates the status bars in the UI.
    statUpdator(){
        if(!this.overHeated){
            app.stage.removeChild(this.overheatBar);
        } else {
            app.stage.addChild(this.overheatBar);
        }
        if(this.stamina < 0){
            this.overHeated = true;
        }
        if(this.stamina >= 20){
            this.overHeated = false;
        }
        if(this.stamina <= 0){
            this.staminaBar.width = 0;
        } else {
            this.staminaBar.width = appSize * (2/5) * (this.stamina / 100);
            this.overheatBar.width = appSize * (2/5) * (this.stamina / 100);
        }
        if(this.health <= 0){
            this.healthBar.width = 0;
        } else {
            this.healthBar.width = appSize * (2/5) * (this.health / 100);
        }

    }

    // Regens 0.25 stamina per tick. Max stamina = 100;
    staminaRegen(){
        if(this.stamina < 100){
            if(this.overHeated){
                this.stamina += 0.125;
            } else {
                this.stamina += 0.25;
            }
        } else {
            this.stamina = 100;
        }
    }

    // Sets controls for the player.
    setKeys(upKey: number, downKey: number, leftKey: number, rightKey: number, shootKey: number, dodgeKey: number): void{
        this.upKey = upKey;
        this.downKey = downKey;
        this.leftKey = leftKey;
        this.rightKey = rightKey;
        this.shootKey = shootKey;
        this.dodgeKey = dodgeKey;
    }

    // Handles player movement across screen.
    // Slows down the player if they are charging.
    // Slows down the player if they are overheated.
    movement(): void {
        if(!this.dodging){
            this.keysPressed.forEach(key => {
                if(key === this.upKey){
                    obstacles.forEach(obs => {
                        if(b.rectangleCollision(this.sprite, obs.image) !== "bottom"){
                            if(this.charging){
                                this.sprite.y -= this.velocity * 0.5;
                            } else if (this.overHeated){
                                this.sprite.y -= this.velocity * 0.5;
                            } else {
                                this.sprite.y -= this.velocity;
                            }
                        } 
                    });
                }
                if(key === this.downKey){
                    obstacles.forEach(obs => {
                        if(b.rectangleCollision(this.sprite, obs.image) !== "top"){
                            if(this.charging){
                                this.sprite.y += this.velocity * 0.5;
                            } else if (this.overHeated){
                                this.sprite.y += this.velocity * 0.5;
                            } else {
                                this.sprite.y += this.velocity;
                            }
                        }
                    });
                }
                if(key === this.leftKey){
                    obstacles.forEach(obs => {
                        if(b.rectangleCollision(this.sprite, obs.image) !== "right"){
                            if(this.charging){
                                this.sprite.x -= this.velocity * 0.5;
                            } else if (this.overHeated){
                                this.sprite.x -= this.velocity * 0.5;
                            } else {
                                this.sprite.x -= this.velocity;
                            }
                        }
                    });
                }
                if(key === this.rightKey){
                    obstacles.forEach(obs => {
                        if(b.rectangleCollision(this.sprite, obs.image) !== "left"){
                            if(this.charging){
                                this.sprite.x += this.velocity * 0.5;
                            } else if (this.overHeated){
                                this.sprite.x += this.velocity * 0.5;
                            } else {
                                this.sprite.x += this.velocity;
                            }
                        } 
                    });
                }
            });
        }
    }

    // Builds the players charge and shoots the bullet based on charge size.
    chargeHandle(): void{
        if(this.charging && !this.overHeated){
            this.charge += 1/18;
            this.removeStamina(0.325);
            if(this.charge >= 10){
                this.charge = 10;
            }
            if(this.stamina <= 0){
                this.overHeated = true;
                this.shoot();
            }
        } 
    }

    // Shoots a bullet based on how much the bullet was charged.
    shoot(): void{
        this.removeStamina(this.charge * 2 + 1);
        let bullet: Bullet = new Bullet(this.charge, this.sprite.x, this.sprite.y, this.rotation, this, this.color);
        this.charge = 2;
        this.bulletIndicator.forEach(elt => {
            app.stage.removeChild(elt);
        });
    }

    //Checks how many movement keys are pressed. Used in rotationUpdator().
    getMovementKeys(): number[] {
        let movementKeysPressed: number[] = [];
        this.keysPressed.forEach(key => {
            if(key === this.upKey){
                movementKeysPressed.push(this.upKey);
            } else if(key === this.downKey){
                movementKeysPressed.push(this.downKey);
            } else if(key === this.leftKey){
                movementKeysPressed.push(this.leftKey);
            } else if(key === this.rightKey){
                movementKeysPressed.push(this.rightKey);
            }
        });
        return movementKeysPressed;
    }

    // Handles player rotation.
    rotationUpdator(): void {
        if(!this.dodging){
            if(this.getMovementKeys().length > 1){
                if(this.getMovementKeys()[this.getMovementKeys().length-1] === this.upKey && this.getMovementKeys()[this.getMovementKeys().length-2] === this.rightKey ||
                this.getMovementKeys()[this.getMovementKeys().length-2] === this.upKey && this.getMovementKeys()[this.getMovementKeys().length-1] === this.rightKey){
                    this.rotation = 45 * Math.PI / 180;
                } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.rightKey && this.getMovementKeys()[this.getMovementKeys().length-2] === this.downKey ||
                this.getMovementKeys()[this.getMovementKeys().length-2] === this.rightKey && this.getMovementKeys()[this.getMovementKeys().length-1] === this.downKey){
                    this.rotation = 135 * Math.PI / 180;
                } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.downKey && this.getMovementKeys()[this.getMovementKeys().length-2] === this.leftKey ||
                this.getMovementKeys()[this.getMovementKeys().length-2] === this.downKey && this.getMovementKeys()[this.getMovementKeys().length-1] === this.leftKey){
                    this.rotation = 225 * Math.PI / 180;
                } else if(this.getMovementKeys()[this.getMovementKeys().length-1] === this.leftKey && this.getMovementKeys()[this.getMovementKeys().length-2] === this.upKey ||
                this.getMovementKeys()[this.getMovementKeys().length-2] === this.leftKey && this.getMovementKeys()[this.getMovementKeys().length-1] === this.upKey){
                    this.rotation = 315 * Math.PI / 180;
                }
            } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.upKey){
                this.rotation = 0;
            } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.rightKey){
                this.rotation = 90 * Math.PI / 180;
            } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.downKey){
                this.rotation = 180 * Math.PI / 180;
            } else if (this.getMovementKeys()[this.getMovementKeys().length-1] === this.leftKey){
                this.rotation = 270 * Math.PI / 180;
            } 
        }
    }

    // Initiates the dodge. Removes 25 stamina.
    // Cannot dodge if there is not enough stamina.
    dodgeStart(): void {
        if(this.stamina >= 20){
            this.dodging = true;
            this.removeStamina(20);
        }
    }
    
    // Controls the players movement as they dodge.
    dodgeMotions(): void{
        if(this.dodging){
            this.charge = 2;
            let xShift = this.velocity * Math.sin(this.rotation) * 3.33;
            let yShift = -this.velocity * Math.cos(this.rotation) * 3.33;
            if(xShift >= 0){
                this.sprite.rotation += 2 * Math.PI / 12;
            } else {
                this.sprite.rotation -= 2 * Math.PI / 12;
            }
            obstacles.forEach(obs => {
                if(b.rectangleCollision(this.sprite, obs.image) !== "bottom" || b.rectangleCollision(this.sprite, obs.image) !== "top"){
                    this.sprite.y += yShift;
                }
                if(b.rectangleCollision(this.sprite, obs.image) !== "left" || b.rectangleCollision(this.sprite, obs.image) !== "right"){
                    this.sprite.x += xShift;
                }
            });
            this.dodgeCount++;
        }
    }

    // Stops the player's dodging motion.
    dodgeStop(): void{
        if(this.dodgeCount >= 12){
            this.dodging = false;
            this.dodgeCount = 0;
            this.sprite.rotation = 0;
        }
    }

    // Puts all active player state handlers together to run in ticker of main function.
    ticker(): void {
        this.rotationUpdator();
        this.movement();
        this.makeBulletIndicator();
        this.chargeHandle();
        this.moveIndicators();
        this.dodgeMotions();
        this.dodgeStop();
        this.statUpdator();
        this.staminaRegen();

    }
};

class Bullet {
    code: number;
    rotation: number;
    damage: number;
    charge: number;
    speed: number;
    image: Graphics;
    owner: Player;
    life: number;
    xVelocity: number;
    yVelocity: number;
    constructor(charge: number, x: number, y: number, rotation: number, owner: Player, color: number){
        this.code = bulletNum;
        bulletCodes.push(bulletNum);
        bulletNum++;

        this.owner = owner;
        this.charge = charge;
        this.damage = charge ** 1.5;

        this.rotation = rotation + ((15*Math.PI/180) - (Math.random()*30*Math.PI/180)) * ((5 - Math.min(5, charge))/5);
        this.image = makeCircle(x, y, charge, color);
        b.contain(this.image, {x: 0, y: UIheight, width: appSize, height: appSize + UIheight}, true);
        this.speed = (charge * 1.1) + 4;
        this.life = 0;
        this.xVelocity = this.speed * Math.sin(this.rotation);
        this.yVelocity = -this.speed * Math.cos(this.rotation);
        bullets.push(this);
    }

    // Moves the bullet across the screen and bounces the bullet off of objects.
    // Bullets with less than 5 charge are deleted on contact with obstacles.
    movement(): void{
        for(let i = 0; i < obstacles.length; i++){
            let obs = obstacles[i];
            if(b.hit(this.image, obs.image)){
                if(this.charge <= 5 && !obs.clear){
                    app.stage.removeChild(this.image);
                    let j: number = bulletCodes.indexOf(this.code);
                    bullets.splice(j, 1);
                    bulletCodes.splice(j, 1);
                }
                if(!obs.clear){
                    let zone: string | undefined = b.rectangleCollision(this.image, obs.image);
                    b.circleRectangleCollision(this.image, obs.image, true);
                    switch(zone){
                        case "left":
                            this.xVelocity *= -1;
                            break;
                        case "right":
                            this.xVelocity *= -1;
                            break;
                        case "top": 
                            this.yVelocity *= -1;
                            break;
                        case "bottom":
                            this.yVelocity *= -1;
                            break;
                    }
                    break;
                }
            }
        }
        if(this.charge >= 5){
            if(this.image.x <= this.image.width || this.image.x >= appSize - this.image.width){
                this.xVelocity *= -1;
            }
            if(this.image.y <= this.image.height + UIheight - 3|| this.image.y >= appSize + UIheight - this.image.width){
                this.yVelocity *= -1;
            }
        }
        this.image.x += this.xVelocity;
        this.image.y += this.yVelocity;
    }

    // Removes the bullet if it comes in contact with a player or expires its time.
    //     Removes health from enemy player if it hits them.
    remover(): void{
        this.life++;
        for(let i: number = 0; i < players.length; i++){
            let p: Player = players[i]
            if(this.owner != p){
                if(b.rectangleCollision(this.image, p.sprite, false)){
                    p.removeHealth(this.damage);
                    
                    app.stage.removeChild(this.image);
                    let i: number = bulletCodes.indexOf(this.code);
                    bullets.splice(i, 1);
                    bulletCodes.splice(i, 1);
                }
            } else if(this.life >= bulletDuration * 60){
                app.stage.removeChild(this.image);
                let i: number = bulletCodes.indexOf(this.code);
                bullets.splice(i, 1);
                bulletCodes.splice(i, 1);
            }
        }
    }

    // Puts all active bullet state handlers together to run in ticker of main function.
    ticker(): void{
        this.movement();
        this.remover();
    }
};

// Creates an obstacle. Determines whether or not an obstacle is "clear".
// Clear obstacles block player movement but let bullets pass through.
class Obstacle {
    image: PIXI.Graphics;
    clear: boolean;
    constructor(rectangle: Graphics, clear: boolean){
        this.image = rectangle;
        this.clear = clear;
        obstacles.push(this);
    }
};

// Makes a rectangle with origin at top left corner.
function makeRectangle(x: number, y: number, width: number, height: number, backgroundColor: number, borderColor: number, borderWidth: number ) {
    var box = new PIXI.Graphics(); 
    box.beginFill(backgroundColor); 
    box.lineStyle(borderWidth , borderColor); 
    box.drawRect(0, 0, width - borderWidth, height - borderWidth); 
    box.endFill(); 
    box.position.x = x + borderWidth/2; 
    box.position.y = y + borderWidth/2; 
    app.stage.addChild(box);
    return box;
};

// Makes a rectangle with origin at top left corner, but built around center.
function makeCenteredRectangle(x: number, y: number, width: number, height: number, backgroundColor: number, borderColor: number, borderWidth: number) {
    var box = new PIXI.Graphics();
    box.beginFill(backgroundColor); 
    box.lineStyle(borderWidth , borderColor); 
    box.drawRect(0, 0, width - borderWidth, height - borderWidth); 
    box.endFill(); 
    box.position.x = x - width / 2; 
    box.position.y = y - height / 2; 
    app.stage.addChild(box);
    return box;
};

// Makes a circle with origin at center.
function makeCircle(x: number, y: number, radius: number, backgroundColor: number) {
    let circle = new PIXI.Graphics();
    circle.beginFill(backgroundColor);
    circle.drawCircle(0, 0, radius);
    circle.position.set(x, y);
    circle.endFill();
    app.stage.addChild(circle);
    return circle;
};

// Builds the arena.
function makeArena(): void {
    let backGround: Graphics = makeRectangle(0, UIheight, appSize, appSize, 0xFFFFFF, 0x000000, 0);
    let leftWall: Obstacle = new Obstacle(makeCenteredRectangle(1, appSize/2 + UIheight, 2, appSize, 0x000000, 0xFFFFFF, 0), false);
    let rightWall: Obstacle = new Obstacle(makeCenteredRectangle(appSize - 1, appSize/2 + UIheight, 2, appSize, 0x000000, 0xFFFFFF, 0), false);
    let topWall: Obstacle = new Obstacle(makeCenteredRectangle(appSize/2, 1 + UIheight, appSize, 2, 0x000000, 0xFFFFFF, 0), false);
    let bottomWall: Obstacle = new Obstacle(makeCenteredRectangle(appSize/2, appSize-1 + UIheight, appSize, 2, 0x000000, 0xFFFFFF, 0), false);
    let centralObs: Obstacle = new Obstacle(makeCenteredRectangle(appSize/2, appSize/2 + UIheight, 100, 100, 0x000000, 0xFFFFFF, 0), false);
    //let bottomLeft: Obstacle = new Obstacle(makeCenteredRectangle(appSize/4, UIheight + appSize * 3/4,50, 50, 0x000000, 0xFFFFFF, 0 ), false)
    //let topRight: Obstacle = new Obstacle(makeCenteredRectangle(appSize * 3/4, UIheight + appSize/4,50, 50, 0x000000, 0xFFFFFF, 0 ), false)
};

// Builds the UI.
function makeUI(): void{
    let backGround: Graphics = makeRectangle(0, 0, appSize, UIheight, 0x8800FF, 0x000000, 2);
    let backBar1: Graphics = makeCenteredRectangle(appSize/4, UIheight/2, appSize * 2/5, 15, 0xCCCCCC, 0x000000, 0);
    let backBar2: Graphics = makeCenteredRectangle(appSize/4, UIheight * 3/4, appSize * 2/5, 15, 0xCCCCCC, 0x000000, 0);
    let backBar3: Graphics = makeCenteredRectangle(appSize * 3/4, UIheight/2, appSize * 2/5, 15, 0xCCCCCC, 0x000000, 0);
    let backBar4: Graphics = makeCenteredRectangle(appSize * 3/4, UIheight * 3/4, appSize * 2/5, 15, 0xCCCCCC, 0x000000, 0);
    let style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 15,
        align: 'center'
    });
    let p1Name = new PIXI.Text("Kris", style);
    p1Name.x = appSize/4 - 10;
    p1Name.y = 10;
    app.stage.addChild(p1Name);
    let p2Name = new PIXI.Text("Fred", style);
    p2Name.x = appSize * 3/4 - 10;
    p2Name.y = 10;
    app.stage.addChild(p2Name);

    let instructionsBar: Graphics = makeCenteredRectangle(appSize / 2, 20, 140, 25, 0xFFFFFF, 0x000000, 2);
    instructionsBar.interactive = true;
    instructionsBar.buttonMode = true;
    instructionsBar.on('pointerdown', displayInstructions);
    app.stage.addChild(instructionsBar);
    let instructionsText: Text = new PIXI.Text("Instructions", style);
    instructionsText.x = appSize/2 - 40;
    instructionsText.y = 10;
    app.stage.addChild(instructionsText);
}

function displayInstructions () {
    print("WELCOME TO UNC COMPUTER SCIENCE'S 2 MAN BATTLE ROYALE!!!");
    print("Kris Jordan: to move use WASD. to shoot use R and to roll use T.");
    print("Fred Brooks: to move use IJKL. to shoot use P and to roll use [.");
    print("Shooting and dodging cost stamina. Use too much stamina and you will overheat! \n When overheated, you can't shoot or roll, you move slower, and your stamina regens slower.");
    print("Bullets can be charged by holding the shoot key. Charged bullets are more accurate and can ricochet. Try shooting charged shots at an angle for maximum value.");
    print("These are the core mechanics of the game. Additional features will be implemented like special abilites, customizable keys, multiple lives, different characters, and many more. Until then, have fun!");
}


// Manages what keys are currently being pressed
function keyManager(player1: Player, player2: Player): void {
    window.onkeydown = function (e): void {
        if(e.keyCode === player1.upKey){
            if(player1.keysPressed.indexOf(player1.upKey) == -1){
                player1.keysPressed.push(player1.upKey);
            }
        }
        if(e.keyCode === player1.downKey){
            if(player1.keysPressed.indexOf(player1.downKey) == -1){
                player1.keysPressed.push(player1.downKey);
            }
        }
        if(e.keyCode === player1.leftKey){
            if(player1.keysPressed.indexOf(player1.leftKey) == -1){
                player1.keysPressed.push(player1.leftKey); 
            }
        }
        if(e.keyCode === player1.rightKey){
            if(player1.keysPressed.indexOf(player1.rightKey) == -1){
                player1.keysPressed.push(player1.rightKey); 
            }
        }
        if(e.keyCode === player1.shootKey){
            if(player1.keysPressed.indexOf(player1.shootKey) == -1){
                player1.keysPressed.push(player1.shootKey);
                player1.charging = true;
            }
        }
        if(e.keyCode === player1.dodgeKey){
            if(player1.keysPressed.indexOf(player1.dodgeKey) == -1){
                player1.keysPressed.push(player1.dodgeKey);
                if(!player1.dodging){
                    player1.dodgeStart();
                }
            }
        }
        if(e.keyCode === player2.upKey){
            if(player2.keysPressed.indexOf(player2.upKey) == -1){
                player2.keysPressed.push(player2.upKey);
            }
        }
        if(e.keyCode === player2.downKey){
            if(player2.keysPressed.indexOf(player2.downKey) == -1){
                player2.keysPressed.push(player2.downKey);
            }
        }
        if(e.keyCode === player2.leftKey){
            if(player2.keysPressed.indexOf(player2.leftKey) == -1){
                player2.keysPressed.push(player2.leftKey);
            }
        }
        if(e.keyCode === player2.rightKey){
            if(player2.keysPressed.indexOf(player2.rightKey) == -1){
                player2.keysPressed.push(player2.rightKey);
            }
        }
        if(e.keyCode === player2.shootKey){
            if(player2.keysPressed.indexOf(player2.shootKey) == -1){
                player2.keysPressed.push(player2.shootKey);
                player2.charging = true;
            }
        }
        if(e.keyCode === player2.dodgeKey){
            if(player2.keysPressed.indexOf(player2.dodgeKey) == -1){
                player2.keysPressed.push(player2.dodgeKey);
                if(!player2.dodging){
                    player2.dodgeStart();
                }
            }
        }
    }
    window.onkeyup = function(e): void {
        if(e.keyCode === player1.upKey){
            let i: number = player1.keysPressed.indexOf(player1.upKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player1.downKey){
            let i: number = player1.keysPressed.indexOf(player1.downKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player1.leftKey){
            let i: number = player1.keysPressed.indexOf(player1.leftKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player1.rightKey){
            let i: number = player1.keysPressed.indexOf(player1.rightKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player1.shootKey){
            let i: number = player1.keysPressed.indexOf(player1.shootKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
                player1.charging = false;
                if(!player1.overHeated){
                    player1.shoot();
                }

            }
        }
        if(e.keyCode === player1.dodgeKey){
            let i: number = player1.keysPressed.indexOf(player1.dodgeKey);
            if(i != -1){
                player1.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player2.upKey){
            let i: number = player2.keysPressed.indexOf(player2.upKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player2.downKey){
            let i: number = player2.keysPressed.indexOf(player2.downKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player2.leftKey){
            let i: number = player2.keysPressed.indexOf(player2.leftKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player2.rightKey){
            let i: number = player2.keysPressed.indexOf(player2.rightKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
            }
        }
        if(e.keyCode === player2.shootKey){
            let i: number = player2.keysPressed.indexOf(player2.shootKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
                player2.charging = false;
                if(!player2.overHeated){
                    player2.shoot();
                }
            }
        }
        if(e.keyCode === player2.dodgeKey){
            let i: number = player2.keysPressed.indexOf(player2.dodgeKey);
            if(i != -1){
                player2.keysPressed.splice(i, 1);
            }
        }
    }
};

main();



