window.onload = function() {
  var size = 512
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.border = 'solid black 1px';

  document.body.appendChild(canvas);

  var mmd = new MMDGL(canvas, canvas.width, canvas.height);
  mmd.initShaders();
  mmd.initParameters();

  var miku = new Model('model', 'Miku_Hatsune.pmd');
  //var miku = new Model('Lat', 'Normal.pmd');
  miku.load(function() {
    mmd.addModel(miku);
    mmd.initBuffers();
    mmd.start();

    var motion = new Motion('motion/smile.vmd');
    motion.load(function() {
      mmd.addMotion(motion);
      mmd.play();
    });
  });
};
