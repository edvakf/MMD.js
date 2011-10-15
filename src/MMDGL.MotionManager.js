(function() {

  MMDGL.MotionManager = (function() {

    function MotionManager() {
      this.bones = {};
      this.morphs = {};
      this.camera = null;
      this.light = null;
      this.lastFrame = 0;
      return;
    }

    MotionManager.prototype.addMotion = function(motion) {
      return this.addMorphMotion(motion);
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
        this.morphs[name].frames = Object.keys(this.morphs[name]).map(Number).sort(function(a, b) {
          return a - b;
        });
      }
    };

    MotionManager.prototype.getFrame = function(frame) {
      return {
        morphs: this.getMorphFrame(frame)
      };
    };

    MotionManager.prototype.getMorphFrame = function(frame) {
      var delta, frames, idx, lastFrame, morphs, n, name, p, timeline;
      morphs = {};
      for (name in this.morphs) {
        timeline = this.morphs[name];
        frames = timeline.frames;
        lastFrame = frames[frames.length - 1];
        if (lastFrame <= frame) {
          morphs[name] = timeline[lastFrame];
        } else {
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
          p = frames[idx];
          n = frames[idx + 1];
          morphs[name] = (timeline[n] * (frame - p) + timeline[p] * (n - frame)) / (n - p);
        }
      }
      return morphs;
    };

    return MotionManager;

  })();

}).call(this);
