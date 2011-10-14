MMDGL.VertexShaderSource = '''

  uniform mat4 uMVMatrix; // model-view matrix (model -> view space)
  uniform mat4 uPMatrix; // projection matrix (view -> projection space)
  uniform mat4 uNMatrix; // normal matrix (inverse of transpose of model-view matrix)

  uniform mat4 uLightMatrix; // mvpdMatrix of light space (model -> display space)

  attribute vec3 aVertexPosition;
  attribute vec3 aVertexNormal;
  attribute vec2 aTextureCoord;
  attribute float aVertexEdge; // 0 or 1. 1 if the vertex has an edge. (becuase we can't pass bool to attributes)

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

  void main() {
    // return vertex point in projection space
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    if (uCenterPoint) {
      gl_Position.z = 0.0; // always on top
      gl_PointSize = 16.0;
    }

    if (uGenerateShadowMap || uAxis || uCenterPoint) return;

    // for fragment shader
    vTextureCoord = aTextureCoord;
    vPosition = (uMVMatrix * vec4(aVertexPosition, 1.0)).xyz;
    vNormal = (uNMatrix * vec4(aVertexNormal, 1.0)).xyz;

    if (uSelfShadow) {
      vLightCoord = uLightMatrix * vec4(aVertexPosition, 1.0);
    }

    if (uEdge) {
      vec4 pos = gl_Position;
      vec4 pos2 = uPMatrix * uMVMatrix * vec4(aVertexPosition + aVertexNormal, 1.0);
      vec4 norm = normalize(pos2 - pos);
      gl_Position = pos + norm * uEdgeThickness * aVertexEdge * pos.w; // scale by pos.w to prevent becoming thicker when zoomed
      return;
    }
  }

'''
