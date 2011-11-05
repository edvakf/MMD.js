(function() {
  var __hasProp = Object.prototype.hasOwnProperty, __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (__hasProp.call(this, i) && this[i] === item) return i; } return -1; };

  this.MMD = (function() {

    function MMD(canvas, width, height) {
      this.width = width;
      this.height = height;
      this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!this.gl) {
        alert('WebGL not supported in your browser');
        throw 'WebGL not supported';
      }
    }

    MMD.prototype.initShaders = function() {
      var attributes, fshader, line, name, src, type, uniforms, vshader, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2, _ref3;
      vshader = this.gl.createShader(this.gl.VERTEX_SHADER);
      this.gl.shaderSource(vshader, MMD.VertexShaderSource);
      this.gl.compileShader(vshader);
      if (!this.gl.getShaderParameter(vshader, this.gl.COMPILE_STATUS)) {
        alert('Vertex shader compilation error');
        throw this.gl.getShaderInfoLog(vshader);
      }
      fshader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      this.gl.shaderSource(fshader, MMD.FragmentShaderSource);
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
      _ref = [MMD.VertexShaderSource, MMD.FragmentShaderSource];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        src = _ref[_i];
        _ref2 = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(';');
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          line = _ref2[_j];
          type = (_ref3 = line.match(/^\s*(uniform|attribute)\s+/)) != null ? _ref3[1] : void 0;
          if (!type) continue;
          name = line.match(/(\w+)(\[\d+\])?\s*$/)[1];
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

    MMD.prototype.addModel = function(model) {
      this.model = model;
    };

    MMD.prototype.initBuffers = function() {
      this.vbuffers = {};
      this.initVertices();
      this.initIndices();
      this.initTextures();
    };

    MMD.prototype.initVertices = function() {
      var bone1, bone2, buffer, data, edge, i, length, model, morphVec, normals, positions1, positions2, rotations1, rotations2, uvs, vectors1, vectors2, vertex, weight, _i, _len, _ref;
      model = this.model;
      length = model.vertices.length;
      weight = new Float32Array(length);
      vectors1 = new Float32Array(3 * length);
      vectors2 = new Float32Array(3 * length);
      rotations1 = new Float32Array(4 * length);
      rotations2 = new Float32Array(4 * length);
      positions1 = new Float32Array(3 * length);
      positions2 = new Float32Array(3 * length);
      morphVec = new Float32Array(3 * length);
      normals = new Float32Array(3 * length);
      uvs = new Float32Array(2 * length);
      edge = new Float32Array(length);
      for (i = 0; 0 <= length ? i < length : i > length; 0 <= length ? i++ : i--) {
        vertex = model.vertices[i];
        bone1 = model.bones[vertex.bone_num1];
        bone2 = model.bones[vertex.bone_num2];
        weight[i] = vertex.bone_weight;
        vectors1[3 * i] = vertex.x - bone1.head_pos[0];
        vectors1[3 * i + 1] = vertex.y - bone1.head_pos[1];
        vectors1[3 * i + 2] = vertex.z - bone1.head_pos[2];
        vectors2[3 * i] = vertex.x - bone2.head_pos[0];
        vectors2[3 * i + 1] = vertex.y - bone2.head_pos[1];
        vectors2[3 * i + 2] = vertex.z - bone2.head_pos[2];
        positions1[3 * i] = bone1.head_pos[0];
        positions1[3 * i + 1] = bone1.head_pos[1];
        positions1[3 * i + 2] = bone1.head_pos[2];
        positions2[3 * i] = bone2.head_pos[0];
        positions2[3 * i + 1] = bone2.head_pos[1];
        positions2[3 * i + 2] = bone2.head_pos[2];
        rotations1[4 * i + 3] = 1;
        rotations2[4 * i + 3] = 1;
        normals[3 * i] = vertex.nx;
        normals[3 * i + 1] = vertex.ny;
        normals[3 * i + 2] = vertex.nz;
        uvs[2 * i] = vertex.u;
        uvs[2 * i + 1] = vertex.v;
        edge[i] = 1 - vertex.edge_flag;
      }
      model.rotations1 = rotations1;
      model.rotations2 = rotations2;
      model.positions1 = positions1;
      model.positions2 = positions2;
      model.morphVec = morphVec;
      _ref = [
        {
          attribute: 'aBoneWeight',
          array: weight,
          size: 1
        }, {
          attribute: 'aVectorFromBone1',
          array: vectors1,
          size: 3
        }, {
          attribute: 'aVectorFromBone2',
          array: vectors2,
          size: 3
        }, {
          attribute: 'aBone1Rotation',
          array: rotations1,
          size: 4
        }, {
          attribute: 'aBone2Rotation',
          array: rotations2,
          size: 4
        }, {
          attribute: 'aBone1Position',
          array: positions1,
          size: 3
        }, {
          attribute: 'aBone2Position',
          array: positions2,
          size: 3
        }, {
          attribute: 'aMultiPurposeVector',
          array: morphVec,
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
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        data = _ref[_i];
        buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data.array, this.gl.STATIC_DRAW);
        this.vbuffers[data.attribute] = {
          size: data.size,
          buffer: buffer
        };
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };

    MMD.prototype.initIndices = function() {
      var indices;
      indices = this.model.triangles;
      this.ibuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    };

    MMD.prototype.initTextures = function() {
      var fileName, material, model, toonIndex, type, _i, _j, _len, _len2, _ref, _ref2;
      var _this = this;
      model = this.model;
      this.textureManager = new MMD.TextureManager(this);
      this.textureManager.onload = function() {
        return _this.redraw = true;
      };
      _ref = model.materials;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        material = _ref[_i];
        if (!material.textures) material.textures = {};
        toonIndex = material.toon_index;
        fileName = 'toon' + ('0' + (toonIndex + 1)).slice(-2) + '.bmp';
        if (toonIndex === -1 || !model.toon_file_names || fileName === model.toon_file_names[toonIndex]) {
          fileName = 'data/' + fileName;
        } else {
          fileName = model.directory + '/' + model.toon_file_names[toonIndex];
        }
        material.textures.toon = this.textureManager.get('toon', fileName);
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
              case '.tga':
                type = 'regular';
                fileName += '.png';
                break;
              default:
                type = 'regular';
            }
            material.textures[type] = this.textureManager.get(type, model.directory + '/' + fileName);
          }
        }
      }
    };

    MMD.prototype.start = function() {
      var before, count, interval, step, t0;
      var _this = this;
      this.gl.clearColor(1, 1, 1, 1);
      this.gl.clearDepth(1);
      this.gl.enable(this.gl.DEPTH_TEST);
      this.redraw = true;
      if (this.drawSelfShadow) this.shadowMap = new MMD.ShadowMap(this);
      this.motionManager = new MMD.MotionManager;
      count = 0;
      t0 = before = Date.now();
      interval = 1000 / this.fps;
      step = function() {
        var now;
        _this.move();
        _this.computeMatrices();
        _this.render();
        now = Date.now();
        if (++count % _this.fps === 0) {
          _this.realFps = _this.fps / (now - before) * 1000;
          before = now;
        }
        return setTimeout(step, (t0 + count * interval) - now);
      };
      step();
    };

    MMD.prototype.move = function() {
      if (!this.playing || this.textureManager.pendingCount > 0) return;
      if (++this.frame > this.motionManager.lastFrame) {
        this.pause();
        return;
      }
      this.moveCamera();
      this.moveLight();
      this.moveModel();
    };

    MMD.prototype.moveCamera = function() {
      var camera;
      camera = this.motionManager.getCameraFrame(this.frame);
      if (camera && !this.ignoreCameraMotion) {
        this.distance = camera.distance;
        this.rotx = camera.rotation[0];
        this.roty = camera.rotation[1];
        this.center = vec3.create(camera.location);
        this.fovy = camera.view_angle;
      }
    };

    MMD.prototype.moveLight = function() {
      var light;
      light = this.motionManager.getLightFrame(this.frame);
      if (light) {
        this.lightDirection = light.location;
        this.lightColor = light.color;
      }
    };

    MMD.prototype.moveModel = function() {
      var bones, model, morphs, _ref;
      model = this.model;
      _ref = this.motionManager.getModelFrame(model, this.frame), morphs = _ref.morphs, bones = _ref.bones;
      this.moveMorphs(model, morphs);
      this.moveBones(model, bones);
    };

    MMD.prototype.moveMorphs = function(model, morphs) {
      var b, base, i, j, morph, vert, weight, _i, _j, _len, _len2, _len3, _ref, _ref2, _ref3;
      if (!morphs) return;
      if (model.morphs.length === 0) return;
      _ref = model.morphs;
      for (j = 0, _len = _ref.length; j < _len; j++) {
        morph = _ref[j];
        if (j === 0) {
          base = morph;
          continue;
        }
        if (!(morph.name in morphs)) continue;
        weight = morphs[morph.name];
        _ref2 = morph.vert_data;
        for (_i = 0, _len2 = _ref2.length; _i < _len2; _i++) {
          vert = _ref2[_i];
          b = base.vert_data[vert.index];
          i = b.index;
          model.morphVec[3 * i] += vert.x * weight;
          model.morphVec[3 * i + 1] += vert.y * weight;
          model.morphVec[3 * i + 2] += vert.z * weight;
        }
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers.aMultiPurposeVector.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, model.morphVec, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      _ref3 = base.vert_data;
      for (_j = 0, _len3 = _ref3.length; _j < _len3; _j++) {
        b = _ref3[_j];
        i = b.index;
        model.morphVec[3 * i] = 0;
        model.morphVec[3 * i + 1] = 0;
        model.morphVec[3 * i + 2] = 0;
      }
    };

    MMD.prototype.moveBones = function(model, bones) {
      var bone, boneMotions, constrainedBones, getBoneMotion, i, individualBoneMotions, length, motion1, motion2, originalBonePositions, parentBones, pos1, pos2, positions1, positions2, resolveIKs, rot1, rot2, rotations1, rotations2, vertex, _len, _ref, _ref2, _ref3;
      if (!bones) return;
      individualBoneMotions = [];
      boneMotions = [];
      originalBonePositions = [];
      parentBones = [];
      constrainedBones = [];
      _ref = model.bones;
      for (i = 0, _len = _ref.length; i < _len; i++) {
        bone = _ref[i];
        individualBoneMotions[i] = (_ref2 = bones[bone.name]) != null ? _ref2 : {
          rotation: quat4.create([0, 0, 0, 1]),
          location: vec3.create()
        };
        boneMotions[i] = {
          r: quat4.create(),
          p: vec3.create(),
          tainted: true
        };
        originalBonePositions[i] = bone.head_pos;
        parentBones[i] = bone.parent_bone_index;
        if (bone.name.indexOf('\u3072\u3056') > 0) constrainedBones[i] = true;
      }
      getBoneMotion = function(boneIndex) {
        var m, motion, p, parentIndex, parentMotion, r, t;
        motion = boneMotions[boneIndex];
        if (motion && !motion.tainted) return motion;
        m = individualBoneMotions[boneIndex];
        r = quat4.set(m.rotation, motion.r);
        t = m.location;
        p = vec3.set(originalBonePositions[boneIndex], motion.p);
        if (parentBones[boneIndex] === 0xFFFF) {
          return boneMotions[boneIndex] = {
            p: vec3.add(p, t),
            r: r,
            tainted: false
          };
        } else {
          parentIndex = parentBones[boneIndex];
          parentMotion = getBoneMotion(parentIndex);
          r = quat4.multiply(parentMotion.r, r, r);
          p = vec3.subtract(p, originalBonePositions[parentIndex]);
          vec3.add(p, t);
          vec3.rotateByQuat4(p, parentMotion.r);
          vec3.add(p, parentMotion.p);
          return boneMotions[boneIndex] = {
            p: p,
            r: r,
            tainted: false
          };
        }
      };
      resolveIKs = function() {
        var axis, axisLen, boneIndex, bonePos, c, i, ik, ikbonePos, ikboneVec, ikboneVecLen, j, maxangle, minLength, motion, n, parentRotation, q, r, sinTheta, targetIndex, targetPos, targetVec, targetVecLen, theta, tmpQ, tmpR, _i, _len2, _ref3, _results;
        targetVec = vec3.create();
        ikboneVec = vec3.create();
        axis = vec3.create();
        tmpQ = quat4.create();
        tmpR = quat4.create();
        _ref3 = model.iks;
        _results = [];
        for (_i = 0, _len2 = _ref3.length; _i < _len2; _i++) {
          ik = _ref3[_i];
          maxangle = ik.control_weight * 4;
          ikbonePos = getBoneMotion(ik.bone_index).p;
          targetIndex = ik.target_bone_index;
          minLength = 0.1 * vec3.length(vec3.subtract(originalBonePositions[targetIndex], originalBonePositions[parentBones[targetIndex]], axis));
          _results.push((function() {
            var _ref4, _results2;
            _results2 = [];
            for (n = 0, _ref4 = ik.iterations; 0 <= _ref4 ? n < _ref4 : n > _ref4; 0 <= _ref4 ? n++ : n--) {
              targetPos = getBoneMotion(targetIndex).p;
              if (minLength > vec3.length(vec3.subtract(targetPos, ikbonePos, axis))) {
                break;
              }
              _results2.push((function() {
                var _len3, _ref5, _results3;
                _ref5 = ik.child_bones;
                _results3 = [];
                for (i = 0, _len3 = _ref5.length; i < _len3; i++) {
                  boneIndex = _ref5[i];
                  motion = getBoneMotion(boneIndex);
                  bonePos = motion.p;
                  if (i > 0) targetPos = getBoneMotion(targetIndex).p;
                  targetVec = vec3.subtract(targetPos, bonePos, targetVec);
                  targetVecLen = vec3.length(targetVec);
                  if (targetVecLen < minLength) continue;
                  ikboneVec = vec3.subtract(ikbonePos, bonePos, ikboneVec);
                  ikboneVecLen = vec3.length(ikboneVec);
                  if (ikboneVecLen < minLength) continue;
                  axis = vec3.cross(targetVec, ikboneVec, axis);
                  axisLen = vec3.length(axis);
                  sinTheta = axisLen / ikboneVecLen / targetVecLen;
                  if (sinTheta < 0.001) continue;
                  theta = Math.asin(sinTheta);
                  if (vec3.dot(targetVec, ikboneVec) < 0) {
                    theta = 3.141592653589793 - theta;
                  }
                  if (theta > maxangle) theta = maxangle;
                  q = quat4.set(vec3.scale(axis, Math.sin(theta / 2) / axisLen), tmpQ);
                  q[3] = Math.cos(theta / 2);
                  parentRotation = getBoneMotion(parentBones[boneIndex]).r;
                  r = quat4.inverse(parentRotation, tmpR);
                  r = quat4.multiply(quat4.multiply(r, q), motion.r);
                  if (constrainedBones[boneIndex]) {
                    c = r[3];
                    r = quat4.set([Math.sqrt(1 - c * c), 0, 0, c], r);
                    quat4.inverse(boneMotions[boneIndex].r, q);
                    quat4.multiply(r, q, q);
                    q = quat4.multiply(parentRotation, q, q);
                  }
                  quat4.normalize(r, individualBoneMotions[boneIndex].rotation);
                  quat4.multiply(q, motion.r, motion.r);
                  for (j = 0; 0 <= i ? j < i : j > i; 0 <= i ? j++ : j--) {
                    boneMotions[ik.child_bones[j]].tainted = true;
                  }
                  _results3.push(boneMotions[ik.target_bone_index].tainted = true);
                }
                return _results3;
              })());
            }
            return _results2;
          })());
        }
        return _results;
      };
      resolveIKs();
      for (i = 0, _ref3 = model.bones.length; 0 <= _ref3 ? i < _ref3 : i > _ref3; 0 <= _ref3 ? i++ : i--) {
        getBoneMotion(i);
      }
      rotations1 = model.rotations1;
      rotations2 = model.rotations2;
      positions1 = model.positions1;
      positions2 = model.positions2;
      length = model.vertices.length;
      for (i = 0; 0 <= length ? i < length : i > length; 0 <= length ? i++ : i--) {
        vertex = model.vertices[i];
        motion1 = boneMotions[vertex.bone_num1];
        motion2 = boneMotions[vertex.bone_num2];
        rot1 = motion1.r;
        pos1 = motion1.p;
        rot2 = motion2.r;
        pos2 = motion2.p;
        rotations1[i * 4] = rot1[0];
        rotations1[i * 4 + 1] = rot1[1];
        rotations1[i * 4 + 2] = rot1[2];
        rotations1[i * 4 + 3] = rot1[3];
        rotations2[i * 4] = rot2[0];
        rotations2[i * 4 + 1] = rot2[1];
        rotations2[i * 4 + 2] = rot2[2];
        rotations2[i * 4 + 3] = rot2[3];
        positions1[i * 3] = pos1[0];
        positions1[i * 3 + 1] = pos1[1];
        positions1[i * 3 + 2] = pos1[2];
        positions2[i * 3] = pos2[0];
        positions2[i * 3 + 1] = pos2[1];
        positions2[i * 3 + 2] = pos2[2];
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers.aBone1Rotation.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, rotations1, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers.aBone2Rotation.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, rotations2, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers.aBone1Position.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, positions1, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vbuffers.aBone2Position.buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, positions2, this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };

    MMD.prototype.computeMatrices = function() {
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

    MMD.prototype.render = function() {
      var attribute, material, offset, vb, _i, _j, _len, _len2, _ref, _ref2, _ref3;
      if (!this.redraw && !this.playing) return;
      this.redraw = false;
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.width, this.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      _ref = this.vbuffers;
      for (attribute in _ref) {
        vb = _ref[attribute];
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vb.buffer);
        this.gl.vertexAttribPointer(this.program[attribute], vb.size, this.gl.FLOAT, false, 0, 0);
      }
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);
      this.setSelfShadowTexture();
      this.setUniforms();
      this.gl.enable(this.gl.CULL_FACE);
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.SRC_ALPHA, this.gl.DST_ALPHA);
      offset = 0;
      _ref2 = this.model.materials;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        material = _ref2[_i];
        this.renderMaterial(material, offset);
        offset += material.face_vert_count;
      }
      this.gl.disable(this.gl.BLEND);
      offset = 0;
      _ref3 = this.model.materials;
      for (_j = 0, _len2 = _ref3.length; _j < _len2; _j++) {
        material = _ref3[_j];
        this.renderEdge(material, offset);
        offset += material.face_vert_count;
      }
      this.gl.disable(this.gl.CULL_FACE);
      this.renderAxes();
      this.gl.flush();
    };

    MMD.prototype.setSelfShadowTexture = function() {
      var material, model, offset, _i, _len, _ref, _ref2;
      if (!this.drawSelfShadow) return;
      model = this.model;
      this.shadowMap.computeMatrices();
      this.shadowMap.beforeRender();
      offset = 0;
      _ref = model.materials;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        material = _ref[_i];
        if ((0.979 < (_ref2 = material.alpha) && _ref2 < 0.981)) continue;
        this.gl.drawElements(this.gl.TRIANGLES, material.face_vert_count, this.gl.UNSIGNED_SHORT, offset * 2);
        offset += material.face_vert_count;
      }
      this.shadowMap.afterRender();
      this.gl.activeTexture(this.gl.TEXTURE3);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowMap.getTexture());
      this.gl.uniform1i(this.program.uShadowMap, 3);
      this.gl.uniformMatrix4fv(this.program.uLightMatrix, false, this.shadowMap.getLightMatrix());
      this.gl.uniform1i(this.program.uSelfShadow, true);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.width, this.height);
    };

    MMD.prototype.setUniforms = function() {
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

    MMD.prototype.renderMaterial = function(material, offset) {
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
      this.gl.cullFace(this.gl.BACK);
      this.gl.drawElements(this.gl.TRIANGLES, material.face_vert_count, this.gl.UNSIGNED_SHORT, offset * 2);
    };

    MMD.prototype.renderEdge = function(material, offset) {
      if (!this.drawEdge || !material.edge_flag) return;
      this.gl.uniform1i(this.program.uEdge, true);
      this.gl.cullFace(this.gl.FRONT);
      this.gl.drawElements(this.gl.TRIANGLES, material.face_vert_count, this.gl.UNSIGNED_SHORT, offset * 2);
      this.gl.cullFace(this.gl.BACK);
      return this.gl.uniform1i(this.program.uEdge, false);
    };

    MMD.prototype.renderAxes = function() {
      var axis, axisBuffer, color, i;
      axisBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, axisBuffer);
      this.gl.vertexAttribPointer(this.program.aMultiPurposeVector, 3, this.gl.FLOAT, false, 0, 0);
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
      }
      this.gl.deleteBuffer(axisBuffer);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    };

    MMD.prototype.registerKeyListener = function(element) {
      var _this = this;
      element.addEventListener('keydown', function(e) {
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
            _this.center[0] -= _this.distance / _this.DIST;
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
            _this.center[1] -= _this.distance / _this.DIST;
            vec3.multiplyMat4(_this.center, mat4.createInverse(_this.mvMatrix));
            break;
          default:
            return;
        }
        e.preventDefault();
        return _this.redraw = true;
      }, false);
    };

    MMD.prototype.registerMouseListener = function(element) {
      this.registerDragListener(element);
      this.registerWheelListener(element);
    };

    MMD.prototype.registerDragListener = function(element) {
      var _this = this;
      element.addEventListener('mousedown', function(e) {
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
          element.removeEventListener('mouseup', onmouseup, false);
          element.removeEventListener('mousemove', onmousemove, false);
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
        element.addEventListener('mouseup', onmouseup, false);
        return element.addEventListener('mousemove', onmousemove, false);
      }, false);
    };

    MMD.prototype.registerWheelListener = function(element) {
      var onwheel;
      var _this = this;
      onwheel = function(e) {
        var delta;
        delta = e.detail || e.wheelDelta / (-40);
        _this.distance += delta * _this.distance / _this.DIST;
        _this.redraw = true;
        return e.preventDefault();
      };
      if ('onmousewheel' in window) {
        element.addEventListener('mousewheel', onwheel, false);
      } else {
        element.addEventListener('DOMMouseScroll', onwheel, false);
      }
    };

    MMD.prototype.initParameters = function() {
      this.ignoreCameraMotion = false;
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
      this.drawCenterPoint = false;
      this.fps = 30;
      this.realFps = this.fps;
      this.playing = false;
      this.frame = -1;
    };

    MMD.prototype.addCameraLightMotion = function(motion, merge_flag, frame_offset) {
      this.motionManager.addCameraLightMotion(motion, merge_flag, frame_offset);
    };

    MMD.prototype.addModelMotion = function(model, motion, merge_flag, frame_offset) {
      this.motionManager.addModelMotion(model, motion, merge_flag, frame_offset);
    };

    MMD.prototype.play = function() {
      this.playing = true;
    };

    MMD.prototype.pause = function() {
      this.playing = false;
    };

    MMD.prototype.rewind = function() {
      this.setFrameNumber(-1);
    };

    MMD.prototype.setFrameNumber = function(num) {
      this.frame = num;
    };

    return MMD;

  })();

}).call(this);
