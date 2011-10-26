MMD.VertexShaderSource = '''

  uniform mat4 uMVMatrix; // model-view matrix (model -> view space)
  uniform mat4 uPMatrix; // projection matrix (view -> projection space)
  uniform mat4 uNMatrix; // normal matrix (inverse of transpose of model-view matrix)

  uniform mat4 uLightMatrix; // mvpdMatrix of light space (model -> display space)

  attribute vec3 aVertexPosition;
  attribute vec3 aVertexNormal;
  attribute vec2 aTextureCoord;
  attribute float aVertexEdge; // 0 or 1. 1 if the vertex has an edge. (becuase we can't pass bool to attributes)

  uniform bool uBoneMotion;
  uniform vec3 uBonePosOriginal[64];
  uniform vec3 uBonePosMoved[64];
  uniform vec4 uBoneRotations[64]; // quaternion

  attribute float aBone1;
  attribute float aBone2;
  attribute float aBoneWeight;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vTextureCoord;
  varying vec4 vLightCoord; // coordinate in light space; to be mapped onto shadow map

  uniform float uEdgeThickness;
  uniform bool uEdge;

  uniform bool uGenerateShadowMap;

  uniform bool uSelfShadow;

  uniform bool uAxis;
  uniform bool uCenterPoint;

  vec3 qtransform(vec4 q, vec3 v) {
    return v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz);
  }

  void main() {
    vec3 position = aVertexPosition;
    vec3 normal = aVertexNormal;

    if (uBoneMotion) {
      int b1 = int(aBone1);
      vec3 o1 = uBonePosOriginal[b1];
      vec3 p1 = uBonePosMoved[b1];
      vec4 q1 = uBoneRotations[b1];
      vec3 r1 = qtransform(q1, position - o1) + p1;

      int b2 = int(aBone2);
      vec3 o2 = uBonePosOriginal[b2];
      vec3 p2 = uBonePosMoved[b2];
      vec4 q2 = uBoneRotations[b2];
      vec3 r2 = qtransform(q2, position - o2) + p2;

      position = mix(r2, r1, aBoneWeight);

      vec3 n1 = qtransform(q1, normal);
      vec3 n2 = qtransform(q2, normal);

      normal = normalize(mix(n2, n1, aBoneWeight));
    }

    // return vertex point in projection space
    gl_Position = uPMatrix * uMVMatrix * vec4(position, 1.0);

    if (uCenterPoint) {
      gl_Position.z = 0.0; // always on top
      gl_PointSize = 16.0;
    }

    if (uGenerateShadowMap || uAxis || uCenterPoint) return;

    // for fragment shader
    vTextureCoord = aTextureCoord;
    vPosition = (uMVMatrix * vec4(position, 1.0)).xyz;
    vNormal = (uNMatrix * vec4(normal, 1.0)).xyz;

    if (uSelfShadow) {
      vLightCoord = uLightMatrix * vec4(position, 1.0);
    }

    if (uEdge) {
      vec4 pos = gl_Position;
      vec4 pos2 = uPMatrix * uMVMatrix * vec4(position + normal, 1.0);
      vec4 norm = normalize(pos2 - pos);
      gl_Position = pos + norm * uEdgeThickness * aVertexEdge * pos.w; // scale by pos.w to prevent becoming thicker when zoomed
      return;
    }
  }

'''
