class MMDGL.MotionManager
  constructor: ->
    @bones = {}
    @morphs = {}
    @camera = null
    @light = null
    @lastFrame = 0
    return

  addMotion: (motion) ->
    @addMorphMotion(motion)

  addMorphMotion: (motion) ->
    for m in motion.morph
      continue if m.name == 'base'
      @morphs[m.name] = [0] if !@morphs[m.name] # set 0th frame as 0
      @morphs[m.name][m.frame] = m.weight
      @lastFrame = m.frame if @lastFrame < m.frame

    for name of @morphs
      @morphs[name].frames = Object.keys(@morphs[name]).map(Number).sort((a,b) -> a - b)

    return

  getFrame: (frame) ->
    return {morphs: @getMorphFrame(frame)}

  getMorphFrame: (frame) ->
    morphs = {}

    for name of @morphs
      timeline = @morphs[name]
      frames = timeline.frames
      # 'frames' is key frames registered, 'frame' is the key frame I'm enquiring about
      # ex. frames: [0,10,20,30,40,50], frame: 15
      # now I want to find the numbers 10 and 20, namely the ones before 15 and after 15

      lastFrame = frames[frames.length - 1]
      if lastFrame <= frame
        morphs[name] = timeline[lastFrame]
      else
        # bisection search
        idx = 0
        delta = frames.length
        while true
          delta = (delta >> 1) || 1 # delta = Math.max(Math.floor(delta / 2), 1)
          if frames[idx] <= frame
            break if delta == 1 and frames[idx + 1] > frame
            idx += delta
          else
            idx -= delta
            break if delta == 1 and frames[idx] <= frame
        p = frames[idx]
        n = frames[idx + 1]
        morphs[name] = (timeline[n] * (frame - p) + timeline[p] * (n - frame)) / (n - p)

    return morphs
