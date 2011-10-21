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
  mmd.registerKeyListener(document);
  mmd.registerMouseListener(document);

  //var miku = new MMD.Model('model', 'Miku_Hatsune.pmd');
  var miku = new MMD.Model('Lat', 'Normal.pmd');
  miku.load(function() {
    mmd.addModel(miku);
    mmd.initBuffers();
    mmd.start();

    var eyes = new MMD.Motion('motion/kottiminnna.vmd');
    eyes.load(function() {
      mmd.addMotion(eyes);
      mmd.play()
    });
  });
};
