class this.MMDGL
  constructor: (canvas, @width, @height) ->
    @gl = canvas.getContext('webgl') or canvas.getContext('experimental-webgl')
    if not @gl
      alert('WebGL not supported in your browser')
      throw 'WebGL not supported'

  initShaders: ->
    vshader = @gl.createShader(@gl.VERTEX_SHADER)
    @gl.shaderSource(vshader, MMDGL.VertexShaderSource)
    @gl.compileShader(vshader)
    if not @gl.getShaderParameter(vshader, @gl.COMPILE_STATUS)
      alert('Vertex shader compilation error')
      throw @gl.getShaderInfoLog(vshader)

    fshader = @gl.createShader(@gl.FRAGMENT_SHADER)
    @gl.shaderSource(fshader, MMDGL.FragmentShaderSource)
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
    for src in [MMDGL.VertexShaderSource, MMDGL.FragmentShaderSource]
      for line in src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(';')
        type = line.match(/^\s*(uniform|attribute)\s+/)?[1]
        continue if not type
        name = line.match(/(\w+)\s*$/)[1]
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
    @initVertices()
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

    @vbuffers =
      for data in [
        {attribute: 'aVertexPosition', array: positions, size: 3},
        {attribute: 'aVertexNormal', array: normals, size: 3},
        {attribute: 'aTextureCoord', array: uvs, size: 2},
        {attribute: 'aVertexEdge', array: edge, size: 1},
      ]
        buffer = @gl.createBuffer()
        @gl.bindBuffer(@gl.ARRAY_BUFFER, buffer)
        @gl.bufferData(@gl.ARRAY_BUFFER, data.array, @gl.STATIC_DRAW)
        {attribute: data.attribute, size: data.size, buffer: buffer}

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

    @textureManager = new MMDGL.TextureManager(this)
    @textureManager.onload = => @redraw = true

    for material in model.materials
      material.textures = {} if not material.textures
      toonIndex = material.toon_index
      fileName = 'toon' + ('0' + (toonIndex + 1)).slice(-2) + '.bmp'
      material.textures.toon = @textureManager.get('toon', 'data/' + fileName)
      if material.texture_file_name
        for fileName in material.texture_file_name.split('*')
          switch fileName.slice(-4)
            when '.sph' then type = 'sph'
            when '.spa' then type = 'spa'
            else             type = 'regular'
          material.textures[type] = @textureManager.get(type, model.directory + '/' + fileName)

    return

  start: ->
    @gl.clearColor(1, 1, 1, 1)
    @gl.clearDepth(1)
    @gl.enable(@gl.DEPTH_TEST)

    @redraw = true
    @registerKeyListener()
    @registerMouseListener()

    @shadowMap = new MMDGL.ShadowMap(this) if @drawSelfShadow

    t0 = Date.now()
    step = =>
      @computeMatrices()
      @render()
      t1 = Date.now()
      setTimeout(step, Math.max(0, @fps - (t1 - t0)))
      t0 = t1

    step()
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

  render: ->
    return if not @redraw
    @redraw = false

    @gl.bindFramebuffer(@gl.FRAMEBUFFER, null)
    @gl.viewport(0, 0, @width, @height)
    @gl.clear(@gl.COLOR_BUFFER_BIT | @gl.DEPTH_BUFFER_BIT)

    for vb in @vbuffers
      @gl.bindBuffer(@gl.ARRAY_BUFFER, vb.buffer)
      @gl.vertexAttribPointer(@program[vb.attribute], vb.size, @gl.FLOAT, false, 0, 0)

    @gl.bindBuffer(@gl.ELEMENT_ARRAY_BUFFER, @ibuffer)

    @setSelfShadowTexture()

    @setUniforms()

    offset = 0
    for material in @model.materials
      @renderMaterial(material, offset)
      @renderEdge(material, offset)
      # offset is in bytes (size of unsigned short = 2)
      offset += material.face_vert_count * 2

    @renderAxes()

    @gl.flush()
    return

  setSelfShadowTexture: ->
    if @drawSelfShadow
      @shadowMap.generate()

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

  renderMaterial: (material, offset) ->
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

    @gl.drawElements(@gl.TRIANGLES, material.face_vert_count, @gl.UNSIGNED_SHORT, offset)
    return

  renderEdge: (material, offset) ->
    if @drawEdge and material.edge_flag
      @gl.uniform1i(@program.uEdge, true)
      @gl.enable(@gl.CULL_FACE)
      @gl.cullFace(@gl.FRONT)
      @gl.drawElements(@gl.TRIANGLES, material.face_vert_count, @gl.UNSIGNED_SHORT, offset)
      @gl.disable(@gl.CULL_FACE)
    return

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

  registerKeyListener: ->
    document.addEventListener('keydown', (e) =>
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
          @center[0] += @distance / @DIST
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
          @center[1] += @distance / @DIST
          vec3.multiplyMat4(@center, mat4.createInverse(@mvMatrix))
        else return

      e.preventDefault()
      @redraw = true
    , false)
    return

  registerMouseListener: ->
    #drag
    document.addEventListener('mousedown', (e) =>
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
        document.removeEventListener('mouseup', onmouseup, false)
        document.removeEventListener('mousemove', onmousemove, false)
        e.preventDefault()

      onmousemove = (e) =>
        return if e.button != 0
        modi = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000
        x = e.clientX; y = e.clientY
        move(x - ox, y - oy, modi)
        ox = x; oy = y
        e.preventDefault()

      document.addEventListener('mouseup', onmouseup, false)
      document.addEventListener('mousemove', onmousemove, false)
    , false)

    #wheel
    document.addEventListener('mousewheel', (e) =>
      delta = e.detail || e.wheelDelta / (-40) # positive: wheel down
      @distance += delta * @distance / @DIST
      e.preventDefault()
    , false)
    return

  initParameters: ->
    # camera/view settings
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
    @lightColor = [154 / 255, 154 / 255, 154 / 255]

    # misc
    @drawSelfShadow = true
    @drawAxes = true
    @drawCenterPoint = true

    @fps = 30 # redraw every 30 msec
    return
