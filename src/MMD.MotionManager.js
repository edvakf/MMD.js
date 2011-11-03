(function() {
  var ModelMotion, bezierp, fraction, ipfunc, ipfuncd, lerp1, previousRegisteredFrame;

  MMD.MotionManager = (function() {

    function MotionManager() {
      this.modelMotions = [];
      this.cameraMotion = [];
      this.cameraFrames = [];
      this.lightMotion = [];
      this.lightFrames = [];
      this.lastFrame = 0;
      return;
    }

    MotionManager.prototype.addModelMotion = function(model, motion, merge_flag, frame_offset) {
      var i, mm, _len, _ref;
      _ref = this.modelMotions;
      for (i = 0, _len = _ref.length; i < _len; i++) {
        mm = _ref[i];
        if (model === mm.model) break;
      }
      if (i === this.modelMotions.length) {
        mm = new ModelMotion(model);
        this.modelMotions.push(mm);
      }
      mm.addBoneMotion(motion.bone, merge_flag, frame_offset);
      mm.addMorphMotion(motion.morph, merge_flag, frame_offset);
      this.lastFrame = mm.lastFrame;
    };

    MotionManager.prototype.getModelFrame = function(model, frame) {
      var i, mm, _len, _ref;
      _ref = this.modelMotions;
      for (i = 0, _len = _ref.length; i < _len; i++) {
        mm = _ref[i];
        if (model === mm.model) break;
      }
      if (i === this.modelMotions.length) return {};
      return {
        bones: mm.getBoneFrame(frame),
        morphs: mm.getMorphFrame(frame)
      };
    };

    MotionManager.prototype.addCameraLightMotion = function(motion, merge_flag, frame_offset) {
      this.addCameraMotoin(motion.camera, merge_flag, frame_offset);
      this.addLightMotoin(motion.light, merge_flag, frame_offset);
    };

    MotionManager.prototype.addCameraMotoin = function(camera, merge_flag, frame_offset) {
      var c, frame, _i, _len;
      if (camera.length === 0) return;
      if (!merge_flag) {
        this.cameraMotion = [];
        this.cameraFrames = [];
      }
      frame_offset = frame_offset || 0;
      for (_i = 0, _len = camera.length; _i < _len; _i++) {
        c = camera[_i];
        frame = c.frame + frame_offset;
        this.cameraMotion[frame] = c;
        this.cameraFrames.push(frame);
        if (this.lastFrame < frame) this.lastFrame = frame;
      }
      this.cameraFrames = this.cameraFrames.sort(function(a, b) {
        return a - b;
      });
    };

    MotionManager.prototype.addLightMotoin = function(light, merge_flag, frame_offset) {
      var frame, l, _i, _len;
      if (light.length === 0) return;
      if (!merge_flag) {
        this.lightMotion = [];
        this.lightFrames = [];
      }
      frame_offset = frame_offset || 0;
      for (_i = 0, _len = light.length; _i < _len; _i++) {
        l = light[_i];
        frame = l.frame + frame_offset;
        this.lightMotion[frame] = l;
        this.lightFrames.push(frame);
        if (this.lastFrame < frame) this.lastFrame = frame;
      }
      this.lightFrames = this.lightFrames.sort(function(a, b) {
        return a - b;
      });
    };

    MotionManager.prototype.getCameraFrame = function(frame) {
      var bez, cache, camera, frac, frames, idx, lastFrame, n, next, p, prev, timeline;
      if (!this.cameraMotion.length) return null;
      timeline = this.cameraMotion;
      frames = this.cameraFrames;
      lastFrame = frames[frames.length - 1];
      if (lastFrame <= frame) {
        camera = timeline[lastFrame];
      } else {
        idx = previousRegisteredFrame(frames, frame);
        p = frames[idx];
        n = frames[idx + 1];
        frac = fraction(frame, p, n);
        prev = timeline[p];
        next = timeline[n];
        cache = [];
        bez = function(i) {
          var X1, X2, Y1, Y2, id;
          X1 = next.interpolation[i * 4];
          X2 = next.interpolation[i * 4 + 1];
          Y1 = next.interpolation[i * 4 + 2];
          Y2 = next.interpolation[i * 4 + 3];
          id = X1 | (X2 << 8) | (Y1 << 16) | (Y2 << 24);
          if (cache[id] != null) return cache[id];
          if (X1 === Y1 && X2 === Y2) return cache[id] = frac;
          return cache[id] = bezierp(X1 / 127, X2 / 127, Y1 / 127, Y2 / 127, frac);
        };
        camera = {
          location: vec3.createLerp3(prev.location, next.location, [bez(0), bez(1), bez(2)]),
          rotation: vec3.createLerp(prev.rotation, next.rotation, bez(3)),
          distance: lerp1(prev.distance, next.distance, bez(4)),
          view_angle: lerp1(prev.view_angle, next.view_angle, bez(5))
        };
      }
      return camera;
    };

    MotionManager.prototype.getLightFrame = function(frame) {
      var frac, frames, idx, lastFrame, light, n, next, p, prev, timeline;
      if (!this.lightMotion.length) return null;
      timeline = this.lightMotion;
      frames = this.lightFrames;
      lastFrame = frames[frames.length - 1];
      if (lastFrame <= frame) {
        light = timeline[lastFrame];
      } else {
        idx = previousRegisteredFrame(frames, frame);
        p = frames[idx];
        n = frames[idx + 1];
        frac = fraction(frame, p, n);
        prev = timeline[p];
        next = timeline[n];
        light = {
          color: vec3.createLerp(prev.color, next.color, frac),
          location: vec3.lerp(prev.location, next.location, frac)
        };
      }
      return light;
    };

    return MotionManager;

  })();

  ModelMotion = (function() {

    function ModelMotion(model) {
      this.model = model;
      this.boneMotions = {};
      this.boneFrames = {};
      this.morphMotions = {};
      this.morphFrames = {};
      this.lastFrame = 0;
    }

    ModelMotion.prototype.addBoneMotion = function(bone, merge_flag, frame_offset) {
      var b, frame, name, _i, _len;
      if (!merge_flag) {
        this.boneMotions = {};
        this.boneFrames = {};
      }
      frame_offset = frame_offset || 0;
      for (_i = 0, _len = bone.length; _i < _len; _i++) {
        b = bone[_i];
        if (!this.boneMotions[b.name]) {
          this.boneMotions[b.name] = [
            {
              location: vec3.create(),
              rotation: quat4.create([0, 0, 0, 1])
            }
          ];
        }
        frame = b.frame + frame_offset;
        this.boneMotions[b.name][frame] = b;
        if (this.lastFrame < frame) this.lastFrame = frame;
      }
      for (name in this.boneMotions) {
        this.boneFrames[name] = (this.boneFrames[name] || []).concat(Object.keys(this.boneMotions[name]).map(Number)).sort(function(a, b) {
          return a - b;
        });
      }
    };

    ModelMotion.prototype.addMorphMotion = function(morph, merge_flag, frame_offset) {
      var frame, m, name, _i, _len;
      if (!merge_flag) {
        this.morphMotions = {};
        this.morphFrames = {};
      }
      frame_offset = frame_offset || 0;
      for (_i = 0, _len = morph.length; _i < _len; _i++) {
        m = morph[_i];
        if (m.name === 'base') continue;
        if (!this.morphMotions[m.name]) this.morphMotions[m.name] = [0];
        frame = m.frame + frame_offset;
        this.morphMotions[m.name][frame] = m.weight;
        if (this.lastFrame < frame) this.lastFrame = frame;
      }
      for (name in this.morphMotions) {
        this.morphFrames[name] = (this.morphFrames[name] || []).concat(Object.keys(this.morphMotions[name]).map(Number)).sort(function(a, b) {
          return a - b;
        });
      }
    };

    ModelMotion.prototype.getBoneFrame = function(frame) {
      var bez, bones, cache, frac, frames, idx, lastFrame, n, name, next, p, prev, r, rotation, timeline;
      bones = {};
      for (name in this.boneMotions) {
        timeline = this.boneMotions[name];
        frames = this.boneFrames[name];
        lastFrame = frames[frames.length - 1];
        if (lastFrame <= frame) {
          bones[name] = timeline[lastFrame];
        } else {
          idx = previousRegisteredFrame(frames, frame);
          p = frames[idx];
          n = frames[idx + 1];
          frac = fraction(frame, p, n);
          prev = timeline[p];
          next = timeline[n];
          cache = [];
          bez = function(i) {
            var X1, X2, Y1, Y2, id;
            X1 = next.interpolation[i * 4];
            X2 = next.interpolation[i * 4 + 1];
            Y1 = next.interpolation[i * 4 + 2];
            Y2 = next.interpolation[i * 4 + 3];
            id = X1 | (X2 << 8) | (Y1 << 16) | (Y2 << 24);
            if (cache[id] != null) return cache[id];
            if (X1 === Y1 && X2 === Y2) return cache[id] = frac;
            return cache[id] = bezierp(X1 / 127, X2 / 127, Y1 / 127, Y2 / 127, frac);
          };
          if (quat4.dot(prev.rotation, next.rotation) >= 0) {
            rotation = quat4.createSlerp(prev.rotation, next.rotation, bez(3));
          } else {
            r = prev.rotation;
            rotation = quat4.createSlerp([-r[0], -r[1], -r[2], -r[3]], next.rotation, bez(3));
          }
          bones[name] = {
            location: vec3.createLerp3(prev.location, next.location, [bez(0), bez(1), bez(2)]),
            rotation: rotation
          };
        }
      }
      return bones;
    };

    ModelMotion.prototype.getMorphFrame = function(frame) {
      var frac, frames, idx, lastFrame, morphs, n, name, next, p, prev, timeline;
      morphs = {};
      for (name in this.morphMotions) {
        timeline = this.morphMotions[name];
        frames = this.morphFrames[name];
        lastFrame = frames[frames.length - 1];
        if (lastFrame <= frame) {
          morphs[name] = timeline[lastFrame];
        } else {
          idx = previousRegisteredFrame(frames, frame);
          p = frames[idx];
          n = frames[idx + 1];
          frac = fraction(frame, p, n);
          prev = timeline[p];
          next = timeline[n];
          morphs[name] = lerp1(prev, next, frac);
        }
      }
      return morphs;
    };

    return ModelMotion;

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

  fraction = function(x, x0, x1) {
    return (x - x0) / (x1 - x0);
  };

  lerp1 = function(x0, x1, a) {
    return x0 + a * (x1 - x0);
  };

  bezierp = function(x1, x2, y1, y2, x) {
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
      if (v * v < 0.0000001) break;
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
