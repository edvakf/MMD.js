window.onload = function() {
  var size = 512
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.border = 'solid black 1px';

  document.body.appendChild(canvas);

  var miku = new Model('model', 'Miku_Hatsune.pmd');
  //var miku = new Model('Lat', 'Normal.pmd');
  miku.load(function() {
    var mmd = new MMDGL(canvas, canvas.width, canvas.height);
    mmd.addModel(miku);
    mmd.initShaders();
    mmd.initBuffers();
    mmd.initParameters();
    mmd.start();
  });
};
