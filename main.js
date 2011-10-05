window.onload = function() {
  var canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 500;
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
    this.redrawNext = true;
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

  var indices = this.model.faceVerts;

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

  this.redrawNext = true;
  this.registerKeyListener();
  setInterval(this.redraw.bind(this), 50);
};

MMDGL.prototype.redraw = function redraw() {
  if (!this.redrawNext) return;
  this.redrawNext = false;

  var gl = this.gl;
  var program = this.program;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, this.width, this.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  this.computeMatrices();

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
    gl.uniformMatrix4fv(program.uLightMatrix, false, this.shadowMap.lightMatrix);
    gl.uniform1i(program.uSelfShadow, true);

    // reset
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  this.setUniforms();

  this.model.materials.reduce(function(offset, material) {
    this.renderMaterial(material, offset);
    this.renderEdge(material, offset);

    // offset is in bytes (size of unsigned short = 2)
    return offset + material.face_vert_count * 2;
  }.bind(this), 0);

  gl.flush();
};

MMDGL.prototype.computeMatrices = function computeMatrices() {
  this.modelMatrix = mat4.create();
  mat4.identity(this.modelMatrix); // model aligned with the world for now

  var rotationMatrix = mat4.create(); // to rotate camera position according to rotx and roty
  mat4.identity(rotationMatrix);
  mat4.rotateY(rotationMatrix, this.roty);
  mat4.rotateX(rotationMatrix, this.rotx);

  this.cameraPosition = vec3.create(); // camera position in world space
  mat4.multiplyVec3(rotationMatrix, [0, 0, this.distance], this.cameraPosition);
  this.center = vec3.add([this.movx, this.movy, 0], this.initialCenter);
  vec3.add(this.cameraPosition, this.center);

  this.viewMatrix = mat4.lookAt(this.cameraPosition, this.center, [0, 1, 0]);

  this.mvMatrix = mat4.create();
  mat4.multiply(this.viewMatrix, this.modelMatrix, this.mvMatrix);

  this.pMatrix = mat4.perspective(this.fovy, this.width / this.height, 0.1, 200.0);

  // normal matrix; inverse transpose of mvMatrix;
  // model -> view space; only applied to directional vectors (not points)
  this.nMatrix = mat4.create();
  mat4.inverse(this.mvMatrix, this.nMatrix);
  mat4.transpose(this.nMatrix);
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
  var lightDirection = vec3.create(this.lightDirection); // world space
  vec3.normalize(lightDirection);
  mat4.multiplyVec3(this.nMatrix, lightDirection); // view space
  vec3.normalize(lightDirection);
  gl.uniform3fv(program.uLightDirection, lightDirection);

  var lightColor = vec3.create(this.lightColor);
  vec3.scale(lightColor, 1 / 255);
  gl.uniform3fv(program.uLightColor, lightColor);
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

MMDGL.prototype.registerKeyListener = function registerKeyListener() {
  document.addEventListener('keydown', function(e) {
    switch(e.keyCode + e.shiftKey * 1000) {
      case 37: this.roty += Math.PI / 12; break; // left
      case 39: this.roty -= Math.PI / 12; break; // right
      case 38: this.rotx = Math.atan(Math.tan(this.rotx) + 1/2); break; // up
      case 40: this.rotx = Math.atan(Math.tan(this.rotx) - 1/2); break; // down
      case 33: this.distance -= 3 * this.distance / this.DIST; break; // pageup
      case 34: this.distance += 3 * this.distance / this.DIST; break; // pagedown
      //case 35: this.movx -= 3; break; // end
      case 36: with(this){rotx = roty = movx = movy = 0; distance = DIST;} break; // home
      case 1037: this.movx += this.distance / this.DIST; break; // left
      case 1039: this.movx -= this.distance / this.DIST; break; // right
      case 1038: this.movy -= this.distance / this.DIST; break; // up
      case 1040: this.movy += this.distance / this.DIST; break; // down
      default: return;
    }
    e.preventDefault();
    this.redrawNext = true;
  }.bind(this), false);
};

MMDGL.prototype.initParameters = function initParameters() {
  // camera/view settings
  this.rotx = this.roty = 0;
  this.movx = this.movy = 0;
  this.distance = this.DIST = 35;
  this.initialCenter = [0, 10, 0];
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
  this.faceVertsLength = mmdgl.model.faceVerts.length;
  this.viewBroadness = 1;

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
  var gl = this.gl;
  var program = this.program;

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

  gl.viewport(0, 0, this.width, this.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(program.uGenerateShadowMap, true);

  // from mmd's vectors and matrices, calculate the "light" space's transform matrices

  var center = vec3.create(this.mmd.center); // center of view in world space

  var lightDirection = vec3.create(this.mmd.lightDirection); // this becomes a camera direction in light space
  vec3.normalize(lightDirection);
  vec3.add(lightDirection, center);

  var cameraPosition = vec3.create(this.mmd.cameraPosition);
  var lengthScale = vec3.length(vec3.subtract(cameraPosition, center));
  var viewSize = lengthScale * this.viewBroadness;

  var viewMatrix = mat4.lookAt(lightDirection, center, [0, 1, 0]);

  var mvMatrix = mat4.create();
  mat4.multiply(viewMatrix, this.mmd.modelMatrix, mvMatrix);
  gl.uniformMatrix4fv(program.uMVMatrix, false, mvMatrix);

  mat4.multiplyVec3(viewMatrix, center); // transform center in view space
  var left = center[0] - viewSize;
  var right = center[0] + viewSize;
  var bottom = center[1] - viewSize;
  var top = center[1] + viewSize;
  var near = -viewSize; // orthographic projection; near can be negative
  var far = viewSize;
  var pMatrix = mat4.ortho(left, right, bottom, top, near, far);
  gl.uniformMatrix4fv(program.uPMatrix, false, pMatrix);

  var mvpMatrix = mat4.multiply(pMatrix, mvMatrix);

  gl.drawElements(gl.TRIANGLES, this.faceVertsLength, gl.UNSIGNED_SHORT, 0);

  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  // for debug (display shadow map)
  //var pixelarray = new Uint8Array(this.width * this.height * 4);
  //gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelarray);
  //var canvas = document.getElementById('shadowmap');
  //if (!canvas) {
    //var canvas = document.createElement('canvas');
    //canvas.id = 'shadowmap';
    //canvas.width = this.width;
    //canvas.height = this.height;
    //canvas.style.border = 'solid black 1px';
    //canvas.style.width = this.mmd.width + 'px';
    //canvas.style.height = this.mmd.height + 'px';
    //document.body.appendChild(canvas);
  //}
  //var ctx = canvas.getContext('2d');
  //var imageData = ctx.getImageData(0, 0, this.width, this.height);
  //var data = imageData.data;
  //for (var i = 0, l = data.length; i < l; i++) {
    //data[i] = pixelarray[i];
  //}
  //ctx.putImageData(imageData, 0, 0);

  // display matrix transforms projection space to screen space. in fragment shader screen coordinates are available as gl_FragCoord
  // http://www.c3.club.kyutech.ac.jp/gamewiki/index.php?3D%BA%C2%C9%B8%CA%D1%B4%B9
  this.lightMatrix = mvpMatrix;
  //this.lightMatrix = mat4.scale(this.lightMatrix, [0.5, 0.5, 0.5]);
  //this.lightMatrix = mat4.translate(this.lightMatrix, [0.5, 0.5, 0.5]);

  gl.uniform1i(program.uGenerateShadowMap, false);
};

MMDGL.ShadowMap.prototype.getTexture = function getTexture() {
  return this.texture;
};
