// utility for glMatrix
mat4.createIdentity = function() {
  return mat4.identity(mat4.create());
};
mat4.createMultiply = function(a, b) {
  return mat4.multiply(a, b, mat4.create());
};
mat4.createInverse = function(mat) {
  return mat4.inverse(mat, mat4.create());
};
mat4.inverseTranspose = function(mat, dest) {
  if (!dest || mat == dest) {
    return mat4.transpose(mat4.inverse(mat));
  }
  return mat4.transpose(mat4.inverse(mat, dest));
};
mat4.applyScale = function(mat, vec) {
  var scaling = mat4.scale(mat4.identity(mat4.create()), vec);
  return mat4.multiply(scaling, mat, mat);
};
mat4.applyTranslate = function(mat, vec) {
  var translation = mat4.translate(mat4.identity(mat4.create()), vec);
  return mat4.multiply(translation, mat, mat);
};
vec3.moveBy = vec3.add;
vec3.rotateX = function(vec, angle, dest) {
  var rotation = mat4.rotateX(mat4.identity(mat4.create()), angle);
  return mat4.multiplyVec3(rotation, vec, dest);
};
vec3.rotateY = function(vec, angle, dest) {
  var rotation = mat4.rotateY(mat4.identity(mat4.create()), angle);
  return mat4.multiplyVec3(rotation, vec, dest);
};
vec3.createNormalize = function(vec) {
  return vec3.normalize(vec3.create(vec));
};
vec3.lengthBetween = function(a, b) {
  return vec3.length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
};
vec3.multiplyMat4 = function(vec, mat, dest) {
  return mat4.multiplyVec3(mat, vec, dest);
};

