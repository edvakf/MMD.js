(function() {
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  this.MMDGL = (function() {

    function MMDGL(canvas, width, height) {
      this.width = width;
      this.height = height;
      this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!this.gl) {
        alert('WebGL not supported in your browser');
        throw 'WebGL not supported';
      }
    }

    MMDGL.prototype.initShaders = function() {
      var attributes, fshader, line, name, src, type, uniforms, vshader, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2, _ref3;
      vshader = this.gl.createShader(this.gl.VERTEX_SHADER);
      this.gl.shaderSource(vshader, MMDGL.VertexShaderSource);
      this.gl.compileShader(vshader);
      if (!this.gl.getShaderParameter(vshader, this.gl.COMPILE_STATUS)) {
        alert('Vertex shader compilation error');
        throw this.gl.getShaderInfoLog(vshader);
      }
      fshader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      this.gl.shaderSource(fshader, MMDGL.FragmentShaderSource);
      this.gl.compileShader(fshader);
      if (!this.gl.getShaderParameter(fshader, this.gl.COMPILE_STATUS)) {
        alert('Fragment shader compilation error');
        throw this.gl.getShaderInfoLog(fshader);
      }
      this.program = this.gl.createProgram();
      this.gl.attachShader(this.program, vshader);
      this.gl.attachShader(this.program, fshader);
      this.gl.linkProgram(this.program);
      if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        alert('Shader linking error');
        throw this.gl.getProgramInfoLog(this.program);
      }
      this.gl.useProgram(this.program);
      attributes = [];
      uniforms = [];
      _ref = [MMDGL.VertexShaderSource, MMDGL.FragmentShaderSource];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        src = _ref[_i];
        _ref2 = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(';');
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          line = _ref2[_j];
          type = (_ref3 = line.match(/^\s*(uniform|attribute)\s+/)) != null ? _ref3[1] : void 0;
          if (!type) continue;
          name = line.match(/(\w+)\s*$/)[1];
          if (type === 'attribute' && __indexOf.call(attributes, name) < 0) {
            attributes.push(name);
          }
          if (type === 'uniform' && __indexOf.call(uniforms, name) < 0) {
            uniforms.push(name);
          }
        }
      }
      for (_k = 0, _len3 = attributes.length; _k < _len3; _k++) {
        name = attributes[_k];
        this.program[name] = this.gl.getAttribLocation(this.program, name);
        this.gl.enableVertexAttribArray(this.program[name]);
      }
      for (_l = 0, _len4 = uniforms.length; _l < _len4; _l++) {
        name = uniforms[_l];
        this.program[name] = this.gl.getUniformLocation(this.program, name);
      }
    };

    MMDGL.prototype.addModel = function(model) {
      this.model = model;
    };

    MMDGL.prototype.initBuffers = function() {
      this.initVertices();
      this.initIndices();
      this.initTextures();
    };

    MMDGL.prototype.initVertices = function() {
      var buffer, data, edge, i, length, model, normals, positions, uvs, vertex;
      model = this.model;
      length = model.vertices.length;
      positions = new Float32Array(3 * length);
      normals = new Float32Array(3 * length);
      uvs = new Float32Array(2 * length);
      edge = new Float32Array(length);
      for (i = 0; 0 <= length ? i < length : i > length; 0 <= length ? i++ : i--) {
        vertex = model.vertices[i];
        positions[3 * i] = vertex.x;
        positions[3 * i + 1] = vertex.y;
        positions[3 * i + 2] = vertex.z;
        normals[3 * i] = vertex.nx;
        normals[3 * i + 1] = vertex.ny;
        normals[3 * i + 2] = vertex.nz;
        uvs[2 * i] = vertex.u;
        uvs[2 * i + 1] = vertex.v;
        edge[i] = 1 - vertex.edge_flag;
      }
      model.positions = positions;
      this.vbuffers = (function() {
        var _i, _len, _ref, _results;
        _ref = [
          {
            attribute: 'aVertexPosition',
            array: positions,
            size: 3
          }, {
            attribute: 'aVertexNormal',
            array: normals,
            size: 3
          }, {
            attribute: 'aTextureCoord',
            array: uvs,
            size: 2
          }, {
            attribute: 'aVertexEdge',
            array: edge,
            size: 1
          }
        ];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          data = _ref[_i];
          buffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, data.array, this.gl.STATIC_DRAW);
          _results.push({
            attribute: data.attribute,
            size: data.size,
            buffer: buffer
          });
        }
        return _results;
      }).call(this);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };

    MMDGL.prototype.initIndices = function() {
      var indices;
      indices = this.model.triangles;
      this.ibuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    };

    MMDGL.prototype.initTextures = function() {
      var fileName, material, model, toonIndex, type, _i, _j, _len, _len2, _ref, _ref2;
      var _this = this;
      model = this.model;
      this.textureManager = new MMDGL.TextureManager(this);
      this.textureManager.onload = function() {
        return _this.redraw = true;
      };
      _ref = model.materials;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        material = _ref[_i];
        if (!material.textures) material.textures = {};
        toonIndex = material.toon_index;
        fileName = 'toon' + ('0' + (toonIndex + 1)).slice(-2) + '.bmp';
        material.textures.toon = this.textureManager.get('toon', 'data/' + fileName);
        if (material.texture_file_name) {
          _ref2 = material.texture_file_name.split('*');
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            fileName = _ref2[_j];
            switch (fileName.slice(-4)) {
              case '.sph':
                type = 'sph';
                break;
              case '.spa':
                type = 'spa';
                break;
              default:
                type = 'regular';
            }
            material.textures[type] = this.textureManager.get(type, model.directory + '/' + fileName);
          }
        }
      }
    };

    MMDGL.prototype.start = function() {
      var step, t0;
      var _this = this;
      this.gl.clearColor(1, 1, 1, 1);
      this.gl.clearDepth(1);
      this.gl.enable(this.gl.DEPTH_TEST);
      this.redraw = true;
      this.registerKeyListener();
      this.registerMouseListener();
      if (this.drawSelfShadow) this.shadowMap = new MMDGL.ShadowMap(this);
      this.motionManager = new MMDGL.MotionManager;
      t0 = Date.now();
      step = function() {
        var t1;
        _this.move();
        _this.computeMatrices();
        _this.render();
        t1 = Date.now();
        setTimeout(step, Math.max(0, 1000 / _this.fps * 2 - (t1 - t0)));
        return t0 = t1;
      };
      step();
    };

    MMDGL.prototype.move = function() {
      var b, base, bones, camera, i, light, model, morph, morphs, name, vert, weight, _i, _j, _len, _len2, _ref, _ref2, _ref3;
      if (!this.playing) return;
      this.frame++;
      model = this.model;
      _ref = this.motionManager.getFrame(this.frame), bones = _ref.bones, morphs = _ref.morphs, camera = _ref.camera, light = _ref.light;
      this.distance = camera.distance;
      this.rotx = camera.rotation[0];
      this.roty = camera.rotation[1];
      this.center = vec3.create(camera.location);
      this.fovy = camera.view_angle;
      this.lightDirection = light.location;
      this.lightColor = light.color;
      base = model.morphsDict['base'];
      for (name in morphs) {
        weight = morphs[name];
        morph = model.morphsDict[name];
        if (!morph) continue;
        _ref2 = morph.vert_data;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          vert = _ref2[_i];
          b = base.vert_data[vert.index];
          i = b.index;
          model.positions[3 * i] += vert.x * weight;
          model.positions[3 * i + 1] += vert.y * weight;
          model.positions[3 * i + 2] += vert.z * weight;
        }
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers[0].buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, model.positions, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      _ref3 = base.vert_data;
      for (_j = 0, _len2 = _ref3.length; _j < _len2; _j++) {
        b = _ref3[_j];
        i = b.index;
        model.positions[3 * i] = b.x;
        model.positions[3 * i + 1] = b.y;
        model.positions[3 * i + 2] = b.z;
      }
      if (this.frame > this.motionManager.lastFrame) this.pause();
    };

    MMDGL.prototype.computeMatrices = function() {
      var up;
      this.modelMatrix = mat4.createIdentity();
      this.cameraPosition = vec3.create([0, 0, this.distance]);
      vec3.rotateX(this.cameraPosition, this.rotx);
      vec3.rotateY(this.cameraPosition, this.roty);
      vec3.moveBy(this.cameraPosition, this.center);
      up = [0, 1, 0];
      vec3.rotateX(up, this.rotx);
      vec3.rotateY(up, this.roty);
      this.viewMatrix = mat4.lookAt(this.cameraPosition, this.center, up);
      this.mvMatrix = mat4.createMultiply(this.viewMatrix, this.modelMatrix);
      this.pMatrix = mat4.perspective(this.fovy, this.width / this.height, 0.1, 1000.0);
      this.nMatrix = mat4.inverseTranspose(this.mvMatrix, mat4.create());
    };

    MMDGL.prototype.render = function() {
      var i, material, offset, vb, _i, _len, _len2, _ref, _ref2;
      if (!this.redraw && !this.playing) return;
      this.redraw = false;
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.width, this.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      _ref = this.vbuffers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        vb = _ref[_i];
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vb.buffer);
        this.gl.vertexAttribPointer(this.program[vb.attribute], vb.size, this.gl.FLOAT, false, 0, 0);
      }
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);
      this.setSelfShadowTexture();
      this.setUniforms();
      offset = 0;
      _ref2 = this.model.materials;
      for (i = 0, _len2 = _ref2.length; i < _len2; i++) {
        material = _ref2[i];
        this.renderMaterial(material, offset);
        this.renderEdge(material, offset);
        offset += material.face_vert_count * 2;
      }
      this.renderAxes();
      this.gl.flush();
    };

    MMDGL.prototype.setSelfShadowTexture = function() {
      if (this.drawSelfShadow) {
        this.shadowMap.generate();
        this.gl.activeTexture(this.gl.TEXTURE3);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowMap.getTexture());
        this.gl.uniform1i(this.program.uShadowMap, 3);
        this.gl.uniformMatrix4fv(this.program.uLightMatrix, false, this.shadowMap.getLightMatrix());
        this.gl.uniform1i(this.program.uSelfShadow, true);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.width, this.height);
      }
    };

    MMDGL.prototype.setUniforms = function() {
      var lightDirection;
      this.gl.uniform1f(this.program.uEdgeThickness, this.edgeThickness);
      this.gl.uniform3fv(this.program.uEdgeColor, this.edgeColor);
      this.gl.uniformMatrix4fv(this.program.uMVMatrix, false, this.mvMatrix);
      this.gl.uniformMatrix4fv(this.program.uPMatrix, false, this.pMatrix);
      this.gl.uniformMatrix4fv(this.program.uNMatrix, false, this.nMatrix);
      lightDirection = vec3.createNormalize(this.lightDirection);
      mat4.multiplyVec3(this.nMatrix, lightDirection);
      this.gl.uniform3fv(this.program.uLightDirection, lightDirection);
      this.gl.uniform3fv(this.program.uLightColor, this.lightColor);
    };

    MMDGL.prototype.renderMaterial = function(material, offset) {
      var textures;
      this.gl.uniform3fv(this.program.uAmbientColor, material.ambient);
      this.gl.uniform3fv(this.program.uSpecularColor, material.specular);
      this.gl.uniform3fv(this.program.uDiffuseColor, material.diffuse);
      this.gl.uniform1f(this.program.uAlpha, material.alpha);
      this.gl.uniform1f(this.program.uShininess, material.shininess);
      this.gl.uniform1i(this.program.uEdge, false);
      textures = material.textures;
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, textures.toon);
      this.gl.uniform1i(this.program.uToon, 0);
      if (textures.regular) {
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, textures.regular);
        this.gl.uniform1i(this.program.uTexture, 1);
      }
      this.gl.uniform1i(this.program.uUseTexture, !!textures.regular);
      if (textures.sph || textures.spa) {
        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D, textures.sph || textures.spa);
        this.gl.uniform1i(this.program.uSphereMap, 2);
        this.gl.uniform1i(this.program.uUseSphereMap, true);
        this.gl.uniform1i(this.program.uIsSphereMapAdditive, !!textures.spa);
      } else {
        this.gl.uniform1i(this.program.uUseSphereMap, false);
      }
      this.gl.drawElements(this.gl.TRIANGLES, material.face_vert_count, this.gl.UNSIGNED_SHORT, offset);
    };

    MMDGL.prototype.renderEdge = function(material, offset) {
      if (this.drawEdge && material.edge_flag) {
        this.gl.uniform1i(this.program.uEdge, true);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.FRONT);
        this.gl.drawElements(this.gl.TRIANGLES, material.face_vert_count, this.gl.UNSIGNED_SHORT, offset);
        this.gl.disable(this.gl.CULL_FACE);
      }
    };

    MMDGL.prototype.renderAxes = function() {
      var axis, axisBuffer, color, i;
      axisBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, axisBuffer);
      this.gl.vertexAttribPointer(this.program.aVertexPosition, 3, this.gl.FLOAT, false, 0, 0);
      if (this.drawAxes) {
        this.gl.uniform1i(this.program.uAxis, true);
        for (i = 0; i < 3; i++) {
          axis = [0, 0, 0, 0, 0, 0];
          axis[i] = 65;
          color = [0, 0, 0];
          color[i] = 1;
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(axis), this.gl.STATIC_DRAW);
          this.gl.uniform3fv(this.program.uAxisColor, color);
          this.gl.drawArrays(this.gl.LINES, 0, 2);
        }
        axis = [-50, 0, 0, 0, 0, 0, 0, 0, -50, 0, 0, 0];
        for (i = -50; i <= 50; i += 5) {
          if (i !== 0) axis.push(i, 0, -50, i, 0, 50, -50, 0, i, 50, 0, i);
        }
        color = [0.7, 0.7, 0.7];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(axis), this.gl.STATIC_DRAW);
        this.gl.uniform3fv(this.program.uAxisColor, color);
        this.gl.drawArrays(this.gl.LINES, 0, 84);
        this.gl.uniform1i(this.program.uAxis, false);
      }
      if (this.drawCenterPoint) {
        this.gl.uniform1i(this.program.uCenterPoint, true);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.center), this.gl.STATIC_DRAW);
        this.gl.drawArrays(this.gl.POINTS, 0, 1);
        this.gl.uniform1i(this.program.uCenterPoint, false);
        this.gl.deleteBuffer(axisBuffer);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      }
    };

    MMDGL.prototype.registerKeyListener = function() {
      var _this = this;
      document.addEventListener('keydown', function(e) {
        switch (e.keyCode + e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000) {
          case 37:
            _this.roty += Math.PI / 12;
            break;
          case 39:
            _this.roty -= Math.PI / 12;
            break;
          case 38:
            _this.rotx += Math.PI / 12;
            break;
          case 40:
            _this.rotx -= Math.PI / 12;
            break;
          case 33:
            _this.distance -= 3 * _this.distance / _this.DIST;
            break;
          case 34:
            _this.distance += 3 * _this.distance / _this.DIST;
            break;
          case 36:
            _this.rotx = _this.roty = 0;
            _this.center = [0, 10, 0];
            _this.distance = _this.DIST;
            break;
          case 1037:
            vec3.multiplyMat4(_this.center, _this.mvMatrix);
            _this.center[0] += _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            break;
          case 1039:
            vec3.multiplyMat4(_this.center, _this.mvMatrix);
            _this.center[0] += _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            break;
          case 1038:
            vec3.multiplyMat4(_this.center, _this.mvMatrix);
            _this.center[1] += _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            break;
          case 1040:
            vec3.multiplyMat4(_this.center, _this.mvMatrix);
            _this.center[1] += _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            break;
          default:
            return;
        }
        e.preventDefault();
        return _this.redraw = true;
      }, false);
    };

    MMDGL.prototype.registerMouseListener = function() {
      var _this = this;
      document.addEventListener('mousedown', function(e) {
        var modifier, move, onmousemove, onmouseup, ox, oy;
        if (e.button !== 0) return;
        modifier = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000;
        if (modifier !== 0 && modifier !== 1000) return;
        ox = e.clientX;
        oy = e.clientY;
        move = function(dx, dy, modi) {
          if (modi === 0) {
            _this.roty -= dx / 100;
            _this.rotx -= dy / 100;
            return _this.redraw = true;
          } else if (modi === 1000) {
            vec3.multiplyMat4(_this.center, _this.mvMatrix);
            _this.center[0] -= dx / 30 * _this.distance / _this.DIST;
            _this.center[1] += dy / 30 * _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            return _this.redraw = true;
          }
        };
        onmouseup = function(e) {
          var modi;
          if (e.button !== 0) return;
          modi = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000;
          move(e.clientX - ox, e.clientY - oy, modi);
          document.removeEventListener('mouseup', onmouseup, false);
          document.removeEventListener('mousemove', onmousemove, false);
          return e.preventDefault();
        };
        onmousemove = function(e) {
          var modi, x, y;
          if (e.button !== 0) return;
          modi = e.shiftKey * 1000 + e.ctrlKey * 10000 + e.altKey * 100000;
          x = e.clientX;
          y = e.clientY;
          move(x - ox, y - oy, modi);
          ox = x;
          oy = y;
          return e.preventDefault();
        };
        document.addEventListener('mouseup', onmouseup, false);
        return document.addEventListener('mousemove', onmousemove, false);
      }, false);
      document.addEventListener('mousewheel', function(e) {
        var delta;
        delta = e.detail || e.wheelDelta / (-40);
        _this.distance += delta * _this.distance / _this.DIST;
        return e.preventDefault();
      }, false);
    };

    MMDGL.prototype.initParameters = function() {
      this.rotx = this.roty = 0;
      this.distance = this.DIST = 35;
      this.center = [0, 10, 0];
      this.fovy = 40;
      this.drawEdge = true;
      this.edgeThickness = 0.004;
      this.edgeColor = [0, 0, 0];
      this.lightDirection = [0.5, 1.0, 0.5];
      this.lightDistance = 8875;
      this.lightColor = [0.6, 0.6, 0.6];
      this.drawSelfShadow = true;
      this.drawAxes = true;
      this.drawCenterPoint = true;
      this.fps = 30;
      this.playing = false;
      this.frame = -1;
    };

    MMDGL.prototype.addMotion = function(motion) {
      this.motionManager.addMotion(motion);
    };

    MMDGL.prototype.play = function() {
      this.playing = true;
    };

    MMDGL.prototype.pause = function() {
      this.playing = false;
    };

    MMDGL.prototype.rewind = function() {
      this.setFrameNumber(-1);
    };

    MMDGL.prototype.setFrameNumber = function(num) {
      this.frame = num;
    };

    return MMDGL;

  })();

}).call(this);
