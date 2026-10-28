# MASTER SPECIFICATION: DEFLECT ARENA

---

## 1. Product Requirements Document (PRD)

### 1.1 Executive Summary
**DEFLECT ARENA** is an ultra-responsive, top-down geometric duelist game built for the web. It merges the accelerating volley tension of *Lethal League* with twitch-reflex arena combat. Two players face off in an enclosed geometric arena with twin-stick movement, armed with a **Deflect Racket** and two distinct projectile types: a speed-accelerating **Vector Bolt** and an explosive, un-deflectable **Roman Candle**. 

Multiplayer is powered directly peer-to-peer via **PeerJS** (WebRTC DataChannels), delivering low-latency inputs without dedicated game servers.

### 1.2 Target Performance & Technical Guardrails
* **Framerate Target:** 60 to 144+ FPS uncapped, locked to monitor refresh rate using delta-time (`dt`) physics.
* **Latency Target:** Sub-50ms peer-to-peer transmission over direct WebRTC DataChannels.
* **System Requirements:** Near-zero GPU overhead. Pure Canvas 2D with additive blending; strictly zero `ctx.shadowBlur` to guarantee stable 144 FPS on integrated graphics.
* **Zero External Asset Overhead:** Audio synthesized entirely in runtime via the **Web Audio API**; graphics generated entirely via mathematical vectors and procedural canvas paths.

### 1.3 Core Gameplay Mechanics

```
               ┌─────────────────────────┐
               │   DEFLECT RACKET SWING  │
               └────────────┬────────────┘
                            │ Beats
                            ▼
               ┌─────────────────────────┐
               │    FAST VECTOR BOLT     │◄─────────┐
               └────────────┬────────────┘          │ Beats
                            │ Beats                 │
                            ▼                       │
               ┌─────────────────────────┐          │
               │       DODGE DASH        ├──────────┘
               └────────────┬────────────┘
                            │ Beats
                            ▼
               ┌─────────────────────────┐
               │      ROMAN CANDLE       │
               │ (Un-deflectable Bomb)   │
               └─────────────────────────┘
```

#### F-1: Movement & Spatial Traversal
* **Arena:** Fixed bounded rectangle ($1280 \times 720$ virtual coordinate space, aspect-ratio scaled to browser window) with 2–4 geometric pillars acting as deflection and cover points.
* **Movement:** 8-directional WASD/Left Stick movement with instant acceleration and responsive micro-friction.
* **Dodge Dash:** 
  * Tap `Shift` / `Space` / `L1` to dash 180 units in current movement direction.
  * Duration: 150ms.
  * **Invulnerability Frames (i-frames):** 100ms.
  * Cooldown: 1.8 seconds (visualized via radial meter around player body).

#### F-2: The Deflect Racket (Core Skill Ceiling)
* **Input:** Left Mouse Click / Right Trigger.
* **Hitbox:** A 120-degree sector extending 80 units in front of player aim direction.
* **Timing & Frames:**
  * Startup: 30ms (near-instant).
  * Active Deflect Window: 120ms.
  * **Whiff Recovery Lag:** 220ms. Missing a swing locks movement speed by 50% and disables attacks, leaving the player completely vulnerable.
* **Deflect Physics:**
  * Parrying a Vector Bolt redirects it toward the current mouse aim vector.
  * **Speed Escalation:** Multiplies current bolt velocity by $\times 1.4$.
  * **Damage Escalation:** Increases base damage by $+1$ point per rally.
  * **Visual Feedback:** Bolt shifts to the deflector’s neon color and lengthens its speed trail.

#### F-3: Weapon Systems & Heat Economy
Players possess two distinct offensive capabilities governed by a **Battery/Energy Meter** (100 Max, regenerates 15/sec):

1. **The Vector Bolt (Light / Deflectable):**
   * Cost: 15 Energy.
   * Trajectory: High-velocity straight line; ricochets off arena boundary walls up to 2 times.
   * Interaction: Can be deflected back and forth indefinitely.
2. **The Roman Candle (Heavy / Un-Deflectable / Anti-Parry):**
   * Cost: 45 Energy.
   * Trajectory: Moderate velocity projectile that bounces off arena walls.
   * Fuse: Detonates after 1.4 seconds or on direct player contact into a 120-unit circular shockwave.
   * **Un-deflectable:** Hitting an incoming Roman Candle with a Racket detonates it immediately in the swinger's face. 
   * Counterplay: Must be dodged via Dodge Dash or blocked using arena pillars.

#### F-4: Match Structure & Health Model
* **Health:** Each player has 5 HP per round.
  * Standard Bolt: 1 Base Damage (scales up with deflects).
  * Roman Candle Blast: 2 Damage + strong radial knockback.
* **Round Flow:** Best of 5 rounds (First to 3 round wins). Round resets player positions to opposite sides of the arena.

---

## 2. Technical Architecture & Implementation Guide

### 2.1 Networking & PeerJS Protocol Architecture

```
 [ PLAYER 1: HOST ]                                 [ PLAYER 2: GUEST ]
         │                                                   │
         ├────── 1. Registers Peer ID via PeerJS Cloud ──────┤
         │          (Room Code: e.g. "DFLT-8492")            │
         │                                                   │
         │◄───── 2. Guest Connects via Room Code / URL ──────┤
         │                                                   │
         ├────── 3. WebRTC RTCDataChannel Established ───────┤
         │          (Binary / Compact Array Payloads)        │
         │                                                   │
  [HOST SIMULATION]                                  [CLIENT PREDICTION]
  Runs 60Hz Physics                                  Renders local player
  Evaluates Hits/Parries                             Sends inputs @ 60Hz
  Broadcasts Full State ──────── (State Sync) ──────► Interpolates Opponent
```

#### Authority Model: Host-Authoritative P2P
To prevent desynchronization of high-speed parried projectiles, **Player 1 (Room Creator) acts as the Authoritative Host**.
* **Host Responsibilities:** Runs physics simulation, tracks projectile positions, checks collision boxes, verifies deflect frame windows, manages health/scores.
* **Guest Responsibilities:** Samples inputs (WASD, Aim Angle, Action Triggers), transmits input packets at 60Hz, renders received host state with client-side interpolation.

#### Compact Packet Schema
To maintain $\le 1$ms serialization latency, avoid verbose JSON. Network messages use flat arrays:

```javascript
// Guest -> Host (Input Packet, 60Hz)
// [seq, inputMask, aimAngleX, aimAngleY]
// inputMask bits: 0:Up, 1:Down, 2:Left, 3:Right, 4:Swing, 5:ShootBolt, 6:ShootCandle, 7:Dash
const CLIENT_INPUT = [1042, 17, 0.707, -0.707];

// Host -> Guest (World State Snapshot, 60Hz)
// [seq, [p1X, p1Y, p1Hp, p1Flags], [p2X, p2Y, p2Hp, p2Flags], [projectiles...]]
const HOST_STATE = [
  5201,
  [200, 360, 5, 0],
  [1080, 360, 4, 1], // flags bit 0: dashing, 1: swinging, 2: in-hitlag
  [
    // type (0: bolt, 1: candle), id, x, y, vx, vy, speedMult
    [0, 12, 640, 360, 850, -200, 1.4]
  ]
];
```

### 2.2 Mathematical Engine & Physics Collision Algorithms

#### A. Circle-to-Sector Collision (Racket Deflect Detection)
To detect if a projectile at $(P_x, P_y)$ with radius $R_p$ is struck by a player at $(C_x, C_y)$ aiming along unit vector $\vec{A}$ with sector radius $R_s$ and half-angle $\theta$:

```javascript
function checkDeflect(px, py, pr, cx, cy, aimAngle, sectorRadius, sectorHalfAngle) {
  const dx = px - cx;
  const dy = py - cy;
  const distSq = dx * dx + dy * dy;
  const maxDist = sectorRadius + pr;
  
  if (distSq > maxDist * maxDist || distSq < 1e-4) return false;

  const dist = Math.sqrt(distSq);
  const toProjX = dx / dist;
  const toProjY = dy / dist;
  
  const aimX = Math.cos(aimAngle);
  const aimY = Math.sin(aimAngle);
  const dot = toProjX * aimX + toProjY * aimY;

  return dot >= Math.cos(sectorHalfAngle);
}
```

#### B. Deflection Velocity Vector Reflection
When successfully deflected, the bolt velocity is not purely reflected across the normal; it is **actively redirected along the player's aim vector**:

$$\vec{V}_{\text{new}} = \begin{bmatrix} \cos(\text{aimAngle}) \\ \sin(\text{aimAngle}) \end{bmatrix} \times (\|\vec{V}_{\text{old}}\| \times 1.4)$$

### 2.3 Audio Synthesis Subsystem (Web Audio API)
Zero audio downloads. All sound effects are generated via a singleton `AudioContext`:

```javascript
const Sound = {
  ctx: new (window.AudioContext || window.webkitAudioContext)(),
  
  // High-tension vector parry sound: ascending sine chirp with fast decay
  deflect() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  },

  // Roman candle explosion: white noise buffer with lowpass filter sweep
  explode() {
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    noise.start();
  }
};
```

---

## 3. Development Task List

### Phase 1: Local Physics, Input, & Render Loop
- [ ] **Task 1.1: Fixed Coordinate Canvas Surface**
  - Implement dynamic scaling for an internal $1280 \times 720$ virtual buffer.
  - Setup delta-time loop tracking `performance.now()`.
  - *Acceptance Criteria:* Resizing the browser window scales the canvas while maintaining aspect ratio and crisp vector rendering.
- [ ] **Task 1.2: Local Twin-Stick Controller**
  - WASD movement with velocity damping/inertia.
  - Mouse aiming with directional reticle.
  - *Acceptance Criteria:* Movement feels crisp with immediate stop response; aiming follows cursor coordinates accurately.
- [ ] **Task 1.3: Deflect Swing State Machine**
  - Implement swing trigger with active frames (120ms) and whiff endlag (220ms).
  - Render vector deflection arc (cone) matching aiming angle.
  - *Acceptance Criteria:* Whiffing a swing locks player movement for 220ms; active window visually displays vector arc.
- [ ] **Task 1.4: Projectile Engine (Bolts & Roman Candles)**
  - Vector Bolt linear trajectory with wall ricochets.
  - Roman Candle physics: friction, wall bounce, 1.4s fuse timer, and circular explosion shockwave.
  - *Acceptance Criteria:* Bolts bounce predictably off walls; Roman Candles detonate into an expanding damage ring.
- [ ] **Task 1.5: Parry & Deflect Interception System**
  - Circle-to-sector collision math for bolt vs. racket.
  - Vector bolt redirection with $\times 1.4$ speed escalation.
  - Self-damage detonation trigger if racket strikes a Roman Candle.
  - *Acceptance Criteria:* Timing a swing against a bolt redirects it toward cursor at increased speed; swinging at a Roman Candle triggers instant explosion.

### Phase 2: Web Audio Synthesizer & Visual Feedback
- [ ] **Task 2.1: Procedural Web Audio Module**
  - Implement zero-dependency sound synthesis (Bolt shoot, Deflect ping, Roman Candle explosion, Dash whoosh, Hit damage).
  - *Acceptance Criteria:* All actions play distinct audio cues with zero asset loading network calls.
- [ ] **Task 2.2: Additive Visual Juice & Camera Shake**
  - Additive neon render pipeline (`globalCompositeOperation = 'lighter'`).
  - Screen shake with 4-frame rotational/translational decay on explosions and high-speed deflects.
  - Brief 2-frame hit-stop (frame pause) on successful supersonic parry.
  - *Acceptance Criteria:* Game runs at stable 144 FPS while displaying punchy hit feedback.

### Phase 3: PeerJS Multiplayer Integration
- [ ] **Task 3.1: PeerJS Session Manager**
  - Integrate PeerJS client.
  - Generate clean 4-character room codes; construct shareable invite link (`https://url#ROOM`).
  - Handle connection lifecycle (Host initialization, Guest handshake, Disconnect detection).
  - *Acceptance Criteria:* Opening invite link in a second window establishes an open `RTCDataChannel`.
- [ ] **Task 3.2: Host-Authoritative State Synchronization**
  - Host broadcasts compact game snapshots at 60Hz.
  - Guest transmits 60Hz input arrays.
  - Guest renders host world state with linear interpolation (lerp) for smooth motion.
  - *Acceptance Criteria:* Guest can aim, move, shoot, and parry with responsive feedback across local network/internet.
- [ ] **Task 3.3: Round & Match Lifecycle Management**
  - Health tracking (5 HP), round victory checks, best-of-5 score counter.
  - Inter-round resets (position recentering, projectile clears).
  - End of match victory screen with "Rematch" handshake button.
  - *Acceptance Criteria:* Match cleanly loops through rounds, declares winner, and resets seamlessly upon rematch.

---

## 4. AGENTS.md (Operational Guidelines for AI Coding Agents)

This section acts as the binding technical contract for AI agents implementing or modifying the **DEFLECT ARENA** codebase.

### 4.1 Architectural North Stars
1. **YAGNI Above All:** Do not implement features outside this specification. No chat systems, no cosmetic skins, no complex database accounts.
2. **Zero Garbage Collection in the Main Loop:**
   * Never instantiate objects (`{}`), arrays (`[]`), or functions inside `update()` or `render()`.
   * Pre-allocate entity pools (Bolts, Particles, Candles) during engine initialization and reuse instances via active flags.
3. **Strict Rendering Separation:**
   * Pure Canvas 2D context.
   * **FORBIDDEN:** `ctx.shadowBlur` and `ctx.shadowColor`. Any glow effect must be achieved using multi-pass strokes and `ctx.globalCompositeOperation = 'lighter'`.
4. **Coordinate Normalization:**
   * All gameplay physics and entity positions operate within the fixed $1280 \times 720$ coordinate system.
   * Rendering converts virtual coordinates to real screen coordinates using a single uniform scale factor:
     $$\text{scale} = \min\left(\frac{\text{window.innerWidth}}{1280}, \frac{\text{window.innerHeight}}{720}\right)$$

### 4.2 Logging & Debugging Protocol
All modules must emit structured logs using standardized prefixes so developers can triage issues via console logs:

* `[DEFLECT-INIT]` — Engine bootstrap, canvas mounting, audio unlock.
* `[DEFLECT-NET]` — PeerJS connection states, room creation, ICE status, disconnects.
* `[DEFLECT-STATE]` — Round start, scoring, HP drops, match victory.
* `[DEFLECT-WARN]` — Network packet drops, out-of-order sequence numbers, storage failures.

```javascript
// Example Logging Pattern
console.log('[DEFLECT-NET] Host connection established. Room ID:', roomId);
console.log('[DEFLECT-STATE] Player 1 damaged. Remaining HP:', p1.hp);
```

### 4.3 Code Generation Standards
* Output complete, immediately runnable files.
* Keep state unified: maintain a single `State` object for host simulation and a single `Client` object for networking.
* Clean teardown: any event listener bound to `window` or `document` must have a corresponding, explicit removal path to prevent memory leaks during hot reloads or remounts.