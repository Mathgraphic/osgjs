/** -*- compile-command: "jslint-cli Viewer.js" -*-
 * Authors:
 *  Cedric Pinson <cedric.pinson@plopbyte.com>
 */


osgViewer.Viewer = function(canvas, options, error) {
    if (options === undefined) {
        options = {antialias : true};
    }

    gl = WebGLUtils.setupWebGL(canvas, options, error );
    if (gl) {
        this._gl = gl;
        osg.init();
        this._canvas = canvas;
        this._frameRate = 60.0;
        osgUtil.UpdateVisitor = osg.UpdateVisitor;
        osgUtil.CullVisitor = osg.CullVisitor;
        this._urlOptions = true;

        this._mouseWheelEventNode = canvas;
        this._mouseEventNode = canvas;
        this._keyboardEventNode = document;
        if (options) {
            if(options.mouseWheelEventNode){
                this._mouseWheelEventNode = options.mouseWheelEventNode;
            }
            if(options.mouseEventNode){
                this._mouseEventNode = options.mouseEventNode;
            }
            if(options.mouseWheelEventNode){
                this._keyboardEventNode = options.keyboardEventNode;
            }
        }

        osgViewer.View.call(this);
        this.setUpView(canvas);
    } else {
        throw "No WebGL implementation found";
    }
};


osgViewer.Viewer.prototype = osg.objectInehrit(osgViewer.View.prototype, {

    init: function() {
        this._done = false;
        this._state = new osg.State();

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        this._updateVisitor = new osgUtil.UpdateVisitor();
        this._cullVisitor = new osgUtil.CullVisitor();

        this._renderStage = new osg.RenderStage();
        this._stateGraph = new osg.StateGraph();

        if (this._urlOptions) {
            this.parseOptions();
        }
    },

    parseOptions: function() {

        var optionsURL = function() {
            var vars = [], hash;
            var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
            for(var i = 0; i < hashes.length; i++)
            {
                hash = hashes[i].split('=');
                vars.push(hash[0]);
                vars[hash[0]] = hash[1];
            }
            return vars;
        };
        
        var options = optionsURL();

        if (options['stats'] === "1" || options['STATS'] === "1" || options['Stats'] === "1" ) {
            this.initStats(options);
        }

        // not the best way to do it
        if (options['DEPTH_TEST'] === "0") {
            this._gl.disable(gl.DEPTH_TEST);
        }
        if (options['BLEND'] === "0") {
            this._gl.disable(gl.BLEND);
        }
        if (options['CULL_FACE'] === "0") {
            this._gl.disable(gl.CULL_FACE);
        }
        if (options['LIGHT'] === "0") {
            this.setLightingMode(osgViewer.View.LightingMode.NO_LIGHT);
        }
    },

    initStats: function(options) {

        var maxMS = 50;
        var stepMS = 10;
        var fontsize = 14;

        if (options['statsMaxMS'] !== undefined) {
            maxMS = parseInt(options['statsMaxMS']);
        }
        if (options['statsStepMS'] !== undefined) {
            stepMS = parseInt(options['statsStepMS']);
        }

        var createDomElements = function (elementToAppend) {
            var dom = [
                "<div id='StatsDiv' style='float: left; position: relative; width: 300px; height: 150px; z-index: 10;'>",
                "<div id='StatsLegends' style='position: absolute; left: 0px; font-size: " + fontsize +"px;color: #ffffff;'>",

                "<div id='frameRate' style='color: #00ff00;' > frameRate </div>",
                "<div id='frameTime' style='color: #ffff00;' > frameTime </div>",
                "<div id='updateTime' style='color: #d07b1f;'> updateTime </div>",
                "<div id='cullTime' style='color: #73e0ff;'> cullTime </div>",
                "<div id='drawTime' style='color: #ff0000;'> drawTime </div>",
                "<div id='fps'> </div>",
                
                "</div>",

                "<div id='StatsCanvasDiv' style='position: relative;'>",
                "<canvas id='StatsCanvasGrid' width='300' height='150' style='z-index:-1; position: absolute; background: rgba(14,14,14,0.8); ' ></canvas>",
                "<canvas id='StatsCanvas' width='300' height='150' style='z-index:8; position: absolute;' ></canvas>",
                "<canvas id='StatsCanvasFps' width='30' height='15' style='z-index:9; position: absolute; top: 130px' ></canvas>",
                "</div>",

                "</div>"
            ].join("\n");
            var parent;
            if (elementToAppend === undefined) {
                parent = document.body;
                //elementToAppend = "body";
            } else {
                parent = document.getElementById(elementToAppend);
            }

            //jQuery(dom).appendTo(elementToAppend);
            var mydiv = document.createElement('div');
            mydiv.innerHTML = dom;
            parent.appendChild(mydiv);

            var grid = document.getElementById("StatsCanvasGrid");
            var ctx = grid.getContext("2d");
            ctx.clearRect(0,0,grid.width, grid.height);

            var step = Math.floor(maxMS/stepMS).toFixed(0);
            var r = grid.height/step;
            ctx.strokeStyle = "rgb(70,70,70)";
            for (var i = 0, l = step; i < l; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i*r);
                ctx.lineTo(grid.width, i*r);
                ctx.stroke();
            }

            // setup the font for fps
            var cfps = document.getElementById("StatsCanvasFps");
            var ctx = cfps.getContext("2d");
            ctx.font = "14px Sans";

            return document.getElementById("StatsCanvas");
        };

        if (this._canvasStats === undefined || this._canvasStats === null) {
            this._canvasStats = createDomElements();
        }
        this._stats = new Stats.Stats(this._canvasStats);
        var that = this;
        this._frameRate = 1;
        this._frameTime = 0;
        this._updateTime = 0;
        this._cullTime = 0;
        this._drawTime = 0;
        var height = this._canvasStats.height;
        var ratio = height / maxMS;
        height = height - 2;
        var getStyle = function(el,styleProp)
        {
	    var x = document.getElementById(el);
	    if (x.style) {
		return x.style.getPropertyValue(styleProp);
            }
            return null;
        };
        this._stats.addLayer(getStyle("frameRate","color"), function(t) { 
            var v = (height)/60.0 * (1000/that._frameRate);
            if (v > height) {
                return height;
            }
            return v;} );
        this._stats.addLayer(getStyle("frameTime", "color"), function(t) { 
            var v = that._frameTime * ratio;
            if (v > height) {
                return height;
            }
            return v;} );
        this._stats.addLayer(getStyle("updateTime","color"), function(t) { 
            var v = that._updateTime * ratio;
            if (v > height) {
                return height;
            }
            return v;} );
        this._stats.addLayer(getStyle("cullTime","color"), function(t) { 
            var v = that._cullTime * ratio;
            if (v > height) {
                return height;
            }
            return v;} );
        this._stats.addLayer(getStyle("drawTime","color"), function(t) { 
            var v = that._drawTime * ratio;
            if (v > height) {
                return height;
            }
            return v;} );
    },

    update: function() {
        this.getScene().accept(this._updateVisitor);
    },
    cull: function() {
        // this part of code should be called for each view
        // right now, we dont support multi view
        this._stateGraph.clean();
        this._renderStage.reset();

        this._cullVisitor.reset();
        this._cullVisitor.setStateGraph(this._stateGraph);
        this._cullVisitor.setRenderStage(this._renderStage);
        var camera = this.getCamera();
        this._cullVisitor.pushStateSet(camera.getStateSet());
        this._cullVisitor.pushProjectionMatrix(camera.getProjectionMatrix());
        this._cullVisitor.pushModelviewMatrix(camera.getViewMatrix());
        this._cullVisitor.pushViewport(camera.getViewport());
        this._cullVisitor.setCullSettings(camera);

        this._renderStage.setClearDepth(camera.getClearDepth());
        this._renderStage.setClearColor(camera.getClearColor());
        this._renderStage.setClearMask(camera.getClearMask());
        this._renderStage.setViewport(camera.getViewport());


        this.getScene().accept(this._cullVisitor);
    },
    draw: function() {
        this._renderStage.draw(this._state);

        // noticed that we accumulate lot of stack, maybe because of the stateGraph
        this._state.popAllStateSets();
        // should not be necessary because of dirty flag now in attrubutes
        //this.state.applyWithoutProgram();
    },

    frame: function() {
        var frameTime, beginFrameTime;
        frameTime = (new Date()).getTime();
        if (this._lastFrameTime === undefined) {
            this._lastFrameTime = 0;
        }
        this._frameRate = frameTime - this._lastFrameTime;
        this._lastFrameTime = frameTime;
        beginFrameTime = frameTime;

        var frameStamp = this.getFrameStamp();

        if (frameStamp.getFrameNumber() === 0) {
            frameStamp.setReferenceTime(frameTime/1000.0);
            this._numberFrame = 0;
        }

        frameStamp.setSimulationTime(frameTime/1000.0 - frameStamp.getReferenceTime());

        if (this.getManipulator()) {
            this.getCamera().setViewMatrix(this.getManipulator().getInverseMatrix());
        }

        // setup framestamp
        this._updateVisitor.setFrameStamp(this.getFrameStamp());
        //this._cullVisitor.setFrameStamp(this.getFrameStamp());


        // time the update
        var updateTime = (new Date()).getTime();
        this.update();

        var cullTime = (new Date()).getTime();
        updateTime = cullTime - updateTime;
        this._updateTime = updateTime;

        this.cull();
        var drawTime = (new Date()).getTime();
        cullTime = drawTime - cullTime;
        this._cullTime = cullTime;

        this.draw();
        drawTime = (new Date()).getTime() - drawTime;
        this._drawTime = drawTime;

        var f = frameStamp.getFrameNumber()+1;
        frameStamp.setFrameNumber(f);

        this._numberFrame++;
        var endFrameTime = (new Date()).getTime();

        this._frameTime = (new Date()).getTime() - beginFrameTime;
        if (this._stats !== undefined) {
            this._stats.update();

            if (this._numberFrame % 60 === 0.0) {
                var nd = endFrameTime;
                var diff = nd - this._statsStartTime;
                var fps = (this._numberFrame*1000/diff).toFixed(1);
                this._statsStartTime = nd;
                this._numberFrame = 0;

                var cfps = document.getElementById("StatsCanvasFps");
                var ctx = cfps.getContext("2d");
                ctx.clearRect(0,0,cfps.width, cfps.height);
                ctx.fillStyle = "rgb(255,255,255)";
                ctx.fillText(fps, 0, cfps.height);
            }
        }
    },

    setDone: function() { this._done = true; },
    done: function() { return this._done; },

    run: function() {
        var that = this;
        var render = function() {
            if (!that.done()) {
                window.requestAnimationFrame(render, that.canvas);
                that.frame();
            }
        };
        render();
    },

    setupManipulator: function(manipulator, dontBindDefaultEvent) {
        if (manipulator === undefined) {
            manipulator = new osgGA.OrbitManipulator();
        }

        if (manipulator.setNode !== undefined) {
            manipulator.setNode(this.getSceneData());
        } else {
            // for backward compatibility
            manipulator.view = this;
        }

        this.setManipulator(manipulator);

        var that = this;
        var viewer = this;
	var fixEvent = function( event ) {

	    //if ( event[ expando ] ) {
		//return event;
	    //}

	    // store a copy of the original event object
	    // and "clone" to set read-only properties

            // nop
	    //var originalEvent = event;
	    //event = jQuery.Event( originalEvent );

	    for ( var i = this.props.length, prop; i; ) {
		prop = this.props[ --i ];
		event[ prop ] = originalEvent[ prop ];
	    }

	    // Fix target property, if necessary
	    if ( !event.target ) {
		event.target = event.srcElement || document; // Fixes #1925 where srcElement might not be defined either
	    }

	    // check if target is a textnode (safari)
	    if ( event.target.nodeType === 3 ) {
		event.target = event.target.parentNode;
	    }

	    // Add relatedTarget, if necessary
	    if ( !event.relatedTarget && event.fromElement ) {
		event.relatedTarget = event.fromElement === event.target ? event.toElement : event.fromElement;
	    }

	    // Calculate pageX/Y if missing and clientX/Y available
	    if ( event.pageX == null && event.clientX != null ) {
		var doc = document.documentElement, body = document.body;
		event.pageX = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
		event.pageY = event.clientY + (doc && doc.scrollTop  || body && body.scrollTop  || 0) - (doc && doc.clientTop  || body && body.clientTop  || 0);
	    }

	    // Add which for key events
	    if ( !event.which && ((event.charCode || event.charCode === 0) ? event.charCode : event.keyCode) ) {
		event.which = event.charCode || event.keyCode;
	    }

	    // Add metaKey to non-Mac browsers (use ctrl for PC's and Meta for Macs)
	    if ( !event.metaKey && event.ctrlKey ) {
		event.metaKey = event.ctrlKey;
	    }

	    // Add which for click: 1 === left; 2 === middle; 3 === right
	    // Note: button is not normalized, so don't use it
	    if ( !event.which && event.button !== undefined ) {
		event.which = (event.button & 1 ? 1 : ( event.button & 2 ? 3 : ( event.button & 4 ? 2 : 0 ) ));
	    }

	    return event;
	};

        manipulator.convertEventToCanvas = function(e) {
            var myObject = that._canvas;
            var posx,posy;
	    if (e.pageX || e.pageY) {
	        posx = e.pageX;
	        posy = e.pageY;
	    }
	    else if (e.clientX || e.clientY) {
	        posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
	        posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
	    }

            var divGlobalOffset = function(obj) {
                var x=0, y=0;
                x = obj.offsetLeft;
                y = obj.offsetTop;
                var body = document.getElementsByTagName('body')[0];
                while (obj.offsetParent && obj!=body){
                    x += obj.offsetParent.offsetLeft;
                    y += obj.offsetParent.offsetTop;
                    obj = obj.offsetParent;
                }
                return [x,y];
            };
	    // posx and posy contain the mouse position relative to the document
	    // Do something with this information
            var globalOffset = divGlobalOffset(myObject);
            posx = posx - globalOffset[0];
            posy = myObject.height-(posy - globalOffset[1]);
            return [posx,posy];
        };

        if (dontBindDefaultEvent === undefined || dontBindDefaultEvent === false) {

            var disableMouse = false;

            var touchDown = function(ev)
            {
                disableMouse = true;
                return viewer.getManipulator().touchDown(ev);
            };
            var touchUp = function(ev)
            {
                disableMouse = true;
                return viewer.getManipulator().touchUp(ev);
            };
            var touchMove = function(ev)
            {
                disableMouse = true;
                return viewer.getManipulator().touchMove(ev);
            };

            // touch events
            this._canvas.addEventListener("MozTouchDown", touchDown, false);
            this._canvas.addEventListener("MozTouchUp", touchUp, false);
            this._canvas.addEventListener("MozTouchMove", touchMove, false);

            // mouse
            var mousedown = function (ev)
            {
                if (disableMouse === false) {
                    return viewer.getManipulator().mousedown(ev);
                }
            };
            var mouseup = function (ev)
            {
                if (disableMouse === false) {
                    return viewer.getManipulator().mouseup(ev);
                }
            };
            var mousemove = function (ev)
            {
                if (disableMouse === false) {
                    return viewer.getManipulator().mousemove(ev);
                }
            };
            var dblclick = function (ev)
            {
                if (disableMouse === false) {
                    return viewer.getManipulator().dblclick(ev);
                }
            };
            var mousewheel = function (event)
            {
                if (disableMouse === false) {
                    // from jquery
                    var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, returnValue = true, deltaX = 0, deltaY = 0;
                    //event = $.event.fix(orgEvent);
                    event.type = "mousewheel";
                    
                    // Old school scrollwheel delta
                    if ( event.wheelDelta ) { delta = event.wheelDelta/120; }
                    if ( event.detail     ) { delta = -event.detail/3; }
                    
                    // New school multidimensional scroll (touchpads) deltas
                    deltaY = delta;
                    
                    // Gecko
                    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
                        deltaY = 0;
                        deltaX = -1*delta;
                    }
                    
                    // Webkit
                    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
                    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
                    // Add event and delta to the front of the arguments
                    args.unshift(event, delta, deltaX, deltaY);
                    var m = viewer.getManipulator();
                    return m.mousewheel.apply(m, args);
                }
            };

            if (viewer.getManipulator().mousedown) {
                this._mouseEventNode.addEventListener("mousedown", mousedown, false);
            }
            if (viewer.getManipulator().mouseup) {
                this._mouseEventNode.addEventListener("mouseup", mouseup, false);
            }
            if (viewer.getManipulator().mousemove) {
                this._mouseEventNode.addEventListener("mousemove", mousemove, false);
            }
            if (viewer.getManipulator().dblclick) {
                this._mouseEventNode.addEventListener("dblclick", dblclick, false);
            }
            if (viewer.getManipulator().mousewheel) {
                this._mouseWheelEventNode.addEventListener("DOMMouseScroll", mousewheel, false);
                this._mouseWheelEventNode.addEventListener("mousewheel", mousewheel, false);
            }

            var keydown = function(ev) {return viewer.getManipulator().keydown(ev); };
            var keyup = function(ev) {return viewer.getManipulator().keyup(ev);};

            if (viewer.getManipulator().keydown) {
                this._keyboardEventNode.addEventListener("keydown", keydown, false);
            }
            if (viewer.getManipulator().keyup) {
                this._keyboardEventNode.addEventListener("keyup", keyup, false);
            }
        }
    }
});