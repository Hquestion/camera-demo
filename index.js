(function() {
    /**
     * 播放器类
     * @constructor
     */
    var Player = function() {
        let player = document.createElement('video');
        player.autoplay = true;
        player.controls = true;
        this.player = player;
    };

    Player.prototype.setSource = function(src) {
        if (typeof src === 'object') {
            this.player.srcObject = src;
        } else {
            this.player.src = src;
        }
    };

    Player.prototype.setRect = function(rect) {
        this.player.width = rect.width;
        this.player.height = rect.height;
    };

    Player.prototype.attach = function(el) {
        el = el || document.body;
        el.appendChild(this.player);
    };


    /**
     * 画布类
     * @constructor
     */
    var Canvas = function () {
        let canvas = document.createElement('canvas');
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    };

    Canvas.prototype.setRect = function(rect) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    };

    Canvas.prototype.attach = function (el) {
        el = el || document.body;
        el.appendChild(this.canvas);
    };

    /**
     * 下载连接类
     * @constructor
     */
    var DownloadLink = function() {
        this.link = document.createElement('a');
    };

    DownloadLink.prototype.setLabel = function(label) {
        this.link.text = label;
    };

    DownloadLink.prototype.setHref = function(href) {
        this.link.href = href;
    };

    DownloadLink.prototype.attach = function(el) {
        el = el || document.body;
        el.appendChild(this.link);
    };

    /**
     * 摄像头类
     * @param opt
     * @constructor
     */
    var Camera = function(opt) {
        this.device = opt.device;
        this.stopped = false;
        this.recorder = null;
        this.recordChunks = [];
        this.canvas = opt.canvas;
        this.player = opt.player;
        this.canvasRecorder = null;
        this.canvasRecordChunks = [];
        this.canvasRecordLink = opt.link;
    };

    /**
     * 请求摄像头,指定设备ID
     * @returns {Promise<MediaStream | never>}
     */
    Camera.prototype.requestMedia = function() {
        const self = this;
        return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                deviceId: this.device.deviceId
            }
        }).then(function(stream) {
            if (self.player) {
                self.player.setSource(stream);
            }
            return stream;
        });
    };

    /**
     * 开始录制
     * @param stream
     * @param interval
     */
    Camera.prototype.startRecord = function(stream, interval) {
        var self = this;
        if (this.recorder && !this.stopped) {
            console.error('正在录制!');
            return;
        }
        this.stopped = false;
        // 同时开启Canvas录制
        this.startCanvasRecord(10);

        this.recordChunks = [];
        this.recorder = new MediaRecorder(stream, {mimeType: 'video/webm'});
        this.recorder.addEventListener('dataavailable', function(e) {
            if (e.data.size > 0) {
                //
                self.recordChunks.push(e.data);
                self.drawVideo();
                self.drawRect();
            }
        });

        this.recorder.addEventListener('stop', function(e) {
            // 停止时创建下载链接
            self.stopped = true;
        });

        this.recorder.start(interval || 10);
    };

    /**
     * 绘制视频
     */
    Camera.prototype.drawVideo = function() {
        const canvas = this.canvas.canvas;
        const ctx = this.canvas.ctx;
        const player = this.player.player;
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage(player, 0, 0, player.width, player.height);
        ctx.save();
    };

    /**
     * 绘制矩形
     * @returns {Promise<any | never>}
     */
    Camera.prototype.drawRect = function() {
        const ctx = this.canvas.ctx;
        const self = this;
        if (this.stopped) return;
        return this.requestDistinguish().then(function(rect) {
            if (self.stopped) return;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#f00";
            ctx.strokeWidth=1;
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            return rect;
        });
    };

    /**
     * 模拟请求后端视频识别接口，返回一个矩形的坐标
     * @returns {Promise<any>}
     */
    Camera.prototype.requestDistinguish = function() {
        const minWidth = 50;
        const minHeight = 50;

        const width = this.canvas.canvas.width;
        const height = this.canvas.canvas.height;

        var cordx = 0, cordy = 0, rectWidth = minWidth, rectHeight = minHeight;
        rectWidth = Math.max(Math.ceil(Math.random() * width / 2), minWidth);
        rectHeight = Math.max(Math.ceil(Math.random() * height / 2), minHeight);
        cordx = Math.floor(Math.random() * (width - rectWidth));
        cordy = Math.floor(Math.random() * (height - rectHeight));

        let _resolve;
        // 模拟接口调用，延迟100ms返回坐标
        setTimeout(() => {
            _resolve({
                x: cordx,
                y: cordy,
                width: rectWidth,
                height: rectHeight
            });
        }, 100);
        return new Promise((resolve, reject) => {
            _resolve = resolve;
        });
    };

    /**
     * 停止录制
     */
    Camera.prototype.stopRecord = function() {
        if (this.recorder) {
            this.recorder.stop();
            this.recorder = null;
        }
        this.stopCanvasRecord();
        this.stopped = true;
    };

    /**
     * 开始录制Canvas,包括视频和绘制的矩形框
     * @param interval
     */
    Camera.prototype.startCanvasRecord = function(interval) {
        const self = this;
        const canvas = this.canvas.canvas;

        // 清空结果展示区域
        var container = document.querySelector('#record-results');
        while(container.hasChildNodes())
        {
            container.removeChild(container.firstChild);
        }

        const stream = canvas.captureStream(60);
        const options = {mimeType: 'video/webm'};
        this.canvasRecordChunks = [];
        this.canvasRecorder = new MediaRecorder(stream, options);

        this.canvasRecorder.addEventListener('dataavailable', function (e) {
            if (e.data.size > 0) {
                self.canvasRecordChunks.push(e.data);
            }
        });

        this.canvasRecorder.addEventListener('stop', function() {
            var href = URL.createObjectURL(new Blob(self.canvasRecordChunks));
            self.canvasRecordLink.setHref(href);
            self.canvasRecordLink.link.download = 'acetest.webm';

            var video = new Player();
            video.setSource(href);
            video.player.style.display = 'inline-block';
            video.attach(container);
        });

        this.canvasRecorder.start(interval || 10);
    };

    /**
     * 停止Canvas录制
     */
    Camera.prototype.stopCanvasRecord = function() {
        if (this.canvasRecorder) {
            this.canvasRecorder.stop();
            this.canvasRecorder = null;
        }
    };


    var Demo = function() {
        this.cameras = [];
        this.isCameraReady = false;

        this.bindEvents();
    };

    /**
     * 准备摄像头
     * @returns {Promise<Array | never>}
     */
    Demo.prototype.prepareCameras = function() {
        const self = this;
        this.cameras = [];
        return navigator.mediaDevices.enumerateDevices().then(ds => {
            let cameraDevices = ds.filter(function (device) {
                return device.kind === 'videoinput';
            });
            const container = document.querySelector('#camera-area');
            cameraDevices.forEach(function(device, index) {
                var canvas = new Canvas();
                canvas.attach(container);
                var player = new Player();
                player.attach(container);
                var cap = device.getCapabilities();
                let rect = {
                    width: cap.width.max,
                    height: cap.height.max
                };
                canvas.setRect(rect);
                player.setRect(rect);

                var link = new DownloadLink();
                link.setLabel('下载canvas record' + (index + 1));
                link.attach(document.querySelector('.download-links'));

                self.cameras.push(new Camera({
                    canvas: canvas,
                    player: player,
                    device: device,
                    link: link
                }));
            });
            self.isCameraReady = true;
            return self.cameras;
        });
    };

    Demo.prototype.start = function() {
        if (!this.isCameraReady) {
            alert('正在准备摄像头,请稍后');
            return;
        }
        this.cameras.forEach(function(camera) {
            camera.requestMedia().then(function(stream) {
                camera.startRecord(stream, 10);
            });
        });
    };

    Demo.prototype.stop = function() {
        this.cameras.forEach(function(camera) {
            camera.stopRecord();
        });
    };

    Demo.prototype.bindEvents = function() {
        const self = this;
        document.querySelector('#start').addEventListener('click', function() {
            self.start();
        });
        document.querySelector('#stop').addEventListener('click', function() {
            self.stop();
        });
    };

    let demo = new Demo();
    demo.prepareCameras();
})();