window.onload = function() {
  var size = 512
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.border = 'solid black 1px';

  document.body.appendChild(canvas);

  var mmd = new MMD(canvas, canvas.width, canvas.height);
  mmd.initShaders();
  mmd.initParameters();

  var miku = new MMD.Model('model', 'Miku_Hatsune.pmd');
  //var miku = new Model('Lat', 'Normal.pmd');
  miku.load(function() {
    mmd.addModel(miku);
    mmd.initBuffers();
    mmd.start();

    var smile = new MMD.Motion('motion/smile.vmd');
    smile.load(function() {
      mmd.addMotion(smile);

      var camera = new MMD.Motion('motion/zoom_in.vmd');
      camera.load(function() {
        mmd.addMotion(camera);
        mmd.play();
      });
    });
  });
};
