window.onload = function() {
  var size = 512
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.border = 'solid black 1px';

  document.body.appendChild(canvas);

  var miku = new Model('model', 'Miku_Hatsune.pmd');
  //var miku = new Model('home', 'haruka.pmd');
  //var miku = new Model('Lat', 'Normal.pmd');
  miku.load(function() {
    var mmd = new MMDGL(canvas, canvas.width, canvas.height);
    mmd.initShaders(
      document.getElementById('vshader').textContent,
      document.getElementById('fshader').textContent);
    mmd.addModel(miku);
    mmd.initBuffers();
    mmd.initParameters();
    if (mmd.selfShadow)mmd.shadowMap = new MMDGL.ShadowMap(mmd);
    mmd.start();
  });
};

function MMDGL(canvas, width, height) {
  var gl;
  ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"].some(function(name, i) {
    try { gl = canvas.getContext(name); } catch(e) {}
    return !!gl
  });
  if(!gl) {
    alert("WebGL not supported");
    return;
  }
  this.gl = gl;
  this.width = width;
  this.height = height;

  this.textureManager = new MMDGL.TextureManager(this);
  this.textureManager.onload = function() {
    this.redraw = true;
  }.bind(this);
}

MMDGL.prototype.initShaders = function initShaders(vshaderSrc, fshaderSrc) {
  var gl = this.gl; 

  var vshader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vshader, vshaderSrc);
  gl.compileShader(vshader);
  if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS))
    return alert(gl.getShaderInfoLog(vshader));

  var fshader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fshader, fshaderSrc);
  gl.compileShader(fshader);
  if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS))
    return alert(gl.getShaderInfoLog(fshader));

  var program = gl.createProgram();
  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);

  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    return alert(gl.getProgramInfoLog(program));

  gl.useProgram(program);

  var attributes = [];
  var uniforms = [];
  [vshaderSrc, fshaderSrc].forEach(function getVariables(src) {
    src.
      replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split(';').
      forEach(function(line) {
        var m = line.match(/^\s*(uniform|attribute)\s+/);
        if (!m) return;
        var name = line.match(/(\w+)\s*$/)[1];
        if (m[1] === 'attribute') attributes.push(name);
        if (m[1] === 'uniform') uniforms.push(name);
      });
  });

  attributes.forEach(function(name) {
    program[name] = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(program[name]);
  });

  uniforms.forEach(function(name) {
    program[name] = gl.getUniformLocation(program, name);
  });

  this.program = program;
};

MMDGL.prototype.addModel = function addModel(model) {
  this.model = model; // TODO: multi model
};

MMDGL.prototype.initBuffers = function initBuffers() {
  this.initVertices();
  this.initIndices();
  this.initTextures();
};

MMDGL.prototype.initVertices = function initVertices() {
  var gl = this.gl;
  var model = this.model;

  var length = model.vertices.length;
  var positions = new Float32Array(3 * length);
  var normals = new Float32Array(3 * length);
  var uvs = new Float32Array(2 * length);
  var edge = new Float32Array(length);
  for (var i = 0; i < length; i++) {
    var vertex = model.vertices[i];
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

  var vbuffers = this.vbuffers = [
    {attribute: 'aVertexPosition', array: positions, size: 3},
    {attribute: 'aVertexNormal', array: normals, size: 3},
    {attribute: 'aTextureCoord', array: uvs, size: 2},
    {attribute: 'aVertexEdge', array: edge, size: 1},
  ];
  vbuffers.forEach(function(vb) {
    vb.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vb.array, gl.STATIC_DRAW);
    vb.array = null; // no longer needed
  });
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

MMDGL.prototype.initIndices = function initIndices() {
  var gl = this.gl;

  var indices = this.model.triangles;

  this.ibuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

MMDGL.prototype.initTextures = function initTextures() {
  var model = this.model;
  var textureManager = this.textureManager;

  model.materials.forEach(function(material) {
    if (!material.textures) material.textures = {};
    var toonIndex = material.toon_index;
    material.textures.toon = textureManager.get('toon', 'data/toon' + ('0' + (toonIndex + 1)).slice(-2) + '.bmp');
    if (material.texture_file_name) {
      material.texture_file_name.split('*').forEach(function(fileName) {
        var type;
        switch (fileName.slice(-4)) {
          case '.sph' : type = 'sph'; break;
          case '.spa' : type = 'spa'; break;
          default:      type = 'regular';
        }
        material.textures[type] = textureManager.get(type, model.directory + '/' + fileName);
      });
    }
  });
};

MMDGL.prototype.start = function start() {
  var gl = this.gl;
  gl.clearColor(1, 1, 1, 1);
  gl.clearDepth(1); // ?
  gl.enable(gl.DEPTH_TEST);

  this.redraw = true;
  this.registerKeyListener();
  this.registerMouseListener();
  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame;

  if (requestAnimationFrame) {
    requestAnimationFrame(function animate() {
      this.computeMatrices();
      this.render();
      requestAnimationFrame(animate.bind(this));
    }.bind(this));
  } else {
    setInterval(function() {
      this.computeMatrices();
      this.render();
    }.bind(this), 1000/60);
  }
};

MMDGL.prototype.render = function render() {
  if (!this.redraw) return;
  this.redraw = false;

  var gl = this.gl;
  var program = this.program;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, this.width, this.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  this.vbuffers.forEach(function(vb) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vb.buffer);
    gl.vertexAttribPointer(program[vb.attribute], vb.size, gl.FLOAT, false, 0, 0);
  });

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuffer);

  if (this.selfShadow) {
    this.shadowMap.generate();

    gl.activeTexture(gl.TEXTURE3); // 3 -> shadow map
    gl.bindTexture(gl.TEXTURE_2D, this.shadowMap.getTexture());
    gl.uniform1i(program.uShadowMap, 3);
    gl.uniformMatrix4fv(program.uLightMatrix, false, this.shadowMap.getLightMatrix());
    gl.uniform1i(program.uSelfShadow, true);

    // reset
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height); // not needed on Windows Chrome but necessary on Mac Chrome
  }

  this.setUniforms();

  this.model.materials.reduce(function(offset, material) {
    this.renderMaterial(material, offset);
    this.renderEdge(material, offset);

    // offset is in bytes (size of unsigned short = 2)
    return offset + material.face_vert_count * 2;
  }.bind(this), 0);

  this.renderAxes();

  gl.flush();
};

MMDGL.prototype.computeMatrices = function computeMatrices() {
  this.modelMatrix = mat4.createIdentity(); // model aligned with the world for now

  this.cameraPosition = vec3.create([0, 0, this.distance]); // camera position in world space
  vec3.rotateX(this.cameraPosition, this.rotx);
  vec3.rotateY(this.cameraPosition, this.roty);
  vec3.moveBy(this.cameraPosition, this.center);

  var up = [0, 1, 0];
  vec3.rotateX(up, this.rotx);
  vec3.rotateY(up, this.roty);

  this.viewMatrix = mat4.lookAt(this.cameraPosition, this.center, up);

  this.mvMatrix = mat4.createMultiply(this.viewMatrix, this.modelMatrix);

  this.pMatrix = mat4.perspective(this.fovy, this.width / this.height, 0.1, 200.0);

  // normal matrix; inverse transpose of mvMatrix;
  // model -> view space; only applied to directional vectors (not points)
  this.nMatrix = mat4.inverseTranspose(this.mvMatrix, mat4.create());
};

MMDGL.prototype.renderMaterial = function renderMaterial(material, offset) {
  var gl = this.gl;
  var program = this.program;

  gl.uniform3fv(program.uAmbientColor, material.ambient);
  gl.uniform3fv(program.uSpecularColor, material.specular);
  gl.uniform3fv(program.uDiffuseColor, material.diffuse);
  gl.uniform1f(program.uAlpha, material.alpha);
  gl.uniform1f(program.uShininess, material.shininess);
  gl.uniform1i(program.uEdge, false);

  var textures = material.textures;

  gl.activeTexture(gl.TEXTURE0); // 0 -> toon
  gl.bindTexture(gl.TEXTURE_2D, textures.toon);
  gl.uniform1i(program.uToon, 0);

  if (textures.regular) {
    gl.activeTexture(gl.TEXTURE1); // 1 -> regular texture
    gl.bindTexture(gl.TEXTURE_2D, textures.regular);
    gl.uniform1i(program.uTexture, 1);
  }
  gl.uniform1i(program.uUseTexture, !!textures.regular);

  if (textures.sph || textures.spa) {
    gl.activeTexture(gl.TEXTURE2); // 2 -> sphere map texture
    gl.bindTexture(gl.TEXTURE_2D, textures.sph || textures.spa);
    gl.uniform1i(program.uSphereMap, 2);
    gl.uniform1i(program.uUseSphereMap, true);
    gl.uniform1i(program.uIsSphereMapAdditive, !!textures.spa);
  } else {
    gl.uniform1i(program.uUseSphereMap, false);
  }

  gl.drawElements(gl.TRIANGLES, material.face_vert_count, gl.UNSIGNED_SHORT, offset);
};

MMDGL.prototype.renderEdge = function renderEdge(material, offset) {
  var gl = this.gl;
  var program = this.program;

  if (this.drawEdge && material.edge_flag) {
    gl.uniform1i(program.uEdge, true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.drawElements(gl.TRIANGLES, material.face_vert_count, gl.UNSIGNED_SHORT, offset);
    gl.disable(gl.CULL_FACE);
  }
};

MMDGL.prototype.renderAxes = function renderAxes() {
  var gl = this.gl;
  var program = this.program;
  var axis, color;

  var axisBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, axisBuffer);
  gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.uniform1i(program.uAxis, true);

  axis = [
    0, 0, 0,
    65, 0, 0
  ];
  color = [1, 0, 0];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axis), gl.STATIC_DRAW);
  gl.uniform3fv(program.uAxisColor, color);
  gl.drawArrays(gl.LINES, 0, 2);

  axis = [
    0, 0, 0,
    0, 65, 0
  ];
  color = [0, 1, 0];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axis), gl.STATIC_DRAW);
  gl.uniform3fv(program.uAxisColor, color);
  gl.drawArrays(gl.LINES, 0, 2);

  axis = [
    0, 0, 0,
    0, 0, 65
  ];
  color = [0, 0, 1];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axis), gl.STATIC_DRAW);
  gl.uniform3fv(program.uAxisColor, color);
  gl.drawArrays(gl.LINES, 0, 2);

  axis = [];
  for (var i = -50; i <= 50; i += 5) if (i !== 0) {
    axis.push(
      i, 0, -50,
      i, 0, 50, // one line parallel to the x-axis
      -50, 0, i,
      50, 0, i // one line parallel to the z-axis
    );
  }
  axis.push(
    0, 0, -50,
    0, 0, 0,
    -50, 0, 0,
    0, 0, 0
  );
  color = [0.7, 0.7, 0.7];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(axis), gl.STATIC_DRAW);
  gl.uniform3fv(program.uAxisColor, color);
  gl.drawArrays(gl.LINES, 0, 84);

  gl.uniform1i(program.uAxis, false);

  // draw center point
  gl.uniform1i(program.uCenterPoint, true);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.center), gl.STATIC_DRAW);
  gl.drawArrays(gl.POINTS, 0, 1);
  gl.uniform1i(program.uCenterPoint, false);

  gl.deleteBuffer(axisBuffer);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

MMDGL.prototype.setUniforms = function setUniforms() {
  var gl = this.gl;
  var program = this.program;

  gl.uniform1f(program.uEdgeThickness, this.edgeThickness);
  gl.uniform3fv(program.uEdgeColor, this.edgeColor);
  gl.uniformMatrix4fv(program.uMVMatrix, false, this.mvMatrix);
  gl.uniformMatrix4fv(program.uPMatrix, false, this.pMatrix);
  gl.uniformMatrix4fv(program.uNMatrix, false, this.nMatrix);

  // direction of light source defined in world space, then transformed to view space
  var lightDirection = vec3.createNormalize(this.lightDirection); // world space
  mat4.multiplyVec3(this.nMatrix, lightDirection); // view space
  gl.uniform3fv(program.uLightDirection, lightDirection);

  var lightColor = vec3.scale(this.lightColor, 1 / 255, vec3.create());
  gl.uniform3fv(program.uLightColor, lightColor);
};

MMDGL.prototype.registerKeyListener = function registerKeyListener() {
  document.addEventListener('keydown', function(e) {
    switch(e.keyCode + e.shiftKey * 1000 + e.ctrlKey *10000 + e.altKey * 100000) {
      case 37: this.roty += Math.PI / 12; break; // left
      case 39: this.roty -= Math.PI / 12; break; // right
      case 38: this.rotx += Math.PI / 12; break; // up
      case 40: this.rotx -= Math.PI / 12; break; // down
      case 33: this.distance -= 3 * this.distance / this.DIST; break; // pageup
      case 34: this.distance += 3 * this.distance / this.DIST; break; // pagedown
      //case 35: break; // end
      case 36: // home
        this.rotx = this.roty = 0;
        this.center = [0, 10, 0];
        this.distance = this.DIST;
        break;
      case 1037: // shift + left
        vec3.multiplyMat4(this.center, this.mvMatrix);
        this.center[0] += this.distance / this.DIST;
        vec3.multiplyMat4(this.center, mat4.createInverse(this.mvMatrix));
        break;
      case 1039: // shift + right
        vec3.multiplyMat4(this.center, this.mvMatrix);
        this.center[0] -= this.distance / this.DIST;
        vec3.multiplyMat4(this.center, mat4.createInverse(this.mvMatrix));
        break;
      case 1038: // shift + up
        vec3.multiplyMat4(this.center, this.mvMatrix);
        this.center[1] -= this.distance / this.DIST;
        vec3.multiplyMat4(this.center, mat4.createInverse(this.mvMatrix));
        break;
      case 1040: // shift + down
        vec3.multiplyMat4(this.center, this.mvMatrix);
        this.center[1] += this.distance / this.DIST;
        vec3.multiplyMat4(this.center, mat4.createInverse(this.mvMatrix));
        break;
      default: return;
    }
    e.preventDefault();
    this.redraw = true;
  }.bind(this), false);
};

MMDGL.prototype.registerMouseListener = function registerMouseListener() {
  // drag
  document.addEventListener('mousedown', function onmousedown(e) {
    if (e.button != 0) return;
    var modifier = e.shiftKey * 1000 + e.ctrlKey *10000 + e.altKey * 100000;
    if (modifier !== 0 && modifier !== 1000) return;
    var ox = e.clientX, oy = e.clientY;

    var move = function (dx, dy, modi) {
      if (modi === 0) {
        this.roty -= dx / 100;
        this.rotx -= dy / 100;
        this.redraw = true;
      } else if (modi === 1000){
        vec3.multiplyMat4(this.center, this.mvMatrix);
        this.center[0] -= dx / 30 * this.distance / this.DIST;
        this.center[1] += dy / 30 * this.distance / this.DIST;
        vec3.multiplyMat4(this.center, mat4.createInverse(this.mvMatrix));
        this.redraw = true;
      }
    }.bind(this);

    var onmouseup = function(e) {
      if (e.button != 0) return;
      var modi = e.shiftKey * 1000 + e.ctrlKey *10000 + e.altKey * 100000;
      move(e.clientX - ox, e.clientY - oy, modi);
      document.removeEventListener('mouseup', onmouseup, false);
      document.removeEventListener('mousemove', onmousemove, false);
      e.preventDefault();
    }.bind(this);

    var onmousemove = function(e) {
      if (e.button != 0) return;
      var modi = e.shiftKey * 1000 + e.ctrlKey *10000 + e.altKey * 100000;
      var x = e.clientX, y = e.clientY;
      move(x - ox, y - oy, modi);
      ox = x, oy = y;
      e.preventDefault();
    }.bind(this);

    document.addEventListener('mouseup', onmouseup, false);
    document.addEventListener('mousemove', onmousemove, false);
  }.bind(this), false);

  // wheel
  document.addEventListener('mousewheel', function scroll(e) {
    var delta = e.detail || e.wheelDelta / (-40); // wheel down -> positive
    this.distance += delta * this.distance / this.DIST;
    e.preventDefault();
  }.bind(this), false);
};

MMDGL.prototype.initParameters = function initParameters() {
  // camera/view settings
  this.rotx = this.roty = 0;
  this.distance = this.DIST = 35;
  this.center = [0, 10, 0];
  this.fovy = 40;

  // edge
  this.drawEdge = true;
  this.edgeThickness = 0.004;
  this.edgeColor = [0, 0, 0];

  // light
  this.lightDirection = [0.5, 1.0, 0.5];
  this.lightDistance = 8875;
  this.lightColor = [154, 154, 154];

  this.selfShadow = true;
};


/*
* TextureManager class
* var textures = new TextureManager(mmdgl);
* textures.get(url);
*/
MMDGL.TextureManager = function TextureManager(mmdgl) {
  this.mmdgl = mmdgl;
  this.gl = mmdgl.gl;
  this.store = {};
};

MMDGL.TextureManager.checkSize = function checkSize(img) {
  var w = img.naturalWidth, h = img.naturalHeight;
  var size = Math.pow(2, Math.log(Math.min(w, h)) / Math.LN2 | 0); // largest 2^n integer that does not exceed s
  if (w !== h || w !== size) {
    var canv = document.createElement('canvas');
    canv.height = canv.width = size;
    canv.getContext('2d').drawImage(img, 0, 0, w, h, 0, 0, size, size);
    img = canv;
  }
  return img;
};

MMDGL.TextureManager.loadImage = function loadImage(url, callback) {
  var img = new Image;
  img.onload = function() {
    callback(img);
  };
  img.onerror = function() {
    alert('failed to load image: ' + url);
  };
  img.src = url;
  return img;
};

MMDGL.TextureManager.prototype.get = function(type, url) {
  var texture = this.store[url];
  if (texture) return texture;

  var gl = this.gl;
  var texture = this.store[url] = gl.createTexture();

  MMDGL.TextureManager.loadImage(url, function(img) {
    img = MMDGL.TextureManager.checkSize(img);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (type === 'toon') {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.onload && this.onload(img);
  }.bind(this));

  return texture;
};


/*
* MMDGL.ShadowMap class
* var shadowMap = new MMDGL.ShadowMap(this);
* shadowMap.generate();
* var shadowMapTexture = shadowMap.getTexture();
*/
MMDGL.ShadowMap = function ShadowMap(mmdgl) {
  this.mmd = mmdgl;
  this.gl = mmdgl.gl;
  this.program = mmdgl.program;
  this.framebuffer = this.texture = null;
  this.width = this.height = 2048;
  this.trianglesLength = mmdgl.model.triangles.length;
  this.viewBroadness = 0.6;
  this.debug = false;

  this.initFramebuffer();
};

MMDGL.ShadowMap.prototype.initFramebuffer = function initFramebuffer() {
  var gl = this.gl;

  this.framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

  this.texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  var renderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

MMDGL.ShadowMap.prototype.generate = function generate() {
  this.computeMatrices();
  this.render();
};

MMDGL.ShadowMap.prototype.computeMatrices = function computeMatrices() {
  // from mmd's vectors and matrices, calculate the "light" space's transform matrices

  var center = vec3.create(this.mmd.center); // center of view in world space

  var lightDirection = vec3.createNormalize(this.mmd.lightDirection); // this becomes a camera direction in light space
  vec3.add(lightDirection, center);

  var cameraPosition = vec3.create(this.mmd.cameraPosition);
  var lengthScale = vec3.lengthBetween(cameraPosition, center);
  var size = lengthScale * this.viewBroadness; // size of shadow map

  var viewMatrix = mat4.lookAt(lightDirection, center, [0, 1, 0]);

  this.mvMatrix = mat4.createMultiply(viewMatrix, this.mmd.modelMatrix);

  mat4.multiplyVec3(viewMatrix, center); // transform center in view space
  var cx = center[0], cy = center[1];
  this.pMatrix = mat4.ortho(cx - size, cx + size, cy - size, cy + size, -size, size); // orthographic projection; near can be negative
};

MMDGL.ShadowMap.prototype.render = function render() {
  var gl = this.gl;
  var program = this.program;

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

  gl.viewport(0, 0, this.width, this.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(program.uGenerateShadowMap, true);
  gl.uniformMatrix4fv(program.uMVMatrix, false, this.mvMatrix);
  gl.uniformMatrix4fv(program.uPMatrix, false, this.pMatrix);

  gl.drawElements(gl.TRIANGLES, this.trianglesLength, gl.UNSIGNED_SHORT, 0);

  gl.uniform1i(program.uGenerateShadowMap, false);

  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (this.debug) this.debugTexture();
};

MMDGL.ShadowMap.prototype.getLightMatrix = function getLightMatrix() {
  // display matrix transforms projection space to screen space. in fragment shader screen coordinates are available as gl_FragCoord
  // http://www.c3.club.kyutech.ac.jp/gamewiki/index.php?3D%BA%C2%C9%B8%CA%D1%B4%B9
  var lightMatrix = mat4.createMultiply(this.pMatrix, this.mvMatrix);
  mat4.applyScale(lightMatrix, [0.5, 0.5, 0.5]);
  mat4.applyTranslate(lightMatrix, [0.5, 0.5, 0.5]);
  return lightMatrix;
};

MMDGL.ShadowMap.prototype.debugTexture = function debugTexture() {
  var gl = this.gl;
  var pixelarray = new Uint8Array(this.width * this.height * 4);
  gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelarray);

  var canvas = document.getElementById('shadowmap');
  if (!canvas) {
    var canvas = document.createElement('canvas');
    canvas.id = 'shadowmap';
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.style.border = 'solid black 1px';
    canvas.style.width = this.mmd.width + 'px';
    canvas.style.height = this.mmd.height + 'px';
    document.body.appendChild(canvas);
  }
  var ctx = canvas.getContext('2d');
  var imageData = ctx.getImageData(0, 0, this.width, this.height);
  var data = imageData.data;
  for (var i = 0, l = data.length; i < l; i++) {
    data[i] = pixelarray[i];
  }
  ctx.putImageData(imageData, 0, 0);
};

MMDGL.ShadowMap.prototype.getTexture = function getTexture() {
  return this.texture;
};
