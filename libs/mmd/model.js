// see http://blog.goo.ne.jp/torisu_tetosuki/e/209ad341d3ece2b1b4df24abf619d6e4

size_Int8 = Int8Array.BYTES_PER_ELEMENT;
size_Uint8 = Uint8Array.BYTES_PER_ELEMENT;
size_Uint16 = Uint16Array.BYTES_PER_ELEMENT;
size_Uint32 = Uint32Array.BYTES_PER_ELEMENT;
size_Float32 = Float32Array.BYTES_PER_ELEMENT;

function Model(directory, filename) {
  this.directory = directory;
  this.filename = filename;
  this.buffer = null;
  this.vertices = null;
  this.faceVerts = null;
  this.materials = null;
}

Model.prototype.load = function(callback) {
  var xhr = new XMLHttpRequest;
  xhr.open('GET', this.directory + '/' + this.filename, true);
  xhr.responseType = 'arraybuffer';
  var that = this;
  xhr.onload = function() {
    that.buffer = xhr.response;
    that.getName();
    that.getVertices();
    that.getFaces();
    that.getMaterials();
    //TODO: 
    callback && callback();
  };
  xhr.send();
};

Model.prototype.getName = function() {
  var header = new Uint8Array(this.buffer, 0, 7 + 20 + 256);
  if (header[0] !== 'P'.charCodeAt(0) ||
      header[1] !== 'm'.charCodeAt(0) ||
      header[2] !== 'd'.charCodeAt(0) ||
      header[3] !== 0x00 ||
      header[4] !== 0x00 ||
      header[5] !== 0x80 ||
      header[6] !== 0x3F
  ) {
    throw 'File is not PMD';
  }
  this.name = sjisArrayToString(Array.prototype.slice.call(header, 7, 7 + 20));
  //console.log(this.name);
  this.comment = sjisArrayToString(Array.prototype.slice.call(header, 7 + 20, 7 + 20 + 256));
  //console.log(this.comment);
};

Model.prototype.getVertices = function() {
  var view = new DataView(this.buffer, this.getVertexBlockOffset());
  var length = view.getUint32(0, true);
  //console.log(view, length);
  this.vertices = [];
  for (var i = 0; i < length; i++) {
    this.vertices.push(new Vertex(view, size_Uint32 + i * Vertex.size));
  }
  //console.log(this.vertices[0]);
  //console.log(this.vertices[length - 1]);
};

Model.prototype.getFaces = function() {
  var view = new DataView(this.buffer, this.getFaceBlockOffset());
  var length = view.getUint32(0, true);
  this.faceVerts = new Uint16Array(length);
  //for (var i = 0; i < length; i++) {
    //this.faceVerts[i] = view.getUint16(size_Uint32 + i * size_Uint16, true);
  //}
  // 左手系→右手系変換 (0番目と1番目の頂点を入れ替え)
  for (var i = 0; i < length; i += 3) {
    this.faceVerts[i + 1] = view.getUint16(size_Uint32 + i * size_Uint16, true);
    this.faceVerts[i] = view.getUint16(size_Uint32 + (i + 1) * size_Uint16, true);
    this.faceVerts[i + 2] = view.getUint16(size_Uint32 + (i + 2) * size_Uint16, true);
  }
};

Model.prototype.getMaterials = function() {
  var view = new DataView(this.buffer, this.getMaterialBlockOffset());
  var length = view.getUint32(0, true);
  this.materials = [];
  for (var i = 0; i < length; i++) {
    this.materials.push(new Material(view, size_Uint32 + i * Material.size));
  }
  //console.log(this.materials);
  //console.log(this.materials[0]);
};


Model.prototype.getHeaderBlockSize = function() {
  return 7 + 20 + 256;
};

Model.prototype.getVertexBlockOffset = function() {
  return this.getHeaderBlockSize();
};

Model.prototype.getVertexBlockSize = function() {
  return size_Uint32 + this.vertices.length * Vertex.size;
}

Model.prototype.getFaceBlockOffset = function() {
  return this.getVertexBlockOffset() + this.getVertexBlockSize();
};

Model.prototype.getFaceBlockSize = function() {
  return size_Uint32 + this.faceVerts.length * size_Uint16;
};

Model.prototype.getMaterialBlockOffset = function() {
  return this.getFaceBlockOffset() + this.getFaceBlockSize();
};

//http://blog.goo.ne.jp/torisu_tetosuki/e/5a1b16e2f61067838dfc66d010389707
//float pos[3]; // x, y, z // 座標
//float normal_vec[3]; // nx, ny, nz // 法線ベクトル
//float uv[2]; // u, v // UV座標 // MMDは頂点UV
//WORD bone_num[2]; // ボーン番号1、番号2 // モデル変形(頂点移動)時に影響
//BYTE bone_weight; // ボーン1に与える影響度 // min:0 max:100 // ボーン2への影響度は、(100 - bone_weight)
//BYTE edge_flag; // 0:通常、1:エッジ無効 // エッジ(輪郭)が有効の場合
Vertex = function(view, offset) {
  this.x = view.getFloat32(offset, true); offset += size_Float32;
  this.y = view.getFloat32(offset, true); offset += size_Float32;
  this.z = - view.getFloat32(offset, true); offset += size_Float32; // 左手系→右手系変換
  this.nx = view.getFloat32(offset, true); offset += size_Float32;
  this.ny = view.getFloat32(offset, true); offset += size_Float32;
  this.nz = - view.getFloat32(offset, true); offset += size_Float32; // 左手系→右手系変換
  this.u = view.getFloat32(offset, true); offset += size_Float32;
  this.v = view.getFloat32(offset, true); offset += size_Float32;
  this.bone_num1 = view.getUint16(offset, true); offset += size_Uint16;
  this.bone_num2 = view.getUint16(offset, true); offset += size_Uint16;
  this.bone_weight = view.getUint8(offset); offset += size_Uint8;
  this.edge_flag = view.getUint8(offset); offset += size_Uint8;
};

Vertex.size = size_Float32 * 8 + size_Uint16 * 2 + size_Uint8 * 2; // 38

//http://blog.goo.ne.jp/torisu_tetosuki/e/ea0bb1b1d4c6ad98a93edbfe359dac32
//float diffuse_color[3]; // dr, dg, db // 減衰色
//float alpha;
//float specularity;
//float specular_color[3]; // sr, sg, sb // 光沢色
//float mirror_color[3]; // mr, mg, mb // 環境色(ambient)
//BYTE toon_index; // toon??.bmp // 0.bmp:0xFF, 1(01).bmp:0x00 ・・・ 10.bmp:0x09
//BYTE edge_flag; // 輪郭、影
//DWORD face_vert_count; // 面頂点数 // インデックスに変換する場合は、材質0から順に加算
//char texture_file_name[20]; // テクスチャファイル名またはスフィアファイル名 // 20バイトぎりぎりまで使える(終端の0x00は無くても動く)
Material = function(view, offset) {
  var tmp = [];
  tmp[0] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[1] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[2] = view.getFloat32(offset, true); offset += size_Float32;
  this.diffuse = new Float32Array(tmp);
  this.alpha = view.getFloat32(offset, true); offset += size_Float32;
  this.shininess = view.getFloat32(offset, true); offset += size_Float32;
  tmp[0] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[1] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[2] = view.getFloat32(offset, true); offset += size_Float32;
  this.specular = new Float32Array(tmp);
  tmp[0] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[1] = view.getFloat32(offset, true); offset += size_Float32;
  tmp[2] = view.getFloat32(offset, true); offset += size_Float32;
  this.ambient = new Float32Array(tmp);
  this.toon_index = view.getInt8(offset); offset += size_Int8;
  this.edge_flag = view.getUint8(offset); offset += size_Uint8;
  this.face_vert_count = view.getUint32(offset, true); offset += size_Uint32;
  var filename_sjis = [];
  for (var i = 0; i < 20; i++) {
    filename_sjis.push(view.getUint8(offset + size_Uint8 * i));
  }
  this.texture_file_name = sjisArrayToString(filename_sjis);
};

Material.size = size_Float32 * 11 + size_Uint8 * 2 + size_Uint32 + size_Uint8 * 20; // 70

