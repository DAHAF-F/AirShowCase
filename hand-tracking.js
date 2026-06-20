/**
 * HAND TRACKING MODULE
 * Wraps MediaPipe Hands + Camera and exposes live hand landmark state
 * on the global AirShowcase namespace for the renderer/UI to consume.
 */
window.AirShowcase = window.AirShowcase || {};

(function () {
  const AS = window.AirShowcase;

  AS.state = {
    hands: [],          // array of 21-point landmark arrays, normalized [0,1]
    handCount: 0,
    gesture: 'None',
    ready: false
  };

  const videoElement = document.querySelector('.input_video');
  const uiHands = document.getElementById('ui-hands');
  const uiGesture = document.getElementById('ui-gesture');

  function onResults(results) {
    AS.state.hands = results.multiHandLandmarks || [];
    AS.state.handCount = AS.state.hands.length;

    if (uiHands) uiHands.innerText = AS.state.handCount;

    // Notify renderer of fresh frame
    if (typeof AS.onHandsUpdate === 'function') {
      AS.onHandsUpdate(AS.state.hands);
    }
  }

  AS.setGestureLabel = function (label) {
    AS.state.gesture = label;
    if (uiGesture) uiGesture.innerText = label;
  };

  AS.initHandTracking = function () {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 1280,
      height: 720,
      facingMode: 'user'
    });

    camera.start();
    AS.state.ready = true;
  };

  // Utility shared across modules
  AS.dist = function (p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  };
})();
