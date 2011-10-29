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
  //var miku = new MMD.Model('Lat', 'Normal.pmd');
  //var miku = new MMD.Model('yufu', 'yufu.pmd');
  var miku = new MMD.Model('defoko', 'defoko.pmd');
  miku.load(function() {
    mmd.addModel(miku);
    mmd.initBuffers();
    mmd.start();

    var zoom = new MMD.Motion('motion/zoom_in.vmd');
    zoom.load(function() {
      mmd.addCameraLightMotion(zoom);

      var smile = new MMD.Motion('motion/smile.vmd');
      smile.load(function() {
        mmd.addModelMotion(miku, smile);

        var arm = new MMD.Motion('motion/arm.vmd');
        arm.load(function() {
          mmd.addModelMotion(miku, arm, true);
          mmd.addModelMotion(miku, arm, true, 60);

          mmd.play()
        });
      });
    });
  });
};
