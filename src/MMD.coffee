class this.MMD
  constructor: (canvas, @width, @height) ->
    @gl = canvas.getContext('webgl') or canvas.getContext('experimental-webgl')
    if not @gl
      alert('WebGL not supported in your browser')
      throw 'WebGL not supported'

  initShaders: ->
    vshader = @gl.createShader(@gl.VERTEX_SHADER)
    @gl.shaderSource(vshader, MMD.VertexShaderSource)
    @gl.compileShader(vshader)
    if not @gl.getShaderParameter(vshader, @gl.COMPILE_STATUS)
      alert('Vertex shader compilation error')
      throw @gl.getShaderInfoLog(vshader)

    fshader = @gl.createShader(@gl.FRAGMENT_SHADER)
    @gl.shaderSource(fshader, MMD.FragmentShaderSource)
    @gl.compileShader(fshader)
    if not @gl.getShaderParameter(fshader, @gl.COMPILE_STATUS)
      alert('Fragment shader compilation error')
      throw @gl.getShaderInfoLog(fshader)

    @program = @gl.createProgram()
    @gl.attachShader(@program, vshader)
    @gl.attachShader(@program, fshader)

    @gl.linkProgram(@program)
    if not @gl.getProgramParameter(@program, @gl.LINK_STATUS)
      alert('Shader linking error')
      throw @gl.getProgramInfoLog(@program)

    @gl.useProgram(@program)

    attributes = []
    uniforms = []
    for src in [MMD.VertexShaderSource, MMD.FragmentShaderSource]
      for line in src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(';')
        type = line.match(/^\s*(uniform|attribute)\s+/)?[1]
        continue if not type
        name = line.match(/(\w+)(\[\d+\])?\s*$/)[1]
        attributes.push(name) if type is 'attribute' and name not in attributes
        uniforms.push(name) if type is 'uniform' and name not in uniforms

    for name in attributes
      @program[name] = @gl.getAttribLocation(@program, name)
      @gl.enableVertexAttribArray(@program[name])

    for name in uniforms
      @program[name] = @gl.getUniformLocation(@program, name)

    return

  addModel: (model) ->
    @model = model # TODO: multi model?
    return

  initBuffers: ->
    @vbuffers = {}
    @initVertices()
    @initBones()
    @initIndices()
    @initTextures()
    return

  initVertices: ->
    model = @model

    length = model.vertices.length
    positions = new Float32Array(3 * length)
    normals = new Float32Array(3 * length)
    uvs = new Float32Array(2 * length)
    edge = new Float32Array(length)
    for i in [0...length]
      vertex = model.vertices[i]
      positions[3 * i    ] = vertex.x
      positions[3 * i + 1] = vertex.y
      positions[3 * i + 2] = vertex.z
      normals[3 * i    ] = vertex.nx
      normals[3 * i + 1] = vertex.ny
      normals[3 * i + 2] = vertex.nz
      uvs[2 * i    ] = vertex.u
      uvs[2 * i + 1] = vertex.v
      edge[i] = 1 - vertex.edge_flag
    model.positions = positions

    for data in [
      {attribute: 'aVertexPosition', array: positions, size: 3},
      {attribute: 'aVertexNormal', array: normals, size: 3},
      {attribute: 'aTextureCoord', array: uvs, size: 2},
      {attribute: 'aVertexEdge', array: edge, size: 1},
    ]
      buffer = @gl.createBuffer()
      @gl.bindBuffer(@gl.ARRAY_BUFFER, buffer)
      @gl.bufferData(@gl.ARRAY_BUFFER, data.array, @gl.STATIC_DRAW)
      @vbuffers[data.attribute] = {size: data.size, buffer: buffer}

    @gl.bindBuffer(@gl.ARRAY_BUFFER, null)
    return

  initBones: ->
    model = @model
    verts = model.vertices
    length = verts.length
    vertsVisited = new Uint8Array(length)
    bone1 = new Float32Array(length)
    bone2 = new Float32Array(length)
    weights = new Float32Array(length)
    triangles = model.triangles
    offset = 0

    for material in model.materials
      bones = material.bones = []
      material.startIndex = offset

      for i in [0...material.face_vert_count] by 3
        for j in [0...3]
          vertIndex = triangles[offset + i + j]
          continue if vertsVisited[vertIndex] == 1
          vertsVisited[vertIndex] = 1
          vert = verts[vertIndex]
          weights[vertIndex] = vert.bone_weight / 100
          idx = bones.indexOf(vert.bone_num1)
          idx = bones.push(vert.bone_num1) - 1 if idx < 0
          bone1[vertIndex] = idx
          idx = bones.indexOf(vert.bone_num2)
          idx = bones.push(vert.bone_num2) - 1 if idx < 0
          bone2[vertIndex] = idx

      material.endIndex = (offset += material.face_vert_count)

    for data in [
      {attribute: 'aBone1', array: bone1, size: 1},
      {attribute: 'aBone2', array: bone2, size: 1},
      {attribute: 'aBoneWeight', array: weights, size: 1},
    ]
      buffer = @gl.createBuffer()
      @gl.bindBuffer(@gl.ARRAY_BUFFER, buffer)
      @gl.bufferData(@gl.ARRAY_BUFFER, data.array, @gl.STATIC_DRAW)
      @vbuffers[data.attribute] = {size: data.size, buffer: buffer}

    @gl.bindBuffer(@gl.ARRAY_BUFFER, null)
    return

  initIndices: ->
    indices = @model.triangles

    @ibuffer = @gl.createBuffer()
    @gl.bindBuffer(@gl.ELEMENT_ARRAY_BUFFER, @ibuffer)
    @gl.bufferData(@gl.ELEMENT_ARRAY_BUFFER, indices, @gl.STATIC_DRAW)
    @gl.bindBuffer(@gl.ELEMENT_ARRAY_BUFFER, null)
    return

  initTextures: ->
    model = @model

    @textureManager = new MMD.TextureManager(this)
    @textureManager.onload = => @redraw = true

    for material in model.materials
      material.textures = {} if not material.textures

      toonIndex = material.toon_index
      fileName = 'toon' + ('0' + (toonIndex + 1)).slice(-2) + '.bmp'
      if toonIndex == -1 or # -1 is special (no shadow)
        !model.toon_file_names or # no toon_file_names section in PMD
        fileName == model.toon_file_names[toonIndex] # toonXX.bmp is in 'data' directory
          fileName = 'data/' + fileName
      else # otherwise the toon texture is in the model's directory
        fileName = model.directory + '/' + model.toon_file_names[toonIndex]
      material.textures.toon = @textureManager.get('toon', fileName)

      if material.texture_file_name
        for fileName in material.texture_file_name.split('*')
          switch fileName.slice(-4)
            when '.sph' then type = 'sph'
            when '.spa' then type = 'spa'
            when '.tga' then type = 'regular'; fileName += '.png'
            else             type = 'regular'
          material.textures[type] = @textureManager.get(type, model.directory + '/' + fileName)

    return

  start: ->
    @gl.clearColor(1, 1, 1, 1)
    @gl.clearDepth(1)
    @gl.enable(@gl.DEPTH_TEST)

    @redraw = true

    @shadowMap = new MMD.ShadowMap(this) if @drawSelfShadow
    @motionManager = new MMD.MotionManager

    t0 = Date.now()
    step = =>
      @move()
      @computeMatrices()
      @render()
      t1 = Date.now()
      #idealInterval = 1000 / @fps
      #delay = (t1 - t0) - idealInterval
      #interval = idealInterval - delay # == 1000 / @fps * 2 - (t1 - t0)
      setTimeout(step, Math.max(0, 1000 / @fps * 2 - (t1 - t0)))
      t0 = t1

    step()
    return

  move: ->
    return if not @playing or @textureManager.pendingCount > 0
    if ++@frame > @motionManager.lastFrame
      @pause()
      return

    @moveCamera()
    @moveLight()
    @moveModel()
    return

  moveCamera: ->
    camera = @motionManager.getCameraFrame(@frame)
    if camera and not @ignoreCameraMotion
      @distance = camera.distance
      @rotx = camera.rotation[0]
      @roty = camera.rotation[1]
      @center = vec3.create(camera.location)
      @fovy = camera.view_angle

    return

  moveLight: ->
    light = @motionManager.getLightFrame(@frame)
    if light
      @lightDirection = light.location
      @lightColor = light.color

    return

  moveModel: ->
    model = @model
    {morphs, bones} = @motionManager.getModelFrame(model, @frame)

    @moveMorphs(model, morphs)
    @moveBones(model, bones)
    return

  moveMorphs: (model, morphs) ->
    return if not morphs
    return if model.morphs.length == 0

    for morph, j in model.morphs
      if j == 0
        base = morph
        continue
      continue if morph.name not of morphs
      weight = morphs[morph.name]
      for vert in morph.vert_data
        b = base.vert_data[vert.index]
        i = b.index
        model.positions[3 * i    ] += vert.x * weight
        model.positions[3 * i + 1] += vert.y * weight
        model.positions[3 * i + 2] += vert.z * weight

    @gl.bindBuffer(@gl.ARRAY_BUFFER, @vbuffers.aVertexPosition.buffer)
    @gl.bufferData(@gl.ARRAY_BUFFER, model.positions, @gl.STATIC_DRAW)
    @gl.bindBuffer(@gl.ARRAY_BUFFER, null)

    # reset positions
    for b in base.vert_data
      i = b.index
      model.positions[3 * i    ] = b.x
      model.positions[3 * i + 1] = b.y
      model.positions[3 * i + 2] = b.z

    return

  moveBones: (model, individualBoneMotions) ->
    return if not individualBoneMotions

    for bone in model.bones
      individualBoneMotions[bone.name] ?= {
        rotation: quat4.create([0, 0, 0, 1])
        location: vec3.create([0, 0, 0])
      }

    boneMotions = {} # {name: {p, r}}

    # individualBoneMotions is translation/rotation of each bone from it's original position
    # boneMotions is total position/rotation of each bone

    getBoneMotion = (bone) ->
      ###
         the position of a bone is found as follows
         take the ORIGINAL bone_head vector relative to it's parent's ORIGINAL bone_head,
         add translation to it and rotate by parent's rotation,
         then add parent's position, i.e.
           p_1' = r_2' (p_1 - p_2 + t_1) r_2'^* + p_2'
         where p_1 and p_2 are it's and parent's ORIGINAL positions respectively,
         t_1 is it's own translation, and r_2' is the parent's rotation
         the children of this bone will be affected by the moved position and total rotation
           r_1' = r_2' + r_1
      ###
      return that if that = boneMotions[bone.name]
      that = individualBoneMotions[bone.name]
      r = that.rotation
      t = that.location

      if bone.parent_bone_index == 0xFFFF # center, foot IK, etc.
        return boneMotions[bone.name] = {p: vec3.createAdd(bone.head_pos, t), r: r}
      else
        parent = model.bones[bone.parent_bone_index]
        parentMotion = getBoneMotion(parent)
        r = quat4.createMultiply(parentMotion.r, r) # r_2' r_1
        p = vec3.createSubtract(bone.head_pos, parent.head_pos)
        vec3.add(p, t) if (that = bone.type) == 1 or that == 2
        vec3.rotateByQuat4(p, parentMotion.r)
        vec3.add(p, parentMotion.p)
        return boneMotions[bone.name] = {p: p, r: r}

    # objects to be reused
    targetVec = vec3.create()
    ikboneVec = vec3.create()
    axis = vec3.create()

    for ik in model.iks
      maxangle = ik.control_weight * 4 # angle to move in one iteration
      affectedBones = (model.bones[i] for i in ik.child_bones)

      ikbone = model.bones[ik.bone_index]
      ikbonePos = getBoneMotion(ikbone).p
      target = model.bones[ik.target_bone_index]
      targetParent = model.bones[target.parent_bone_index]
      minLength = 0.1 * vec3.length(
        vec3.subtract(target.head_pos, targetParent.head_pos, axis)) # temporary use of axis

      for n in [0...ik.iterations]
        targetPos = getBoneMotion(target).p # this should calculate the whole chain
        break if minLength > vec3.length(
          vec3.subtract(targetPos, ikbonePos, axis)) # temporary use of axis

        for bone, i in affectedBones
          motion = getBoneMotion(bone)
          bonePos = motion.p
          targetPos = getBoneMotion(target).p if i > 0
          targetVec = vec3.subtract(targetPos, bonePos, targetVec)
          targetVecLen = vec3.length(targetVec)
          continue if targetVecLen < minLength # targetPos == bonePos
          ikboneVec = vec3.subtract(ikbonePos, bonePos, ikboneVec)
          ikboneVecLen = vec3.length(ikboneVec)
          continue if ikboneVecLen < minLength # ikbonePos == bonePos
          axis = vec3.cross(targetVec, ikboneVec, axis)
          axisLen = vec3.length(axis)
          sinTheta = axisLen / ikboneVecLen / targetVecLen
          continue if sinTheta < 0.001 # ~0.05 degree
          theta = Math.asin(sinTheta)
          theta = 3.141592653589793 - theta if vec3.dot(targetVec, ikboneVec) < 0
          theta = maxangle if theta > maxangle
          q = quat4.create(vec3.scale(axis, Math.sin(theta / 2) / axisLen))
          q[3] = Math.cos(theta / 2)
          parent = model.bones[bone.parent_bone_index]
          r = quat4.multiply(quat4.multiply(
            quat4.createInverse(getBoneMotion(parent).r), q), motion.r)

          if bone.name.indexOf('\u3072\u3056') >= 0 # ひざ
            c = r[3] # cos(theta / 2)
            r = quat4.set([Math.sqrt(1 - c * c), 0, 0, c], r) # axis must be x direction
            quat4.inverse(boneMotions[bone.name].r, q)
            quat4.multiply(r, q, q)
            q = quat4.multiply(boneMotions[parent.name].r, q, q)

          individualBoneMotions[bone.name].rotation = quat4.normalize(r)
          boneMotions[bone.name].r = quat4.multiply(q, motion.r)

          delete boneMotions[affectedBones[j].name] for j in [0...i]
          delete boneMotions[target.name]

    for bone in model.bones
      getBoneMotion(bone)

    model.boneMotions = boneMotions

    return

  computeMatrices: ->
    @modelMatrix = mat4.createIdentity() # model aligned with the world for now

    @cameraPosition = vec3.create([0, 0, @distance]) # camera position in world space
    vec3.rotateX(@cameraPosition, @rotx)
    vec3.rotateY(@cameraPosition, @roty)
    vec3.moveBy(@cameraPosition, @center)

    up = [0, 1, 0]
    vec3.rotateX(up, @rotx)
    vec3.rotateY(up, @roty)

    @viewMatrix = mat4.lookAt(@cameraPosition, @center, up)

    @mvMatrix = mat4.createMultiply(@viewMatrix, @modelMatrix)

    @pMatrix = mat4.perspective(@fovy, @width / @height, 0.1, 1000.0)

    # normal matrix; inverse transpose of mvMatrix
    # model -> view space; only applied to directional vectors (not points)
    @nMatrix = mat4.inverseTranspose(@mvMatrix, mat4.create())
    return

  reindexBones: (model, bones) ->
    bonePosOriginal = []
    bonePosMoved = []
    boneRotations = []
    for boneIndex in bones
      bone = model.bones[boneIndex]
      bonePosOriginal.push(bone.head_pos[0], bone.head_pos[1], bone.head_pos[2])
      motion = model.boneMotions[bone.name]
      boneRotations.push(motion.r[0], motion.r[1], motion.r[2], motion.r[3])
      bonePosMoved.push(motion.p[0], motion.p[1], motion.p[2])
    @gl.uniform3fv(@program.uBonePosOriginal, bonePosOriginal)
    @gl.uniform3fv(@program.uBonePosMoved, bonePosMoved)
    @gl.uniform4fv(@program.uBoneRotations, boneRotations)
    return

  render: ->
    return if not @redraw and not @playing
    @redraw = false

    @gl.bindFramebuffer(@gl.FRAMEBUFFER, null)
    @gl.viewport(0, 0, @width, @height)
    @gl.clear(@gl.COLOR_BUFFER_BIT | @gl.DEPTH_BUFFER_BIT)

    for attribute, vb of @vbuffers
      @gl.bindBuffer(@gl.ARRAY_BUFFER, vb.buffer)
      @gl.vertexAttribPointer(@program[attribute], vb.size, @gl.FLOAT, false, 0, 0)

    @gl.bindBuffer(@gl.ELEMENT_ARRAY_BUFFER, @ibuffer)

    @setSelfShadowTexture()

    @setUniforms()

    @gl.enable(@gl.CULL_FACE)
    @gl.enable(@gl.BLEND)
    @gl.blendFuncSeparate(@gl.SRC_ALPHA, @gl.ONE_MINUS_SRC_ALPHA, @gl.SRC_ALPHA, @gl.DST_ALPHA)

    for material in @model.materials
      if @model.boneMotions
        @reindexBones(@model, material.bones)
        @gl.uniform1i(@program.uBoneMotion, true)

      @renderMaterial(material)

      @gl.uniform1i(@program.uBoneMotion, false)

    @gl.disable(@gl.BLEND)

    for material in @model.materials
      if @model.boneMotions
        @reindexBones(@model, material.bones)
        @gl.uniform1i(@program.uBoneMotion, true)

      @renderEdge(material)

      @gl.uniform1i(@program.uBoneMotion, false)

    @gl.disable(@gl.CULL_FACE)

    @renderAxes()

    @gl.flush()
    return

  setSelfShadowTexture: ->
    return if not @drawSelfShadow

    model = @model

    @shadowMap.computeMatrices()
    @shadowMap.beforeRender()

    for material in model.materials
      continue if 0.979 < material.alpha < 0.981 # alpha is 0.98
      if @model.boneMotions
        @reindexBones(model, material.bones)
        @gl.uniform1i(@program.uBoneMotion, true)

      sectionLength = material.endIndex - material.startIndex
      offset = material.startIndex * 2 # *2 because it's byte offset
      @gl.drawElements(@gl.TRIANGLES, sectionLength, @gl.UNSIGNED_SHORT, offset)

      @gl.uniform1i(@program.uBoneMotion, false)

    @shadowMap.afterRender()

    @gl.activeTexture(@gl.TEXTURE3) # 3 -> shadow map
    @gl.bindTexture(@gl.TEXTURE_2D, @shadowMap.getTexture())
    @gl.uniform1i(@program.uShadowMap, 3)
    @gl.uniformMatrix4fv(@program.uLightMatrix, false, @shadowMap.getLightMatrix())
    @gl.uniform1i(@program.uSelfShadow, true)

    # reset
    @gl.bindFramebuffer(@gl.FRAMEBUFFER, null)
    @gl.viewport(0, 0, @width, @height) # not needed on Windows Chrome but necessary on Mac Chrome
    return

  setUniforms: ->
    @gl.uniform1f(@program.uEdgeThickness, @edgeThickness)
    @gl.uniform3fv(@program.uEdgeColor, @edgeColor)
    @gl.uniformMatrix4fv(@program.uMVMatrix, false, @mvMatrix)
    @gl.uniformMatrix4fv(@program.uPMatrix, false, @pMatrix)
    @gl.uniformMatrix4fv(@program.uNMatrix, false, @nMatrix)

    # direction of light source defined in world space, then transformed to view space
    lightDirection = vec3.createNormalize(@lightDirection) # world space
    mat4.multiplyVec3(@nMatrix, lightDirection) # view space
    @gl.uniform3fv(@program.uLightDirection, lightDirection)

    @gl.uniform3fv(@program.uLightColor, @lightColor)
    return

  renderMaterial: (material) ->
    @gl.uniform3fv(@program.uAmbientColor, material.ambient)
    @gl.uniform3fv(@program.uSpecularColor, material.specular)
    @gl.uniform3fv(@program.uDiffuseColor, material.diffuse)
    @gl.uniform1f(@program.uAlpha, material.alpha)
    @gl.uniform1f(@program.uShininess, material.shininess)
    @gl.uniform1i(@program.uEdge, false)

    textures = material.textures

    @gl.activeTexture(@gl.TEXTURE0) # 0 -> toon
    @gl.bindTexture(@gl.TEXTURE_2D, textures.toon)
    @gl.uniform1i(@program.uToon, 0)

    if textures.regular
      @gl.activeTexture(@gl.TEXTURE1) # 1 -> regular texture
      @gl.bindTexture(@gl.TEXTURE_2D, textures.regular)
      @gl.uniform1i(@program.uTexture, 1)
    @gl.uniform1i(@program.uUseTexture, !!textures.regular)

    if textures.sph or textures.spa
      @gl.activeTexture(@gl.TEXTURE2) # 2 -> sphere map texture
      @gl.bindTexture(@gl.TEXTURE_2D, textures.sph || textures.spa)
      @gl.uniform1i(@program.uSphereMap, 2)
      @gl.uniform1i(@program.uUseSphereMap, true)
      @gl.uniform1i(@program.uIsSphereMapAdditive, !!textures.spa)
    else
      @gl.uniform1i(@program.uUseSphereMap, false)

    @gl.cullFace(@gl.BACK)

    sectionLength = material.endIndex - material.startIndex
    offset = material.startIndex * 2 # *2 because it's byte offset
    @gl.drawElements(@gl.TRIANGLES, sectionLength, @gl.UNSIGNED_SHORT, offset)

    return

  renderEdge: (material) ->
    return if not @drawEdge or not material.edge_flag

    @gl.uniform1i(@program.uEdge, true)
    @gl.cullFace(@gl.FRONT)

    sectionLength = material.endIndex - material.startIndex
    offset = material.startIndex * 2 # *2 because it's byte offset
    @gl.drawElements(@gl.TRIANGLES, sectionLength, @gl.UNSIGNED_SHORT, offset)

    @gl.cullFace(@gl.BACK)
    @gl.uniform1i(@program.uEdge, false)

  renderAxes: ->
    axisBuffer = @gl.createBuffer()
    @gl.bindBuffer(@gl.ARRAY_BUFFER, axisBuffer)
    @gl.vertexAttribPointer(@program.aVertexPosition, 3, @gl.FLOAT, false, 0, 0)
    if @drawAxes
      @gl.uniform1i(@program.uAxis, true)

      for i in [0...3]
        axis = [0, 0, 0, 0, 0, 0]
        axis[i] = 65 # from [65, 0, 0] to [0, 0, 0] etc.
        color = [0, 0, 0]
        color[i] = 1
        @gl.bufferData(@gl.ARRAY_BUFFER, new Float32Array(axis), @gl.STATIC_DRAW)
        @gl.uniform3fv(@program.uAxisColor, color)
        @gl.drawArrays(@gl.LINES, 0, 2)

      axis = [
        -50, 0, 0, 0, 0, 0 # negative x-axis (from [-50, 0, 0] to origin)
        0, 0, -50, 0, 0, 0 # negative z-axis (from [0, 0, -50] to origin)
      ]
      for i in [-50..50] by 5
        if i != 0
          axis.push(
            i,   0, -50,
            i,   0, 50, # one line parallel to the x-axis
            -50, 0, i,
            50,  0, i   # one line parallel to the z-axis
          )
      color = [0.7, 0.7, 0.7]
      @gl.bufferData(@gl.ARRAY_BUFFER, new Float32Array(axis), @gl.STATIC_DRAW)
      @gl.uniform3fv(@program.uAxisColor, color)
      @gl.drawArrays(@gl.LINES, 0, 84)

      @gl.uniform1i(@program.uAxis, false)

    # draw center point
    if @drawCenterPoint
      @gl.uniform1i(@program.uCenterPoint, true)
      @gl.bufferData(@gl.ARRAY_BUFFER, new Float32Array(this.center), @gl.STATIC_DRAW)
      @gl.drawArrays(@gl.POINTS, 0, 1)
      @gl.uniform1i(@program.uCenterPoint, false)

    @gl.deleteBuffer(axisBuffer)
    @gl.bindBuffer(@gl.ARRAY_BUFFER, null)

    return

  registerKeyListener: (element) ->
    element.addEventListener('keydown', (e) =>
      switch e.keyCode + e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000
        when 37 then @roty += Math.PI / 12 # left
        when 39 then @roty -= Math.PI / 12 # right
        when 38 then @rotx += Math.PI / 12 # up
        when 40 then @rotx -= Math.PI / 12 # down
        when 33 then @distance -= 3 * @distance / @DIST # pageup
        when 34 then @distance += 3 * @distance / @DIST # pagedown
        when 36 # home
          @rotx = @roty = 0
          @center = [0, 10, 0]
          @distance = @DIST
        when 1037 # shift + left
          vec3.multiplyMat4(@center, @mvMatrix)
          @center[0] -= @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
        when 1039 # shift + right
          vec3.multiplyMat4(@center, @mvMatrix)
          @center[0] += @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
        when 1038 # shift +  up
          vec3.multiplyMat4(@center, @mvMatrix)
          @center[1] += @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
        when 1040 # shift + down
          vec3.multiplyMat4(@center, @mvMatrix)
          @center[1] -= @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
        else return

      e.preventDefault()
      @redraw = true
    , false)
    return

  registerMouseListener: (element) ->
    @registerDragListener(element)
    @registerWheelListener(element)
    return

  registerDragListener: (element) ->
    element.addEventListener('mousedown', (e) =>
      return if e.button != 0
      modifier = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000
      return if modifier != 0 and modifier != 1000
      ox = e.clientX; oy = e.clientY

      move = (dx, dy, modi) =>
        if modi == 0
          @roty -= dx / 100
          @rotx -= dy / 100
          @redraw = true
        else if modi == 1000
          vec3.multiplyMat4(@center, @mvMatrix)
          @center[0] -= dx / 30 * @distance / @DIST
          @center[1] += dy / 30 * @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
          @redraw = true

      onmouseup = (e) =>
        return if e.button != 0
        modi = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000
        move(e.clientX - ox, e.clientY - oy, modi)
        element.removeEventListener('mouseup', onmouseup, false)
        element.removeEventListener('mousemove', onmousemove, false)
        e.preventDefault()

      onmousemove = (e) =>
        return if e.button != 0
        modi = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000
        x = e.clientX; y = e.clientY
        move(x - ox, y - oy, modi)
        ox = x; oy = y
        e.preventDefault()

      element.addEventListener('mouseup', onmouseup, false)
      element.addEventListener('mousemove', onmousemove, false)
    , false)
    return

  registerWheelListener: (element) ->
    onwheel = (e) =>
      delta = e.detail || e.wheelDelta / (-40) # positive: wheel down
      @distance += delta * @distance / @DIST
      @redraw = true
      e.preventDefault()

    if 'onmousewheel' of window
      element.addEventListener('mousewheel', onwheel, false)
    else
      element.addEventListener('DOMMouseScroll', onwheel, false)

    return

  initParameters: ->
    # camera/view settings
    @ignoreCameraMotion = false
    @rotx = @roty = 0
    @distance = @DIST = 35
    @center = [0, 10, 0]
    @fovy = 40

    # edge
    @drawEdge = true
    @edgeThickness = 0.004
    @edgeColor = [0, 0, 0]

    # light
    @lightDirection = [0.5, 1.0, 0.5]
    @lightDistance = 8875
    @lightColor = [0.6, 0.6, 0.6]

    # misc
    @drawSelfShadow = true
    @drawAxes = true
    @drawCenterPoint = false

    @fps = 30 # redraw every 1000/30 msec
    @playing = false
    @frame = -1
    return

  addCameraLightMotion: (motion, merge_flag, frame_offset) ->
    @motionManager.addCameraLightMotion(motion, merge_flag, frame_offset)
    return

  addModelMotion: (model, motion, merge_flag, frame_offset) ->
    @motionManager.addModelMotion(model, motion, merge_flag, frame_offset)
    return

  play: ->
    @playing = true
    return

  pause: ->
    @playing = false
    return

  rewind: ->
    @setFrameNumber(-1)
    return

  setFrameNumber: (num) ->
    @frame = num
    return

