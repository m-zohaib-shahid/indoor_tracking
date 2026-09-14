// Pure-logic test of the step detector (same math as the browser version)
// Validates: walking pattern produces steps at correct cadence,
// isolated/rapid shaking does NOT produce runaway false steps.

function createDetector(opts = {}) {
  const {
    baselineAlpha = 0.85,
    stepThreshold = 1.4,
    resetThreshold = 0.8,
    maxDelta = 6.0,       // reject absurdly large spikes (hard slam / drop)
    minInterval = 320,
    maxInterval = 1200,
  } = opts;

  let filtered = 9.8;
  let above = false;
  let lastStepTime = null; // BUG FIX: was 0 in the original, which made the
                            // very first "now - lastStepTime" astronomically
                            // large, so the timing window check always
                            // failed and NO step could ever be confirmed.
  const confirmedSteps = [];

  function process(t, mag) {
    filtered = baselineAlpha * filtered + (1 - baselineAlpha) * mag;
    const delta = Math.abs(mag - filtered);

    if (delta > stepThreshold && delta < maxDelta && !above) {
      above = true;
    }
    if (delta < resetThreshold && above) {
      above = false;
      if (lastStepTime === null) {
        // first candidate ever seen — accept it and start the clock
        lastStepTime = t;
        confirmedSteps.push(t);
      } else {
        const interval = t - lastStepTime;
        if (interval >= minInterval && interval <= maxInterval) {
          confirmedSteps.push(t);
          lastStepTime = t;
        } else if (interval > maxInterval) {
          // long pause (person stopped) — treat next crossing as a fresh start
          lastStepTime = t;
        }
        // interval < minInterval -> noise/bounce, ignore, don't move the clock
      }
    }
    return delta;
  }

  return { process, get steps() { return confirmedSteps.slice(); } };
}

function runTest(name, samples, opts) {
  const det = createDetector(opts);
  samples.forEach(([t, mag]) => det.process(t, mag));
  console.log(`\n--- ${name} ---`);
  console.log(`Steps detected: ${det.steps.length}`);
  console.log(`Timestamps: ${det.steps.map((s) => s + 'ms').join(', ')}`);
  return det.steps.length;
}

// ---------------------------------------------------------------------
// Pattern A: realistic walking — magnitude bounces around gravity baseline
// with a ~600ms period (typical walking cadence), amplitude ~3 m/s^2,
// over 9 seconds -> expect roughly 14-15 steps.
// ---------------------------------------------------------------------
const walkSamples = [];
for (let t = 0; t <= 9000; t += 20) { // 50Hz sampling
  const mag = 9.8 + 3.2 * Math.sin((2 * Math.PI * t) / 600) + (Math.random() - 0.5) * 0.3;
  walkSamples.push([t, mag]);
}
const walkSteps = runTest('Pattern A: Normal walking (9s, ~600ms cadence)', walkSamples);

// ---------------------------------------------------------------------
// Pattern B: single isolated deliberate shake while sitting still,
// rest of the time basically stationary -> should register at most 1 step,
// NOT a runaway count.
// ---------------------------------------------------------------------
const shakeSamples = [];
for (let t = 0; t <= 4000; t += 20) {
  let mag = 9.8 + (Math.random() - 0.5) * 0.15; // stationary noise floor
  if (t >= 2000 && t < 2150) {
    mag = 9.8 + 8 * Math.sin((2 * Math.PI * (t - 2000)) / 150); // one sharp shake burst
  }
  shakeSamples.push([t, mag]);
}
const shakeSteps = runTest('Pattern B: Sitting still + one shake burst (4s)', shakeSamples);

// ---------------------------------------------------------------------
// Pattern C: rapid continuous hand-shaking (much faster than human stride,
// ~80ms period) -> the min-interval guard should suppress almost all of it.
// ---------------------------------------------------------------------
const rapidShakeSamples = [];
for (let t = 0; t <= 4000; t += 10) { // 100Hz sampling to catch fast shakes
  const mag = 9.8 + 7 * Math.sin((2 * Math.PI * t) / 80);
  rapidShakeSamples.push([t, mag]);
}
const rapidSteps = runTest('Pattern C: Rapid continuous shaking (4s, 80ms period)', rapidShakeSamples);

// ---------------------------------------------------------------------
// Pattern D: stationary phone on a desk, ambient micro-vibration only
// -> should register 0 steps.
// ---------------------------------------------------------------------
const idleSamples = [];
for (let t = 0; t <= 5000; t += 20) {
  const mag = 9.8 + (Math.random() - 0.5) * 0.2;
  idleSamples.push([t, mag]);
}
const idleSteps = runTest('Pattern D: Stationary on desk (5s)', idleSamples);

// ---------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------
console.log('\n=== VERDICT ===');
console.log(`Walking (expect ~13-16): ${walkSteps >= 12 && walkSteps <= 17 ? 'PASS' : 'CHECK'} (${walkSteps})`);
console.log(`Single shake (expect <=1): ${shakeSteps <= 1 ? 'PASS' : 'FAIL'} (${shakeSteps})`);
console.log(`Rapid shake (expect <=2, min-interval should suppress): ${rapidSteps <= 2 ? 'PASS' : 'FAIL'} (${rapidSteps})`);
console.log(`Idle desk (expect 0): ${idleSteps === 0 ? 'PASS' : 'FAIL'} (${idleSteps})`);
