(function() {
  var interpolateBezier, interpolateLinear, ipfunc, ipfuncd, previousRegisteredFrame;

  MMDGL.MotionManager = (function() {

    function MotionManager() {
      this.bones = {};
      this.morphs = {};
      this.morphFrames = {};
      this.camera = null;
      this.cameraFrames = null;
      this.light = null;
      this.lightFrames = null;
      this.lastFrame = 0;
      return;
    }

    MotionManager.prototype.addMotion = function(motion) {
      this.addMorphMotion(motion);
      this.addCameraMotoin(motion);
      return this.addLightMotoin(motion);
    };

    MotionManager.prototype.addMorphMotion = function(motion) {
      var m, name, _i, _len, _ref;
      _ref = motion.morph;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (m.name === 'base') continue;
        if (!this.morphs[m.name]) this.morphs[m.name] = [0];
        this.morphs[m.name][m.frame] = m.weight;
        if (this.lastFrame < m.frame) this.lastFrame = m.frame;
      }
      for (name in this.morphs) {
        this.morphFrames[name] = Object.keys(this.morphs[name]).map(Number).sort(function(a, b) {
          return a - b;
        });
      }
    };

    MotionManager.prototype.addCameraMotoin = function(motion) {
      var c, frames, _i, _len, _ref;
      if (motion.camera.length === 0) return;
      this.camera = [];
      frames = [];
      _ref = motion.camera;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        this.camera[c.frame] = c;
        frames.push(c.frame);
        if (this.lastFrame < c.frame) this.lastFrame = c.frame;
      }
      this.cameraFrames = frames.sort(function(a, b) {
        return a - b;
      });
    };

    MotionManager.prototype.addLightMotoin = function(motion) {
      var frames, l, _i, _len, _ref;
      if (motion.light.length === 0) return;
      this.light = [];
      frames = [];
      _ref = motion.light;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        l = _ref[_i];
        this.light[l.frame] = l;
        frames.push(l.frame);
        if (this.lastFrame < l.frame) this.lastFrame = l.frame;
      }
      this.lightFrames = frames.sort(function(a, b) {
        return a - b;
      });
    };

    MotionManager.prototype.getFrame = function(frame) {
      return {
        morphs: this.getMorphFrame(frame),
        camera: this.getCameraFrame(frame),
        light: this.getLightFrame(frame)
      };
    };

    MotionManager.prototype.getMorphFrame = function(frame) {
      var frames, idx, lastFrame, morphs, n, name, p, timeline;
      morphs = {};
      for (name in this.morphs) {
        timeline = this.morphs[name];
        frames = this.morphFrames[name];
        lastFrame = frames[frames.length - 1];
        if (lastFrame <= frame) {
          morphs[name] = timeline[lastFrame];
        } else {
          idx = previousRegisteredFrame(frames, frame);
          p = frames[idx];
          n = frames[idx + 1];
          morphs[name] = interpolateLinear(p, n, timeline[p], timeline[n], frame);
        }
      }
      return morphs;
    };

    MotionManager.prototype.getCameraFrame = function(frame) {
      var cache, camera, frames, idx, interpolated_x, lastFrame, n, next, p, prev, timeline;
      if (!this.camera) return null;
      timeline = this.camera;
      frames = this.cameraFrames;
      lastFrame = frames[frames.length - 1];
      if (lastFrame <= frame) {
        camera = timeline[lastFrame];
      } else {
        idx = previousRegisteredFrame(frames, frame);
        p = frames[idx];
        n = frames[idx + 1];
        prev = timeline[p];
        next = timeline[n];
        cache = [];
        interpolated_x = function(i) {
          var X1, X2, Y1, Y2, a, id, _ref;
          _ref = Array.prototype.slice.call(next.interpolation, i * 4, i * 4 + 4), X1 = _ref[0], X2 = _ref[1], Y1 = _ref[2], Y2 = _ref[3];
          id = X1 | (X2 << 8) | (Y1 << 16) | (Y2 << 24);
          if (cache[id] != null) return cache[id];
          if (X1 === Y1 && X2 === Y2) return cache[id] = frame;
          a = interpolateBezier(X1 / 127, X2 / 127, Y1 / 127, Y2 / 127, (frame - p) / (n - p));
          return cache[id] = p + (n - p) * a;
        };
        camera = {
          location: [interpolateLinear(p, n, prev.location[0], next.location[0], interpolated_x(0)), interpolateLinear(p, n, prev.location[1], next.location[1], interpolated_x(1)), interpolateLinear(p, n, prev.location[2], next.location[2], interpolated_x(2))],
          rotation: [interpolateLinear(p, n, prev.rotation[0], next.rotation[0], interpolated_x(3)), interpolateLinear(p, n, prev.rotation[1], next.rotation[1], interpolated_x(3)), interpolateLinear(p, n, prev.rotation[2], next.rotation[2], interpolated_x(3))],
          distance: interpolateLinear(p, n, prev.distance, next.distance, interpolated_x(4)),
          view_angle: interpolateLinear(p, n, prev.view_angle, next.view_angle, interpolated_x(5))
        };
      }
      return camera;
    };

    MotionManager.prototype.getLightFrame = function(frame) {
      var frames, idx, lastFrame, light, n, p, timeline;
      if (!this.light) return null;
      timeline = this.light;
      frames = this.lightFrames;
      lastFrame = frames[frames.length - 1];
      if (lastFrame <= frame) {
        light = timeline[lastFrame];
      } else {
        idx = previousRegisteredFrame(frames, frame);
        p = frames[idx];
        n = frames[idx + 1];
        light = {
          color: [interpolateLinear(p, n, timeline[p].color[0], timeline[n].color[0], frame), interpolateLinear(p, n, timeline[p].color[1], timeline[n].color[1], frame), interpolateLinear(p, n, timeline[p].color[2], timeline[n].color[2], frame)],
          location: [interpolateLinear(p, n, timeline[p].location[0], timeline[n].location[0], frame), interpolateLinear(p, n, timeline[p].location[1], timeline[n].location[1], frame), interpolateLinear(p, n, timeline[p].location[2], timeline[n].location[2], frame)]
        };
      }
      return light;
    };

    return MotionManager;

  })();

  previousRegisteredFrame = function(frames, frame) {
    /*
        'frames' is key frames registered, 'frame' is the key frame I'm enquiring about
        ex. frames: [0,10,20,30,40,50], frame: 15
        now I want to find the numbers 10 and 20, namely the ones before 15 and after 15
        I'm doing a bisection search here.
    */
    var delta, idx;
    idx = 0;
    delta = frames.length;
    while (true) {
      delta = (delta >> 1) || 1;
      if (frames[idx] <= frame) {
        if (delta === 1 && frames[idx + 1] > frame) break;
        idx += delta;
      } else {
        idx -= delta;
        if (delta === 1 && frames[idx] <= frame) break;
      }
    }
    return idx;
  };

  interpolateLinear = function(x1, x2, y1, y2, x) {
    return (y2 * (x - x1) + y1 * (x2 - x)) / (x2 - x1);
  };

  interpolateBezier = function(x1, x2, y1, y2, x) {
    /*
        interpolate using Bezier curve (http://musashi.or.tv/fontguide_doc3.htm)
        Bezier curve is parametrized by t (0 <= t <= 1)
          x = s^3 x_0 + 3 s^2 t x_1 + 3 s t^2 x_2 + t^3 x_3
          y = s^3 y_0 + 3 s^2 t y_1 + 3 s t^2 y_2 + t^3 y_3
        where s is defined as s = 1 - t.
        Especially, for MMD, (x_0, y_0) = (0, 0) and (x_3, y_3) = (1, 1), so
          x = 3 s^2 t x_1 + 3 s t^2 x_2 + t^3
          y = 3 s^2 t y_1 + 3 s t^2 y_2 + t^3
        Now, given x, find t by bisection method (http://en.wikipedia.org/wiki/Bisection_method)
        i.e. find t such that f(t) = 3 s^2 t x_1 + 3 s t^2 x_2 + t^3 - x = 0
        One thing to note here is that f(t) is monotonically increasing in the range [0,1]
        Therefore, when I calculate f(t) for the t I guessed,
        Finally find y for the t.
    */
    var t, tt, v;
    t = x;
    while (true) {
      v = ipfunc(t, x1, x2) - x;
      if (Math.abs(v) < 0.0001) break;
      tt = ipfuncd(t, x1, x2);
      if (tt === 0) break;
      t -= v / tt;
    }
    return ipfunc(t, y1, y2);
  };

  ipfunc = function(t, p1, p2) {
    return (1 + 3 * p1 - 3 * p2) * t * t * t + (3 * p2 - 6 * p1) * t * t + 3 * p1 * t;
  };

  ipfuncd = function(t, p1, p2) {
    return (3 + 9 * p1 - 9 * p2) * t * t + (6 * p2 - 12 * p1) * t + 3 * p1;
  };

}).call(this);
