// Pure simulation for the brake game: no DOM, no three.js, so it can run in Node.
// Units are SI (m, s, m/s, N). The car's position `x` is its front bumper,
// measured along the road from the start line.

export const G = 9.81;
const MPH = 0.44704;

export const SPEC = {
  car: {
    // Tesla's claimed 0–60 mph for the new Roadster (reveal, October 2026).
    zeroToSixtyS: 0.81,
    // Motors alone: the 250 mph Tesla promised in 2017.
    motorTopKmh: 250 * MPH * 3.6,
    // With the jets lit: 383 mph, Musk's "half the speed of sound".
    topSpeedKmh: 383 * MPH * 3.6,
    // a(v) = launchAccel · (1 − (v / vMotor)^accelExp), fitted so 0–60 mph takes 0.81 s.
    launchAccel: 33.3,
    accelExp: 3,
    length: 4.6,
  },
  jet: {
    // Four rear cold-gas nozzles: about 2 g of extra push, fading only near 383 mph.
    accel: 2 * G,
    exp: 10,
    // Compressed-air tank, in seconds of full thrust.
    tankS: 7,
    spool: 6,
  },
  brake: {
    minSpeedKmh: 100,
    breakForceN: 1612,
    // Pedal force grows the longer you hold: F' = rampBase + 2·rampGrowth·holdTime.
    rampBase: 200,
    rampGrowth: 400,
    releaseRate: 900,
    // Suction fans add up to 2 g of downforce, so tyres see ~3 g of load.
    // Full pedal therefore buys about 3 g of braking.
    maxDecel: 3 * G,
    rollingDecel: 0.15,
    dragCoeff: 1.8e-4,
    stopSpeed: 0.08,
    // After leaping the barrier the car stops itself gently (about 1.2 g),
    // so a leap always costs time against a clean stop.
    autoForceN: 640,
  },
  track: {
    barrierDistance: 2600,
    startFront: 2.7,
    barrierDepth: 1,
    barrierHeight: 1.2,
    runoff: 1900,
  },
  // Thrusters lift the car, it rolls sideways and drifts a lane over and back.
  flip: { launchVz: 7.5, sideways: 3.4 },
  leap: { minHeight: 3.8, minAir: 1.3, maxAir: 2.8, sideways: 4.2 },
};

const B = SPEC.brake;
const C = SPEC.car;
const T = SPEC.track;
const V_MOTOR = C.motorTopKmh / 3.6;
const V_TOP = C.topSpeedKmh / 3.6;
const J = SPEC.jet;
const DECEL_PER_N = B.maxDecel / B.breakForceN;
const SAMPLE_EVERY = 0.04;

export function score(v0Kmh, seconds) {
  return seconds <= 0 ? 0 : Math.round((v0Kmh * v0Kmh) / seconds);
}

export function easeInOut(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
}

export class Sim {
  constructor() {
    this.reset();
    this.phase = 'menu';
  }

  reset() {
    this.phase = 'menu';
    this.x = T.startFront;
    this.v = 0;
    this.z = 0;
    this.vz = 0;
    this.roll = 0;
    this.pitch = 0;
    this.side = 0;
    this.accel = 0;
    this.gas = J.tankS;
    this.jet = 0;
    this.jetting = false;
    this.force = 0;
    this.hold = 0;
    this.powerCut = false;
    this.brakeElapsed = 0;
    this.v0Kmh = 0;
    this.peakForce = 0;
    this.flips = 0;
    this.leapt = false;
    this.auto = false;
    this.air = null;
    this.samples = [];
    this.sampleTimer = 0;
    this.countdown = 0;
    this.lastTick = 4;
    this.brakeStartX = 0;
    this.earlyCooldown = 0;
    this.result = null;
  }

  start() {
    this.reset();
    this.phase = 'countdown';
    this.countdown = 3;
  }

  get speedKmh() {
    return this.v * 3.6;
  }

  get distanceToBarrier() {
    return T.barrierDistance - this.x;
  }

  get canBrake() {
    return this.phase === 'accelerating' && this.speedKmh >= B.minSpeedKmh;
  }

  get airborne() {
    return this.phase === 'air';
  }

  /** Forward push on the ground while the motors are still powered. */
  driveAccel(v, jet) {
    const motor =
      v < V_MOTOR
        ? C.launchAccel * (1 - (v / V_MOTOR) ** C.accelExp)
        : -(B.rollingDecel + B.dragCoeff * (v * v - V_MOTOR * V_MOTOR));
    if (jet <= 0) return motor;
    return Math.max(motor, 0) + jet * J.accel * (1 - Math.min(v / V_TOP, 1) ** J.exp);
  }

  /** Advance one fixed step. Returns a list of events for sound, camera and UI. */
  step(dt, pressed, jetInput = false) {
    const events = [];
    this.earlyCooldown = Math.max(0, this.earlyCooldown - dt);
    switch (this.phase) {
      case 'countdown': {
        this.countdown -= dt;
        const tick = Math.ceil(this.countdown);
        if (tick < this.lastTick && tick > 0) {
          this.lastTick = tick;
          events.push({ type: 'countdown', value: tick });
        }
        if (this.countdown <= 0) {
          this.phase = 'accelerating';
          events.push({ type: 'go' });
        }
        break;
      }
      case 'accelerating': {
        if (pressed) {
          if (this.canBrake) {
            this.beginBraking(events);
            this.stepGround(dt, pressed, events);
            break;
          }
          if (this.earlyCooldown === 0) {
            this.earlyCooldown = 1.2;
            events.push({ type: 'tooEarly' });
          }
        }
        this.stepJet(dt, jetInput, events);
        const a = this.driveAccel(this.v, this.jet);
        this.accel = a;
        this.v = Math.max(0, this.v + a * dt);
        this.x += this.v * dt;
        // Never touched the pedal: the car still clears the barrier, and the run
        // is timed from the take-off.
        if (this.shouldLeap()) {
          this.beginBraking(events);
          this.startLeap(events);
        }
        break;
      }
      case 'braking':
        this.stepGround(dt, pressed, events);
        break;
      case 'air':
        this.stepAir(dt, events);
        break;
      default:
        break;
    }
    return events;
  }

  stepJet(dt, want, events) {
    const on = want && this.gas > 0;
    if (on && !this.jetting) events.push({ type: 'jetStart' });
    if (!on && this.jetting) events.push({ type: this.gas <= 0 ? 'jetEmpty' : 'jetStop' });
    this.jetting = on;
    this.jet += ((on ? 1 : 0) - this.jet) * Math.min(1, dt * J.spool);
    if (this.jet < 0.002) this.jet = 0;
    if (on) this.gas = Math.max(0, this.gas - dt);
  }

  beginBraking(events) {
    if (this.jetting) events.push({ type: 'jetStop' });
    this.jetting = false;
    this.jet = 0;
    this.phase = 'braking';
    this.powerCut = true;
    this.v0Kmh = this.speedKmh;
    this.brakeStartX = this.x;
    this.recordSample();
    events.push({ type: 'brakeStart', v0Kmh: this.v0Kmh });
  }

  shouldLeap() {
    if (this.leapt) return false;
    const d = this.distanceToBarrier;
    return this.v > 0.3 && d <= this.v * 0.32 + 0.6;
  }

  stepGround(dt, pressed, events) {
    if (this.auto) {
      this.hold += dt;
      const f = this.force + (B.rampBase + 2 * B.rampGrowth * this.hold) * dt;
      this.force = Math.min(B.autoForceN, f);
    } else if (pressed) {
      this.hold += dt;
      this.force += (B.rampBase + 2 * B.rampGrowth * this.hold) * dt;
    } else {
      this.hold = 0;
      this.force = Math.max(0, this.force - B.releaseRate * dt);
    }

    if (this.force >= B.breakForceN) {
      this.peakForce = B.breakForceN;
      this.force = B.breakForceN;
      this.recordSample();
      this.startFlip(events);
      return;
    }

    const a = -(B.rollingDecel + B.dragCoeff * this.v * this.v + DECEL_PER_N * this.force);
    this.accel = a;
    this.v = Math.max(0, this.v + a * dt);
    this.x += this.v * dt;
    this.tickClock(dt);

    if (this.shouldLeap()) {
      this.startLeap(events);
      return;
    }
    if (!this.leapt && this.distanceToBarrier <= 0.05) {
      // Crept up to the blocks below leap speed: a bumper kiss counts as a stop.
      this.x = T.barrierDistance - 0.05;
      this.v = 0;
    }
    if (this.v <= B.stopSpeed) {
      this.v = 0;
      this.finish(events);
    }
  }

  tickClock(dt) {
    this.brakeElapsed += dt;
    this.peakForce = Math.max(this.peakForce, this.force);
    this.sampleTimer += dt;
    if (this.sampleTimer >= SAMPLE_EVERY) {
      this.sampleTimer -= SAMPLE_EVERY;
      this.recordSample();
    }
  }

  startFlip(events) {
    const vz = SPEC.flip.launchVz;
    const airTime = (2 * vz) / G;
    // A flip that would come down on or past the blocks becomes a barrier leap.
    if (!this.leapt && this.x + this.v * airTime >= T.barrierDistance - 0.5) {
      this.force = 0;
      this.hold = 0;
      this.startLeap(events);
      return;
    }
    this.flips += 1;
    this.force = 0;
    this.hold = 0;
    this.phase = 'air';
    this.vz = vz;
    this.air = { kind: 'flip', t: 0, T: airTime, dir: this.flips % 2 ? 1 : -1 };
    events.push({ type: 'flip', count: this.flips });
  }

  startLeap(events) {
    const x0 = this.x;
    // Clear the blocks with room to spare, and keep the car's ground speed through the air.
    const need = T.barrierDistance + T.barrierDepth + C.length + 10 - x0;
    const airTime = Math.min(
      SPEC.leap.maxAir,
      Math.max(SPEC.leap.minAir, need / Math.max(this.v, 0.1)),
    );
    const x1 = x0 + Math.max(need, this.v * airTime);
    const height = Math.max(SPEC.leap.minHeight, (G * airTime * airTime) / 8);
    this.force = 0;
    this.hold = 0;
    this.phase = 'air';
    this.air = { kind: 'leap', t: 0, T: airTime, x0, x1, height, vKeep: this.v, dir: 1 };
    events.push({ type: 'leap' });
  }

  stepAir(dt, events) {
    const air = this.air;
    air.t += dt;
    const s = Math.min(1, air.t / air.T);
    if (air.kind === 'flip') {
      const a = -(B.rollingDecel + B.dragCoeff * this.v * this.v);
      this.accel = a;
      this.v = Math.max(0, this.v + a * dt);
      this.x += this.v * dt;
      this.vz -= G * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      this.roll = air.dir * 2 * Math.PI * easeInOut(s);
      this.side = air.dir * SPEC.flip.sideways * Math.sin(Math.PI * s);
    } else {
      const prevX = this.x;
      this.x = air.x0 + (air.x1 - air.x0) * s;
      this.z = 4 * air.height * s * (1 - s);
      this.roll = air.dir * 2 * Math.PI * easeInOut(s);
      this.side = air.dir * SPEC.leap.sideways * Math.sin(Math.PI * s);
      this.accel = 0;
      // Speedometer shows how fast the car really crosses the ground.
      this.v = Math.max(air.vKeep, (this.x - prevX) / dt) || air.vKeep;
    }
    this.tickClock(dt);
    if (s >= 1) this.land(events);
  }

  land(events) {
    const kind = this.air.kind;
    if (kind === 'leap') {
      this.x = this.air.x1;
      this.v = this.air.vKeep;
      this.leapt = true;
      this.auto = true;
    }
    this.z = 0;
    this.vz = 0;
    this.roll = 0;
    this.pitch = 0;
    this.side = 0;
    this.air = null;
    this.phase = 'braking';
    this.hold = 0;
    events.push({ type: 'land', kind });
    if (this.v <= B.stopSpeed) {
      this.v = 0;
      this.finish(events);
    }
  }

  finish(events) {
    this.phase = 'stopped';
    this.recordSample();
    const v0 = Math.round(this.v0Kmh * 10) / 10;
    const t = Math.round(this.brakeElapsed * 1000) / 1000;
    this.result = {
      v0Kmh: v0,
      stopSeconds: t,
      stopDistance: this.x - this.brakeStartX,
      peakForce: this.peakForce,
      flips: this.flips,
      leapt: this.leapt,
      gasUsed: J.tankS - this.gas,
      gap: this.distanceToBarrier,
      score: score(v0, t),
      samples: this.samples.slice(),
    };
    events.push({ type: 'stopped', result: this.result });
  }

  recordSample() {
    this.samples.push({
      t: this.brakeElapsed,
      speedKmh: this.speedKmh,
      force: Math.min(this.force, B.breakForceN),
      air: this.phase === 'air',
    });
  }
}
